import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as R from '../js/market/merchant-rules.js';
import {addActor, commission, createWorld, endHour, holdings, invest, jadeSupply, shock, trade, JADE, VEIN} from '../js/market/engine.js';
import {npcHour, populate} from '../js/market/npc.js';
import {runFastForward, sanitize} from '../js/market/fastforward.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const balanced = world => {
  const held = holdings(world), tokens = new Set([...Object.keys(held), ...Object.keys(world.supply.minted), ...Object.keys(world.supply.burned)]);
  for (const t of tokens) {
    const expected = (world.supply.minted[t] ?? 0) - (world.supply.burned[t] ?? 0);
    if ((held[t] ?? 0) !== expected) return `${t}: holdings ${held[t] ?? 0}, minted − burned ${expected}`;
  }
  return '';
};

const week = runFastForward({seed: 1});
const calmWeek = runFastForward({seed: 1, cast: {flooder: false}});

test('the same seed always plays the same week, and a different seed does not', () => {
  assert.equal(digest(runFastForward({seed: 1}).frames), digest(week.frames));
  assert.notEqual(digest(runFastForward({seed: 2}).frames), digest(week.frames));
  assert.equal(week.frames.length, 168);
});

test('every jade and every good is accounted for, hour by hour', () => {
  const world = createWorld({seed: 3});
  populate(world);
  for (let h = 0; h < 72; h++) {
    if (h === 30) shock(world, 'ministry-audit');
    if (h === 40) shock(world, 'spring-flood');
    npcHour(world);
    assert.equal(balanced(world), '', `hour ${h}`);
    endHour(world);
    assert.equal(balanced(world), '', `after hour ${h}`);
  }
  assert.equal(balanced(week.world), '');
});

test('the Ember Guild flood crashes Cinder Essence and breaks Lu Yan; without it, she survives', () => {
  const lowCinder = Math.min(...week.frames.slice(0, 48).map(f => f.families['essence-ember']));
  assert.ok(lowCinder <= 6_000, `Cinder index fell only to ${lowCinder}`);
  assert.ok(week.events.some(e => e.type === 'closed' && e.merchant === 'lu-yan'));
  assert.ok(week.events.some(e => e.type === 'reopened' && e.merchant === 'lu-yan'), 'a patron rekindles the shop');
  const calmCinder = calmWeek.frames.map(f => f.families['essence-ember']);
  assert.ok(Math.min(...calmCinder) >= 8_000 && Math.max(...calmCinder) <= 14_000, 'only scheduled events (up to +35%) move it far');
  assert.equal(calmWeek.summary.closures, 0);
});

test('the Pagoda Edict drives what cultivators forge', () => {
  const edict = R.edictSchool(0), forged = week.summary.forged;
  const [top] = Object.entries(forged).sort((a, b) => b[1] - a[1]);
  assert.equal(top[0], edict, JSON.stringify(forged));
  assert.ok(week.frames.slice(24).some(f => f.families['essence-' + edict] > 11_000), 'demand lifts the edict school');
});

test('jade supply stays within 3% growth or shrinkage per market day', () => {
  for (const run of [week, calmWeek, runFastForward({seed: 5, days: 14})])
    assert.ok(Math.abs(run.summary.jadeGrowthPerDayBps) <= 300, `growth ${run.summary.jadeGrowthPerDayBps} bps/day`);
});

test('a default week computes fast enough to play in the browser', () => {
  const start = performance.now();
  runFastForward({seed: 9});
  assert.ok(performance.now() - start < 4_000);
});

test('trades move goods, jade and the Paper Taxman\'s cut, and refuse what a trader cannot cover', () => {
  const world = createWorld({seed: 1});
  addActor(world, {id: 'p', name: 'Player', cash: 1_000, items: {'mat:essence-tide-1': 10}});
  const sold = trade(world, 'p', 'elder-ya', 'mat:essence-tide-1', 'sell', 5);
  assert.ok(sold.ok);
  assert.equal(world.actors.p.cash, 1_000 + sold.total);
  assert.equal(world.actors.p.items['mat:essence-tide-1'], 5);
  assert.equal(world.ministry, sold.taxPaid);
  assert.equal(trade(world, 'p', 'elder-ya', 'mat:essence-tide-1', 'sell', 6).code, 'NOT_HELD');
  assert.equal(trade(world, 'p', 'elder-ya', 'mat:essence-tide-5', 'buy', 15).code, 'NO_JADE');
  assert.equal(balanced(world), '');
});

test('spirit veins tire when farmed and recover with time', () => {
  const world = createWorld({seed: 1});
  addActor(world, {id: 'p', name: 'Player'});
  const first = commission(world, 'p', 'ember', 2), second = commission(world, 'p', 'ember', 2);
  assert.ok(second.materials['mat:essence-ember-2'] < first.materials['mat:essence-ember-2'] ||
    second.materials['mat:seal-jade-2'] < first.materials['mat:seal-jade-2']);
  assert.equal(world.veins['ember-2'], VEIN.fullBps - 2 * VEIN.perRunBps);
  for (let h = 0; h < 20; h++) endHour(world);
  assert.equal(world.veins['ember-2'], VEIN.fullBps);
  assert.equal(commission(world, 'p', 'ember', 2, false).ok, false, 'a lost fight pays nothing');
});

test('patrons may own at most 49% of a merchant, and at most ten may invest', () => {
  const world = createWorld({seed: 1}), m = world.merchants['gao-shan'];
  for (let i = 0; i < 11; i++) addActor(world, {id: 'a' + i, name: 'A' + i, cash: m.startCash});
  assert.ok(invest(world, 'a0', 'gao-shan', Math.trunc(m.startCash * 0.49)).ok);
  assert.equal(invest(world, 'a1', 'gao-shan', 100).ok, false);
  const world2 = createWorld({seed: 1});
  for (let i = 0; i < 11; i++) addActor(world2, {id: 'a' + i, name: 'A' + i, cash: 1_000});
  for (let i = 0; i < 10; i++) assert.ok(invest(world2, 'a' + i, 'gao-shan', 100).ok);
  assert.match(invest(world2, 'a10', 'gao-shan', 100).reason, /ten patrons/);
});

test('shocks act on stock and purses, and prices respond through the rules', () => {
  const world = createWorld({seed: 1});
  const before = world.markets['lu-yan'].stock['mat:essence-ember-1'], cash = jadeSupply(world);
  shock(world, 'kiln-riot');
  assert.ok(world.markets['lu-yan'].stock['mat:essence-ember-1'] < before);
  shock(world, 'ministry-audit');
  assert.ok(jadeSupply(world) < cash);
  assert.equal(world.log.filter(e => e.type === 'shock').length, 2);
  assert.equal(balanced(world), '');
  assert.deepEqual(sanitize({shocks: [{id: 'not-real', tick: 3}, {id: 'kiln-riot', tick: -1}, {id: 'storm-rush', tick: 5}]}).shocks, [{id: 'storm-rush', tick: 5}]);
});

test('fast-forward and the live market share one engine and one rules file', async () => {
  const source = await readFile(new URL('../js/market/fastforward.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/engine\.js'/);
  assert.match(source, /from '\.\/merchant-rules\.js'/);
  for (const file of ['engine.js', 'npc.js', 'fastforward.js']) {
    const text = await readFile(new URL('../js/market/' + file, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /Math\.random|Date\.now/, file + ' uses only the seeded world clock and randomness');
  }
  assert.equal(JADE, 'jade');
});

test('the flood week tells its story: the flood, the crash, the closure, the rescue, in order', async () => {
  const {storyBeats} = await import('../js/market/story.js');
  const sim = runFastForward({cast: {flooder: true}});
  const beats = storyBeats(sim, {family: f => f, merchant: id => sim.world.merchants[id].name});
  const kinds = beats.map(b => b.kind);
  assert.ok(beats.length <= 8);
  assert.deepEqual(beats.map(b => b.tick), [...beats.map(b => b.tick)].sort((a, b) => a - b), 'in time order');
  for (const kind of ['flood', 'low', 'closed', 'rekindle', 'reopened']) assert.ok(kinds.includes(kind), kind);
  assert.ok(kinds.indexOf('flood') < kinds.indexOf('low') && kinds.indexOf('closed') < kinds.indexOf('rekindle')
    && kinds.indexOf('rekindle') < kinds.indexOf('reopened'), kinds.join(' → '));
  assert.match(beats.find(b => b.kind === 'low').text, /essence-ember falls to \d+% of its usual price/);
  const quiet = storyBeats(runFastForward({cast: {flooder: false}}), {family: f => f, merchant: id => id});
  assert.ok(!quiet.some(b => b.kind === 'flood' || b.kind === 'closed'), 'no flood, no closure');
});
