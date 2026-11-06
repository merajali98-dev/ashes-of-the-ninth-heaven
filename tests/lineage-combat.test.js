import assert from 'node:assert/strict';
import test from 'node:test';
import {createCombat,playCard,endTurn,previewEndTurn,captureCombatEvents} from '../js/combat.js';

const damage = amount => ({type:'damage',amount});
const block = amount => ({type:'block',amount});
const status = (id,amount,target='opponent') => ({type:'status',status:id,amount,target});
function battle(definitions,overrides={}) {
  return createCombat({cards:definitions,deck:definitions.map(card=>card.id),draw:10,energy:10,
    hp:50,maxHp:60,seed:42,enemy:{id:'effigy',name:'Effigy',hp:200,intents:[{name:'Strike',effects:[damage(3)]}]},...overrides});
}
const card = (id,effects,extra={}) => ({id,name:id,cost:1,school:'iron',
  kind:effects.some(effect => effect.type === 'damage') ? 'attack' : 'skill',effects,...extra});
const play = (state,id) => playCard(state,state.hand.findIndex(entry=>entry.id===id));

test('conditional bonuses snapshot the hand, vitality and enemy before effects',() => {
  const hex = card('hex',[status('poison',2)],{condition:'afflicted',bonusEffects:[damage(9)]});
  const pact = card('pact',[block(2)],{healthCost:6,condition:'wounded',bonusEffects:[damage(11)]});
  const finish = card('finish',[damage(4),{type:'draw',amount:1}],{condition:'empty-hand',bonusEffects:[damage(8)]});
  const state = battle([hex,pact,finish],{hp:33});
  play(state,'hex');
  assert.equal(state.enemy.hp,200,'a hex does not qualify itself');
  play(state,'pact');
  assert.equal(state.player.hp,27);
  assert.equal(state.enemy.hp,200,'a pact does not wound itself into its bonus');
  play(state,'finish');
  assert.equal(state.enemy.hp,188,'last-card condition survives its own draw');
});

test('resonance setup qualifies before the played card completes the chain',() => {
  const finisher = card('finish',[damage(2)],{condition:'resonant',bonusEffects:[damage(8)]});
  const state = battle([finisher]);
  state.resonance={element:'iron',count:2};
  play(state,'finish');
  assert.equal(state.enemy.hp,190);
  assert.equal(state.resonance.count,0);
});

test('unpayable pacts and fourth auras reject atomically',() => {
  const definitions = Array.from({length:4},(_,i)=>card('aura-'+i,[block(1)],{
    aura:{trigger:'turn-end',duration:2,effects:[block(1)]},
  }));
  const pact=card('pact',[damage(20)],{healthCost:4});
  const state=battle([...definitions,pact],{hp:4});
  let before=structuredClone(state);
  assert.equal(play(state,'pact').ok,false);
  assert.deepEqual(state,before);
  for(let i=0;i<3;i++)play(state,'aura-'+i);
  before=structuredClone(state);
  assert.equal(play(state,'aura-3').ok,false);
  assert.deepEqual(state,before);
});

test('start and end formations each have their full duration payouts',() => {
  for(const trigger of ['turn-start','turn-end']){
    const art=card('art',[block(1)],{aura:{trigger,duration:2,effects:[damage(4)]}});
    const state=battle([art]);
    play(state,'art');
    endTurn(state);
    assert.equal(state.enemy.hp,196);
    endTurn(state);
    assert.equal(state.enemy.hp,192);
    endTurn(state);
    assert.equal(state.enemy.hp,192);
    assert.equal(state.auras.length,0);
  }
});

test('stances trigger once per played technique, never recursively or on installation',() => {
  const stance=card('stance',[damage(1)],{aura:{trigger:'on-attack',duration:2,effects:[damage(2)]}});
  const hit=card('hit',[{type:'damage',amount:1,hits:3},damage(1)]);
  const state=battle([stance,hit]);
  play(state,'stance');
  assert.equal(state.enemy.hp,199);
  play(state,'hit');
  assert.equal(state.enemy.hp,193);
  assert.equal(state.auras.length,1);
});

test('replaying a formation refreshes one slot and ritual queues are finite',() => {
  const art=card('art',[block(1)],{aura:{trigger:'turn-end',duration:2,effects:[block(1)]}});
  const ritual=card('ritual',[block(1)],{delayed:{turns:2,effects:[damage(3)]}});
  const state=battle([art,ritual]);
  play(state,'art');
  state.hand.push({id:'art',upgrade:0});
  state.turn++;
  play(state,'art');
  assert.equal(state.auras.length,1);
  assert.equal(state.auras[0].expires,4);
  for(let i=0;i<6;i++){
    if(i)state.hand.push({id:'ritual',upgrade:0});
    play(state,'ritual');
  }
  state.hand.push({id:'ritual',upgrade:0});
  const before=structuredClone(state);
  assert.equal(play(state,'ritual').ok,false);
  assert.deepEqual(state,before);
});

test('recovery excludes the resolving card and dispel removes stacks in order',() => {
  const spent=card('spent',[block(1)],{exhaust:true});
  const recover=card('recover',[{type:'recover',amount:2}],{exhaust:true});
  const dispel=card('dispel',[{type:'dispel',amount:3}]);
  const state=battle([spent,recover,dispel]);
  play(state,'spent');play(state,'recover');
  assert.deepEqual(state.discard.map(c=>c.id),['spent']);
  assert.deepEqual(state.exhausted.map(c=>c.id),['recover']);
  state.enemy.statuses={strength:2,focus:2,ward:2,poison:3};
  play(state,'dispel');
  assert.deepEqual(state.enemy.statuses,{focus:1,ward:2,poison:3});
});

test('forecast and JSON resume keep persistent effects isolated and deterministic',() => {
  const art=card('art',[block(1)],{aura:{trigger:'turn-start',duration:2,effects:[block(4)]}});
  const ritual=card('ritual',[block(1)],{delayed:{turns:1,effects:[damage(5)]}});
  const state=battle([art,ritual]);
  play(state,'art');play(state,'ritual');
  const before=structuredClone(state);
  const prediction=previewEndTurn(state);
  assert.deepEqual(state,before);
  const resumed=JSON.parse(JSON.stringify(state));
  endTurn(state);endTurn(resumed);
  assert.deepEqual(state,resumed);
  assert.equal(state.enemy.hp,prediction.enemyHp);
  assert.equal(state.player.hp,prediction.hp);
});

test('timed lethal damage cancels all pending arts before the enemy acts',() => {
  const art=card('art',[block(1)],{aura:{trigger:'turn-end',duration:3,effects:[damage(5)]}});
  const ritual=card('ritual',[block(1)],{delayed:{turns:2,effects:[damage(10)]}});
  const state=battle([art,ritual]);
  play(state,'art');play(state,'ritual');
  state.enemy.hp=3;
  const {events}=captureCombatEvents(state,()=>endTurn(state));
  assert.equal(state.outcome,'victory');
  assert.deepEqual(state.auras,[]);
  assert.deepEqual(state.rituals,[]);
  assert.equal(events.some(e=>e.type==='intent'),false);
});
