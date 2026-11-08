// The merchant agents: the rules layer, the NEAR AI layer's checks, and one decision per merchant per market day.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {aiDecision, createAgents, ownerLetter, rulesDecision} from '../server/agents.js';

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

test("the letter to a deed's holder states the ledger's figures, and a model's letter is used only if it states the vault exactly", async () => {
  const b = {...books('lu-yan', {'mat:essence-ember-1': 1}), status: 'open'};
  const deed = {owner_id: 'alice.ashes-ninth.testnet', vault: '1234', agent: true};
  const history = {days: [{day: 3, share: '800', holder: 'alice.ashes-ninth.testnet'}, {day: 4, share: '434', holder: 'alice.ashes-ninth.testnet'},
    {day: 1, share: '999', holder: 'someone-else.ashes-ninth.testnet'}]};
  const rules = await ownerLetter(b, deed, history, 30, {apiKey: ''});
  assert.equal(rules.source, 'rules');
  assert.match(rules.say, /Your vault holds 12\.34 jade/);
  assert.match(rules.say, /last 2 good days under your seal paid you 12\.34 jade/, "only this holder's days count");
  assert.match(rules.say, /short of [^.]*Cinder/);
  const reply = content => async () => ({ok: true, json: async () => ({choices: [{message: {content}}]})});
  const voiced = await ownerLetter(b, deed, history, 30, {apiKey: 'k', fetchImpl: reply('Your vault holds 12.34 jade. Buy cinder cheap at dawn.')});
  assert.equal(voiced.source, 'near-ai');
  for (const bad of ['Your vault holds a fortune.', 'Your vault holds 12.34 jade; check your wallet.']) {
    assert.equal((await ownerLetter(b, deed, history, 30, {apiKey: 'k', fetchImpl: reply(bad)})).source, 'rules', bad);
  }
});

test('a job players leave alone goes to the merchant with the most to spare, within checkFill; then the round delivers it', async () => {
  const {fillOffer} = await import('../server/agents.js');
  const ember = 'mat:essence-ember-1';
  const lu = books('lu-yan', {[ember]: 10}), granny = books('granny-qiu', {[ember]: 70}), mu = books('mu-xiao');
  const job = {merchant_id: lu.account_id, rules_id: 'lu-yan', name: 'Lu Yan', token_id: ember, wanted: '8', pay_each: '300', posted_tick: 100, expires_tick: 124, expired: false};
  const market = tick => ({tick, merchants: [lu, granny, mu], jobs: [job], deeds: []});
  assert.equal(fillOffer(market(100 + R.JOBS.playersFirstTicks - 1)), null, 'players have the first hours');
  const offer = fillOffer(market(100 + R.JOBS.playersFirstTicks));
  assert.equal(offer.filler.rules_id, 'granny-qiu', 'the merchant that trades the good and has it to spare');
  assert.equal(offer.units, 8);
  assert.ok(offer.payEach >= offer.bid, 'never for less than its own bid');
  assert.equal(fillOffer({...market(110), jobs: [{...job, pay_each: '1'}]}), null, 'too cheap for anyone');
  assert.equal(fillOffer({...market(110), merchants: [lu, books('granny-qiu', {[ember]: 40}), mu]}), null, 'nobody has surplus');
  const held = {merchant_id: granny.account_id, held_by_ministry: false, agent: false};
  assert.equal(fillOffer({...market(110), deeds: [held]}), null, 'a shop whose deed holder decides is left alone');

  const store = {data: {}, save() {}}, calls = [];
  const chain = {online: async () => true, agentsReady: async () => true, forgetBooks() {}, market: async () => market(110),
    agentCall: async (id, method, args) => { calls.push({id, method, args}); return {ok: true, tx: 'tx-' + calls.length}; }};
  await createAgents({store, chain, decide: async (b, t, rules) => rules, perRound: 0}).round();
  assert.deepEqual(calls, [{id: granny.account_id, method: 'merchant_fill_job', args: {merchant_id: lu.account_id, amount: '8'}}]);
  const hire = store.data.hires[0];
  assert.equal(hire.ok, true);
  assert.equal(hire.tx, 'tx-1');
  assert.match(hire.said.filler, /Lu Yan was short of Mortal Cinder Essence/);
  assert.match(hire.said.hirer, /Granny Qiu brought me 8 Mortal Cinder Essence at the wage I posted, 3\.00 jade each/);
});
