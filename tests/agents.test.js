// The merchant agents: the rules layer, the NEAR AI layer's checks, and one decision per merchant per market day.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {aiDecision, createAgents, rulesDecision} from '../server/agents.js';

function books(id, tweak = {}) {
  const m = R.MERCHANTS.find(x => x.id === id), s = R.openingState(m, MARKET_TOKENS);
  return {account_id: `m-${id}.ashes-ninth.testnet`, rules_id: id, name: m.name, cash: String(s.cash), closed: false, specialty: null, tick: 0, patrons: [],
    goods: Object.keys(s.target).map(t => ({token_id: t, stock: String(tweak[t] ?? s.stock[t]), target: String(s.target[t]), base_target: String(s.baseTarget[t]), flow: 0}))};
}

test('the rules want less of a glut, more of a scarce good, and stay inside 60–160%', () => {
  const b = books('lu-yan', {'mat:essence-ember-1': 999, 'mat:essence-ember-2': 1});
  const d = rulesDecision(b, 0);
  const want = Object.fromEntries(d.targets);
  assert.equal(want['mat:essence-ember-1'], 7_500);
  assert.equal(want['mat:essence-ember-2'], 12_500);
  assert.ok(d.targets.length <= 5 && d.targets.every(([, bps]) => bps >= R.ADAPTATION.minBps && bps <= R.ADAPTATION.maxBps));
  assert.match(d.say, /drowning in Mortal Cinder Essence|Cinder/);
  assert.equal(d.source, 'rules');
});

test('the model may adjust, but its reply is clamped, filtered and checked; any failure falls back to the rules', async () => {
  const b = books('lu-yan'), rules = rulesDecision(b, 0);
  const reply = content => async () => ({ok: true, json: async () => ({choices: [{message: {content}}]})});
  const d = await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('<think>hm</think>{"targets":{"mat:essence-ember-1":250,"mat:not-mine":120},"specialty":"ember","say":"The kilns roar; I will hoard Cinder."}')});
  assert.equal(d.source, 'near-ai');
  assert.deepEqual(d.targets, [['mat:essence-ember-1', 16_000]], 'clamped to 160%, and goods she does not trade are dropped');
  assert.equal(d.say, 'The kilns roar; I will hoard Cinder.');
  const leaky = await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('{"targets":{},"say":"Pay me in crypto tokens."}')});
  assert.equal(leaky.say, rules.say, 'a line that breaks the fiction is replaced');
  assert.equal(await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('not json')}), rules);
  assert.equal(await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: async () => { throw new Error('down'); }}), rules);
  assert.equal(await aiDecision(b, 0, rules, {apiKey: ''}), rules, 'no key: the rules decide');
});

test('each merchant decides once per market day, signs from its own account and leaves a journal entry', async () => {
  const store = {data: {}, save() {}};
  const calls = [];
  const all = R.MERCHANTS.map(m => books(m.id));
  let tick = 30;
  const chain = {online: async () => true, agentsReady: async () => true, forgetBooks() {},
    market: async () => ({tick, merchants: all}),
    agentCall: async (id, method, args) => { calls.push({id, method, args}); return {ok: true, tx: 'tx-' + calls.length}; }};
  const agents = createAgents({store, chain, decide: async (b, t, rules) => rules, perRound: 20});
  await agents.round();
  assert.equal(calls.length, 9);
  assert.ok(calls.every(c => c.method === 'merchant_set_strategy' && c.id.startsWith('m-')));
  await agents.round();
  assert.equal(calls.length, 9, 'not twice in one market day');
  tick += 24;
  await agents.round();
  assert.equal(calls.length, 18, 'again the next day');
  const entry = store.data.journal['lu-yan'][0];
  assert.equal(entry.day, 2);
  assert.equal(entry.tx, 'tx-13');
  assert.ok(entry.say.length > 10);
});

test('the crier tells what changed on the ledger: a closure, a new week, a decision', async () => {
  const {crierFromLedger} = await import('../js/market/crier.js');
  const before = {tick: 160, merchants: {'lu-yan': {name: 'Lu Yan', closed: false}}, journal: {}};
  const after = {tick: 170, merchants: {'lu-yan': {name: 'Lu Yan', closed: true}}, journal: {'lu-yan': {day: 7, say: 'The kilns are cold.'}}};
  const lines = crierFromLedger(before, after);
  assert.ok(lines.some(l => /Lu Yan's shutters are down/.test(l)));
  assert.ok(lines.some(l => /A new week: the Pagoda Edict now favours/.test(l)));
  assert.ok(lines.some(l => l === 'Lu Yan: “The kilns are cold.”'));
  assert.deepEqual(crierFromLedger(after, after), [], 'nothing new, nothing cried');
  assert.deepEqual(crierFromLedger(null, after), [], 'the first reading is not news');
});

test('a merchant with a thin purse stops asking for more stock and stops hiring', async () => {
  const {thrifty} = await import('../server/agents.js');
  const b = books('lu-yan');
  const decision = {targets: [['a', 12_000], ['b', 8_000]], changes: [{token: 'a', from: 10_000, to: 12_000}, {token: 'b', from: 10_000, to: 8_000}], job: {token: 'a'}};
  assert.deepEqual(thrifty(b, decision), decision, 'a full purse decides freely');
  const thin = thrifty({...b, cash: '90000'}, decision);
  assert.deepEqual(thin.targets, [['b', 8_000]]);
  assert.equal(thin.job, null);
});

test('a shop left shuttered by players is rekindled by the Ministry, once, after a wait', async () => {
  const store = {data: {}, save() {}}, relief = [];
  const all = R.MERCHANTS.slice(0, 2).map(m => books(m.id));
  all[0].closed = true;
  const chain = {online: async () => true, agentsReady: async () => true, forgetBooks() {},
    market: async () => ({tick: 30, merchants: all}), agentCall: async () => ({ok: true, tx: 't'}),
    ministryRelief: async ids => { relief.push(ids); return {ok: true, tx: 'relief-tx'}; }};
  const agents = createAgents({store, chain, decide: async (b, t, rules) => rules, perRound: 20, reliefAfter: 50});
  await agents.round();
  assert.equal(relief.length, 0, 'players get time to rekindle it first');
  await new Promise(r => setTimeout(r, 60));
  await agents.round();
  assert.deepEqual(relief, [[all[0].account_id]]);
  assert.equal(store.data.journal[all[0].rules_id][0].source, 'ministry');
  assert.equal(store.data.journal[all[0].rules_id][0].tx, 'relief-tx');
});
