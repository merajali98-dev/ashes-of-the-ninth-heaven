// The practice market: the whole market world lives inside the player's save and runs in the browser.
// One market hour passes per real minute; on return, up to a market week is caught up at once.
// The player trades through the same engine calls as every simulated trader.
import * as R from './merchant-rules.js';
import {addActor, createWorld, endHour, invest, quoteFor, trade} from './engine.js';
import {npcHour, populate} from './npc.js';
import {materialRequirement} from '../economy.js';
import {cultivationLevel} from '../cultivation.js';
import {invest as ledgerInvest, isActive as onLedger, overlay, trade as ledgerTrade} from '../online/ledger.js';

export const HOUR_MS = 60_000;
export const LIVE_CAST = Object.freeze({wanderers: 6, flooder: false, speculator: true, patron: true, forgeMaster: true});
const PLAYER = 'player', LOG_KEEP = 80;
const worlds = new WeakMap();
const persisted = ['tick', 'rng', 'markets', 'ministry', 'veins', 'patrons', 'dayStart', 'capitalIn', 'stats'];

/** The player's jade in cents: whole jade from the save plus the change purse (0–99). */
export const walletCents = game => game.jade * R.CENTS + (game.market?.fen ?? 0);
function setWallet(game, cents) {
  game.jade = Math.floor(cents / R.CENTS);
  game.market.fen = cents % R.CENTS;
}

function hydrate(game, now) {
  const saved = game.market;
  const world = createWorld({seed: (game.seed >>> 0) || 1});
  if (saved?.version === 1) {
    for (const key of persisted) if (saved[key] !== undefined) world[key] = structuredClone(saved[key]);
    world.actors = structuredClone(saved.actors ?? {});
    world.log = structuredClone(saved.log ?? []);
  } else {
    populate(world, LIVE_CAST);
    game.market = {version: 1, fen: 0, lastHourAt: now, volume: {}};
  }
  addActor(world, {id: PLAYER, name: game.name || 'You', strategy: 'player'});
  worlds.set(game, world);
  return world;
}

function syncIn(game, world) {
  const actor = world.actors[PLAYER];
  actor.name = game.name || 'You';
  actor.cash = walletCents(game);
  actor.volume = {...(game.market.volume ?? {})};
  actor.items = {};
  for (const [id, n] of Object.entries(game.materials ?? {})) if (n > 0 && world.tokens['mat:' + id]) actor.items['mat:' + id] = n;
  for (const [id, n] of Object.entries(game.bag ?? {})) if (n > 0 && world.tokens['item:' + id]) actor.items['item:' + id] = n;
}

function syncOut(game, world) {
  const actor = world.actors[PLAYER];
  setWallet(game, actor.cash);
  game.market.volume = {...actor.volume};
  for (const token of Object.keys(world.tokens)) {
    const [kind, id] = token.split(/:(.+)/), n = actor.items[token] ?? 0;
    const store = kind === 'mat' ? (game.materials ??= {}) : game.bag;
    if (n > 0) store[id] = n; else delete store[id];
  }
  const {[PLAYER]: _player, ...npcs} = world.actors;
  for (const key of persisted) game.market[key] = structuredClone(world[key]);
  game.market.actors = structuredClone(npcs);
  game.market.log = world.log.slice(-LOG_KEEP);
  world.log = game.market.log.slice();
}

/** The market world for this save, without advancing time. */
export function marketWorld(game, now = Date.now()) {
  const world = worlds.get(game) ?? hydrate(game, now);
  syncIn(game, world);
  return onLedger() ? overlay(world) : world; // sealed: the merchants are the ledger's
}

/** Let market hours pass up to `now`. Returns what happened, for "While you were away". */
export function advance(game, now) {
  if (onLedger()) return {hours: 0, events: []}; // the ledger keeps its own time
  const world = marketWorld(game, now);
  const due = Math.floor((now - (game.market.lastHourAt ?? now)) / HOUR_MS);
  if (due <= 0) return {hours: 0, events: []};
  const hours = Math.min(due, R.TIME.maxCatchUpTicks), from = world.log.length, cashBefore = world.actors[PLAYER].cash;
  for (let h = 0; h < hours; h++) { npcHour(world); endHour(world); }
  game.market.lastHourAt = due > hours ? now : game.market.lastHourAt + hours * HOUR_MS;
  const events = world.log.slice(from);
  syncOut(game, world);
  return {hours, events, earned: world.actors[PLAYER].cash - cashBefore};
}

const blocked = game => !game.started ? 'Swear your oath before trading.' : game.active ? 'Return from your expedition before trading.' : '';

/** Quote a trade for the player, including the cultivation gate on buying high-tier materials. */
export function playerQuote(game, merchantId, tokenId, side, qty = 1) {
  const world = marketWorld(game);
  const q = quoteFor(world, PLAYER, merchantId, tokenId, side, qty);
  const gate = side === 'buy' && tokenId.startsWith('mat:') ? materialRequirement(tokenId.slice(4))?.level ?? 1 : 1;
  if (q.ok && gate > cultivationLevel(game)) return {...q, ok: false, code: 'LOCKED', reason: `Reach cultivation level ${gate} to buy ${world.tokens[tokenId].name}.`};
  return q;
}

export function playerTrade(game, merchantId, tokenId, side, qty = 1) {
  const reason = blocked(game);
  if (reason) return {ok: false, reason};
  const world = marketWorld(game);
  const q = playerQuote(game, merchantId, tokenId, side, qty);
  if (!q.ok) return {ok: false, reason: q.reason};
  if (onLedger()) {
    // Sealed: the same checks, then the trade is signed in this browser and recorded on the Honest Ledger.
    const actor = world.actors[PLAYER], name = world.tokens[tokenId].name, who = world.merchants[merchantId].name;
    if (side === 'sell' && (actor.items[tokenId] ?? 0) < qty) return {ok: false, reason: `You don't have ${qty} to sell.`};
    if (side === 'buy' && actor.cash < q.total) return {ok: false, reason: `You need ${R.jade(q.total - actor.cash)} more jade.`};
    return ledgerTrade(game, merchantId, tokenId, side, qty).then(done => !done.ok ? done : {ok: true, quote: {total: done.total}, record: done.record,
      message: side === 'sell' ? `Sold ${qty} ${name} to ${who} for ${R.jade(done.total)} jade.` : `Bought ${qty} ${name} from ${who} for ${R.jade(done.total)} jade.`});
  }
  const done = trade(world, PLAYER, merchantId, tokenId, side, qty);
  if (!done.ok) return {ok: false, reason: done.reason};
  syncOut(game, world);
  const name = world.tokens[tokenId].name, who = world.merchants[merchantId].name;
  return {ok: true, quote: done, message: side === 'sell'
    ? `Sold ${qty} ${name} to ${who} for ${R.jade(done.total)} jade.` : `Bought ${qty} ${name} from ${who} for ${R.jade(done.total)} jade.`};
}

/** Become a patron of a merchant, or help rekindle a closed shop. */
export function playerInvest(game, merchantId, jade) {
  const reason = blocked(game);
  if (reason) return {ok: false, reason};
  const world = marketWorld(game), cents = Math.round(jade * R.CENTS);
  if (onLedger()) {
    const m = world.merchants[merchantId];
    if (world.actors[PLAYER].cash < cents) return {ok: false, reason: 'Not enough jade.'};
    return ledgerInvest(game, merchantId, cents).then(done => !done.ok ? done : {ok: true, record: done.record,
      message: done.closed ? `You put ${R.jade(cents)} jade toward rekindling ${m.name}'s shop.` : `You are now a patron of ${m.name}.`});
  }
  const done = invest(world, PLAYER, merchantId, cents);
  if (!done.ok) return {ok: false, reason: done.reason};
  syncOut(game, world);
  const m = world.merchants[merchantId];
  return {ok: true, message: world.markets[merchantId].closed ? `You put ${R.jade(cents)} jade toward rekindling ${m.name}'s shop.` : `You are now a patron of ${m.name}.`};
}

/** Best bid and best ask for a good across every open merchant, for the price board and hints. */
export function bestPrices(game, tokenId) {
  const world = marketWorld(game);
  let bid = null, ask = null;
  for (const id of Object.keys(world.merchants)) {
    if (!(tokenId in world.markets[id].target)) continue;
    const q = quoteFor(world, PLAYER, id, tokenId, 'sell', 1);
    if (q.status === 'closed') continue;
    if (q.code !== 'STOREROOM_FULL' && q.code !== 'PURSE_EMPTY' && (!bid || q.bid > bid.bid)) bid = q;
    if ((world.markets[id].stock[tokenId] ?? 0) > 0 && (!ask || q.ask < ask.ask)) ask = q;
  }
  return {bid, ask};
}
