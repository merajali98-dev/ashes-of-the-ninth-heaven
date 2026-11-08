// Haggling and merchants hiring players: the rules (with the contract-parity fixture), the agents' jobs, and the
// merchant's voice, which may phrase the ledger's decision but never change it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {haggleLines} from '../js/market/haggle-words.js';
import {buildHaggleCases} from '../scripts/gen-haggle-cases.mjs';
import {aiDecision, createAgents, haggleSay, jobOptions, rulesDecision, rulesJob, settleJob} from '../server/agents.js';

const merchant = id => R.MERCHANTS.find(m => m.id === id);
const fixture = JSON.parse(await readFile(new URL('./fixtures/haggle-cases.json', import.meta.url), 'utf8'));

test('the parity fixture is current: regenerate it with node scripts/gen-haggle-cases.mjs after changing the rules', () => {
  assert.equal(JSON.stringify(buildHaggleCases()), JSON.stringify(fixture));
  const outcomes = new Set(fixture.haggles.map(h => h.outcome)), codes = new Set(fixture.jobs.map(j => j.code));
  assert.deepEqual([...outcomes].sort(), ['accepted', 'countered', 'walked']);
  for (const code of ['OK', 'NOT_SHORT', 'BAD_QTY', 'BAD_PAY', 'TOO_DEAR', 'PURSE_TOO_THIN']) assert.ok(codes.has(code), code);
});

test('a merchant accepts within its room, counters once halfway beyond it, and walks away from an insult', () => {
  const lu = merchant('lu-yan'); // greedy: 2%, plus 3% when the deal fixes a shortage
  const h = offer => R.haggle({merchant: lu, side: 'sell', posted: 10_000, offer, helps: true});
  assert.deepEqual(h(9_000), {outcome: 'accepted', price: 10_000, bendBps: 500, room: 500}, 'never less than the posted price');
  assert.equal(h(10_500).price, 10_500);
  assert.deepEqual([h(10_800).outcome, h(10_800).price], ['countered', 10_250]);
  assert.equal(h(11_001).outcome, 'walked');
  const buy = R.haggle({merchant: merchant('gao-shan'), side: 'buy', posted: 10_000, offer: 9_600});
  assert.deepEqual([buy.outcome, buy.price], ['accepted', 9_600], 'a cautious merchant gives 4% on a purchase');
  const thin = R.haggle({merchant: lu, side: 'sell', posted: 10_000, offer: 10_100, struggling: true});
  assert.deepEqual([thin.outcome, thin.price], ['countered', 10_000], 'a thin purse pays its price and no more');
});

test('haggling both ways never beats the spread: buying low and selling straight back loses', () => {
  for (const m of R.MERCHANTS) {
    const state = R.openingState(m, MARKET_TOKENS);
    for (const id of Object.keys(state.target).slice(0, 6)) {
      const token = MARKET_TOKENS[id];
      const buy = R.quote({merchant: m, state, token, side: 'buy', qty: 1, testimonyBps: R.BPS}); // tax-free, the worst case
      if (!buy.ok) continue;
      const bought = R.haggle({merchant: m, side: 'buy', posted: buy.total, offer: 1, helps: true});
      const paid = buy.total - bought.room; // the best a haggler gets
      const after = R.applyQuote(state, {...buy, total: paid});
      const sell = R.quote({merchant: m, state: after, token, side: 'sell', qty: 1, testimonyBps: R.BPS, reputationBps: R.BPS});
      const sold = sell.total + R.haggle({merchant: m, side: 'sell', posted: sell.total, offer: sell.total * 2, helps: true}).room;
      assert.ok(sold < paid, `${m.id} ${id}: bought at ${paid}, sold back at ${sold}`);
    }
  }
});

test('the merchant explains its answer in its own words', () => {
  const lu = merchant('lu-yan'), token = MARKET_TOKENS['mat:essence-ember-1'];
  const h = R.haggle({merchant: lu, side: 'sell', posted: 10_000, offer: 10_800, helps: true});
  const lines = haggleLines(lu, token, h, {side: 'sell', posted: 10_000, offer: 10_800, helps: true});
  assert.match(lines[0], /Meet me at 102\.50 jade/);
  assert.ok(lines.some(l => /short of Mortal Cinder Essence/.test(l)));
  assert.ok(lines.some(l => /move 5%/.test(l)));
});

// ---------------------------------------------------------------- agents: jobs

function books(id, tweak = {}) {
  const m = merchant(id), s = R.openingState(m, MARKET_TOKENS);
  return {account_id: `m-${id}.ashes-ninth.testnet`, rules_id: id, name: m.name, cash: String(s.cash), closed: false, status: 'open', specialty: null, tick: 0, patrons: [],
    goods: Object.keys(s.target).map(t => ({token_id: t, stock: String(tweak[t] ?? s.stock[t]), target: String(s.target[t]), base_target: String(s.baseTarget[t]), flow: 0}))};
}

test('a merchant short of a good proposes a job the contract will accept; a full shop proposes none', () => {
  assert.equal(rulesJob(books('lu-yan'), 0), null, 'full shelves, no job');
  const b = books('lu-yan', {'mat:essence-ember-1': 20, 'mat:essence-ember-2': 70});
  const [first] = jobOptions(b, 0);
  assert.equal(first.token, 'mat:essence-ember-1', 'the shortest good first');
  const job = rulesJob(b, 0);
  assert.equal(job.token, 'mat:essence-ember-1');
  assert.ok(job.payEach > first.bid && job.payEach < first.mid, 'pays better than its bid, below its own valuation');
  assert.ok(job.units >= 1 && job.units <= R.JOBS.maxUnits);
  assert.equal(R.checkJob(merchant('lu-yan'), {stock: 20, target: first.target, bid: first.bid, mid: first.mid, cash: Number(b.cash), open: true},
    {units: job.units, payEach: job.payEach}), 'OK');
  assert.equal(rulesJob({...b, status: 'struggling'}, 0), null, 'a struggling shop hires nobody');
  const greedy = settleJob(b, first, {units: 999, pay: first.mid * 5});
  assert.ok(greedy.units <= R.JOBS.maxUnits && greedy.payEach <= first.bid + Math.floor((first.mid - first.bid) * 0.6), 'the model is clamped');
});

test('the model may pick which shortage to hire for; its choice is clamped and checked', async () => {
  const b = books('lu-yan', {'mat:essence-ember-1': 20, 'mat:essence-ember-2': 30});
  const rules = rulesDecision(b, 0);
  rules.jobOptions = jobOptions(b, 0);
  rules.job = settleJob(b, rules.jobOptions[0]);
  const reply = content => async () => ({ok: true, json: async () => ({choices: [{message: {content}}]})});
  const pick = await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('{"targets":{},"hire":{"id":"mat:essence-ember-2","units":5,"pay":999},"say":"I need Cinder."}')});
  assert.equal(pick.job.token, 'mat:essence-ember-2');
  assert.equal(pick.job.units, 5);
  const none = await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('{"targets":{},"hire":null,"say":"Not today."}')});
  assert.equal(none.job, null, 'the merchant may choose not to hire');
  const bogus = await aiDecision(b, 0, rules, {apiKey: 'k', fetchImpl: reply('{"targets":{},"hire":{"id":"mat:seal-jade-1","units":5,"pay":1},"say":"Hm."}')});
  assert.deepEqual(bogus.job, rules.job, 'a good it may not hire for falls back to the rules');
});

test('the agents post the day\'s job from the merchant\'s own account, and not while one is open', async () => {
  const store = {data: {}, save() {}}, calls = [];
  const all = [books('lu-yan', {'mat:essence-ember-1': 20}), books('mu-xiao')];
  let jobs = [];
  const chain = {online: async () => true, agentsReady: async () => true, forgetBooks() {},
    market: async () => ({tick: 0, merchants: all, jobs}),
    agentCall: async (id, method, args) => { calls.push({id, method, args}); return {ok: true, tx: 'tx-' + calls.length}; }};
  const agents = createAgents({store, chain, decide: async (b, t, rules) => rules, perRound: 20});
  await agents.round();
  const posted = calls.filter(c => c.method === 'merchant_post_job');
  assert.equal(posted.length, 1);
  assert.equal(posted[0].id, 'm-lu-yan.ashes-ninth.testnet');
  assert.equal(posted[0].args.token_id, 'mat:essence-ember-1');
  assert.equal(store.data.journal['lu-yan'][0].job.ok, true);
  jobs = [{merchant_id: 'm-lu-yan.ashes-ninth.testnet', expired: false}];
  store.data.agents = {};
  await agents.round();
  assert.equal(calls.filter(c => c.method === 'merchant_post_job').length, 1, 'one job at a time');
});

// ---------------------------------------------------------------- the merchant's voice

test('the merchant voices the ledger\'s decision, and a line that changes the price is not used', async () => {
  const receipt = {outcome: 'countered', merchant_id: 'm-lu-yan.ashes-ninth.testnet', token_id: 'mat:essence-ember-1', amount: '10', sell: true,
    posted: '10000', offer: '10800', price: '10250', bend_bps: 500, helps: true};
  const b = books('lu-yan');
  const rules = await haggleSay(receipt, b, {apiKey: ''});
  assert.equal(rules.source, 'rules');
  assert.match(rules.say, /102\.50 jade/);
  const reply = content => async () => ({ok: true, json: async () => ({choices: [{message: {content}}]})});
  const good = await haggleSay(receipt, b, {apiKey: 'k', fetchImpl: reply('"Ha! For Cinder this fine? 102.50 jade, and only because my kilns run low."')});
  assert.equal(good.source, 'near-ai');
  assert.equal(good.say, 'Ha! For Cinder this fine? 102.50 jade, and only because my kilns run low.');
  const wrong = await haggleSay(receipt, b, {apiKey: 'k', fetchImpl: reply('Fine, 108.00 jade it is.')});
  assert.equal(wrong.source, 'rules', 'a model that changes the price is ignored');
  const leaky = await haggleSay(receipt, b, {apiKey: 'k', fetchImpl: reply('102.50 jade, paid in crypto.')});
  assert.equal(leaky.source, 'rules');
  const down = await haggleSay(receipt, b, {apiKey: 'k', fetchImpl: async () => { throw new Error('down'); }});
  assert.equal(down.source, 'rules');
});
