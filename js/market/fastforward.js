// Fast-forward: a week of the market, computed up front and played back as charts.
// A labelled simulation with the same engine and rules as the live market. It sends no transactions.
import * as R from './merchant-rules.js';
import {createWorld, endHour, familyIndex, jadeSupply, shock, SCHOOLS, SHOCKS} from './engine.js';
import {DEFAULT_CAST, npcHour, populate} from './npc.js';

export const FAMILIES = ['seal-jade', ...SCHOOLS.map(s => 'essence-' + s)];
const div = (a, b) => Math.trunc(a / b) || 0;   // || 0 turns -0 into 0: Rust integers have no negative zero

export function sanitize(input = {}) {
  const cast = {...DEFAULT_CAST, ...(input.cast ?? {})};
  return {
    seed: Number.isSafeInteger(input.seed) && input.seed > 0 ? input.seed : 1,
    days: Number.isSafeInteger(input.days) ? Math.min(14, Math.max(1, input.days)) : 7,
    cast: {wanderers: Math.min(12, Math.max(0, Math.trunc(Number(cast.wanderers) || 0))),
      flooder: Boolean(cast.flooder), speculator: Boolean(cast.speculator), patron: Boolean(cast.patron), forgeMaster: Boolean(cast.forgeMaster)},
    shocks: (Array.isArray(input.shocks) ? input.shocks : [])
      .filter(s => s && Object.hasOwn(SHOCKS, s.id) && Number.isSafeInteger(s.tick) && s.tick >= 0).slice(0, 20),
  };
}

function frame(world) {
  return {
    tick: world.tick, day: div(world.tick, 24) + 1, hour: world.tick % 24,
    families: Object.fromEntries(FAMILIES.map(f => [f, familyIndex(world, f)])),
    cash: Object.fromEntries(Object.entries(world.markets).map(([id, s]) => [id, s.cash])),
    closed: Object.entries(world.markets).filter(([, s]) => s.closed).map(([id]) => id),
    edict: R.edictSchool(world.tick), event: R.activeEvent(world.tick)?.id ?? null,
    jade: jadeSupply(world),
  };
}

export function runFastForward(input = {}, {trace = null} = {}) {
  const params = sanitize(input);
  const world = createWorld({seed: params.seed, trace});
  populate(world, params.cast);
  const frames = [], startJade = jadeSupply(world);
  for (let h = 0; h < params.days * R.TIME.ticksPerDay; h++) {
    for (const s of params.shocks) if (s.tick === world.tick) shock(world, s.id);
    npcHour(world);
    frames.push(frame(world));
    endHour(world);
  }
  const last = frames.at(-1), movers = FAMILIES.map(f => {
    const values = frames.map(x => x.families[f]);
    return {family: f, low: Math.min(...values), high: Math.max(...values), end: last.families[f]};
  });
  const endJade = jadeSupply(world);
  return {
    params, frames, events: world.log,
    summary: {
      closures: world.log.filter(e => e.type === 'closed').length,
      reopenings: world.log.filter(e => e.type === 'reopened').length,
      dividends: world.stats.dividends, trades: world.stats.trades, commissions: world.stats.commissions,
      forged: world.stats.forged, ministry: world.ministry,
      biggestFall: movers.reduce((a, b) => (b.low < a.low ? b : a)),
      biggestRise: movers.reduce((a, b) => (b.high > a.high ? b : a)),
      jadeStart: startJade, jadeEnd: endJade,
      jadeGrowthPerDayBps: div(div((endJade - startJade) * R.BPS, startJade), params.days),
    },
    world,
  };
}
