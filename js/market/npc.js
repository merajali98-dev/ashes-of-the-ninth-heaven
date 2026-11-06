// Simulated traders. They act through the same engine calls a player does, so the market cannot tell them apart.
// Every choice uses the world's seeded random numbers, so a given seed always plays out the same way.
import * as R from './merchant-rules.js';
import {addActor, bestMerchant, commission, consume, familyIndex, forge, forgeCost, invest, random, pick, trade,
  NPC_SUCCESS_BPS, SCHOOLS, VEIN} from './engine.js';
import {cards} from '../content.js';

const div = (a, b) => Math.trunc(a / b) || 0;   // || 0 turns -0 into 0: Rust integers have no negative zero
const FAMILIES = ['seal-jade', ...SCHOOLS.map(s => 'essence-' + s)];
const forgeable = {};
for (const card of cards) {
  const cost = forgeCost(card.id);
  if (cost) (forgeable[card.school || 'neutral'] ??= []).push({id: card.id, tier: cost.tier, rarity: card.rarity});
}

export const CAST = Object.freeze({
  wanderer: {label: 'Wandering cultivators', text: 'Fight commissions, sell their loot where it pays, and forge for the current Pagoda Edict.'},
  flooder: {label: 'Ember Guild flooder', text: 'A mining guild that dumps Cinder Essence on Lu Yan every hour.'},
  speculator: {label: 'General Hong, speculator', text: 'Buys Storm Essence when it is cheap and sells when it is dear.'},
  patron: {label: 'Patron', text: 'Rekindles shops that go broke and buys a share of the healthy ones.'},
  forgeMaster: {label: 'Forge-master', text: 'A high-level cultivator who buys the rarest materials to forge legendaries.'},
});
export const DEFAULT_CAST = Object.freeze({wanderers: 6, flooder: true, speculator: true, patron: true, forgeMaster: true});

export function populate(world, cast = DEFAULT_CAST) {
  for (let i = 0; i < (cast.wanderers ?? 0); i++)
    addActor(world, {id: 'wanderer-' + (i + 1), name: 'Wanderer ' + (i + 1), strategy: 'wanderer', cash: 15_000,
      maxTier: 1 + (i % 3), busy: i % 3, plan: null, school: SCHOOLS[i % 7]});
  if (cast.flooder) addActor(world, {id: 'ember-guild', name: 'The Ember Guild', strategy: 'flooder', cash: 0});
  if (cast.speculator) addActor(world, {id: 'general-hong', name: 'General Hong', strategy: 'speculator', cash: 150_000});
  if (cast.patron) addActor(world, {id: 'patron', name: 'Madam Rui', strategy: 'patron', cash: 250_000});
  if (cast.forgeMaster) addActor(world, {id: 'forge-master', name: 'Forge-master Ao', strategy: 'forgeMaster', cash: 300_000, maxTier: 5, plan: null});
}

function sellAll(world, actor, keep = {}, minBps = 0, only = null) {
  for (const token of Object.keys(actor.items)) {
    let left = (actor.items[token] ?? 0) - (keep[token] ?? 0);
    while (left > 0) {
      const qty = Math.min(left, 20), q = bestMerchant(world, actor.id, token, 'sell', qty, only);
      if (!q || q.total * R.BPS < world.tokens[token].base * qty * minBps) break;
      if (!trade(world, actor.id, q.merchant, token, 'sell', qty).ok) break;
      left -= qty;
    }
  }
}

/** Buy whatever the planned card still needs, then forge it if everything is in hand. */
function workTowardForge(world, actor, budgetFloor) {
  if (!actor.plan) return false;
  const cost = forgeCost(actor.plan);
  for (const [token, need] of Object.entries(cost.materials)) {
    let missing = need - (actor.items[token] ?? 0);
    while (missing > 0) {
      const qty = Math.min(missing, 20), q = bestMerchant(world, actor.id, token, 'buy', qty);
      if (!q || actor.cash - q.total < budgetFloor + cost.jade) break;
      if (!trade(world, actor.id, q.merchant, token, 'buy', qty).ok) break;
      missing -= qty;
    }
  }
  const done = forge(world, actor.id, actor.plan);
  if (done.ok) actor.plan = null;
  return done.ok;
}
function planCard(world, actor, minTier = 1) {
  const school = actor.school && random(world) < 0.5 ? actor.school : R.edictSchool(world.tick), options = (forgeable[school] ?? []).filter(c => c.tier <= actor.maxTier && c.tier >= minTier);
  actor.plan = options.length ? pick(world, options).id : null;
  actor.planWeek = Math.floor(world.tick / R.TIME.ticksPerWeek);
}

const STRATEGIES = {
  wanderer(world, actor, index) {
    if (actor.busy > 0) { actor.busy--; return; }
    if (!actor.plan || actor.planWeek !== Math.floor(world.tick / R.TIME.ticksPerWeek)) planCard(world, actor);
    const keep = actor.plan ? forgeCost(actor.plan).materials : {};
    sellAll(world, actor, keep, random(world) < 0.5 ? 5_000 : 7_000);
    if (random(world) < 0.2 && workTowardForge(world, actor, 3_000)) return;
    let best = null;
    for (const school of SCHOOLS) for (let tier = 1; tier <= actor.maxTier; tier++) {
      const health = world.veins[school + '-' + tier] ?? VEIN.fullBps;
      const value = div((index['seal-jade'] + index['essence-' + school]) * health, R.BPS) * tier * (80 + Math.floor(random(world) * 40));
      if (!best || value > best.value) best = {school, tier, value};
    }
    if (random(world) < 0.3) {
      const pills = Object.keys(world.markets['auntie-shi']?.target ?? {});
      const pill = pills.length && pick(world, pills);
      if (pill && trade(world, actor.id, 'auntie-shi', pill, 'buy', 1).ok) consume(world, actor.id, pill);
    }
    commission(world, actor.id, best.school, best.tier, random(world) * R.BPS < NPC_SUCCESS_BPS[best.tier - 1]);
    actor.busy = 2;
  },
  flooder(world, actor) {
    for (const [token, n] of [['mat:essence-ember-1', 60], ['mat:essence-ember-2', 30], ['mat:essence-ember-3', 15]]) {
      actor.items[token] = (actor.items[token] ?? 0) + n;
      world.supply.minted[token] = (world.supply.minted[token] ?? 0) + n;
    }
    for (const token of Object.keys(actor.items)) {        // dump on Lu Yan until she refuses
      while ((actor.items[token] ?? 0) > 0 && trade(world, actor.id, 'lu-yan', token, 'sell', Math.min(actor.items[token], 20)).ok);
    }
  },
  speculator(world, actor) {
    for (let tier = 1; tier <= 5; tier++) {
      const token = 'mat:essence-thunder-' + tier, base = world.tokens[token].base;
      const ask = bestMerchant(world, actor.id, token, 'buy', 10);
      if (ask && ask.total * R.BPS < base * 10 * 9_000 && actor.cash > ask.total * 3) trade(world, actor.id, ask.merchant, token, 'buy', 10);
      const held = actor.items[token] ?? 0, bid = held && bestMerchant(world, actor.id, token, 'sell', Math.min(held, 20));
      if (bid && bid.total * R.BPS > base * bid.qty * 10_500) trade(world, actor.id, bid.merchant, token, 'sell', bid.qty);
    }
  },
  patron(world, actor) {
    for (const [id, state] of Object.entries(world.markets)) {
      if (!state.closed || world.tick - (actor.rescued?.[id] ?? -999) < 48) continue;
      const m = world.merchants[id], need = div(m.startCash * R.PURSE.reopenAtBps, R.BPS) - state.cash + R.CENTS;
      if (need > 0 && actor.cash >= need && invest(world, actor.id, id, need).ok) (actor.rescued ??= {})[id] = world.tick;
    }
    if (world.tick % R.TIME.ticksPerDay === 12 && actor.cash > 100_000) {
      const open = Object.keys(world.markets).filter(id => !world.markets[id].closed);
      invest(world, actor.id, pick(world, open), 20_000);
    }
  },
  forgeMaster(world, actor) {
    if (world.tick % 6) return;
    if (!actor.plan || actor.planWeek !== Math.floor(world.tick / R.TIME.ticksPerWeek)) planCard(world, actor, 3);
    workTowardForge(world, actor, 20_000);
  },
};

/** Every simulated trader takes its turn for this market hour, in a fixed order. */
export function npcHour(world) {
  const index = Object.fromEntries(FAMILIES.map(family => [family, familyIndex(world, family)]));
  for (const actor of Object.values(world.actors)) STRATEGIES[actor.strategy]?.(world, actor, index);
}
