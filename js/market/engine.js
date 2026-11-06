// The market world: merchants, cultivators, spirit veins and the Ministry, one market hour at a time.
// Prices and merchant behaviour come only from merchant-rules.js. This file moves goods and jade, keeps the books,
// and writes the story of what happened. The live market and the fast-forward simulation both run it.
import * as R from './merchant-rules.js';
import {MARKET_TOKENS} from './tokens.js';
import {bountyRewards, forgeRecipe} from '../economy.js';
import {cards} from '../content.js';

export const JADE = 'jade';
export const SCHOOLS = ['iron', 'ember', 'tide', 'shade', 'lotus', 'thunder', 'star', 'neutral'];
/** Commission success chance by tier for simulated cultivators: an assumption, not measured from combat. */
export const NPC_SUCCESS_BPS = [9_500, 9_000, 8_500, 8_000, 7_500];
/** Spirit veins tire when a commission is farmed and recover each hour. Material rewards scale with vein health. */
export const VEIN = Object.freeze({fullBps: 10_000, perRunBps: 1_200, minBps: 2_500, regenBps: 250});

const div = (a, b) => Math.trunc(a / b) || 0;   // || 0 turns -0 into 0: Rust integers have no negative zero
const cardById = Object.fromEntries(cards.map(card => [card.id, card]));

export function createWorld({seed = 1, tokens = MARKET_TOKENS, merchants = R.MERCHANTS, trace = null} = {}) {
  const world = {
    tick: 0, seed, rng: (seed >>> 0) || 1, tokens, trace, testimonyBps: 0,
    merchants: Object.fromEntries(merchants.map(m => [m.id, m])),
    markets: {}, actors: {}, ministry: 0, veins: {}, patrons: {}, dayStart: {}, capitalIn: {},
    supply: {minted: {}, burned: {}}, log: [], stats: {trades: 0, forged: {}, commissions: 0, dividends: 0},
  };
  for (const m of merchants) {
    const state = R.openingState(m, tokens);
    world.markets[m.id] = state;
    world.dayStart[m.id] = state.cash;
    world.capitalIn[m.id] = 0;
    world.patrons[m.id] = {};
    mint(world, JADE, state.cash);
    for (const [id, n] of Object.entries(state.stock)) mint(world, id, n);
  }
  trace?.push({op: 'genesis', seed, merchants: merchants.map(m => m.id), tokens: Object.values(tokens)});
  note(world, 'edict', `The Pagoda Edict favours ${R.edictSchool(0)} this week.`);
  return world;
}

export function random(world) {
  let x = world.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  world.rng = x >>> 0;
  return world.rng / 4294967296;
}
export const pick = (world, list) => list[Math.floor(random(world) * list.length)];

function mint(world, token, n) { if (n > 0) world.supply.minted[token] = (world.supply.minted[token] ?? 0) + n; }
function burn(world, token, n) { if (n > 0) world.supply.burned[token] = (world.supply.burned[token] ?? 0) + n; }
function note(world, type, text, extra = {}) { world.log.push({tick: world.tick, type, text, ...extra}); }
const give = (actor, token, n) => { actor.items[token] = (actor.items[token] ?? 0) + n; if (!actor.items[token]) delete actor.items[token]; };

export function addActor(world, {id, name, strategy = 'player', cash = 0, items = {}, ...rest}) {
  const actor = {id, name, strategy, cash, items: {}, volume: {}, ...rest};
  world.actors[id] = actor;
  mint(world, JADE, cash);
  for (const [token, n] of Object.entries(items)) { give(actor, token, n); mint(world, token, n); }
  return actor;
}

/** Reputation with a merchant grows with jade traded there: 10% of its starting purse makes you a full regular. */
export function reputationBps(world, actor, merchantId) {
  const m = world.merchants[merchantId];
  return Math.min(R.BPS, div((actor.volume[merchantId] ?? 0) * R.BPS * 10, m.startCash));
}

export function quoteFor(world, actorId, merchantId, tokenId, side, qty = 1) {
  const actor = world.actors[actorId], merchant = world.merchants[merchantId], token = world.tokens[tokenId];
  if (!actor || !merchant || !token) return {ok: false, code: 'UNKNOWN', reason: 'Unknown trader or good.', lines: []};
  return R.quote({merchant, state: world.markets[merchantId], token, side, qty, tick: world.tick,
    reputationBps: reputationBps(world, actor, merchantId), testimonyBps: world.testimonyBps});
}

/** Buy or sell at a merchant. Returns the quote; on success goods, jade and tax have moved. */
export function trade(world, actorId, merchantId, tokenId, side, qty = 1) {
  const actor = world.actors[actorId];
  const q = quoteFor(world, actorId, merchantId, tokenId, side, qty);
  if (q.ok && side === 'sell' && (actor.items[tokenId] ?? 0) < qty) return {...q, ok: false, code: 'NOT_HELD', reason: `You don't have ${qty} to sell.`};
  if (q.ok && side === 'buy' && actor.cash < q.total) return {...q, ok: false, code: 'NO_JADE', reason: `You need ${R.jade(q.total - actor.cash)} more jade.`};
  world.trace?.push({op: 'trade', m: merchantId, token: tokenId, side, qty, tick: world.tick,
    rep: reputationBps(world, actor, merchantId), testimony: world.testimonyBps, code: q.code, total: q.total, taxPaid: q.taxPaid ?? 0});
  if (!q.ok) return q;
  world.markets[merchantId] = R.applyQuote(world.markets[merchantId], q);
  give(actor, tokenId, side === 'sell' ? -qty : qty);
  actor.cash += side === 'sell' ? q.total : -q.total;
  actor.volume[merchantId] = (actor.volume[merchantId] ?? 0) + q.total;
  world.ministry += q.taxPaid;
  world.stats.trades++;
  return q;
}

/** Fight a commission. Win: jade plus materials scaled by the vein's health. The vein tires either way. */
export function commission(world, actorId, school, tier, success = true) {
  const actor = world.actors[actorId], reward = bountyRewards(school, tier);
  if (!actor || !reward) return {ok: false};
  const key = school + '-' + tier, health = world.veins[key] ?? VEIN.fullBps;
  world.veins[key] = Math.max(VEIN.minBps, health - VEIN.perRunBps);
  world.stats.commissions++;
  if (!success) return {ok: false, health};
  const jadeWon = reward.gold * R.CENTS, materials = {};
  actor.cash += jadeWon; mint(world, JADE, jadeWon);
  for (const [id, n] of Object.entries(reward.materials)) {
    const amount = Math.max(1, div(n * health, R.BPS));
    materials['mat:' + id] = amount;
    give(actor, 'mat:' + id, amount); mint(world, 'mat:' + id, amount);
  }
  return {ok: true, jade: jadeWon, materials, health};
}

export const forgeCost = cardId => {
  const recipe = forgeRecipe(cardById[cardId]);
  return recipe && {jade: recipe.jade * R.CENTS, materials: Object.fromEntries(Object.entries(recipe.materials).map(([id, n]) => ['mat:' + id, n])), tier: recipe.tier};
};
/** Forge a technique: its materials and fee are burned. */
export function forge(world, actorId, cardId) {
  const actor = world.actors[actorId], cost = forgeCost(cardId);
  if (!actor || !cost || actor.cash < cost.jade || Object.entries(cost.materials).some(([id, n]) => (actor.items[id] ?? 0) < n)) return {ok: false};
  actor.cash -= cost.jade; burn(world, JADE, cost.jade);
  for (const [id, n] of Object.entries(cost.materials)) { give(actor, id, -n); burn(world, id, n); }
  const school = cardById[cardId].school || 'neutral';
  world.stats.forged[school] = (world.stats.forged[school] ?? 0) + 1;
  return {ok: true, cost};
}

/** Pills and talismans are used up in battle. */
export function consume(world, actorId, tokenId) {
  const actor = world.actors[actorId];
  if (!actor || !(actor.items[tokenId] > 0)) return false;
  give(actor, tokenId, -1); burn(world, tokenId, 1);
  return true;
}

function adjustMerchant(world, merchantId, cash) {
  world.markets[merchantId] = {...world.markets[merchantId], cash: world.markets[merchantId].cash + cash};
  world.trace?.push({op: 'adjust', m: merchantId, cash});
}
const publicStake = (world, merchantId) => Object.values(world.patrons[merchantId]).reduce((a, b) => a + b, 0);

/** Become a patron: jade goes into the merchant's purse and earns a share of its daily profit. */
export function invest(world, actorId, merchantId, amount) {
  const actor = world.actors[actorId], m = world.merchants[merchantId], patrons = world.patrons[merchantId];
  if (!actor || !m || !Number.isSafeInteger(amount) || amount <= 0 || actor.cash < amount) return {ok: false, reason: 'Not enough jade.'};
  if (!(actorId in patrons) && Object.keys(patrons).length >= R.PATRONAGE.maxPatrons) return {ok: false, reason: `${m.name} already has ten patrons.`};
  const room = div(m.startCash * R.PATRONAGE.maxPublicBps, R.BPS) - publicStake(world, merchantId);
  const closed = world.markets[merchantId].closed;
  if (room <= 0 && !closed) return {ok: false, reason: `Patrons already own 49% of ${m.name}.`};
  actor.cash -= amount;
  adjustMerchant(world, merchantId, amount);
  world.capitalIn[merchantId] += amount;
  if (room > 0) patrons[actorId] = (patrons[actorId] ?? 0) + Math.min(amount, room);   // beyond 49%, a rekindling gift
  if (closed) note(world, 'rekindle', `${actor.name} put ${R.jade(amount)} jade into rekindling ${m.name}'s shop.`, {merchant: merchantId, actor: actorId});
  return {ok: true};
}

/** World shocks act on stock, demand or purses; prices then respond through the normal rules. */
export const SHOCKS = Object.freeze({
  'kiln-riot': {text: 'Riots at the kilns: merchants lose 60% of their Cinder Essence.', family: 'essence-ember', stockBps: 4_000},
  'spring-flood': {text: 'The estuary floods: merchants are swamped with Frosttide Essence.', family: 'essence-tide', stockBps: 25_000},
  'storm-rush': {text: 'A tribulation storm: everyone is buying Storm Essence.', family: 'essence-thunder', flowTargets: 1},
  'ministry-audit': {text: 'A Ministry audit seizes 35% of every merchant\'s purse.', cashBps: 6_500},
});
export function shock(world, id) {
  const s = SHOCKS[id];
  if (!s) return false;
  for (const [mid, state] of Object.entries(world.markets)) {
    const next = {...state, stock: {...state.stock}, flow: {...state.flow}}, patch = {m: mid, cash: 0, stock: {}, flow: {}};
    for (const token of Object.keys(state.target)) {
      if (world.tokens[token].family !== s.family) continue;
      if (s.stockBps) {
        const after = div((state.stock[token] ?? 0) * s.stockBps, R.BPS), delta = after - (state.stock[token] ?? 0);
        next.stock[token] = after; patch.stock[token] = delta;
        delta > 0 ? mint(world, token, delta) : burn(world, token, -delta);
      }
      if (s.flowTargets) { const delta = state.target[token] * s.flowTargets; next.flow[token] = (state.flow[token] ?? 0) + delta; patch.flow[token] = delta; }
    }
    if (s.cashBps) { const after = div(state.cash * s.cashBps, R.BPS); patch.cash = after - state.cash; burn(world, JADE, state.cash - after); next.cash = after; }
    world.markets[mid] = next;
    world.trace?.push({op: 'adjust', ...patch});
  }
  note(world, 'shock', s.text, {shock: id});
  return true;
}

/** End the market hour: merchants take offerings, caravans move, veins recover, patrons are paid at day's end. */
export function endHour(world) {
  for (const [id, m] of Object.entries(world.merchants)) {
    const before = world.markets[id], after = R.tickMerchant(m, before, world.tick, world.tokens);
    world.trace?.push({op: 'tick', m: id, tick: world.tick});
    const cash = after.cash - before.cash;
    cash > 0 ? mint(world, JADE, cash) : burn(world, JADE, -cash);
    for (const token of Object.keys(after.stock)) {
      const delta = (after.stock[token] ?? 0) - (before.stock[token] ?? 0);
      delta > 0 ? mint(world, token, delta) : burn(world, token, -delta);
    }
    if (!before.closed && after.closed) note(world, 'closed', `${m.name} ran out of jade and shuttered the shop.`, {merchant: id});
    if (before.closed && !after.closed) note(world, 'reopened', `${m.name} reopened thanks to the patrons who rekindled it.`, {merchant: id});
    world.markets[id] = after;
  }
  for (const key of Object.keys(world.veins)) world.veins[key] = Math.min(VEIN.fullBps, world.veins[key] + VEIN.regenBps);
  if ((world.tick + 1) % R.TIME.ticksPerDay === 0) payPatrons(world);
  world.tick++;
  if (world.tick % R.TIME.ticksPerWeek === 0) note(world, 'edict', `The Pagoda Edict now favours ${R.edictSchool(world.tick)}.`);
  const event = R.activeEvent(world.tick);
  if (event && world.tick % R.EVENTS.periodTicks === 0) note(world, 'event', event.text + '.', {event: event.id});
}

function payPatrons(world) {
  for (const [id, m] of Object.entries(world.merchants)) {
    const state = world.markets[id], patrons = world.patrons[id], stake = publicStake(world, id);
    const profit = state.cash - world.dayStart[id] - world.capitalIn[id];
    if (stake > 0 && profit > 0 && !state.closed) {
      const share = Math.min(R.PATRONAGE.maxPublicBps, div(stake * R.BPS, m.startCash));
      let paid = 0;
      for (const [actorId, amount] of Object.entries(patrons)) {
        const cut = div(div(profit * share, R.BPS) * amount, stake);
        world.actors[actorId].cash += cut; paid += cut;
      }
      if (paid > 0) { adjustMerchant(world, id, -paid); world.stats.dividends += paid; note(world, 'dividend', `${m.name} paid ${R.jade(paid)} jade to patrons.`, {merchant: id, amount: paid}); }
    }
    world.dayStart[id] = world.markets[id].cash;
    world.capitalIn[id] = 0;
  }
  world.trace?.push({op: 'check', tick: world.tick, markets: structuredClone(world.markets)});
}

/** Everything that exists, by token, for the conservation check: holdings must equal minted minus burned. */
export function holdings(world) {
  const total = {[JADE]: world.ministry};
  const add = (token, n) => { total[token] = (total[token] ?? 0) + n; };
  for (const state of Object.values(world.markets)) { add(JADE, state.cash); for (const [t, n] of Object.entries(state.stock)) add(t, n); }
  for (const actor of Object.values(world.actors)) { add(JADE, actor.cash); for (const [t, n] of Object.entries(actor.items)) add(t, n); }
  return total;
}
export const jadeSupply = world => world.ministry + Object.values(world.markets).reduce((a, s) => a + s.cash, 0) + Object.values(world.actors).reduce((a, x) => a + x.cash, 0);

/** Best price for a good across open merchants. side 'sell' finds the highest bid, 'buy' the lowest ask. */
export function bestMerchant(world, actorId, tokenId, side, qty = 1, only = null) {
  let best = null;
  for (const id of Object.keys(world.merchants)) {
    if (only && !only.includes(id)) continue;
    if (!(tokenId in world.markets[id].target)) continue;
    const q = quoteFor(world, actorId, id, tokenId, side, qty);
    if (!q.ok) continue;
    if (!best || (side === 'sell' ? q.total > best.total : q.total < best.total)) best = q;
  }
  return best;
}

/** Mid price against base for a material family, weighted by how much each merchant wants to hold (10000 = usual). */
export function familyIndex(world, family) {
  let sum = 0, count = 0;
  for (const [id, m] of Object.entries(world.merchants)) {
    const state = world.markets[id];
    for (const token of Object.keys(state.target)) {
      const t = world.tokens[token];
      if (t.family !== family) continue;
      const p = R.midPrice(m, t, {stock: state.stock[token] ?? 0, target: state.target[token], flow: state.flow[token] ?? 0, tick: world.tick});
      const weight = state.baseTarget[token];
      sum += div(p.mid * R.BPS, t.base) * weight; count += weight;
    }
  }
  return count ? div(sum, count) : R.BPS;
}
