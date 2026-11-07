// The market as the Honest Ledger has it, mirrored into the browser while the player's seal is pressed.
//  • The nine merchants' books come from the contract (through /api/ledger); prices and reasons are computed here from
//    the same merchant-rules.js the contract was generated from, so tooltips stay instant.
//  • The player's goods and jade in the save mirror their ledger balances. A trade is signed by the device key and
//    relayed; rewards and costs outside the market (battle drops, forging, selling gear) are sent as grants and burns.
//  • The practice purse is set aside when the seal is first used in this save and given back on sign-out.
import {MARKET_TOKENS} from '../market/tokens.js';
import * as R from '../market/merchant-rules.js';
import {state as session, sealCall} from './session.js';

export const ledger = {active: false, books: null, balances: null, listings: [], contract: null, at: 0, error: null, syncing: 0};
const TOKENS = Object.keys(MARKET_TOKENS);
const PLAYER = 'player';

export const isActive = () => ledger.active;

async function get(path) {
  const res = await fetch(path, {credentials: 'same-origin', headers: {'X-Ashes': '1'}});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'SERVER'), {code: json.error || 'SERVER'});
  return json.ledger;
}
async function post(path, body) {
  const res = await fetch(path, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-Ashes': '1'}, body: JSON.stringify(body)});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || 'SERVER'), {code: json.error || 'SERVER'});
  return json;
}

/** Reads the ledger. The mirror is active only while the player is signed in with a pressed seal. */
export async function refresh() {
  if (!session.ledger || !session.user?.seal) { ledger.active = false; return ledger; }
  try {
    const data = await get('/api/ledger');
    ledger.books = {tick: data.tick, testimonyBps: data.testimonyBps ?? 0, merchants: Object.fromEntries(data.merchants.map(m => [m.rules_id, m]))};
    ledger.listings = data.listings ?? [];
    ledger.journal = data.journal ?? {};
    ledger.deeds = data.deeds ?? [];
    ledger.contract = data.contract;
    if (data.balances) ledger.balances = data.balances;
    ledger.active = Boolean(data.balances && data.contract);
    ledger.at = Date.now();
    ledger.error = null;
  } catch (error) { ledger.error = error.code; }
  return ledger;
}

/** A copy of the practice world whose merchants are the ledger's. Quotes on it equal the contract's (parity test). */
export function overlay(world) {
  if (!ledger.active) return world;
  const markets = {...world.markets}, patrons = {...world.patrons};
  for (const [id, b] of Object.entries(ledger.books.merchants)) {
    const map = key => Object.fromEntries(b.goods.map(g => [g.token_id, Number(g[key])]));
    markets[id] = {cash: Number(b.cash), stock: map('stock'), target: map('target'), baseTarget: map('base_target'),
      flow: Object.fromEntries(b.goods.map(g => [g.token_id, g.flow])), closed: b.closed, specialty: b.specialty};
    patrons[id] = Object.fromEntries(b.patrons.map(([who, cents]) => [who === session.user.seal.id ? PLAYER : who, Number(cents)]));
  }
  return {...world, markets, patrons, tick: ledger.books.tick, testimonyBps: ledger.books.testimonyBps};
}

const holdings = game => {
  const out = {jade: game.jade * R.CENTS + (game.market?.fen ?? 0)};
  for (const token of TOKENS) {
    const [kind, id] = token.split(/:(.+)/);
    out[token] = (kind === 'mat' ? game.materials?.[id] : game.bag?.[id]) ?? 0;
  }
  return out;
};
function write(game, balances) {
  game.jade = Math.floor((balances.jade ?? 0) / R.CENTS);
  if (game.market) game.market.fen = (balances.jade ?? 0) % R.CENTS;
  game.materials ??= {};
  game.bag ??= {};
  for (const token of TOKENS) {
    const [kind, id] = token.split(/:(.+)/), store = kind === 'mat' ? game.materials : game.bag, n = balances[token] ?? 0;
    if (n > 0) store[id] = n; else delete store[id];
  }
}

/** Puts the ledger balances into the save (the practice purse is kept aside the first time). */
export function applyToSave(game) {
  if (!ledger.active || !ledger.balances) return false;
  const seal = session.user.seal.id;
  if (game.ledgerSeal?.id !== seal) {
    game.practicePurse ??= holdings(game);
    game.ledgerSeal = {id: seal};
  }
  write(game, ledger.balances);
  game.ledgerSeal.mirror = {...ledger.balances};
  return true;
}

/** Signing out: the practice purse comes back. */
export function restorePractice(game) {
  ledger.active = false;
  if (game.practicePurse) write(game, game.practicePurse);
  delete game.practicePurse;
  delete game.ledgerSeal;
}

/**
 * After any change to the save: goods or jade that moved outside the market (a battle reward, forging, selling gear)
 * are recorded on the ledger. Resolves to null, or to an error code if the ledger refused (the save is put back).
 */
export async function reconcile(game, reason = 'the game') {
  if (!ledger.active || !game.ledgerSeal?.mirror) return null;
  const before = game.ledgerSeal.mirror, now = holdings(game), gains = {}, spends = {};
  for (const [token, n] of Object.entries(now)) {
    const d = n - (before[token] ?? 0);
    if (d > 0) gains[token] = d;
    if (d < 0) spends[token] = -d;
  }
  if (!Object.keys(gains).length && !Object.keys(spends).length) return null;
  game.ledgerSeal.mirror = now;
  ledger.balances = {...ledger.balances, ...now};
  ledger.syncing++;
  try {
    await post('/api/ledger/sync', {gains, spends, reason});
    return null;
  } catch (error) {
    game.ledgerSeal.mirror = before;
    ledger.balances = {...ledger.balances, ...before};
    write(game, before);
    return error.code || 'SERVER';
  } finally { ledger.syncing--; }
}

const CODES = {NOT_FOR_SALE: 'That deed is not for sale.', TOO_MANY_DEEDS: 'One cultivator may hold at most three deeds.', ALREADY_YOURS: 'You already hold that deed.',
  STRATEGY_ALREADY_SET_TODAY: 'The shop has already decided today. Try again next market day.', NO_DEED: 'That deed does not exist.', NO_LISTING: 'That listing has just been sold or taken down.', OWN_LISTING: 'That is your own listing.', NOT_ENOUGH: 'There are not that many left.',
  TOO_MANY_LISTINGS: 'You already have 20 listings up.', MARKET_FULL: 'The stalls are full right now. Try again later.', BAD_PRICE: 'Choose a price between 0.01 and 1,000,000 jade.',
  NO_JADE: 'You need more jade for that.', NOT_YOURS: 'Only the seller can take that down.', PRICE_MOVED: 'Prices moved while you haggled. Look again and retry.', MERCHANT_CLOSED: 'That shop has closed.',
  PURSE_EMPTY: 'The merchant cannot pay for that right now.', OUT_OF_STOCK: 'The merchant has run out.', STOREROOM_FULL: 'The storeroom is full.',
  CLOSED: 'That shop has closed.', NOT_TRADED: 'This merchant does not trade that good.', BUSY: 'The Honest Ledger is busy. Try again in a minute.',
  SLOW_DOWN: 'Too many trades at once. Wait a moment.', NOT_HELD: 'You do not hold that many.', OFFLINE: 'The Honest Ledger is closed right now.'};
export const reasonFor = code => CODES[code] || 'The Honest Ledger could not record that trade. Try again.';

/** A trade with a merchant on the ledger, at the contract's own quote. */
export async function trade(game, merchantId, tokenId, side, qty) {
  const books = ledger.books?.merchants[merchantId];
  if (!books) return {ok: false, reason: reasonFor('OFFLINE')};
  try {
    const q = await get(`/api/ledger/quote?m=${encodeURIComponent(books.account_id)}&t=${encodeURIComponent(tokenId)}&side=${side}&n=${qty}`);
    if (q.code !== 'OK') return {ok: false, reason: reasonFor(q.code)};
    const limit = side === 'sell' ? {min_total: q.total} : {max_total: q.total};
    const result = await sealCall(ledger.contract, side === 'sell' ? 'market_sell' : 'market_buy',
      {merchant_id: books.account_id, token_id: tokenId, amount: String(qty), ...limit});
    if (!result.ok) return {ok: false, reason: reasonFor(result.code)};
    const total = Number(result.receipt?.total ?? q.total), sign = side === 'sell' ? 1 : -1;
    const next = {...ledger.balances, jade: ledger.balances.jade + sign * total, [tokenId]: (ledger.balances[tokenId] ?? 0) - sign * qty};
    ledger.balances = next;
    write(game, next);
    game.ledgerSeal.mirror = {...next};
    refresh(); // the merchant's new books, in the background
    return {ok: true, total, record: result.tx};
  } catch (error) { return {ok: false, reason: reasonFor(error.code)}; }
}

/** Patronage or rekindling on the ledger. */
export async function invest(game, merchantId, cents) {
  const books = ledger.books?.merchants[merchantId];
  if (!books) return {ok: false, reason: reasonFor('OFFLINE')};
  try {
    const result = await sealCall(ledger.contract, 'patron_invest', {merchant_id: books.account_id, amount: String(cents)});
    if (!result.ok) return {ok: false, reason: reasonFor(result.code)};
    const next = {...ledger.balances, jade: ledger.balances.jade - cents};
    ledger.balances = next;
    write(game, next);
    game.ledgerSeal.mirror = {...next};
    refresh();
    return {ok: true, closed: books.closed, record: result.tx};
  } catch (error) { return {ok: false, reason: reasonFor(error.code)}; }
}

// ------------------------------------------------------------------ player stalls (listings held in escrow)

const applyBalances = (game, next) => {
  ledger.balances = next;
  write(game, next);
  game.ledgerSeal.mirror = {...next};
};
async function listingCall(method, args) {
  try {
    const result = await sealCall(ledger.contract, method, args);
    return result.ok ? result : {ok: false, reason: reasonFor(result.code)};
  } catch (error) { return {ok: false, reason: reasonFor(error.code)}; }
}

/** Puts goods up at your own price (jade cents each). They wait in escrow until bought or taken down. */
export async function createListing(game, tokenId, amount, priceEach) {
  const result = await listingCall('listing_create', {token_id: tokenId, amount: String(amount), price_each: String(priceEach)});
  if (!result.ok) return result;
  applyBalances(game, {...ledger.balances, [tokenId]: (ledger.balances[tokenId] ?? 0) - amount});
  await refresh();
  return {ok: true, record: result.tx};
}

export async function fillListing(game, listing, amount) {
  const result = await listingCall('listing_fill', {listing_id: listing.id, amount: String(amount), max_price_each: listing.price_each});
  if (!result.ok) return result;
  const total = Number(result.receipt?.total ?? Number(listing.price_each) * amount);
  applyBalances(game, {...ledger.balances, jade: ledger.balances.jade - total, [listing.token_id]: (ledger.balances[listing.token_id] ?? 0) + amount});
  await refresh();
  return {ok: true, total, record: result.tx};
}

export async function cancelListing(game, listing) {
  const result = await listingCall('listing_cancel', {listing_id: listing.id});
  if (!result.ok) return result;
  applyBalances(game, {...ledger.balances, [listing.token_id]: (ledger.balances[listing.token_id] ?? 0) + Number(listing.amount)});
  await refresh();
  return {ok: true, record: result.tx};
}

// ------------------------------------------------------------------ commissions: proof of battle

/** Before a commission on the ledger: the server deals the seed and keeps the battle's inputs. */
export async function startCommission(school, tier, inputs, difficulty) {
  try { return await post('/api/battle/start', {school, tier, inputs, difficulty}); }
  catch (error) { return {error: error.code || 'SERVER'}; }
}

/**
 * After a won commission: its rewards are already in the save. They are taken out of the "changes to record" (the
 * server mints them itself after replaying the battle) and put back out of the save if the replay is refused.
 */
export async function claimCommission(game, battleId, actions, before) {
  if (!ledger.active || !game.ledgerSeal?.mirror) return null;
  const now = holdings(game), gained = {};
  for (const [token, n] of Object.entries(now)) if (n > (before[token] ?? 0)) gained[token] = n - (before[token] ?? 0);
  game.ledgerSeal.mirror = {...game.ledgerSeal.mirror, ...Object.fromEntries(Object.entries(gained).map(([t, n]) => [t, (game.ledgerSeal.mirror[t] ?? 0) + n]))};
  ledger.balances = {...ledger.balances, ...game.ledgerSeal.mirror};
  try {
    await post('/api/battle/claim', {battleId, actions});
    return null;
  } catch (error) {
    const back = {...game.ledgerSeal.mirror};
    for (const [t, n] of Object.entries(gained)) back[t] = Math.max(0, (back[t] ?? 0) - n);
    game.ledgerSeal.mirror = back;
    ledger.balances = {...ledger.balances, ...back};
    write(game, back);
    return error.code || 'SERVER';
  }
}

/** The save's ledger goods and jade right now (for "before the reward"). */
export const snapshotHoldings = game => holdings(game);

// ------------------------------------------------------------------ Shop Deeds (NEP-171)

async function deedCall(game, method, args, jadeDelta = 0) {
  const result = await listingCall(method, args);
  if (!result.ok) return result;
  if (jadeDelta) applyBalances(game, {...ledger.balances, jade: ledger.balances.jade + jadeDelta});
  await refresh();
  return {ok: true, record: result.tx, receipt: result.receipt};
}
export const buyDeed = (game, deed) => deedCall(game, 'deed_buy', {token_id: deed.token_id, max_price: deed.for_sale}, -Number(deed.for_sale));
export const listDeed = (game, deed, priceCents) => deedCall(game, 'deed_list', {token_id: deed.token_id, price: priceCents ? String(priceCents) : null});
export async function claimDeed(game, deed) {
  const result = await listingCall('deed_claim', {token_id: deed.token_id});
  if (!result.ok) return result;
  const amount = Number(result.receipt ?? deed.vault);
  applyBalances(game, {...ledger.balances, jade: ledger.balances.jade + amount});
  await refresh();
  return {ok: true, amount, record: result.tx};
}
export const appointAgent = (game, deed, appoint) => deedCall(game, 'deed_appoint_agent', {token_id: deed.token_id, appoint});
export const setDeedSpecialty = (game, deed, school) => deedCall(game, 'deed_set_strategy', {token_id: deed.token_id, target_bps: [], specialty: school || null});
