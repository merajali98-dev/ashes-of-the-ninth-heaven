import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import {cards,starterDeck} from '../js/content.js';
import {createCombat,getCard,resolveTechnique,playCard,endTurn,previewEndTurn,useConsumable} from '../js/combat.js';
import {techniqueRules} from '../js/combat.js';
import {cardInspection} from '../js/workshop-views.js';
import {esc} from '../js/ui.js';

test('in-battle inspection uses stored legacy quality and disables sanctuary transactions',()=>{
  const game=rules.freshGame(42);rules.begin(game,'Legacy inspection');
  assert.equal(rules.encounter(game,'blank-writ').ok,true);
  const combat=game.active.combat;
  for(const entry of [...combat.hand,...combat.drawPile,...combat.discard,...combat.exhausted]) {
    delete entry.level;entry.upgrade=1;
    game.cardLevels[entry.id]=3;game.upgrades[entry.id]=1;
  }
  const card=getCard(combat,0);
  const inspection=cardInspection(game,card.id);
  for(const rule of techniqueRules(card))assert.ok(inspection.body.includes(esc(rule)),rule);
  assert.match(inspection.body,/Return from this expedition/);
  assert.match(inspection.body,/data-action="open-shop"[^>]*disabled/);
});

test('an unstarted legacy chronicle still receives the first-run guide',()=>{
  const legacy=rules.freshGame(24);
  for(const key of ['economyVersion','cultivationVersion','materials','cardLevels','deckPresets','deckDraft','activeDeckId','tutorial'])delete legacy[key];
  const restored=rules.readSave(null,JSON.stringify(legacy));
  assert.equal(restored.warning,undefined);
  assert.deepEqual(restored.game.tutorial,{version:1,sanctuary:0,battle:0});
});

function ready(seed=41) {const game=rules.freshGame(seed);rules.begin(game,'Workshop QA');return game;}
const read=game=>rules.readSave(null,JSON.stringify(game));
const snapshot=game=>structuredClone(game);
const positive=(result,label)=>assert.equal(result.ok,true,`${label}: ${result.reason}`);
function rejectUnchanged(game,action,label) {const before=snapshot(game);assert.equal(action().ok,false,label);assert.deepEqual(game,before,label);}
function perfected() {const game=ready();game.realm=9;game.essence=6500;game.jade=1_000_000;game.hp=rules.maxHp(game);return game;}
function forceVictory(game) {
  // Only the payout test uses an explicit QA damage effect; pacing simulations use legal cards.
  for(let phase=0;phase<=game.active.combat.phases.length&&!game.active.combat.outcome;phase++) {
    useConsumable(game.active.combat,[{type:'block',amount:100000},{type:'damage',amount:100000}]);
    if(!game.active.combat.outcome)endTurn(game.active.combat);
  }
  assert.equal(game.active.combat.outcome,'victory');
}
function holdings(game) {return {jade:game.jade,essence:game.essence,materials:{...game.materials},known:{...game.known}};}

test('legacy v1 realms and all old mastery ranks migrate once without rewriting active battles',()=>{
  const legacyHp=[0,8,17,29,44,61,83];
  const mapped=[0,1,2,3,4,5,7];
  for(let realm=0;realm<7;realm++)for(let upgrade=0;upgrade<3;upgrade++) {
    const game=ready();
    for(const key of ['cultivationVersion','economyVersion','materials','cardLevels','deckPresets','activeDeckId','deckDraft','tutorial'])delete game[key];
    game.realm=realm;game.essence=1500;game.hp=54+legacyHp[realm];game.upgrades={'palm-strike':upgrade};
    const enemy=rules.enemyById[rules.missionById['blank-writ'].enemy];
    const combat=createCombat({cards,deck:game.deck.map(id=>({id,upgrade:game.upgrades[id]||0})),enemy,hp:game.hp,maxHp:game.hp,seed:91});
    // A stored snapshot must remain authoritative even if the catalogue later changes.
    combat.cards['palm-strike']={...combat.cards['palm-strike'],effects:[{type:'damage',amount:9}]};
    delete combat.auras;delete combat.rituals;
    game.active={kind:'mission',id:'blank-writ',combat};
    const before=snapshot(game);
    const loaded=read(game);
    assert.equal(loaded.warning,undefined,`${realm}/${upgrade}`);
    assert.deepEqual(game,before,'readSave must not mutate its source');
    assert.equal(loaded.game.realm,mapped[realm]);
    assert.equal(loaded.game.cardLevels['palm-strike'],1+2*upgrade);
    assert.deepEqual(loaded.game.active,before.active);
    for(const key of ['known','deck','bag','jade','complete','upgrades','hp'])assert.deepEqual(loaded.game[key],before[key],key);
    assert.equal(loaded.game.tutorial.sanctuary,6);
    assert.equal(loaded.game.tutorial.battle,4);
    assert.deepEqual(read(loaded.game).game,loaded.game,'migration runs only once');
    const original=snapshot(before.active.combat);
    endTurn(original);endTurn(loaded.game.active.combat);
    assert.deepEqual(loaded.game.active.combat,original,'old combat has identical next round');
  }
});

test('malformed new economy, deck, tutorial and combat-level save fields are rejected',()=>{
  const cases=[
    game=>game.economyVersion=2,
    game=>game.materials={'unknown-material':1},
    game=>game.materials={'seal-jade-1':-1},
    game=>game.materials={'seal-jade-1':1.5},
    game=>game.cardLevels={'palm-strike':0},
    game=>game.cardLevels={'palm-strike':6},
    game=>game.cardLevels={'palm-strike':2.5},
    game=>{game.cardLevels={'palm-strike':5};game.upgrades={'palm-strike':0};},
    game=>game.activeDeckId='deck-9',
    game=>game.deckPresets[0].cards=['unknown-card'],
    game=>game.deckDraft.cards=['write-a-new-heaven'],
    game=>game.deckDraft.cards=Array(23).fill('palm-strike'),
    game=>game.tutorial.sanctuary=7,
    game=>game.tutorial.battle=-1,
    game=>{rules.encounter(game,'blank-writ');game.active.combat.hand[0].level=6;},
  ];
  for(const [index,change] of cases.entries()) {const game=ready();change(game);assert.ok(read(game).warning,`case ${index}`);}
});

test('all 597 techniques at all five levels use the same resolver in real combat, saves and forecasts',()=>{
  const dummy={id:'effigy',name:'Effigy',hp:100000,intents:[{name:'Wait',effects:[]}]};
  for(const card of cards) {
    let previous=null;
    for(let level=1;level<=5;level++) {
      const state=createCombat({cards,deck:[{id:card.id,level,upgrade:0}],enemy:dummy,hp:50,maxHp:100,energy:30,draw:1,seed:99});
      const resolved=getCard(state,0);
      assert.equal(state.hand[0].level,level,card.id);
      assert.deepEqual(resolved,resolveTechnique(card,0,{},level),`${card.id} Lv${level}`);
      assert.equal(resolved.upgrade,Math.floor((level-1)/2),card.id);
      if(previous)assert.notDeepEqual(resolved.effects,previous.effects,`${card.id} paid level ${level} has no effect`);
      const legacy=resolveTechnique(card,Math.floor((level-1)/2));
      const sumBlock=value=>value.effects.filter(e=>e.type==='block'&&e.target!=='opponent').reduce((n,e)=>n+e.amount,0);
      assert.equal(sumBlock(resolved)-sumBlock(legacy),Math.floor(level/2),`${card.id} extra Guard budget`);
      for(const type of ['energy','draw','recover'])assert.deepEqual(resolved.effects.filter(e=>e.type===type),legacy.effects.filter(e=>e.type===type),`${card.id} extra resource scaling`);
      for(const key of ['aura','delayed','bonusEffects'])assert.deepEqual(resolved[key],legacy[key],card.id);
      state.player.block=1;state.player.statuses={poison:2};state.enemy.statuses={burn:1,strength:3};
      state.resonance={element:card.school,count:2};
      positive(playCard(state,0),`${card.id} Lv${level}`);
      for(let round=0;round<3;round++) {
        const before=snapshot(state);const forecast=previewEndTurn(state);
        assert.deepEqual(state,before,card.id);
        const resumed=JSON.parse(JSON.stringify(state));endTurn(state);endTurn(resumed);
        assert.deepEqual(state,resumed,card.id);
        assert.equal(state.player.hp,forecast.hp,card.id);assert.equal(state.enemy.hp,forecast.enemyHp,card.id);
      }
      previous=resolved;
    }
  }
});

test('named deck editing preserves active snapshots, incomplete drafts and maximum reservations',()=>{
  const game=ready();const active=snapshot(game.deck);const originalId=game.activeDeckId;
  positive(rules.beginDeckDraft(game,'new'),'new draft');
  positive(rules.renameDeckDraft(game,'Patient Lotus'),'rename');
  positive(rules.editDeckDraft(game,'palm-strike',1),'add owned');
  assert.deepEqual(game.deck,active);
  rejectUnchanged(game,()=>rules.saveDeckDraft(game),'incomplete draft cannot become ready preset');
  const restored=read(game);assert.equal(restored.warning,undefined);assert.deepEqual(restored.game.deckDraft,game.deckDraft);
  game.deckDraft.cards=[...active];
  positive(rules.saveDeckDraft(game),'save ready deck');
  const secondId=game.deckDraft.sourceId;assert.notEqual(secondId,originalId);
  const reserved=active.filter(id=>id==='palm-strike').length;
  assert.equal(rules.reservedCopies(game,'palm-strike'),reserved,'shared presets reserve max, not sum');
  positive(rules.activateDeck(game,secondId),'activate');
  rejectUnchanged(game,()=>rules.deleteDeck(game,secondId),'active preset protected');
  positive(rules.deleteDeck(game,originalId),'delete inactive');
  positive(rules.beginDeckDraft(game,'new'),'independent draft');
  game.known['breath-ward']=4;
  game.deckDraft.cards=Array(4).fill('breath-ward');
  assert.equal(rules.reservedCopies(game,'breath-ward'),4,'incomplete draft also reserves owned copies');
  rejectUnchanged(game,()=>rules.salvageCard(game,'breath-ward'),'draft protected');
  positive(rules.beginDeckDraft(game,secondId),'cancel draft by reopening saved');
  positive(rules.salvageCard(game,'breath-ward'),'only surplus dismantles');
  assert.equal(game.known['breath-ward'],3);
  positive(rules.encounter(game,'blank-writ'),'battle');
  for(const action of [()=>rules.beginDeckDraft(game,'new'),()=>rules.activateDeck(game,secondId),()=>rules.deleteDeck(game,secondId),()=>rules.editDeckDraft(game,'palm-strike',-1)])rejectUnchanged(game,action,'editing blocked in battle');
});

test('encounter entry revalidates legal deck size and ownership atomically',()=>{
  for(const change of [game=>game.deck=['palm-strike'],game=>game.deck[0]='write-a-new-heaven']) {
    for(const start of [game=>rules.encounter(game,'blank-writ'),game=>rules.startBounty(game,'iron',1)]) {
      const game=ready();change(game);rejectUnchanged(game,()=>start(game),'invalid active deck');
    }
  }
});

test('deck drafts enforce ownership, four-copy and 22-card bounds, and saved preset capacity',()=>{
  const game=ready();
  for(let index=2;index<=8;index++) {
    positive(rules.beginDeckDraft(game,'new'),'new preset draft');
    game.deckDraft.cards=[...starterDeck];
    positive(rules.saveDeckDraft(game,`Deck ${index}`),'save within capacity');
  }
  positive(rules.beginDeckDraft(game,'new'),'new draft at capacity');
  game.deckDraft.cards=[...starterDeck];
  rejectUnchanged(game,()=>rules.saveDeckDraft(game,'Ninth deck'),'eight preset limit');
  rejectUnchanged(game,()=>rules.saveDeckDraft(game,'Deck 2'),'duplicate names');
  game.deckDraft.cards=[];
  rejectUnchanged(game,()=>rules.editDeckDraft(game,'write-a-new-heaven',1),'unowned technique');
  game.known['palm-strike']=6;
  for(let index=0;index<4;index++)positive(rules.editDeckDraft(game,'palm-strike',1),'four copies');
  rejectUnchanged(game,()=>rules.editDeckDraft(game,'palm-strike',1),'earned excess does not increase draft copy limit');
  for(const card of cards.slice(1,7)) {
    game.known[card.id]=4;
    while(game.deckDraft.cards.length<22&&game.deckDraft.cards.filter(id=>id===card.id).length<4)
      positive(rules.editDeckDraft(game,card.id,1),'fill legal slots');
  }
  assert.equal(game.deckDraft.cards.length,22);
  const extra=cards[7].id;game.known[extra]=1;
  rejectUnchanged(game,()=>rules.editDeckDraft(game,extra,1),'22 card limit');
  const invalidPreset=game.deckPresets[1];invalidPreset.cards[0]='write-a-new-heaven';
  rejectUnchanged(game,()=>rules.activateDeck(game,invalidPreset.id),'activation rechecks ownership');
});

test('commissions pay exact targeted rewards only after victory, once, and remain repeatable',()=>{
  for(const tier of [1,2,3,4,5]) {
    const game=perfected();
    const offer=rules.bountyOffer(game,'ember',tier);const original=holdings(game);
    positive(rules.startBounty(game,'ember',tier),'start commission');
    assert.deepEqual(holdings(game),original,'starting gives no reward');
    assert.equal(game.active.combat.enemy.maxHp,Math.ceil(offer.enemy.hp*offer.scale));
    rejectUnchanged(game,()=>rules.resolveEncounter(game),'cannot claim before victory');
    const restored=read(game);assert.equal(restored.warning,undefined);assert.deepEqual(restored.game.active,game.active);
    forceVictory(game);positive(rules.resolveEncounter(game),'claim victory');
    assert.equal(game.jade,original.jade+offer.rewards.gold);
    assert.equal(game.essence,original.essence+offer.rewards.essence);
    assert.deepEqual(game.materials,offer.rewards.materials);
    rejectUnchanged(game,()=>rules.resolveEncounter(game),'reward cannot be claimed twice');
    positive(rules.startBounty(game,'ember',tier),'repeat commission');forceVictory(game);positive(rules.resolveEncounter(game),'repeat reward');
    for(const [id,n] of Object.entries(offer.rewards.materials))assert.equal(game.materials[id],n*2);
  }
});

test('commission gates, retreat and defeat cannot create currency or materials',()=>{
  const locked=ready();rejectUnchanged(locked,()=>rules.startBounty(locked,'iron',2),'tier gate');
  for(const [school,tier] of [['invalid',1],['iron',0],['iron',6],['iron',1.5]])rejectUnchanged(locked,()=>rules.startBounty(locked,school,tier),'invalid offer');
  for(const outcome of ['withdraw','defeat']) {
    const game=ready();const before=holdings(game);positive(rules.startBounty(game,'iron',1),'start');
    if(outcome==='withdraw')positive(rules.retreat(game),'retreat');
    else {game.active.combat.player.hp=0;endTurn(game.active.combat);positive(rules.resolveEncounter(game),'resolve defeat');}
    assert.equal(game.active,null);assert.deepEqual(game.materials,before.materials);assert.equal(game.essence,before.essence);
    assert.deepEqual(game.known,before.known);assert.ok(game.jade<=before.jade);
  }
});

test('manual buying cannot bypass acquisition gates or undercut the canonical card price',()=>{
  const game=ready();game.jade=100000;
  for(const mission of rules.missions)game.complete[mission.id]={choice:mission.choices?.[0].id??null};
  const manuals=rules.items.filter(item=>item.card);
  for(const item of manuals) {
    assert.ok(rules.price(item,game)>=rules.cardPrice(item.card),item.id);
    if(rules.cardRequirement(item.card).level>1) {
      rejectUnchanged(game,()=>rules.trade(game,item.id,'order'),item.id);
      rejectUnchanged(game,()=>rules.learn(game,item.card),item.card);
    }
  }
  const earned=manuals.find(item=>rules.cardRequirement(item.card).level>1&&!game.known[item.card]);
  game.bag[earned.id]=1;
  positive(rules.study(game,earned.id),'earned manual remains usable below acquisition gate');
  assert.equal(game.known[earned.card],1);
});
