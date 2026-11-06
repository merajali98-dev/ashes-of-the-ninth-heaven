import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCombat, describeEffect, endTurn, getCard, getIntent, playCard, previewEndTurn, STATUS_INFO, useConsumable, captureCombatEvents,
} from '../js/combat.js';
import { enemies } from '../js/content/adversaries.js';
import { cards, starterDeck } from '../js/content/techniques.js';
import { items } from '../js/content/treasury.js';

const technique = (id, school, cost, effects, flags) => ({ id, name: id, school, cost, effects, ...flags });
const damage = (amount, hits) => ({ type: 'damage', amount, hits });
const block = amount => ({ type: 'block', amount });
const status = (status, amount, target) => ({ type: 'status', status, amount, target });
const move = (name, ...effects) => ({ name, effects });
const dummy = { id: 'dummy', name: 'Training Effigy', hp: 100, intents: [move('Wait')] };
const basicCards = [
  technique('iron-sword', 'iron', 1, [damage(4, 2)]),
  technique('iron-wall', 'iron', 1, [block(5)]),
  technique('iron-fist', 'iron', 1, [damage(3)]),
  technique('blank-slip', 'neutral', 0, [{ type: 'draw', amount: 1 }], { exhaust: true }),
  technique('ember-sun', 'ember', 4, [damage(30)]),
  technique('sheathed-blade', 'neutral', 1, [damage(1)], { retain: true }),
];

test('combat feedback reports actual multi-hit damage, absorption and denied statuses', () => {
  const state = battle();
  state.enemy.block = 6;
  state.enemy.statuses.ward = 1;
  const {result,events} = captureCombatEvents(state, () =>
    useConsumable(state, [damage(4,2), status('burn',3), block(5), {type:'heal',amount:3}]));
  assert.equal(result.ok,true);
  assert.deepEqual(events,[
    {type:'strike',target:'enemy',amount:2,blocked:6,hits:2},
    {type:'ward',target:'enemy',status:'burn'},
    {type:'guard',target:'player',amount:5},
    {type:'heal',target:'player',amount:3},
  ]);
  assert.equal(JSON.stringify(state).includes('"events"'),false);
  assert.deepEqual(captureCombatEvents(state, () => playCard(state,-1)).events,[]);
});

test('combat feedback captures phase seals and school resonance', () => {
  const enemy = {...dummy,sealPhases:true,phases:[{at:.8,name:'Second Seal',intents:dummy.intents}]};
  const state = battle({enemy});
  const phase = captureCombatEvents(state,() => useConsumable(state,[damage(25)])).events;
  assert.deepEqual(phase.find(event => event.type === 'phase'),{type:'phase',target:'enemy',name:'Second Seal',sealed:true});
  assert.deepEqual(captureCombatEvents(state,() => useConsumable(state,[damage(3)])).events,[{type:'seal',target:'enemy'}]);
  state.resonance = {element:'iron',count:2};
  const guard = state.hand.findIndex((_,index) => getCard(state,index).id === 'iron-wall');
  const events = captureCombatEvents(state,() => playCard(state,guard)).events;
  assert.ok(events.some(event => event.type === 'resonance' && event.school === 'iron'));
  assert.ok(events.some(event => event.type === 'guard' && event.amount === 6));
});

test('sealed phases prevent multi-hit and poison from skipping phase intents', () => {
  const boss = {
    ...dummy, sealPhases:true,
    phases:[{at:.66, name:'First Seal',intents:[move('First Reply',damage(4))]},
      {at:.31, name:'Second Seal',intents:[move('Second Reply',damage(7))]}],
  };
  const state = battle({enemy:boss});
  const burst = [damage(150,4),status('poison',50)];
  useConsumable(state,burst);
  assert.equal(state.enemy.hp,66);
  assert.equal(getIntent(state).name,'First Reply');
  useConsumable(state,burst);
  assert.equal(state.enemy.hp,66);
  assert.equal(previewEndTurn(state).hpChange,-4);
  endTurn(state);
  useConsumable(state,burst);
  assert.equal(state.enemy.hp,31);
  assert.equal(getIntent(state).name,'Second Reply');
  endTurn(state);
  assert.equal(state.player.hp,39);
  useConsumable(state,burst);
  assert.equal(state.outcome,'victory');
});

test('a phase reached by turn-start poison preserves the announced intent', () => {
  const boss = {
    ...dummy, sealPhases:true, intents:[move('Read the Writ',damage(3))],
    phases:[{at:.6,name:'Second Seal',intents:[move('Burn the Writ',damage(11))]}],
  };
  const state = battle({enemy:boss});
  useConsumable(state,[status('poison',50)]);
  assert.equal(getIntent(state).name,'Read the Writ');
  assert.equal(previewEndTurn(state).hpChange,-3);
  endTurn(state);
  assert.equal(state.enemy.hp,60);
  assert.equal(getIntent(state).name,'Burn the Writ');
  useConsumable(state,[damage(500)]);
  assert.equal(state.enemy.hp,60);
  endTurn(state);
  assert.equal(state.player.hp,36);
});

function battle(overrides = {}) {
  return createCombat({
    deck: basicCards.map(card => card.id),
    cards: basicCards,
    enemy: dummy,
    hp: 50,
    maxHp: 60,
    seed: 'combat-fixture',
    draw: 10,
    ...overrides,
  });
}

function play(state, id) {
  const result = playCard(state, state.hand.findIndex(card => card.id === id));
  assert.equal(result.ok, true, result.reason);
}

function validateEffects(effects, id) {
  for (const effect of effects) {
    assert.ok(describeEffect(effect), id);
    assert.ok(Number.isInteger(effect.amount) && effect.amount > 0, id);
    if (effect.type === 'status') assert.ok(Object.hasOwn(STATUS_INFO, effect.status), id);
  }
}

test('seed controls shuffle and a JSON round trip resumes identically', () => {
  const original = battle({ draw: 3 });
  assert.deepEqual(original, battle({ draw: 3 }));
  const sequence = state => [...state.hand, ...state.drawPile].map(card => card.id);
  assert.notDeepEqual(sequence(original), sequence(battle({ draw: 3, seed: 'different' })));
  endTurn(original);
  const loaded = JSON.parse(JSON.stringify(original));
  for (const state of [original, loaded]) {
    assert.equal(useConsumable(state, [status('poison', 2)]).ok, true);
    endTurn(state);
    const affordable = state.hand.findIndex((_, index) => getCard(state, index).cost <= state.energy);
    assert.equal(playCard(state, affordable).ok, true);
    endTurn(state);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(original)), loaded);
});

test('invalid hand slots, unaffordable cards and empty consumables preserve state', () => {
  const state = battle();
  const before = structuredClone(state);
  assert.equal(playCard(state, 100).ok, false);
  assert.equal(playCard(state, 1.5).ok, false);
  assert.equal(playCard(state, state.hand.findIndex(card => card.id === 'ember-sun')).ok, false);
  assert.equal(useConsumable(state, []).ok, false);
  assert.deepEqual(state, before);
});

test('neutral cards preserve school resonance and a matching chain crosses turns', () => {
  const state = battle({ bonuses: { strength: 1, focus: 1, block: 2 } });
  play(state, 'iron-sword');
  play(state, 'blank-slip');
  assert.deepEqual(state.resonance, { element: 'iron', count: 1 });
  assert.equal(state.exhausted.length, 1);
  endTurn(state);
  play(state, 'iron-wall');
  play(state, 'iron-fist');
  assert.deepEqual(state.resonance, { element: 'iron', count: 0 });
  assert.equal(state.player.block, 13);
  assert.equal(state.enemy.hp, 86);
  assert.equal(state.energy, 2);
  assert.equal(state.log.some(line => line.startsWith('Iron Bastion')), true);
});

test('changing elemental school starts a fresh resonance chain', () => {
  const state = battle({ energy: 6 });
  play(state, 'iron-sword');
  play(state, 'ember-sun');
  assert.deepEqual(state.resonance, { element: 'ember', count: 1 });
  play(state, 'iron-fist');
  assert.deepEqual(state.resonance, { element: 'iron', count: 1 });
});

test('each school has a distinct resonance payoff', () => {
  const fixtures = {
    iron: state => assert.equal(state.player.block, 6),
    ember: state => assert.equal(state.enemy.statuses.burn, 3),
    tide: state => assert.equal(state.player.hp, 54),
    shade: state => assert.equal(state.enemy.statuses.vulnerable, 2),
    lotus: state => assert.equal(state.player.statuses.ward, 1),
    thunder: state => assert.equal(state.enemy.hp, 94),
    star: state => assert.equal(state.hand.length, 2),
  };
  for (const [school, check] of Object.entries(fixtures)) {
    const state = battle({
      cards: [technique('focus', school, 0, [])],
      deck: Array(5).fill('focus'),
      draw: 3,
    });
    for (let count = 0; count < 3; count++) play(state, 'focus');
    check(state);
    assert.equal(state.energy, 4);
    if (school !== 'star') assert.equal(state.hand.length, 1);
  }
});

test('draw honors retention, exhaustion, and the ten-card hand limit', () => {
  const state = battle({ deck: [...basicCards.map(card => card.id), ...Array(7).fill('sheathed-blade')] });
  assert.equal(state.hand.length, 10);
  endTurn(state);
  const retained = state.hand.filter(card => card.id === 'sheathed-blade');
  assert.equal(state.hand.length, 10);
  assert.ok(retained.length >= 6);
  const drawOnly = battle({ deck: ['blank-slip'] });
  play(drawOnly, 'blank-slip');
  assert.equal(drawOnly.hand.length, 0);
  endTurn(drawOnly);
  assert.equal(drawOnly.hand.length, 0);
  assert.equal(drawOnly.exhausted.length, 1);
  const loneGuard = battle({ deck: ['iron-wall'] });
  play(loneGuard, 'iron-wall');
  endTurn(loneGuard);
  assert.equal(loneGuard.hand[0].id, 'iron-wall');
  assert.equal(loneGuard.discard.length, 0);
});

test('Block, Focus and Qi reset at the correct time', () => {
  const enemy = { ...dummy, intents: [move('Crush and Guard', damage(12), block(8))] };
  const state = battle({ enemy, bonuses: { energy: 1, block: 2, focus: 1 } });
  assert.equal(state.energy, 4);
  play(state, 'iron-wall');
  assert.equal(state.player.block, 8);
  endTurn(state);
  assert.equal(state.player.hp, 46);
  assert.equal(state.player.block, 0);
  assert.equal(state.enemy.block, 8);
  assert.equal(state.energy, 4);
  play(state, 'iron-sword');
  assert.equal(state.enemy.hp, 100);
  assert.equal(state.enemy.block, 0);
});

test('the end-turn forecast includes Guard, attack modifiers and timed damage without mutating combat', () => {
  const enemy = { ...dummy, intents: [move('Crush', damage(10, 2))] };
  const state = battle({ enemy });
  useConsumable(state, [
    status('weak', 1),
    status('vulnerable', 1, 'self'),
    status('poison', 2, 'self'),
    block(4),
  ]);
  const before = structuredClone(state);
  const forecast = previewEndTurn(state);
  assert.deepEqual(state, before);
  assert.deepEqual(forecast, { hp: 35, hpChange: -15, enemyHp: 100, outcome: null });
  endTurn(state);
  assert.equal(state.player.hp, forecast.hp);
  assert.equal(state.enemy.hp, forecast.enemyHp);
});

test('attack modifiers resolve per hit and consume Bleed and Vulnerable charges', () => {
  const state = battle({ bonuses: { strength: 1 } });
  useConsumable(state, [status('weak', 1, 'self'), status('vulnerable', 1), status('bleed', 2)]);
  play(state, 'iron-sword');
  // Weak reduces each hit to 3. Vulnerable raises only the first hit to 4,
  // and Bleed adds 2 to the first hit and 1 to the second.
  assert.equal(state.enemy.hp, 90);
  assert.deepEqual(state.enemy.statuses, {});
  assert.equal(state.player.statuses.weak, 1);
  endTurn(state);
  assert.equal(state.player.statuses.weak, undefined);
});

test('Ward prevents one application, Cleanse removes stacks, and turn effects decay', () => {
  const state = battle({ bonuses: { ward: 1, regen: 2, heal: 2 } });
  assert.equal(state.player.hp, 52);
  useConsumable(state, [
    status('burn', 10, 'self'),
    status('poison', 3, 'self'),
    status('burn', 2, 'self'),
    { type: 'cleanse', amount: 2 },
  ]);
  assert.deepEqual(state.player.statuses, { regen: 2, poison: 1, burn: 2 });
  endTurn(state);
  assert.equal(state.player.hp, 51);
  assert.deepEqual(state.player.statuses, { regen: 1, burn: 1 });
});

test('Burn bursts and fades faster than persistent Poison', () => {
  const state = battle();
  useConsumable(state, [status('burn', 5), status('poison', 5)]);
  endTurn(state);
  assert.equal(state.enemy.hp, 90);
  assert.deepEqual(state.enemy.statuses, { burn: 2, poison: 4 });
  endTurn(state);
  assert.equal(state.enemy.hp, 84);
  assert.deepEqual(state.enemy.statuses, { burn: 1, poison: 3 });
});

test('poison can end a battle before a lethal telegraphed enemy move', () => {
  const enemy = { ...dummy, hp: 2, intents: [move('Lethal', damage(1000))] };
  const state = battle({ enemy });
  useConsumable(state, [status('poison', 2)]);
  endTurn(state);
  assert.equal(state.outcome, 'victory');
  assert.equal(state.player.hp, 50);
  assert.equal(getIntent(state), null);
  assert.equal(endTurn(state).ok, false);
  assert.equal(useConsumable(state, [damage(1)]).ok, false);
});

test('upgrades and gear resolve real magnitudes without changing definitions', () => {
  const state = battle({ deck: [{ id: 'iron-sword', upgrade: 2 }], bonuses: { school: { iron: { damage: 1 } } } });
  assert.equal(getCard(state, 0).effects[0].amount, 7);
  assert.equal(describeEffect(getCard(state, 0).effects[0]), 'Deal 7 × 2 damage.');
  assert.equal(basicCards[0].effects[0].amount, 4);
  play(state, 'iron-sword');
  assert.equal(state.enemy.hp, 86);
});

test('generic mastery preserves Qi costs and refunds', () => {
  const cards = [
    technique('refund', 'neutral', 1, [{ type: 'energy', amount: 1 }, block(4)]),
  ];
  const state = battle({ cards, deck: [{ id: 'refund', upgrade: 2 }] });
  assert.deepEqual(getCard(state, 0).effects.map(effect => effect.amount), [1, 8]);
  play(state, 'refund');
  assert.equal(state.energy, state.maxEnergy);
});

test('threshold phases retarget the visible intent and cannot be reversed by healing', () => {
  const enemy = {
    ...dummy,
    intents: [move('Feint'), move('Second Feint')],
    phases: [
      { at: 0.2, name: 'Final Form', intents: [move('Recover', { type: 'heal', amount: 60 }), move('Execute', damage(60))] },
      { at: 0.5, name: 'Wrath', intents: [move('Flame', damage(20))] },
    ],
  };
  const state = battle({ enemy });
  assert.equal(getIntent(state).name, 'Feint');
  endTurn(state);
  assert.equal(getIntent(state).name, 'Second Feint');
  useConsumable(state, [damage(80)], 'Sword Seal');
  assert.equal(state.enemy.phase, 2);
  assert.equal(state.enemy.phaseName, 'Final Form');
  assert.equal(getIntent(state).name, 'Recover');
  endTurn(state);
  assert.equal(state.enemy.hp, 80);
  assert.equal(getIntent(state).name, 'Execute');
  endTurn(state);
  assert.equal(state.outcome, 'defeat');
  assert.equal(state.player.hp, 0);
});

test('the starter deck and every technique resolve through the combat engine', () => {
  const intro = battle({ cards, deck: starterDeck, draw: 5, enemy: enemies[0] });
  assert.equal(intro.hand.length, 5);
  assert.equal(Object.keys(intro.cards).length, new Set(starterDeck).size);
  assert.equal(getIntent(intro).name, enemies[0].intents[0].name);
  for (const card of cards) {
    for (const upgrade of [0, 2]) {
      const state = battle({ cards, deck: [{ id: card.id, upgrade }], hp: 5, energy: 10 });
      validateEffects(getCard(state, 0).effects, card.id);
      assert.equal(playCard(state, 0).ok, true, card.id);
    }
  }
});

test('every campaign opponent intent and phase can execute', () => {
  for (const enemy of enemies) {
    const state = battle({ enemy, hp: 100000, maxHp: 100000 });
    for (const phase of [enemy, ...(enemy.phases ?? [])]) {
      if (phase.at) {
        state.player.statuses = {};
        state.enemy.block = 0;
        state.enemy.statuses = {};
        const threshold = Math.floor(phase.at * enemy.hp);
        useConsumable(state, [damage(state.enemy.hp - threshold)]);
      }
      for (const intent of phase.intents) {
        validateEffects(intent.effects, enemy.id);
        assert.equal(getIntent(state)?.name, intent.name, enemy.id);
        assert.equal(endTurn(state).ok, true, enemy.id);
        assert.ok(state.log.some(line => line === `${enemy.name} uses ${intent.name}.`), enemy.id);
      }
    }
  }
});

test('every campaign pill and talisman has executable combat effects', () => {
  for (const item of items.filter(item => ['pill', 'talisman'].includes(item.type))) {
    assert.ok(item.effects?.length, item.id);
    validateEffects(item.effects, item.id);
    const state = battle({ hp: 10 });
    assert.equal(useConsumable(state, item.effects, item.name).ok, true, item.id);
    assert.ok(state.log.includes(`You use ${item.name}.`));
  }
});
