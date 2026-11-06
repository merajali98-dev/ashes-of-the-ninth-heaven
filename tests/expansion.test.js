import assert from 'node:assert/strict';
import test from 'node:test';
import { cards } from '../js/content.js';
import { ironCards } from '../js/content/expansion/iron.js';
import { emberCards } from '../js/content/expansion/ember.js';
import { tideCards } from '../js/content/expansion/tide.js';
import { shadeCards } from '../js/content/expansion/shade.js';
import { lotusCards } from '../js/content/expansion/lotus.js';
import { thunderCards } from '../js/content/expansion/thunder.js';
import { starCards } from '../js/content/expansion/star.js';
import { neutralCards } from '../js/content/expansion/neutral.js';
import { createCombat, playCard, endTurn, previewEndTurn, captureCombatEvents,
  resolveTechnique, techniqueRules, STATUS_INFO } from '../js/combat.js';
import { cardForm, CARD_TYPES } from '../js/card-frame.js';
import * as progression from '../js/progression.js';

const schools = {iron:ironCards,ember:emberCards,tide:tideCards,shade:shadeCards,
  lotus:lotusCards,thunder:thunderCards,star:starCards,neutral:neutralCards};
const authored = Object.values(schools).flat();
const expansion = authored.map(card=>cards.find(entry=>entry.id===card.id)||card);
const effectTypes = new Set(['damage','block','heal','draw','energy','status','cleanse','recover','dispel']);
const newTypes = ['hex','formation','stance','counter','pact','ritual','transmute','finisher'];
const payloads = card => [card.effects,card.bonusEffects,card.aura?.effects,card.delayed?.effects].filter(Boolean);
const byId = id => {
  const result = expansion.find(card => card.id === id);
  assert.ok(result, `Missing authored fixture ${id}`);
  return result;
};
const dummy = {id:'effigy',name:'Effigy',hp:10000,intents:[{name:'Wait',effects:[]}]};
const filler = {id:'qa-filler',name:'Filler',kind:'skill',school:'neutral',cost:1,effects:[{type:'block',amount:1}]};
function battle(definitions,upgrade=0,extra={}) {
  return createCombat({cards:[...definitions,filler],deck:definitions.map(card=>({id:card.id,upgrade})),
    enemy:dummy,hp:50,maxHp:100,energy:30,draw:10,seed:42,...extra});
}
function play(state,id) {
  const result=playCard(state,state.hand.findIndex(entry=>entry.id===id));
  assert.equal(result.ok,true,`${id}: ${result.reason}`);
  return result;
}

test('all 480 authored techniques are registered with exact school, rarity and type coverage',()=>{
  assert.equal(expansion.length,480);
  assert.equal(new Set(expansion.map(card=>card.id)).size,480);
  const registry = new Map(cards.map(card=>[card.id,card]));
  for(const [school,entries] of Object.entries(schools)) {
    assert.equal(entries.length,60,school);
    for(const type of newTypes) assert.equal(entries.filter(card=>card.type===type).length,7,`${school}/${type}`);
    for(const type of ['strike','ward','mantra','remedy']) assert.equal(entries.filter(card=>card.type===type).length,1,`${school}/${type}`);
    for(const [rarity,count] of Object.entries({common:24,uncommon:20,rare:12,legendary:4}))
      assert.equal(entries.filter(card=>card.rarity===rarity).length,count,`${school}/${rarity}`);
    const signatures = new Map();
    for(const card of entries) {
      assert.equal(card.school,school,card.id);
      assert.ok(registry.has(card.id),`${card.id} missing from playable registry`);
      for(const field of ['effects','bonusEffects','aura','delayed','healthCost','condition','type','school'])
        assert.deepEqual(registry.get(card.id)[field],card[field],`${card.id} changed ${field} during registration`);
      const directDamage=[...card.effects,...card.bonusEffects||[]].some(effect=>effect.type==='damage');
      assert.equal(registry.get(card.id).kind,directDamage?'attack':'skill',card.id);
      const signature=JSON.stringify([card.cost,card.kind,card.effects,card.condition,card.bonusEffects,
        card.healthCost,card.aura,card.delayed,!!card.exhaust]);
      assert.ok(!signatures.has(signature),`${card.id} mechanically duplicates ${signatures.get(signature)}`);
      signatures.set(signature,card.id);
    }
  }
});

test('every immediate, conditional and scheduled payload has supported meaningful mechanics',()=>{
  for(const card of expansion) {
    assert.match(card.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(['attack','skill'].includes(card.kind),card.id);
    assert.ok(Number.isSafeInteger(card.cost)&&card.cost>=0&&card.cost<=3,card.id);
    assert.equal(cardForm(card),card.type,card.id);
    assert.ok(Object.hasOwn(CARD_TYPES,card.type),card.id);
    assert.ok(card.name&&card.flavor&&card.description&&!card.description.includes('undefined'),card.id);
    for(const effects of payloads(card)) {
      assert.ok(Array.isArray(effects)&&effects.length,card.id);
      for(const effect of effects) {
        assert.ok(effectTypes.has(effect.type),`${card.id}/${effect.type}`);
        assert.ok(Number.isSafeInteger(effect.amount)&&effect.amount>0,card.id);
        assert.ok(effect.target===undefined||['self','opponent'].includes(effect.target),card.id);
        if(effect.type==='status') assert.ok(Object.hasOwn(STATUS_INFO,effect.status),card.id);
        if(effect.hits!==undefined) assert.ok(effect.type==='damage'&&Number.isSafeInteger(effect.hits)&&effect.hits>0,card.id);
      }
    }
    if(card.condition) assert.ok(['guarded','wounded','afflicted','resonant','empty-hand'].includes(card.condition)&&card.bonusEffects?.length,card.id);
    if(card.school==='neutral') assert.notEqual(card.condition,'resonant',card.id);
    if(card.type==='pact') assert.ok(Number.isSafeInteger(card.healthCost)&&card.healthCost>0,card.id);
    if(card.healthCost) assert.ok(!card.effects.some(e=>e.type==='heal'),`${card.id} cancels its own vitality payment`);
    if(card.aura) {
      assert.ok([2,3].includes(card.aura.duration),card.id);
      assert.ok(['turn-start','turn-end','on-attack','on-guard','on-status'].includes(card.aura.trigger),card.id);
    }
    if(card.delayed) assert.ok([1,2].includes(card.delayed.turns),card.id);
    if(payloads(card).flat().some(e=>e.type==='recover')) assert.equal(card.exhaust,true,card.id);
    for(const mastery of [0,2]) assert.ok(techniqueRules(resolveTechnique(card,mastery)).every(rule=>rule&&!rule.includes('undefined')),card.id);
  }
});

test('all authored cards execute at base and maximum mastery with real useful effects',()=>{
  for(const card of expansion) for(const mastery of [0,2]) {
    const state=battle([card],mastery);
    // Give situational techniques a valid target without inventing a new combatant.
    state.player.block=2;
    state.player.statuses={poison:3,weak:3};
    state.enemy.statuses={burn:1,strength:5,focus:5,regen:5};
    state.resonance={element:card.school,count:2};
    state.cards[filler.id]=filler;
    state.drawPile=Array.from({length:20},()=>({id:filler.id,upgrade:0}));
    state.exhausted=Array.from({length:8},()=>({id:filler.id,upgrade:0}));
    const definitionsBefore=JSON.stringify(state.cards);
    const {events}=captureCombatEvents(state,()=>play(state,card.id));
    assert.ok(events.some(event=>['strike','guard','heal','draw','qi','status','cleanse','recover','dispel','aura','ritual'].includes(event.type)),`${card.id}+${mastery} has no useful action`);
    for(let turn=0;turn<4;turn++) {
      const before=structuredClone(state);
      const forecast=previewEndTurn(state);
      assert.deepEqual(state,before,`${card.id}+${mastery} forecast mutates live battle`);
      const resumed=JSON.parse(JSON.stringify(state));
      endTurn(state);endTurn(resumed);
      assert.deepEqual(state,resumed,`${card.id}+${mastery} changes after JSON resume`);
      assert.equal(state.player.hp,forecast.hp,card.id);
      assert.equal(state.enemy.hp,forecast.enemyHp,card.id);
    }
    assert.equal(JSON.stringify(state.cards),definitionsBefore,`${card.id} mutated authored definitions`);
    assert.equal(state.auras.length,0,`${card.id} did not expire`);
    assert.equal(state.rituals.length,0,`${card.id} did not resolve`);
    for(const n of [state.player.hp,state.enemy.hp,state.player.block,state.energy]) assert.ok(Number.isSafeInteger(n)&&n>=0,card.id);
  }
});

test('authored start-turn Qi survives turn refresh for every scheduled payout',()=>{
  const candidates=expansion.filter(card=>card.aura?.trigger==='turn-start'&&card.aura.effects.some(e=>e.type==='energy')||card.delayed?.effects.some(e=>e.type==='energy'));
  assert.ok(candidates.length>=4);
  for(const card of candidates) {
    const state=battle([card]);play(state,card.id);
    const count=card.aura?.duration||card.delayed.turns;
    for(let turn=1;turn<=count+1;turn++) {
      endTurn(state);
      const effects=card.aura&&turn<=card.aura.duration?card.aura.effects:card.delayed&&turn===card.delayed.turns?card.delayed.effects:[];
      const bonus=effects.filter(e=>e.type==='energy').reduce((sum,e)=>sum+e.amount,0);
      assert.equal(state.energy,state.maxEnergy+bonus,`${card.id}, payout turn ${turn}`);
    }
  }
});

test('delayed recovery cannot return its own exhausted source technique',()=>{
  const candidates=expansion.filter(card=>card.delayed?.effects.some(e=>e.type==='recover'));
  assert.ok(candidates.length>=4);
  for(const card of candidates) {
    const state=battle([card]);play(state,card.id);
    for(let turn=0;turn<card.delayed.turns;turn++) endTurn(state);
    assert.deepEqual(state.exhausted.map(entry=>entry.id),[card.id],card.id);
    assert.ok(![...state.hand,...state.discard,...state.drawPile].some(entry=>entry.id===card.id),card.id);
  }
});

test('authored attack stance fires once for a multi-hit cast and never for a ritual payload',()=>{
  const stance=byId('iron-scabbard-across-the-throat');
  const ritual=byId('iron-heat-the-judgment-brand');
  const attack=byId('thunder-cable-car-knuckle');
  const state=battle([stance,ritual,attack]);
  play(state,stance.id);
  assert.equal(state.player.block,2,'installing the stance does not trigger itself');
  play(state,ritual.id);
  assert.equal(state.player.block,4,'a delayed-damage skill is not an attack cast');
  play(state,attack.id);
  assert.equal(state.player.block,7,'multiple hits grant the stance bonus only once');
  endTurn(state);
  assert.equal(state.player.block,0,'delayed damage cannot trigger an action stance');
});

test('new free cards exhaust and action stances do not directly fund additional plays',()=>{
  for(const card of expansion) {
    if(card.cost===0) assert.equal(card.exhaust,true,`${card.id} offers repeatable free plays`);
    if(card.aura?.trigger.startsWith('on-')) assert.ok(!card.aura.effects.some(e=>['energy','draw','recover'].includes(e.type)),`${card.id} recursively funds a card cycle`);
    for(const mastery of [0,2]) {
      const resolved=resolveTechnique(card,mastery);
      if(!card.exhaust) {
        const immediateQi=resolved.effects.filter(e=>e.type==='energy').reduce((n,e)=>n+e.amount,0);
        assert.ok(immediateQi<card.cost,`${card.id}+${mastery} is a repeatable free action`);
      }
    }
  }
});

test('a delayed authored burst respects sealed enemy phase transitions',()=>{
  const card=byId('star-sentence-of-the-empty-throne');
  const state=battle([card],2,{enemy:{...dummy,hp:40,sealPhases:true,
    phases:[{at:.75,intents:[{name:'Second phase',effects:[]}]}]}});
  play(state,card.id);
  endTurn(state);endTurn(state);
  assert.equal(state.enemy.hp,30);
  assert.equal(state.enemy.phase,1);
  const attacker={id:'qa-burst',name:'Burst',kind:'attack',school:'neutral',cost:0,effects:[{type:'damage',amount:100}]};
  state.cards[attacker.id]=attacker;state.hand.push({id:attacker.id,upgrade:0});
  play(state,attacker.id);
  assert.equal(state.enemy.hp,30,'new phase remains sealed until its intent acts');
});

test('registered pending arts survive the actual campaign save validation and resume',()=>{
  const game=progression.freshGame(42);
  assert.equal(progression.begin(game,'Archivist').ok,true);
  assert.equal(progression.encounter(game,'blank-writ').ok,true);
  const art=byId('thunder-reservoir-of-cloudglass');
  const ritual=byId('tide-send-the-return-ferry');
  const state=game.active.combat;
  for(const card of [art,ritual]) {
    state.cards[card.id]=card;
    state.hand.push({id:card.id,upgrade:2});
  }
  state.energy=10;
  play(state,art.id);play(state,ritual.id);
  const loaded=progression.readSave(null,JSON.stringify(game));
  assert.equal(loaded.warning,undefined);
  assert.deepEqual(loaded.game.active.combat,state);
  endTurn(state);endTurn(loaded.game.active.combat);
  assert.deepEqual(loaded.game.active.combat,state);
  const malformed=structuredClone(game);
  malformed.active.combat.auras[0].source='unknown-technique';
  assert.ok(progression.readSave(null,JSON.stringify(malformed)).warning);
});

test('every expansion technique can be purchased once cultivation reaches all acquisition gates',()=>{
  const game=progression.freshGame(42);
  progression.begin(game,'Archivist');
  for(const mission of progression.missions) game.complete[mission.id]={choice:mission.choices?.[0].id??null};
  game.realm=6;game.essence=progression.REALMS[7].essence-1;
  game.jade=1_000_000;
  for(const card of expansion) {
    assert.equal(progression.learningRequirement(game,card),'',card.id);
    const copies=game.known[card.id]||0;
    const jade=game.jade;
    assert.equal(progression.learn(game,card.id).ok,true,card.id);
    assert.equal(game.known[card.id],copies+1,card.id);
    assert.equal(game.jade,jade-progression.learnCost(card),card.id);
  }
});

test('pure-Qi pact mastery adds useful Guard without increasing its Qi refund',()=>{
  for(const id of ['ember-swallow-the-live-coal','thunder-lease-a-heartbeat']) {
    const card=byId(id);
    const qi=card.effects.filter(effect=>effect.type==='energy').reduce((n,e)=>n+e.amount,0);
    for(const mastery of [0,1,2]) {
      const resolved=resolveTechnique(card,mastery);
      assert.equal(resolved.effects.filter(e=>e.type==='energy').reduce((n,e)=>n+e.amount,0),qi,id);
      const state=battle([card],mastery);
      const before=state.energy;
      play(state,id);
      assert.equal(state.energy,before-card.cost+qi,id);
      assert.equal(state.player.block,mastery*2,id);
      assert.equal(state.player.hp,50-card.healthCost,id);
      assert.equal(state.exhausted[0].id,id);
    }
  }
});

test('recovery excludes recovery-bearing techniques in every nested payload location',()=>{
  const recovery={type:'recover',amount:1};
  const variants=[
    {effects:[recovery]},
    {condition:'guarded',bonusEffects:[recovery]},
    {aura:{trigger:'turn-start',duration:2,effects:[recovery]}},
    {delayed:{turns:1,effects:[recovery]}},
  ].map((extra,i)=>({...filler,id:`qa-recovery-${i}`,exhaust:true,...extra}));
  const collector={...filler,id:'qa-collector',effects:[{type:'recover',amount:10}],exhaust:true};
  const state=battle([collector,...variants]);
  state.cards[filler.id]=filler;
  state.hand=state.hand.filter(entry=>entry.id===collector.id);
  state.exhausted=[{id:filler.id,upgrade:2},...variants.map(card=>({id:card.id,upgrade:2}))];
  play(state,collector.id);
  assert.deepEqual(state.discard,[{id:filler.id,upgrade:2}]);
  assert.deepEqual(state.exhausted.map(entry=>entry.id),[...variants.map(card=>card.id),collector.id]);
});
