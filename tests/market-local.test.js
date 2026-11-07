import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import * as rules from '../js/progression.js';
import {advance, bestPrices, HOUR_MS, marketWorld, playerInvest, playerQuote, playerTrade, walletCents} from '../js/market/local.js';
import {merchantsTab, priceBoard, simPage, marketTeaser, awayDialog} from '../js/market/views.js';
import {runFastForward} from '../js/market/fastforward.js';
import {SHOP_TABS, shop} from '../js/workshop-views.js';

const T0 = Date.UTC(2026, 10, 6, 12);
const started = (seed = 7) => {
  const game = rules.freshGame(seed);
  rules.begin(game, 'Market Tester');
  game.materials = {'essence-ember-1': 30, 'seal-jade-1': 20};
  game.jade = 50;
  marketWorld(game, T0);
  return game;
};
const roundTrip = game => rules.readSave(null, JSON.stringify(game));

test('a market lives inside the save, and the save stays valid after trading', () => {
  const game = started();
  assert.equal(game.market.version, 1);
  assert.equal(game.market.lastHourAt, T0);
  const sold = playerTrade(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 10);
  assert.ok(sold.ok, sold.reason);
  assert.equal(game.materials['essence-ember-1'], 20);
  assert.equal(walletCents(game), 5_000 + sold.quote.total);
  assert.ok(Number.isSafeInteger(game.jade) && game.market.fen >= 0 && game.market.fen < 100);
  const loaded = roundTrip(game);
  assert.equal(loaded.warning, undefined, 'the chronicle still loads');
  assert.deepEqual(loaded.game.market.markets['lu-yan'], game.market.markets['lu-yan']);
});

test('prices survive a save and reload exactly', () => {
  const game = started();
  playerTrade(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 15);
  const before = playerQuote(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 1);
  const reloaded = roundTrip(game).game;
  const after = playerQuote(reloaded, 'lu-yan', 'mat:essence-ember-1', 'sell', 1);
  assert.equal(after.bid, before.bid);
  assert.deepEqual(after.lines, before.lines);
});

test('buying spends the change purse first and respects cultivation gates', () => {
  const game = started();
  game.market.fen = 99;
  const bought = playerTrade(game, 'elder-ya', 'mat:seal-jade-1', 'buy', 1);
  assert.ok(bought.ok, bought.reason);
  assert.equal(walletCents(game), 5_099 - bought.quote.total);
  assert.equal(game.materials['seal-jade-1'], 21);
  const locked = playerQuote(game, 'gao-shan', 'mat:essence-star-5', 'buy', 1);
  assert.equal(locked.code, 'LOCKED');
  assert.match(locked.reason, /Reach cultivation level \d+/);
  assert.equal(playerTrade(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 999).ok, false);
});

test('pills and talismans trade with Auntie Shi and land in the bag', () => {
  const game = started();
  game.jade = 500;
  const pill = Object.keys(marketWorld(game).markets['auntie-shi'].target).find(id => id.startsWith('item:'));
  const bought = playerTrade(game, 'auntie-shi', pill, 'buy', 2);
  assert.ok(bought.ok, bought.reason);
  assert.equal(game.bag[pill.slice(5)] >= 2, true);
  assert.equal(roundTrip(game).warning, undefined);
});

test('trading waits until the oath is sworn and the expedition is over', () => {
  const fresh = rules.freshGame(3);
  marketWorld(fresh, T0);
  assert.match(playerTrade(fresh, 'lu-yan', 'mat:essence-ember-1', 'sell', 1).reason, /oath/);
  const game = started();
  game.active = {kind: 'trial'};
  assert.match(playerTrade(game, 'lu-yan', 'mat:essence-ember-1', 'sell', 1).reason, /expedition/);
});

test('market hours pass with real time, and a long absence catches up at most a week', () => {
  const game = started();
  assert.equal(advance(game, T0 + 30_000).hours, 0);
  const hour = advance(game, T0 + HOUR_MS * 3 + 5);
  assert.equal(hour.hours, 3);
  assert.equal(marketWorld(game).tick, 3);
  const away = advance(game, T0 + HOUR_MS * 10_000);
  assert.equal(away.hours, 168);
  assert.equal(game.market.lastHourAt, T0 + HOUR_MS * 10_000);
  assert.ok(away.events.some(e => e.type === 'edict'), 'a new Pagoda Edict was announced');
  assert.equal(roundTrip(game).warning, undefined);
  assert.match(awayDialog(away).body, /kept trading without you/);
});

test('patrons invest from their jade, and a closed shop can be rekindled', () => {
  const game = started();
  game.jade = 400;
  assert.ok(playerInvest(game, 'gao-shan', 100).ok);
  assert.equal(game.jade, 300);
  assert.equal(marketWorld(game).patrons['gao-shan'].player, 10_000);
  const world = marketWorld(game);
  world.markets['lu-yan'] = {...world.markets['lu-yan'], cash: 1_000, closed: true};
  const rekindle = playerInvest(game, 'lu-yan', 50);
  assert.ok(rekindle.ok);
  assert.match(rekindle.message, /rekindling/);
});

test('the best price helper finds the highest bid and the lowest ask', () => {
  const game = started();
  const {bid, ask} = bestPrices(game, 'mat:seal-jade-1');
  assert.ok(bid && ask);
  for (const id of ['granny-qiu', 'elder-ya', 'mu-xiao']) assert.ok(playerQuote(game, id, 'mat:seal-jade-1', 'sell').bid <= bid.bid);
});

test('the shop sells materials only through merchants, and consumables only through Auntie Shi', () => {
  assert.deepEqual(SHOP_TABS.map(([id]) => id), ['quick', 'merchants', 'stalls', 'prices', 'cards', 'goods', 'sell']);
  const game = started();
  game.bag = {'roadside-bitter-pill': 2, ...game.bag};
  const gear = shop(game, {tab: 'sell'});
  assert.doesNotMatch(gear, /Roadside Bitter Pill/);
  assert.doesNotMatch(shop(game, {tab: 'merchants'}), /Celestial Treasury/);
});

test('no market screen mentions wallets, keys, gas or the chain', async () => {
  const game = started();
  const sim = runFastForward({seed: 1});
  const screens = [merchantsTab(game, {merchant: 'lu-yan'}), priceBoard(game), simPage(sim, {simFrame: 167}), marketTeaser(game), shop(game, {})].join('\n');
  const banned = /\b(wallet|seed phrase|mnemonic|private key|gas|signature|sign transaction|blockchain|crypto|yocto|NEAR)\b/i;
  assert.doesNotMatch(screens.replace(/<[^>]+>/g, ' '), banned);
  for (const file of await readdir(new URL('../js/market/', import.meta.url))) {
    const source = await readFile(new URL('../js/market/' + file, import.meta.url), 'utf8');
    const strings = source.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
    assert.doesNotMatch(strings.join(' '), banned, file);
  }
});
