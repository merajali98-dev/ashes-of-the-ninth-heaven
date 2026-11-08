/**
 * MERCHANT PRICING RULES: the one file that decides every merchant price.
 *
 * Read this first. The live market, the fast-forward simulation and every price tooltip use this file, and the
 * items contract enforces the same formula with the parameters generated from it. There is no other copy.
 *
 *   scarcity = (target / stock) ^ k              k comes from the merchant's temperament, in quarter steps
 *   demand   = 1 + flowWeight * recentNet / target   recentNet = units bought minus units sold, fading each hour
 *   mid      = base * scarcity * demand * edict * event, held between 30% and 300% of base
 *   bid      = mid * (1 - spread + specialty premium) * purse    what the merchant PAYS you, minus tax
 *   ask      = mid * (1 + spread)                                 what the merchant CHARGES you, plus tax
 *   haggle   = your price if within posted ± room; one counter halfway if within twice the room; else it walks away
 *   job      = a short merchant pays between its bid and its mid per unit, from its purse into escrow
 *
 * Each unit in a trade is priced at the stock it leaves behind, so selling 20 at once earns less than 20 times the
 * first price, and buying then selling straight back always loses money.
 *
 * A merchant pays upkeep every open hour, refuses more of a good once its storeroom holds 5× its target, stops buying
 * when its purse falls under 10%, and shutters the shop if a market day ends under 15%. Players can rekindle it.
 *
 * Rules for this file: pure functions only (no clock, no randomness, no I/O, no imports). Whole numbers only:
 * prices are jade cents (100 = 1 jade), rates are basis points (10000 = 100%), division truncates toward zero.
 * That keeps JavaScript and the Rust contract identical to the last cent.
 */

export const CENTS = 100;
export const BPS = 10_000;
const PPM = 1_000_000n;

export const PRICE_BAND = Object.freeze({floorBps: 3_000, ceilingBps: 30_000});
export const TIME = Object.freeze({ticksPerDay: 24, ticksPerWeek: 168, maxCatchUpTicks: 168}); // one tick = one market hour

/** Temperament changes these parameters, never the formula. */
export const TEMPERAMENTS = Object.freeze({
  cautious: {kQuarters: 2, spreadBps: 1_500, flowWeightBps: 1_000, flowFadeBps: 600, reversionBps: 200, loyaltyBps: 0, haggleBps: 400},
  loyal: {kQuarters: 3, spreadBps: 1_000, flowWeightBps: 2_000, flowFadeBps: 800, reversionBps: 300, loyaltyBps: 5_000, haggleBps: 300},
  greedy: {kQuarters: 4, spreadBps: 800, flowWeightBps: 3_500, flowFadeBps: 1_200, reversionBps: 400, loyaltyBps: 0, haggleBps: 200},
});
export const DEMAND_BAND = Object.freeze({minBps: 8_000, maxBps: 12_500});
export const STOREROOM_BPS = 50_000;        // a merchant holds at most 5× its target, then refuses more
export const SPECIALTY_PREMIUM_BPS = 300;   // must stay below every merchant's narrowest spread (checked by validateRules)

/** Purse thresholds, as a share of the merchant's starting purse. */
export const PURSE = Object.freeze({
  thinBelowBps: 3_000, thinPayBps: 8_500,    // under 30%: pays 85% of the usual bid
  stopBuyingBelowBps: 1_000,                 // never pays out below 10%
  closeAtDayEndBelowBps: 1_500,              // a market day that ends under 15% shutters the shop
  closeBelowBps: 500, reopenAtBps: 2_000,    // closes at once under 5%; reopens once rekindled to 20%
  upkeepBps: 10,                             // rent and wages: 0.1% of the starting purse every open hour
});
/** Caravans: each hour stock drifts toward target. Restocking costs 60% of base; dumping surplus returns 15%. */
export const CARAVAN = Object.freeze({restockCostBps: 6_000, surplusValueBps: 1_500});
/** Merchants learn: stock outside the band at the end of a market day moves the target, within 60%–160%. */
export const ADAPTATION = Object.freeze({everyTicks: 24, bandBps: 2_000, stepBps: 500, minBps: 6_000, maxBps: 16_000});
/** How much each merchant wants to hold, by material tier 1–5. */
export const TARGETS = Object.freeze({specialty: [120, 80, 50, 30, 15], side: [40, 25, 15, 8, 4], consumable: 12});

/** The Pagoda Edict: one school is favoured each market week, by a fixed rule. */
export const EDICT = Object.freeze({boostBps: 2_000, schools: ['iron', 'ember', 'tide', 'shade', 'lotus', 'thunder', 'star']});
/** Market events rotate every 30 hours and last 8. */
export const EVENTS = Object.freeze({periodTicks: 30, durationTicks: 8, list: [
  {id: 'kiln-riot', family: 'essence-ember', priceBps: 13_500, text: 'A riot at the kilns: Cinder Essence is scarce'},
  {id: 'spring-thaw', family: 'essence-tide', priceBps: 7_500, text: 'The spring thaw floods the estuary with Frosttide Essence'},
  {id: 'storm-season', family: 'essence-thunder', priceBps: 13_000, text: 'Storm season: every courier wants Storm Essence'},
  {id: 'ministry-audit', family: 'seal-jade', priceBps: 12_000, text: 'A Ministry audit is seizing Seal Jade'},
  {id: 'veil-funerals', family: 'essence-shade', priceBps: 12_500, text: 'Forbidden funerals need Umbral Essence'},
  {id: 'archive-surplus', family: 'essence-lotus', priceBps: 8_000, text: 'The Archive sold its surplus Verdant Essence'},
]});
/** Patrons may own up to 49% of a merchant (their stake against its starting purse) and share its daily profit. */
export const PATRONAGE = Object.freeze({maxPublicBps: 4_900, maxPatrons: 10});
// Shop Deeds (NEP-171, on the ledger only): the deed's holder takes this share of each profitable market day into the
// deed's own vault; the Ministry sells each deed once at this price, paid into the shop's purse; one account may hold
// at most this many deeds.
export const DEED = Object.freeze({ownerShareBps: 1_000, priceCents: 10_000, maxPerAccount: 3});
/** Haggling: extra room when your deal fixes a shortage or glut; walks away beyond twice its room. Jobs: units, purse share, hours. */
export const HAGGLE = Object.freeze({needBps: 300, walkAwayBps: 20_000});
export const JOBS = Object.freeze({maxUnits: 20, maxEscrowBps: 1_000, ttlTicks: 24});
/** The Paper Taxman's cut of every trade. Collective Testimony (players clearing the campaign) lowers it. */
export const TAX = Object.freeze({baseBps: 300});

export const MERCHANTS = Object.freeze([
  {id: 'granny-qiu', name: 'Granny Qiu', region: 'ashen-prefecture', temperament: 'loyal', spreadBps: 2_500, startCash: 400_000,
    families: Object.fromEntries(['seal-jade', 'essence-iron', 'essence-ember', 'essence-tide', 'essence-shade', 'essence-lotus',
      'essence-thunder', 'essence-star', 'essence-neutral'].map(family => [family, 'side']))},
  {id: 'auntie-shi', name: 'Auntie Shi', region: 'ashen-prefecture', temperament: 'cautious', startCash: 300_000, consumables: true,
    families: {'essence-neutral': 'side'}},
  {id: 'mu-xiao', name: 'Mu Xiao', region: 'ashen-prefecture', temperament: 'loyal', startCash: 250_000,
    families: {'essence-iron': 'specialty', 'seal-jade': 'side'}},
  {id: 'lu-yan', name: 'Lu Yan', region: 'ashen-prefecture', temperament: 'greedy', startCash: 250_000,
    families: {'essence-ember': 'specialty', 'essence-neutral': 'side'}},
  {id: 'elder-ya', name: 'Elder Ya', region: 'salt-estuary', temperament: 'cautious', startCash: 250_000,
    families: {'essence-tide': 'specialty', 'seal-jade': 'specialty'}},
  {id: 'black-bamboo', name: 'Black Bamboo', region: 'hollow-theatre', temperament: 'greedy', startCash: 250_000,
    families: {'essence-shade': 'specialty', 'essence-neutral': 'side'}},
  {id: 'kuang-yi', name: 'Kuang Yi', region: 'lotus-vault', temperament: 'loyal', startCash: 250_000,
    families: {'essence-lotus': 'specialty', 'seal-jade': 'side'}},
  {id: 'he-feng', name: 'He Feng', region: 'thunder-span', temperament: 'greedy', startCash: 250_000,
    families: {'essence-thunder': 'specialty', 'seal-jade': 'side'}},
  {id: 'gao-shan', name: 'Gao Shan', region: 'last-observatory', temperament: 'cautious', startCash: 250_000,
    families: {'essence-star': 'specialty', 'seal-jade': 'side'}},
].map(Object.freeze));

// ---------------------------------------------------------------------------------------------------------------
// Integer helpers (mirrored in Rust). `div` truncates toward zero, like Rust's integer division.
const div = (a, b) => Math.trunc(a / b) || 0;   // || 0 turns -0 into 0: Rust integers have no negative zero
const ceilDiv = (a, b) => Math.trunc((a + b - 1) / b);   // non-negative a only
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const pct = bps => `${bps >= 0 ? '+' : '−'}${Math.abs(bps) / 100}%`;
export const jade = cents => (cents / CENTS).toFixed(2);

function isqrt(n) {
  if (n < 2n) return n;
  let x = n, y = (x + 1n) / 2n;
  while (y < x) { x = y; y = (x + n / x) / 2n; }
  return x;
}
/** (target / stock) ^ (kQuarters / 4), in parts per million. The ratio is held within 1/100 .. 100 first. */
export function scarcityPpm(target, stock, kQuarters) {
  let ratio = BigInt(Math.max(target, 1)) * PPM / BigInt(Math.max(stock, 1));
  ratio = ratio < 10_000n ? 10_000n : ratio > 100_000_000n ? 100_000_000n : ratio;
  const half = isqrt(ratio * PPM), quarter = isqrt(half * PPM);
  let out = PPM;
  for (let i = 0; i < Math.floor(kQuarters / 4); i++) out = out * ratio / PPM;
  if (kQuarters % 4 >= 2) out = out * half / PPM;
  if (kQuarters % 2 === 1) out = out * quarter / PPM;
  return Number(out);
}

export const temperamentOf = merchant => ({...TEMPERAMENTS[merchant.temperament], ...(merchant.spreadBps ? {spreadBps: merchant.spreadBps} : {})});
export const edictSchool = tick => EDICT.schools[(Math.imul(Math.floor(tick / TIME.ticksPerWeek) + 1, 2654435761) >>> 0) % EDICT.schools.length];
export function activeEvent(tick) {
  if (tick % EVENTS.periodTicks >= EVENTS.durationTicks) return null;
  return EVENTS.list[Math.floor(tick / EVENTS.periodTicks) % EVENTS.list.length];
}
export const taxBps = (testimonyBps = 0) => TAX.baseBps - div(TAX.baseBps * clamp(testimonyBps, 0, BPS), BPS);

/** The merchant's mid price for one unit at a given stock and demand memory. Returns the terms for the tooltip too. */
export function midPrice(merchant, token, {stock, target, flow, tick}) {
  const t = temperamentOf(merchant);
  const scarcity = scarcityPpm(target, stock, t.kQuarters);
  const demandBps = clamp(BPS + div(flow * t.flowWeightBps, Math.max(target, 1)), DEMAND_BAND.minBps, DEMAND_BAND.maxBps);
  const edictBps = token.school && token.school === edictSchool(tick) ? BPS + EDICT.boostBps : BPS;
  const event = activeEvent(tick);
  const eventBps = event && event.family === token.family ? event.priceBps : BPS;
  let mid = div(token.base * scarcity, 1_000_000);
  mid = div(div(div(mid * demandBps, BPS) * edictBps, BPS) * eventBps, BPS);
  const floor = div(token.base * PRICE_BAND.floorBps, BPS), ceiling = div(token.base * PRICE_BAND.ceilingBps, BPS);
  return {mid: clamp(mid, Math.max(floor, 1), ceiling), raw: mid, floor, ceiling, scarcity, demandBps, edictBps, event: eventBps === BPS ? null : event};
}

function purseState(merchant, cash) {
  if (cash * BPS < merchant.startCash * PURSE.closeBelowBps) return 'closed';
  if (cash * BPS < merchant.startCash * PURSE.thinBelowBps) return 'struggling';
  return 'open';
}
/** A closed shop stays closed until rekindled to the reopening line. */
export function merchantStatus(merchant, state) {
  if (state.closed) return state.cash * BPS >= merchant.startCash * PURSE.reopenAtBps ? 'open' : 'closed';
  return purseState(merchant, state.cash);
}

function unitPrices(merchant, token, state, side, mid, rep, tax) {
  const t = temperamentOf(merchant);
  const spread = t.spreadBps - div(div(t.spreadBps * t.loyaltyBps, BPS) * clamp(rep, 0, BPS), BPS);
  const premium = state.specialty && state.specialty === token.school ? SPECIALTY_PREMIUM_BPS : 0;
  const purse = state.cash * BPS < merchant.startCash * PURSE.thinBelowBps ? PURSE.thinPayBps : BPS;
  if (side === 'sell') return Math.max(1, div(div(div(mid * (BPS - spread + premium), BPS) * purse, BPS) * (BPS - tax), BPS));
  return ceilDiv(ceilDiv(mid * (BPS + spread), BPS) * (BPS + tax), BPS);
}

/**
 * Quote a trade. side 'sell' = the player sells to the merchant, 'buy' = the player buys from the merchant.
 * state: {cash, stock, target, baseTarget, flow, closed, specialty}; maps are keyed by token id.
 */
export function quote({merchant, state, token, side, qty = 1, tick = 0, reputationBps = 0, testimonyBps = 0}) {
  const stock = state.stock[token.id] ?? 0, target = state.target[token.id] ?? 0, flow = state.flow[token.id] ?? 0;
  const tax = taxBps(testimonyBps), status = merchantStatus(merchant, state);
  const at = (s, f) => midPrice(merchant, token, {stock: s, target, flow: f, tick});
  const now = at(stock, flow);
  const bid = unitPrices(merchant, token, state, 'sell', at(stock + 1, flow - 1).mid, reputationBps, tax);
  const ask = unitPrices(merchant, token, state, 'buy', at(Math.max(stock - 1, 0), flow + 1).mid, reputationBps, tax);
  const base = {side, qty, token: token.id, merchant: merchant.id, bid, ask, mid: now.mid, status, total: 0, units: []};
  const fail = (code, reason) => ({...base, ok: false, code, reason, lines: explain(merchant, token, state, now, {...base, tax, reputationBps}, reason)});
  if (side !== 'sell' && side !== 'buy') return fail('BAD_SIDE', 'Choose to buy or to sell.');
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 99) return fail('BAD_QTY', 'Trade between 1 and 99 at a time.');
  if (!target) return fail('NOT_TRADED', `${merchant.name} doesn't deal in ${token.name}.`);
  if (status === 'closed') return fail('CLOSED', `${merchant.name}'s shop is shuttered until someone rekindles it.`);
  if (side === 'buy' && stock < qty) return fail('OUT_OF_STOCK', `${merchant.name} only has ${stock} ${token.name}.`);
  if (side === 'sell' && (stock + qty) * BPS > target * STOREROOM_BPS) return fail('STOREROOM_FULL', `${merchant.name}'s storeroom is full of ${token.name}.`);
  const units = [];
  for (let i = 1; i <= qty; i++) {
    const s = side === 'sell' ? stock + i : stock - i, f = side === 'sell' ? flow - i : flow + i;
    units.push(unitPrices(merchant, token, state, side, at(s, f).mid, reputationBps, tax));
  }
  const total = units.reduce((sum, n) => sum + n, 0);
  const taxPaid = taxOn(total, side, tax);
  if (side === 'sell' && (state.cash - total - taxPaid) * BPS < merchant.startCash * PURSE.stopBuyingBelowBps)
    return fail('PURSE_EMPTY', `${merchant.name}'s purse is too thin to buy that many.`);
  const done = {...base, ok: true, code: 'OK', reason: '', units, total, taxPaid};
  return {...done, lines: explain(merchant, token, state, now, {...done, tax, reputationBps})};
}

/** The Paper Taxman's cut inside a total: on a sale the merchant pays it on top; on a purchase it is part of the price. */
export const taxOn = (total, side, tax) => side === 'sell' ? div(total * tax, BPS - tax) : total - div(total * BPS, BPS + tax);

/** Haggle over a quote's total (`posted`; `offer` is yours). Room = posted × (temperament haggleBps + needBps if you
 *  fix its shortage or glut; none when a thin purse would pay over its price). One haggle per merchant per day. */
export function haggle({merchant, side, posted, offer, helps = false, struggling = false}) {
  const sell = side === 'sell';
  const bendBps = sell && struggling ? 0 : temperamentOf(merchant).haggleBps + (helps ? HAGGLE.needBps : 0);
  const room = div(posted * bendBps, BPS), over = sell ? offer - posted : posted - offer;
  const toward = n => sell ? posted + n : posted - n;
  if (over <= 0) return {outcome: 'accepted', price: posted, bendBps, room};
  if (over <= room) return {outcome: 'accepted', price: offer, bendBps, room};
  if (room === 0 || over * BPS <= room * HAGGLE.walkAwayBps) return {outcome: 'countered', price: toward(div(room, 2)), bendBps, room};
  return {outcome: 'walked', price: 0, bendBps, room};
}

/** A job for one good: units (up to the shortfall), pay per unit (bid to mid), and the most the purse may escrow. */
export const jobTerms = (merchant, {stock, target, bid, mid, cash, open}) => ({maxUnits: Math.min(JOBS.maxUnits, open ? Math.max(0, target - stock) : 0),
  minPay: bid, maxPay: Math.max(bid, mid), maxEscrow: div(cash * JOBS.maxEscrowBps, BPS), floor: div(merchant.startCash * PURSE.stopBuyingBelowBps, BPS)});
export function checkJob(merchant, books, {units, payEach}) { // 'OK' or why the contract refuses the job
  const t = jobTerms(merchant, books);
  if (!books.open) return 'PURSE_TOO_THIN';
  if (!t.maxUnits) return 'NOT_SHORT';
  if (!Number.isSafeInteger(units) || units < 1 || units > t.maxUnits) return 'BAD_QTY';
  if (!Number.isSafeInteger(payEach) || payEach < t.minPay || payEach > t.maxPay) return 'BAD_PAY';
  if (units * payEach > t.maxEscrow || books.cash - units * payEach < t.floor) return 'TOO_DEAR';
  return 'OK';
}

/** Apply an accepted quote to a copy of the merchant's state. The Paper Taxman's cut leaves the merchant's purse too. */
export function applyQuote(state, q) {
  if (!q.ok) return state;
  const sign = q.side === 'sell' ? 1 : -1;
  return {...state, cash: state.cash - sign * q.total - q.taxPaid,
    stock: {...state.stock, [q.token]: (state.stock[q.token] ?? 0) + sign * q.qty},
    flow: {...state.flow, [q.token]: (state.flow[q.token] ?? 0) - sign * q.qty}};
}

/** The merchant's reasons, in their own voice. The tooltip is these lines. */
export function explain(merchant, token, state, now, q, failure = '') {
  const stock = state.stock[token.id] ?? 0, target = state.target[token.id] ?? 0, n = token.name, lines = [];
  if (failure) lines.push(failure);
  if (target) {
    if (stock * 10 > target * 12) lines.push(`I'm holding ${stock} ${n} and only want ${target}, so I pay less.`);
    else if (stock * 10 < target * 8) lines.push(`Only ${stock} ${n} left and I like to keep ${target}, so it's dear.`);
    else lines.push(`My ${n} stock (${stock}) is about where I want it (${target}).`);
  }
  if (now.demandBps > BPS + 200) lines.push(`Cultivators keep buying ${n} from me; it's moving fast (${pct(now.demandBps - BPS)}).`);
  if (now.demandBps < BPS - 200) lines.push(`Cultivators keep selling me ${n}; I'm well supplied (${pct(now.demandBps - BPS)}).`);
  if (now.edictBps !== BPS) lines.push(`The Pagoda Edict favours ${token.schoolName || token.school} this week (${pct(EDICT.boostBps)}).`);
  if (now.event) lines.push(`${now.event.text} (${pct(now.event.priceBps - BPS)}).`);
  if (now.raw < now.floor) lines.push(`That's as low as I value it: ${jade(now.floor)}, before my margin.`);
  if (now.raw > now.ceiling) lines.push(`That's as high as I value it: ${jade(now.ceiling)}, before my margin.`);
  if (state.specialty && state.specialty === token.school) lines.push(`${token.schoolName || token.school} is my trade today, so I pay a little more.`);
  if (TEMPERAMENTS[merchant.temperament].loyaltyBps && q.reputationBps > 0) lines.push(`You're a regular, so I trim my margin.`);
  if (q.status === 'struggling') lines.push(`My purse is thin, so I pay less.`);
  if (q.tax) lines.push(`The Paper Taxman takes ${q.tax / 100}% of every trade.`);
  if (q.units?.length > 1) lines.push(`First unit ${jade(q.units[0])}, last ${jade(q.units.at(-1))}: every unit moves my price.`);
  lines.push(`I pay ${jade(q.bid)} · I sell at ${jade(q.ask)} · usual ${jade(token.base)} jade.`);
  return lines;
}

/** One market hour for one merchant: upkeep, caravans, fading demand memory, learning and closure. */
export function tickMerchant(merchant, state, tick, tokens) {
  const t = temperamentOf(merchant), next = {...state, stock: {...state.stock}, flow: {...state.flow}, target: {...state.target}};
  if (merchantStatus(merchant, next) === 'open' && next.closed) next.closed = false;
  if (next.closed) return next;
  next.cash = Math.max(0, next.cash - div(merchant.startCash * PURSE.upkeepBps, BPS));
  for (const id of Object.keys(next.target)) {
    const token = tokens[id], gap = next.target[id] - (next.stock[id] ?? 0);
    if (token && gap) {
      let move = Math.sign(gap) * Math.max(1, Math.abs(div(gap * t.reversionBps, BPS)));
      if (move > 0) {
        const unit = div(token.base * CARAVAN.restockCostBps, BPS), floor = div(merchant.startCash * PURSE.stopBuyingBelowBps, BPS);
        move = Math.max(0, Math.min(move, div(next.cash - floor, Math.max(unit, 1))));
        next.cash -= move * unit;
      } else next.cash += -move * div(token.base * CARAVAN.surplusValueBps, BPS);
      next.stock[id] = (next.stock[id] ?? 0) + move;
    }
    next.flow[id] = div((next.flow[id] ?? 0) * (BPS - t.flowFadeBps), BPS);
    if ((tick + 1) % ADAPTATION.everyTicks === 0) {
      const s = next.stock[id] ?? 0, target = next.target[id], base = state.baseTarget[id];
      const step = Math.max(1, div(target * ADAPTATION.stepBps, BPS));
      if (s * BPS < target * (BPS - ADAPTATION.bandBps)) next.target[id] = target + step;
      else if (s * BPS > target * (BPS + ADAPTATION.bandBps)) next.target[id] = target - step;
      next.target[id] = clamp(next.target[id], div(base * ADAPTATION.minBps, BPS), div(base * ADAPTATION.maxBps, BPS));
    }
  }
  const dayEnds = (tick + 1) % TIME.ticksPerDay === 0;
  if (purseState(merchant, next.cash) === 'closed' || (dayEnds && next.cash * BPS < merchant.startCash * PURSE.closeAtDayEndBelowBps)) next.closed = true;
  return next;
}

/** A merchant's agent may change only its targets (within the learning band) and today's specialty school. */
export function applyStrategy(merchant, state, {targetBps = {}, specialty = null} = {}) {
  const target = {...state.target};
  for (const [id, bps] of Object.entries(targetBps)) {
    if (!(id in state.baseTarget) || !Number.isSafeInteger(bps)) continue;
    target[id] = div(state.baseTarget[id] * clamp(bps, ADAPTATION.minBps, ADAPTATION.maxBps), BPS);
  }
  const schools = Object.keys(merchant.families).map(family => family.replace('essence-', '')).filter(s => EDICT.schools.includes(s));
  return {...state, target, specialty: schools.includes(specialty) ? specialty : null};
}

/** Starting state for a merchant, given the token registry ({id: {family, tier, kind}}). */
export function openingState(merchant, tokens) {
  const target = {};
  for (const token of Object.values(tokens)) {
    const role = merchant.families[token.family];
    if (role && token.tier) target[token.id] = TARGETS[role][token.tier - 1];
    else if (merchant.consumables && token.kind === 'consumable') target[token.id] = TARGETS.consumable;
  }
  return {cash: merchant.startCash, stock: {...target}, target: {...target}, baseTarget: {...target}, flow: {}, closed: false, specialty: null};
}

/** Checks the invariants the rest of the economy relies on. Returns a list of problems (empty = valid). */
export function validateRules() {
  const problems = [];
  if (PRICE_BAND.floorBps >= PRICE_BAND.ceilingBps) problems.push('price floor must sit below the ceiling');
  for (const m of MERCHANTS) {
    const t = temperamentOf(m);
    if (!t.kQuarters || t.kQuarters < 1 || t.kQuarters > 8) problems.push(`${m.id}: kQuarters must be 1..8`);
    const narrowest = t.spreadBps - div(t.spreadBps * t.loyaltyBps, BPS);
    if (SPECIALTY_PREMIUM_BPS >= narrowest) problems.push(`${m.id}: specialty premium must be below the narrowest spread`);
    if (!Number.isSafeInteger(m.startCash) || m.startCash <= 0) problems.push(`${m.id}: starting purse must be positive`);
  }
  if (!(PURSE.closeBelowBps < PURSE.stopBuyingBelowBps && PURSE.stopBuyingBelowBps < PURSE.closeAtDayEndBelowBps &&
    PURSE.closeAtDayEndBelowBps < PURSE.thinBelowBps && PURSE.closeAtDayEndBelowBps < PURSE.reopenAtBps)) problems.push('purse thresholds out of order');
  if (CARAVAN.surplusValueBps >= CARAVAN.restockCostBps) problems.push('caravans must not profit from round trips');
  for (const t of MERCHANTS.map(temperamentOf)) // haggling both ways must never beat the spread, even tax-free
    if (!(t.haggleBps >= 0) || 2 * t.haggleBps + HAGGLE.needBps >= 2 * (t.spreadBps - div(t.spreadBps * t.loyaltyBps, BPS))) problems.push('haggling room must stay inside the spread');
  if (HAGGLE.walkAwayBps < BPS) problems.push('a merchant must not walk away inside its own room');
  return problems;
}
