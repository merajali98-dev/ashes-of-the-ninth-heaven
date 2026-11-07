// The ledger mirror in the browser (js/online/ledger.js), with fetch stubbed: the practice market's quotes run on the
// ledger's books, the practice purse is set aside and given back, and changes outside the market reach the ledger.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {state as session} from '../js/online/session.js';
import {applyToSave, ledger, overlay, reconcile, refresh, restorePractice} from '../js/online/ledger.js';
import {marketWorld, playerQuote} from '../js/market/local.js';
import {freshGame} from '../js/progression.js';

const LU = R.MERCHANTS.find(m => m.id === 'lu-yan');
function books() {
  const {stock, target, baseTarget, flow, cash} = R.openingState(LU, MARKET_TOKENS);
  const goods = Object.keys(target).map(id => ({token_id: id, stock: String(Math.floor(stock[id] / 3)), target: String(target[id]), base_target: String(baseTarget[id]), flow: flow[id] ?? 0}));
  return {account_id: 'm-lu-yan.ashes-ninth.testnet', rules_id: 'lu-yan', name: 'Lu Yan', cash: String(cash), closed: false, specialty: null, tick: 40, goods, patrons: [['shen-luo.ashes-ninth.testnet', '500']]};
}
const balances = () => ({jade: 15_000, 'mat:essence-ember-1': 8, 'mat:essence-iron-1': 4});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (path, init = {}) => {
    calls.push({path, body: init.body ? JSON.parse(init.body) : null});
    const {status = 200, json} = handler(path, init);
    return {ok: status < 400, status, json: async () => json};
  };
  return calls;
}

test('sealed, the market quotes on the ledger books and the save mirrors ledger balances; signing out gives the practice purse back', async () => {
  Object.assign(session, {ledger: true, signedIn: true, user: {name: 'shen', seal: {id: 'shen-luo.ashes-ninth.testnet'}}});
  stubFetch(() => ({json: {ledger: {tick: 40, testimonyBps: 0, merchants: [books()], balances: balances(), contract: 'items.ashes-ninth.testnet'}}}));
  const game = freshGame(7);
  game.started = true;
  game.jade = 35;
  game.materials = {'essence-tide-1': 3};
  marketWorld(game);
  await refresh();
  assert.equal(ledger.active, true);

  const world = marketWorld(game);
  assert.equal(world.markets['lu-yan'].stock['mat:essence-ember-1'], Number(books().goods.find(g => g.token_id === 'mat:essence-ember-1').stock));
  assert.equal(world.patrons['lu-yan'].player, 500, "the player's own patronage is theirs");
  const expected = R.quote({merchant: LU, state: overlay(world).markets['lu-yan'], token: MARKET_TOKENS['mat:essence-ember-1'], side: 'sell', qty: 3, tick: 40, reputationBps: 0, testimonyBps: 0});
  applyToSave(game);
  assert.equal(playerQuote(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 3).total, expected.total);
  assert.equal(game.jade, 150);
  assert.equal(game.materials['essence-ember-1'], 8);
  assert.equal(game.materials['essence-tide-1'], undefined, 'practice goods are set aside while sealed');

  restorePractice(game);
  assert.equal(game.jade, 35);
  assert.equal(game.materials['essence-tide-1'], 3);
  assert.equal(ledger.active, false);
});

test('a reward or a cost outside the market is sent to the ledger; a refusal is undone in the save', async () => {
  Object.assign(session, {ledger: true, signedIn: true, user: {name: 'shen', seal: {id: 'shen-luo.ashes-ninth.testnet'}}});
  let refuse = false;
  const calls = stubFetch(path => path === '/api/ledger/sync'
    ? (refuse ? {status: 429, json: {error: 'REWARD_CAP'}} : {json: {ok: true}})
    : {json: {ledger: {tick: 40, testimonyBps: 0, merchants: [books()], balances: balances(), contract: 'items.ashes-ninth.testnet'}}});
  const game = freshGame(7);
  game.started = true;
  marketWorld(game);
  await refresh();
  applyToSave(game);

  game.materials['essence-ember-1'] += 2;   // a battle drop
  game.jade -= 20;                          // forging
  assert.equal(await reconcile(game, 'a commission'), null);
  const sync = calls.find(c => c.path === '/api/ledger/sync').body;
  assert.deepEqual(sync, {gains: {'mat:essence-ember-1': 2}, spends: {jade: 2_000}, reason: 'a commission'});
  assert.equal(await reconcile(game), null, 'nothing new, nothing sent');
  assert.equal(calls.filter(c => c.path === '/api/ledger/sync').length, 1);

  refuse = true;
  game.materials['essence-iron-1'] = 99;
  assert.equal(await reconcile(game), 'REWARD_CAP');
  assert.equal(game.materials['essence-iron-1'], 4, 'the refused reward is taken back out of the save');
  restorePractice(game);
});
