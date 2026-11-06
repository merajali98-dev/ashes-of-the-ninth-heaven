import assert from 'node:assert/strict';
import { cards, enemies } from '../js/content.js';
import { createCombat, getCard, playCard, endTurn, resolveTechnique } from '../js/combat.js';

// Explicit balance simulation: node tests/expansion-playthrough.mjs
// A bounded tactical beam evaluates the displayed enemy action, including timed arts.
const registry = Object.fromEntries(cards.map(card => [card.id, card]));
if(!process.argv.includes('--decks-only'))for(const card of cards)for(const level of [0,2]) {
  const resolved=resolveTechnique(card,level);
  const direct=[...resolved.effects,...(resolved.bonusEffects||[])];
  const refunds=direct.filter(e=>e.type==='energy').reduce((n,e)=>n+e.amount,0);
  // Healing a pact's payment cannot bypass this strictly positive Qi spend.
  if(!resolved.exhaust)assert.ok(resolved.cost>refunds,`${card.id}: repeatable plays need a positive net Qi spend`);
  const allEffects=[...direct,...(resolved.aura?.effects||[]),...(resolved.delayed?.effects||[])];
  if(allEffects.some(e=>e.type==='recover'))assert.equal(resolved.exhaust,true,`${card.id}: recovery is finite`);
  if(resolved.aura?.trigger.startsWith('on-'))assert.equal(
    resolved.aura.effects.some(e=>['energy','draw','recover'].includes(e.type)),false,
    `${card.id}: action auras must not generate another action's resources`);
}
const builds = {
  iron: ['black-wax-citation', 'four-nails-boundary', 'nail-the-heel', 'objection-at-the-hilt',
    'shut-the-iron-shutter', 'heat-the-judgment-brand', 'the-last-entry', 'rent-the-execution-sword'],
  ember: ['soot-in-the-warrant', 'three-brick-refuge', 'cauterist-grip', 'catch-the-fire-tong',
    'oven-door-rebuttal', 'seal-the-coal-jar', 'last-coal-cast', 'palm-for-the-bellows'],
  lotus: ['inkless-rebuke', 'shelf-of-rain-bowls', 'heel-against-the-archive-door', 'close-the-reading-shutter',
    'keep-the-page-dry', 'wait-for-the-bronze-to-settle', 'fold-the-final-margin', 'speak-through-the-split-lip'],
  star: ['name-the-false-north', 'observatory-chalk-ring', 'hold-the-measuring-thread', 'brass-lens-rebuttal',
    'close-the-shutter-slit', 'set-the-meteor-bell', 'fold-the-empty-atlas', 'pulse-driven-orrery'],
};
const support = {
  iron: ['iron-vow', 'bailiffs-guard', 'sword-petition', 'temper-the-spine'],
  ember: ['cinder-finger', 'furnace-skin', 'ash-basket', 'first-firing'],
  lotus: ['jade-palm', 'unwritten-shield', 'prayer-wheel', 'testimony-palm'],
  star: ['astral-needle', 'orbiting-screen', 'starfallen-brush', 'witness-of-polaris'],
};
function fork(s) {
  return { ...s, player:{...s.player,statuses:{...s.player.statuses}}, enemy:{...s.enemy,statuses:{...s.enemy.statuses}},
    hand:[...s.hand],drawPile:[...s.drawPile],discard:[...s.discard],exhausted:[...s.exhausted],
    auras:s.auras.map(a=>({...a})),rituals:s.rituals.map(r=>({...r})),resonance:{...s.resonance},log:[] };
}
function value(s) {
  if(s.outcome==='victory') return 10000+s.player.hp;
  if(s.outcome==='defeat') return -10000-s.enemy.hp;
  const p=s.player.statuses,e=s.enemy.statuses;
  const timed=s.rituals.reduce((n,r)=>n+r.effects.reduce((v,x)=>v+(x.type==='damage'?x.amount:0),0)*0.5,0);
  return 1.7*s.player.hp-s.enemy.hp+3*(p.strength||0)+2*(p.focus||0)+(p.regen||0)
    +1.5*(e.poison||0)+(e.burn||0)+(e.bleed||0)-2*(p.poison||0)-1.5*(p.burn||0)
    +timed+s.auras.length;
}
function evaluate(s,path) { const after=fork(s);if(!after.outcome)endTurn(after);return {state:s,path,score:value(after)-0.025*path.length}; }
function plan(s) {
  let best=evaluate(s,[]), frontier=[best];
  for(let depth=0;depth<12&&frontier.length;depth++) {
    const next=[];
    for(const node of frontier) {
      const used=new Set();
      for(let i=0;i<node.state.hand.length;i++) {
        const card=getCard(node.state,i);
        if(used.has(card.id)||card.cost>node.state.energy)continue;
        used.add(card.id);
        const copy=fork(node.state);
        if(!playCard(copy,i).ok)continue;
        const candidate=evaluate(copy,[...node.path,i]);
        if(candidate.score>best.score)best=candidate;
        if(!copy.outcome)next.push(candidate);
      }
    }
    frontier=next.sort((a,b)=>b.score-a.score).slice(0,12);
  }
  return best.path;
}

// A legal eight-card draw/refund/recovery deck used to run indefinitely at +2.
// The assertion is against the observed action sequence, not an arbitrary engine turn cap.
function recoveryProbe(upgrade) {
  const ids=['star-retrieve-the-burned-chart','iron-salvage-the-broken-oath',
    'gather-qi','gather-qi','missing-second','missing-second','lightning-ledger','lightning-ledger'];
  const s=createCombat({cards,deck:ids.map(id=>({id,upgrade})),seed:1,hp:54,maxHp:54,
    enemy:{id:'balance-effigy',name:'Balance effigy',hp:100000,intents:[{name:'Wait',effects:[]}]}});
  let steps=0;
  for(;steps<300;steps++) {
    const options=s.hand.map((_,i)=>({i,c:getCard(s,i)})).filter(x=>x.c.cost<=s.energy);
    const priority=x=>x.c.effects.some(e=>e.type==='recover')?(s.exhausted.length>=3?100:-100):10;
    options.sort((a,b)=>priority(b)-priority(a));
    if(!options.length)break;
    assert.equal(playCard(s,options[0].i).ok,true);
  }
  console.log(JSON.stringify({probe:'recovery-refund',mastery:upgrade,actions:steps,remainingQi:s.energy}));
  assert.ok(steps<300,'Recovery arts must not mutually recycle a permanent draw/Qi engine.');
}
if(!process.argv.includes('--decks-only'))for(const level of [0,2])recoveryProbe(level);

// Repeatable free status/attack cards plus upgraded draw can refund every spend
// through school resonance. Exhaustion must close these preexisting routes too.
if(!process.argv.includes('--decks-only'))for(const [free,draw] of [
  ['red-coals','ash-basket'],['bitter-brine','ferrys-wake'],['candle-snuffer','curtain-hem'],
  ['ground-wire','silver-relay'],
]) {
  const ids=[...Array(4).fill(free),draw,draw,'empty-jar','gather-qi'];
  let longest=0;
  for(let seed=1;seed<=5;seed++) {
    const s=createCombat({cards,deck:ids.map(id=>({id,upgrade:2})),seed,hp:54,maxHp:54,
      enemy:{id:'resonance-effigy',name:'Resonance effigy',hp:100000,intents:[{name:'Wait',effects:[]}]}});
    let actions=0;
    for(;actions<300;actions++) {
      const option=s.hand.map((_,i)=>({i,c:getCard(s,i)})).filter(x=>x.c.cost<=s.energy)
        .sort((a,b)=>a.c.cost-b.c.cost)[0];
      if(!option)break;
      assert.equal(playCard(s,option.i).ok,true);
    }
    longest=Math.max(longest,actions);
    assert.ok(actions<300,`${free}/${seed}: free-card resonance must not sustain permanent draw`);
  }
  console.log(JSON.stringify({probe:'free-resonance',free,longestTurn:longest,seeds:5}));
}

// Every authored pact must refuse an exact-lethal payment before mutating any state.
for(const card of cards.filter(c=>c.expansion&&c.healthCost)) {
  const s=createCombat({cards,deck:[card.id],seed:1,hp:card.healthCost,maxHp:54,energy:5,
    enemy:{id:'pact-effigy',name:'Pact effigy',hp:100,intents:[{name:'Wait',effects:[]}]}});
  const before=structuredClone(s);
  assert.equal(playCard(s,0).ok,false,card.id);
  assert.deepEqual(s,before,card.id);
}

for(const [school,names] of Object.entries(builds)) {
  const ids=[...names.map(name=>`${school}-${name}`),...support[school]];
  for(const id of ids)assert.ok(registry[id],`Missing archetype card ${id}`);
  for(const tier of [
    {label:'opening',mastery:0,hp:59,enemy:'magistrate-wei'},
    {label:'refined',mastery:2,hp:103,enemy:'general-hong'},
    {label:'final',mastery:2,hp:142,enemy:'ninth-heaven'},
  ]) {
    let wins=0,turns=0,totalHp=0,maxActions=0;
    const usedTypes=new Set();
    for(let seed=1;seed<=5;seed++) {
      // Actual four-slot common loadout: pilgrim staff, sootcloth coat, jade beads, windproof wick.
      const s=createCombat({cards,deck:ids.map(id=>({id,upgrade:tier.mastery})),seed,hp:tier.hp,maxHp:tier.hp,
        bonuses:{strength:1,focus:1,ward:2},enemy:enemies.find(e=>e.id===tier.enemy)});
      for(let turn=0;turn<40&&!s.outcome;turn++) {
        const actions=plan(s);maxActions=Math.max(maxActions,actions.length);
        for(const index of actions) {
          const played=getCard(s,index);
          if(played.expansion)usedTypes.add(played.type);
          assert.equal(playCard(s,index).ok,true);
        }
        if(!s.outcome)endTurn(s);
      }
      assert.ok(s.outcome,`${school}/${tier.label}/${seed}: battle did not terminate`);
      if(s.outcome==='victory')wins++;
      turns+=s.turn;totalHp+=s.player.hp;
    }
    console.log(JSON.stringify({school,tier:tier.label,wins,seeds:5,meanTurns:turns/5,meanHp:totalHp/5,maxActions,usedTypes:[...usedTypes].sort()}));
    if(tier.label!=='final')assert.ok(wins>=3,`${school}/${tier.label}: intentional mixed-type deck should be viable`);
    if(tier.label==='final')for(const type of ['formation','stance','ritual']) {
      assert.ok(usedTypes.has(type),`${school}: persistent ${type} should contribute to an intentional build`);
    }
  }
}
