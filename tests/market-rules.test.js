import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as rules from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';

const {MERCHANTS, BPS, PRICE_BAND, quote, applyQuote, tickMerchant, openingState, applyStrategy, midPrice, scarcityPpm,
  merchantStatus, validateRules, edictSchool, activeEvent, EVENTS, ADAPTATION, PURSE} = rules;
const merchant = id => MERCHANTS.find(m => m.id === id);
const token = id => MARKET_TOKENS[id];
const cinder = token('mat:essence-ember-2');
const quietTick = EVENTS.durationTicks + 1;          // no market event is active at this hour
const rng = seed => () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

test('the rules file is pure: no clock, randomness, imports or floating-point rounding', async () => {
  const source = await readFile(new URL('../js/market/merchant-rules.js', import.meta.url), 'utf8');
  for (const banned of [/\bDate\b/, /Math\.random/, /^import /m, /Math\.round/, /\bfetch\(/, /localStorage/])
    assert.doesNotMatch(source, banned);
  assert.ok(source.split('\n').length <= 300, 'the rules file stays readable in one sitting');
});

test('the rules satisfy their own invariants', () => {
  assert.deepEqual(validateRules(), []);
});

test('the token registry covers all 45 materials and the pills and talismans', () => {
  const tokens = Object.values(MARKET_TOKENS);
  assert.equal(tokens.filter(t => t.kind === 'material').length, 45);
  assert.equal(tokens.filter(t => t.kind === 'consumable').length, 46);
  assert.ok(tokens.every(t => Number.isSafeInteger(t.base) && t.base >= 100));
});

test('scarcity uses exact quarter-step powers', () => {
  assert.equal(scarcityPpm(100, 100, 4), 1_000_000);
  assert.equal(scarcityPpm(400, 100, 2), 2_000_000);      // (4)^(1/2)
  assert.equal(scarcityPpm(100, 400, 2), 500_000);        // (1/4)^(1/2)
  assert.equal(scarcityPpm(1600, 100, 1), 2_000_000);     // (16)^(1/4)
  assert.equal(scarcityPpm(300, 100, 4), 3_000_000);
  assert.equal(scarcityPpm(100, 0, 4), 100_000_000);      // empty stock is treated as one unit, ratio capped at 100
});

test('every merchant opens with stock on target and a full purse', () => {
  for (const m of MERCHANTS) {
    const state = openingState(m, MARKET_TOKENS);
    assert.ok(Object.keys(state.target).length > 0, m.id);
    assert.equal(merchantStatus(m, state), 'open');
    for (const id of Object.keys(state.target)) {
      const q = quote({merchant: m, state, token: token(id), side: 'sell', tick: quietTick});
      assert.ok(q.ok, `${m.id} buys ${id}`);
      assert.ok(q.bid < q.ask, `${m.id} ${id} spread`);
    }
  }
  const shi = openingState(merchant('auntie-shi'), MARKET_TOKENS);
  assert.ok(Object.keys(shi.target).some(id => id.startsWith('item:')), 'Auntie Shi stocks consumables');
});

test('flooding a greedy merchant crashes its bid by more than half', () => {
  const lu = merchant('lu-yan');
  let state = openingState(lu, MARKET_TOKENS);
  const before = quote({merchant: lu, state, token: cinder, side: 'sell', tick: quietTick}).bid;
  const target = state.target[cinder.id];
  for (let sold = 0; sold < target * 2; sold += 20) {
    const q = quote({merchant: lu, state, token: cinder, side: 'sell', qty: 20, tick: quietTick});
    assert.ok(q.ok, q.reason);
    state = applyQuote(state, q);
  }
  const after = quote({merchant: lu, state, token: cinder, side: 'sell', tick: quietTick});
  assert.ok(after.bid * 2 < before, `bid fell from ${before} to ${after.bid}`);
  assert.match(after.lines.join(' '), /I'm holding \d+ Spirit Cinder Essence and only want \d+/);
});

test('prices never leave the 30%–300% band, whatever the state', () => {
  const r = rng(7);
  for (let i = 0; i < 3000; i++) {
    const m = MERCHANTS[between(r, 0, MERCHANTS.length - 1)];
    const ids = Object.keys(openingState(m, MARKET_TOKENS).target), t = token(ids[between(r, 0, ids.length - 1)]);
    const p = midPrice(m, t, {stock: between(r, 0, 5000), target: between(r, 1, 500), flow: between(r, -2000, 2000), tick: between(r, 0, 2000)});
    assert.ok(p.mid >= Math.max(1, Math.trunc(t.base * PRICE_BAND.floorBps / BPS)) && p.mid <= Math.trunc(t.base * PRICE_BAND.ceilingBps / BPS));
  }
});

test('buying and selling straight back always loses money, in either order', () => {
  const r = rng(11);
  for (let i = 0; i < 1500; i++) {
    const m = MERCHANTS[between(r, 0, MERCHANTS.length - 1)];
    let state = openingState(m, MARKET_TOKENS);
    const ids = Object.keys(state.target), t = token(ids[between(r, 0, ids.length - 1)]);
    const target = state.target[t.id], qty = between(r, 1, Math.min(25, target)), tick = between(r, 0, 1000), rep = between(r, 0, BPS);
    state = {...state, stock: {...state.stock, [t.id]: between(r, qty, target * 3)}, flow: {[t.id]: between(r, -3 * target, 3 * target)},
      specialty: r() < .5 ? t.school : null};
    const buy = quote({merchant: m, state, token: t, side: 'buy', qty, tick, reputationBps: rep});
    const back = quote({merchant: m, state: applyQuote(state, buy), token: t, side: 'sell', qty, tick, reputationBps: rep});
    assert.ok(buy.ok && back.ok, buy.reason || back.reason);
    assert.ok(back.total < buy.total, `${m.id} ${t.id}: paid ${buy.total}, got ${back.total}`);
    const sell = quote({merchant: m, state, token: t, side: 'sell', qty, tick, reputationBps: rep});
    const rebuy = quote({merchant: m, state: applyQuote(state, sell), token: t, side: 'buy', qty, tick, reputationBps: rep});
    assert.ok(sell.ok && rebuy.ok, sell.reason || rebuy.reason);
    assert.ok(sell.total < rebuy.total, `${m.id} ${t.id}: got ${sell.total}, repaid ${rebuy.total}`);
  }
});

test('each unit in a sale pays no more than the one before it', () => {
  const ya = merchant('elder-ya'), state = openingState(ya, MARKET_TOKENS), t = token('mat:essence-tide-1');
  const q = quote({merchant: ya, state, token: t, side: 'sell', qty: 40, tick: quietTick});
  assert.ok(q.ok);
  for (let i = 1; i < q.units.length; i++) assert.ok(q.units[i] <= q.units[i - 1]);
  assert.ok(q.units.at(-1) < q.units[0]);
  assert.equal(q.total, q.units.reduce((a, b) => a + b, 0));
  assert.match(q.lines.join(' '), /First unit .* last .*every unit moves my price/);
});

test('a thin purse pays less, an empty one stops buying, and a broke shop closes until rekindled', () => {
  const lu = merchant('lu-yan'), base = openingState(lu, MARKET_TOKENS);
  const healthy = quote({merchant: lu, state: base, token: cinder, side: 'sell', tick: quietTick});
  const thin = {...base, cash: Math.trunc(lu.startCash * 0.2)};
  const thinQuote = quote({merchant: lu, state: thin, token: cinder, side: 'sell', tick: quietTick});
  assert.equal(thinQuote.status, 'struggling');
  assert.ok(thinQuote.bid < healthy.bid);
  assert.match(thinQuote.lines.join(' '), /purse is thin/);
  const nearlyEmpty = {...base, cash: Math.trunc(lu.startCash * 0.101)};
  assert.equal(quote({merchant: lu, state: nearlyEmpty, token: cinder, side: 'sell', qty: 99, tick: quietTick}).code, 'PURSE_EMPTY');
  const broke = tickMerchant(lu, {...base, cash: Math.trunc(lu.startCash * 0.04)}, quietTick, MARKET_TOKENS);
  assert.equal(broke.closed, true);
  assert.equal(merchantStatus(lu, broke), 'closed');
  assert.equal(quote({merchant: lu, state: broke, token: cinder, side: 'buy', tick: quietTick}).code, 'CLOSED');
  const stillClosed = tickMerchant(lu, broke, quietTick + 1, MARKET_TOKENS);
  assert.equal(stillClosed.cash, broke.cash, 'a shuttered shop pays no upkeep');
  const rekindled = tickMerchant(lu, {...broke, cash: Math.trunc(lu.startCash * PURSE.reopenAtBps / BPS)}, quietTick + 2, MARKET_TOKENS);
  assert.equal(rekindled.closed, false);
});

test('caravans pull stock back toward target and demand memory fades', () => {
  const he = merchant('he-feng'), t = token('mat:essence-thunder-1');
  let state = openingState(he, MARKET_TOKENS);
  const target = state.target[t.id];
  let calm = state;
  state = {...state, stock: {...state.stock, [t.id]: target * 3}, flow: {[t.id]: -200}};
  for (let h = 0; h < 72; h++) {       // avoid day ends, so the merchant doesn't learn mid-test
    state = tickMerchant(he, state, h * 24 + 1, MARKET_TOKENS);
    calm = tickMerchant(he, calm, h * 24 + 1, MARKET_TOKENS);
  }
  assert.ok(Math.abs(state.stock[t.id] - target) < target * 0.25, `stock ${state.stock[t.id]} vs target ${target}`);
  assert.ok(Math.abs(state.flow[t.id]) <= 1);
  assert.ok(state.cash > calm.cash, 'caravans pay something for surplus');
  assert.ok(calm.cash < he.startCash, 'an idle shop still pays upkeep');
});

test('merchants learn within the band, and agents can only nudge targets and specialty', () => {
  const gao = merchant('gao-shan'), t = token('mat:essence-star-3');
  let state = openingState(gao, MARKET_TOKENS);
  const base = state.baseTarget[t.id];
  for (let day = 0; day < 60; day++) {
    state = {...state, stock: {...state.stock, [t.id]: 0}};
    state = tickMerchant(gao, state, day * ADAPTATION.everyTicks + ADAPTATION.everyTicks - 1, MARKET_TOKENS);
  }
  assert.equal(state.target[t.id], Math.trunc(base * ADAPTATION.maxBps / BPS));
  const nudged = applyStrategy(gao, state, {targetBps: {[t.id]: 99_999, 'mat:not-real': 5000}, specialty: 'star'});
  assert.equal(nudged.target[t.id], Math.trunc(base * ADAPTATION.maxBps / BPS));
  assert.equal(nudged.specialty, 'star');
  assert.ok(!('mat:not-real' in nudged.target));
  assert.equal(applyStrategy(gao, state, {specialty: 'ember'}).specialty, null, 'a merchant can only specialise in what it trades');
});

test('the Pagoda Edict and market events follow fixed rules and explain themselves', () => {
  const week = edictSchool(0);
  assert.equal(edictSchool(167), week);
  assert.ok(new Set(Array.from({length: 20}, (_, w) => edictSchool(w * 168))).size >= 4, 'the edict rotates');
  const event = activeEvent(0), quiet = activeEvent(EVENTS.durationTicks);
  assert.ok(event && quiet === null);
  const m = MERCHANTS.find(x => Object.keys(x.families).includes(event.family));
  const state = openingState(m, MARKET_TOKENS), t = Object.values(MARKET_TOKENS).find(x => x.family === event.family && x.tier === 1);
  const during = quote({merchant: m, state, token: t, side: 'sell', tick: 0}), after = quote({merchant: m, state, token: t, side: 'sell', tick: quietTick});
  assert.notEqual(during.bid, after.bid);
  assert.ok(during.lines.some(line => line.startsWith(event.text)));
  const edictToken = Object.values(MARKET_TOKENS).find(x => x.kind === 'material' && x.school === week);
  const edictMerchant = MERCHANTS.find(x => x.families[edictToken.family] === 'specialty');
  const edictQuote = quote({merchant: edictMerchant, state: openingState(edictMerchant, MARKET_TOKENS), token: edictToken, side: 'sell', tick: quietTick});
  assert.ok(edictQuote.lines.some(line => line.includes('Pagoda Edict favours')));
});

test('every quote explains itself, including refusals', () => {
  const qiu = merchant('granny-qiu'), state = openingState(qiu, MARKET_TOKENS);
  const q = quote({merchant: qiu, state, token: token('mat:seal-jade-1'), side: 'sell', tick: quietTick, reputationBps: BPS});
  assert.ok(q.ok);
  assert.ok(q.lines.length >= 3);
  assert.match(q.lines.at(-1), new RegExp(`I pay ${rules.jade(q.bid)} · I sell at ${rules.jade(q.ask)}`));
  assert.ok(q.lines.some(line => line.includes('regular')));
  const pill = Object.values(MARKET_TOKENS).find(t => t.kind === 'consumable');
  const refused = quote({merchant: qiu, state, token: pill, side: 'sell'});
  assert.equal(refused.code, 'NOT_TRADED');
  assert.match(refused.lines[0], /doesn't deal in/);
  assert.equal(quote({merchant: qiu, state, token: token('mat:seal-jade-1'), side: 'sell', qty: 0}).code, 'BAD_QTY');
  assert.equal(quote({merchant: qiu, state, token: token('mat:seal-jade-1'), side: 'buy', qty: 99}).code, 'OUT_OF_STOCK');
  const full = {...state, stock: {...state.stock, 'mat:seal-jade-1': state.target['mat:seal-jade-1'] * 5}};
  const refusedFull = quote({merchant: qiu, state: full, token: token('mat:seal-jade-1'), side: 'sell'});
  assert.equal(refusedFull.code, 'STOREROOM_FULL');
  assert.match(refusedFull.lines[0], /storeroom is full/);
});

test('quotes are deterministic', () => {
  const lu = merchant('lu-yan'), state = openingState(lu, MARKET_TOKENS);
  const a = quote({merchant: lu, state, token: cinder, side: 'buy', qty: 7, tick: 333});
  const b = quote({merchant: lu, state, token: cinder, side: 'buy', qty: 7, tick: 333});
  assert.deepEqual(a, b);
});
