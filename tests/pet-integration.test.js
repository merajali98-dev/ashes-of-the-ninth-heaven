import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import {cards} from '../js/content.js';
import {createCombat,playCard,getIntent,endTurn,previewEndTurn,usePetAbility,petAbilityStatus,captureCombatEvents} from '../js/combat.js';

const clone=value=>structuredClone(value);
const good=(result,label)=>assert.equal(result.ok,true,`${label}: ${result.reason}`);
function reject(state,action,label) {const before=clone(state);assert.equal(action().ok,false,label);assert.deepEqual(state,before,label);}
function ready() {const game=rules.freshGame(182);rules.begin(game,'Spirit QA');return game;}
function companion(id,realm=0) {
  const game=ready();game.realm=realm;game.essence=rules.REALMS[realm].essence;
  good(rules.hatchPet(game,id),'hatch');game.pets[id]={realm,essence:rules.REALMS[realm].essence};
  good(rules.equipPet(game,id),'equip');return game;
}
const dummy={id:'effigy',name:'Effigy',hp:10000,intents:[{name:'Wait',effects:[]}]};
function battle(id,realm=0,overrides={}) {
  return createCombat({cards,deck:['palm-strike','breath-ward','gather-qi'],enemy:dummy,
    hp:50,maxHp:100,energy:10,draw:3,seed:42,pet:rules.snapshotPet(companion(id,realm)),...overrides});
}
const read=game=>rules.readSave(null,JSON.stringify(game));

test('all 80 species/realm snapshots execute every unlocked ability with useful effects and exact cooldowns',()=>{
  let casts=0;
  for(const definition of rules.spiritPets)for(let realm=0;realm<10;realm++) {
    const expected=rules.previewPet(definition.id,realm);
    for(const ability of expected.abilities) {
      const state=battle(definition.id,realm);
      if(!ability.unlocked) {reject(state,()=>usePetAbility(state,ability.id),'locked ability');continue;}
      state.player.hp=40;state.player.statuses={...state.player.statuses,poison:3,bleed:3};
      state.enemy.statuses={strength:4,focus:4,regen:4};
      state.resonance={element:definition.school,count:2};
      const resources=()=>({energy:state.energy,resonance:clone(state.resonance),hand:clone(state.hand),drawPile:clone(state.drawPile),discard:clone(state.discard),exhausted:clone(state.exhausted),rng:state.rng});
      const before=resources();
      const {result,events}=captureCombatEvents(state,()=>usePetAbility(state,ability.id));
      good(result,`${definition.id}/${realm}/${ability.id}`);casts++;
      assert.ok(events.some(event=>['strike','guard','heal','status','cleanse','dispel'].includes(event.type)&&event.amount>0),ability.id);
      assert.deepEqual(resources(),before,'pet command does not consume or generate card resources or chain steps');
      assert.equal(state.pet.lastAbilityTurn,1);
      assert.equal(state.pet.readyAt[ability.id],1+ability.cooldown);
      for(const other of expected.abilities.filter(entry=>entry.unlocked))reject(state,()=>usePetAbility(state,other.id),'one global command per turn');
      for(let elapsed=1;elapsed<=ability.cooldown;elapsed++) {
        const original=clone(state),forecast=previewEndTurn(state);
        assert.deepEqual(state,original,'pet forecast must not alter cooldown or nested effects');
        const resumed=JSON.parse(JSON.stringify(state));endTurn(state);endTurn(resumed);
        assert.deepEqual(state,resumed,'pet JSON round-trip must preserve complete combat');
        assert.equal(state.player.hp,forecast.hp);assert.equal(state.enemy.hp,forecast.enemyHp);
        const status=petAbilityStatus(state,ability.id);
        assert.equal(status.remaining,Math.max(0,ability.cooldown-elapsed));
        assert.equal(status.ok,elapsed===ability.cooldown,ability.id);
        if(elapsed<ability.cooldown)reject(state,()=>usePetAbility(state,ability.id),'cooldown gate');
      }
      good(usePetAbility(state,ability.id),'ready exactly on casting turn plus cooldown');
    }
  }
  assert.equal(casts,240);
});

test('opening and repeating passives fire once at their own point and never activate action stances',()=>{
  for(const definition of rules.spiritPets)for(let realm=0;realm<10;realm++) {
    const state=battle(definition.id,realm);
    const expected=rules.previewPet(definition.id,realm).passives.filter(passive=>passive.unlocked);
    const opening=expected.find(passive=>passive.trigger==='opening');
    assert.equal(state.log.filter(line=>line===`${definition.name}: ${opening.name}.`).length,1);
    state.auras=['on-attack','on-guard','on-status'].map((trigger,index)=>({source:`qa-${index}`,name:'Forbidden recursion',school:'neutral',created:1,expires:20,trigger,duration:3,effects:[{type:'damage',amount:9999}]}));
    const {events}=captureCombatEvents(state,()=>{
      good(usePetAbility(state,definition.abilities[0].id),'direct pet command');
      endTurn(state);endTurn(state);endTurn(state);
    });
    assert.equal(events.filter(event=>event.type==='aura').length,0,definition.id);
    assert.equal(events.filter(event=>['resonance','draw','qi','recover'].includes(event.type)).length,0,definition.id);
    for(const passive of definition.passives) {
      const amount=events.filter(event=>event.type==='pet-passive'&&event.name===passive.name).length;
      assert.equal(amount,realm>=passive.unlockRealm&&passive.trigger!=='opening'?3:0,`${definition.id}/${realm}/${passive.id}`);
    }
  }
});

test('different ready abilities still share one command budget and invalid commands reject atomically',()=>{
  const state=battle('azure-dragon',9);
  good(usePetAbility(state,'cloudpiercer'),'first command');
  reject(state,()=>usePetAbility(state,'rain-seal'),'different ready ability denied same turn');
  endTurn(state);
  good(usePetAbility(state,'rain-seal'),'different ability available next turn');
  reject(state,()=>usePetAbility(state,'sky-rend'),'new turn also has one command limit');
  for(const id of ['missing','__proto__',null,3])reject(state,()=>usePetAbility(state,id),'invalid ability ID');
  const absent=createCombat({cards,deck:['palm-strike'],enemy:dummy,hp:50,maxHp:100});
  reject(absent,()=>usePetAbility(absent,'cloudpiercer'),'no selected companion');
  state.outcome='victory';reject(state,()=>usePetAbility(state,'sky-rend'),'finished battle');
});

test('pet commands and pet Burn honor phase seals and preserve the already announced enemy intent',()=>{
  const enemy={id:'sealed-foe',name:'Sealed foe',hp:100,sealPhases:true,
    intents:[{name:'Announced jab',effects:[{type:'damage',amount:2}]}],
    phases:[{at:.5,name:'Second seal',intents:[{name:'New heavy strike',effects:[{type:'damage',amount:20}]}]}]};
  const burst=battle('thunder-serpent',9,{enemy});burst.enemy.hp=54;
  good(usePetAbility(burst,'returning-thunder'),'multi-hit pet burst');
  assert.equal(burst.enemy.hp,50,'multi-hit cannot cross the seal');assert.equal(burst.enemy.phase,1);
  const state=battle('vermilion-phoenix',5,{enemy});state.enemy.hp=51;
  assert.equal(getIntent(state).name,'Announced jab');
  const {events}=captureCombatEvents(state,()=>endTurn(state));
  assert.equal(state.enemy.hp,50);assert.equal(state.enemy.phase,1);
  assert.deepEqual(events.filter(event=>event.type==='intent').map(event=>event.name),['Announced jab']);
  assert.equal(state.player.hp,50,'2 damage then the realm-five two-point phoenix heal, not the new phase strike');
});

test('pet lethal effects clear pending arts and cannot fire after victory or defeat',()=>{
  for(const source of ['active','passive']) {
    const state=battle('vermilion-phoenix',5);state.enemy.hp=1;
    state.auras=[{source:'qa-timed',name:'Delayed shelter',trigger:'turn-start',created:1,expires:4,duration:3,effects:[{type:'block',amount:5}]}];
    state.rituals=[{source:'qa-ritual',name:'Later',due:3,effects:[{type:'damage',amount:5}]}];
    const {events}=captureCombatEvents(state,()=>source==='active'?usePetAbility(state,'cinder-feather'):endTurn(state));
    assert.equal(state.outcome,'victory');assert.deepEqual(state.auras,[]);assert.deepEqual(state.rituals,[]);
    assert.equal(events.some(event=>event.type==='intent'),false);
    reject(state,()=>endTurn(state),'no passives after victory');
  }
  const state=battle('jade-qilin',9,{hp:1});state.player.statuses.poison=5;
  endTurn(state);
  assert.equal(state.outcome,'defeat','turn-start pet healing cannot revive a defeated owner');
  reject(state,()=>usePetAbility(state,'springstep'),'no active revival');
});

test('old saves initialize an empty sanctuary and preserve an existing battle without assigning a pet',()=>{
  for(const version of ['legacy','economy'])for(const fighting of [false,true]) {
    const game=ready();if(fighting)good(rules.encounter(game,'blank-writ'),'old battle');
    for(const key of ['petVersion','pets','activePetId'])delete game[key];
    if(version==='legacy')for(const key of ['economyVersion','cultivationVersion','materials','cardLevels','deckPresets','activeDeckId','deckDraft','tutorial'])delete game[key];
    const before=clone(game);const restored=read(game);
    assert.equal(restored.warning,undefined,version);assert.equal(restored.game.petVersion,1);
    assert.deepEqual(restored.game.pets,{});assert.equal(restored.game.activePetId,null);
    assert.deepEqual(restored.game.active,before.active);
    assert.deepEqual(read(restored.game).game,restored.game);
  }
});

test('actual pet battle saves reject altered definitions, impossible cooldown history and parent mismatch',()=>{
  const game=companion('azure-dragon',9);good(rules.encounter(game,'blank-writ'),'start real battle');
  good(rules.fight(game,'pet','cloudpiercer'),'dispatch command');
  assert.equal(read(game).warning,undefined);
  const cases=[
    g=>g.active.combat.pet.abilities[0].effects[0].amount++,
    g=>g.active.combat.pet.passives[0].effects[0].amount++,
    g=>g.active.combat.pet.abilities[0].cooldown=1,
    g=>g.active.combat.pet.readyAt.fake=3,
    g=>g.active.combat.pet.readyAt.cloudpiercer=99,
    g=>g.active.combat.pet.readyAt.cloudpiercer=0,
    g=>g.active.combat.pet.readyAt.cloudpiercer=1,
    g=>g.active.combat.pet.lastAbilityTurn=0,
    g=>g.active.combat.pet.readyAt={},
    g=>g.active.combat.pet.readyAt['rain-seal']=4,
    g=>g.active.combat.pet.lastAbilityTurn=2,
    g=>g.activePetId=null,
    g=>delete g.pets['azure-dragon'],
    g=>g.pets['azure-dragon'].essence++,
    g=>g.active.combat.pet.realm=8,
  ];
  for(const [index,mutate] of cases.entries()) {const altered=clone(game);mutate(altered);assert.ok(read(altered).warning,`invalid pet save case ${index}`);}
  const resumed=read(game).game;rules.fight(game,'end');rules.fight(resumed,'end');assert.deepEqual(game,resumed);
});

test('hatched selection snapshots exactly one pet, and feeding revalidates protected copies without refunding quality',()=>{
  const game=ready();good(rules.hatchPet(game,'azure-dragon'),'chosen first hatch');assert.equal(game.activePetId,null);
  good(rules.encounter(game,'blank-writ'),'unselected battle');assert.equal(game.active.combat.pet,undefined);good(rules.retreat(game),'return');
  good(rules.equipPet(game,'azure-dragon'),'deliberate selection');
  const food='iron-black-wax-citation';game.known[food]=4;game.cardLevels[food]=5;game.upgrades[food]=2;
  game.deckPresets.push({id:'deck-2',name:'Protected meal',cards:[...game.deck.slice(0,7),food]});
  game.deckDraft.cards=[food,food];
  const quote=rules.quoteFeed(game,'azure-dragon',food,2);assert.equal(quote.reserved,2);assert.equal(quote.available,2);
  game.deckDraft.cards.push(food);
  reject(game,()=>rules.feedPet(game,'azure-dragon',food,2),'stale quote cannot destroy newly reserved copy');
  const jade=game.jade,materials=clone(game.materials);good(rules.feedPet(game,'azure-dragon',food,1),'safe surplus');
  assert.equal(game.known[food],3);assert.equal(game.pets['azure-dragon'].essence,8);assert.equal(game.cardLevels[food],5);assert.equal(game.upgrades[food],2);
  assert.equal(game.jade,jade);assert.deepEqual(game.materials,materials);
  good(rules.encounter(game,'blank-writ'),'selected pet battle');const frozen=clone(game.active.combat.pet);
  assert.equal(frozen.id,'azure-dragon');assert.equal(frozen.level,1);
  for(const action of [()=>rules.equipPet(game,null),()=>rules.feedPet(game,'azure-dragon',food,1),()=>rules.hatchPet(game,'white-tiger'),()=>rules.evolvePet(game,'azure-dragon')])reject(game,action,'sanctuary transactions unavailable during battle');
  assert.deepEqual(game.active.combat.pet,frozen);
});
