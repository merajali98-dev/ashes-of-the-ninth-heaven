// The fast-forward week as a story: its turning points, picked from what the simulation recorded (shocks, closures,
// rescues, reopenings, market events) and from its prices (the week's deepest fall and highest rise). Pure: it reads a
// finished simulation and returns at most eight beats in time order, so the page can light them as playback passes and
// jump to any of them.
import {CAST} from './npc.js';

const MAX_BEATS = 8;
// Which beats to keep when there are too many, and, within one market hour, the order they happened in.
const PRIORITY = {flood: 0, shock: 0, closed: 1, reopened: 2, rekindle: 3, low: 4, high: 5, event: 6};
const SAME_HOUR = {flood: 0, shock: 1, event: 2, low: 3, high: 4, closed: 5, rekindle: 6, reopened: 7};
const SHOCK_TITLE = {'kiln-riot': 'Riots at the kilns', 'spring-flood': 'The estuary floods', 'storm-rush': 'A tribulation storm', 'ministry-audit': 'A Ministry audit'};

/** sim: runFastForward's result. names: {family: id → label, merchant: id → name}. */
export function storyBeats(sim, names) {
  const beats = [], seen = new Set();
  const once = (key, beat) => { if (!seen.has(key)) { seen.add(key); beats.push(beat); } };
  if (sim.params?.cast?.flooder) beats.push({tick: 0, kind: 'flood', title: 'A guild floods the market', text: CAST.flooder.text});
  for (const e of sim.events) {
    const who = e.merchant ? names.merchant(e.merchant) : '';
    if (e.type === 'shock') once('shock' + e.tick, {tick: e.tick, kind: 'shock', title: SHOCK_TITLE[e.shock] ?? 'A shock hits the bazaar', text: e.text});
    if (e.type === 'closed') once('closed' + e.merchant + e.tick, {tick: e.tick, kind: 'closed', title: `${who} shutters`, text: e.text});
    if (e.type === 'rekindle') once('rekindle' + e.merchant, {tick: e.tick, kind: 'rekindle', title: `Patrons rally to ${who}`, text: e.text});
    if (e.type === 'reopened') once('reopened' + e.merchant + e.tick, {tick: e.tick, kind: 'reopened', title: `${who} reopens`, text: e.text});
    if (e.type === 'event' && [...seen].filter(k => k.startsWith('event')).length < 2) once('event' + e.tick, {tick: e.tick, kind: 'event', title: 'Bazaar news', text: e.text});
  }
  const {biggestFall: fall, biggestRise: rise} = sim.summary;
  const at = (family, pick) => {
    const values = sim.frames.map(f => f.families[family]), target = pick(...values);
    return sim.frames[values.indexOf(target)].tick;
  };
  const pct = bps => Math.round(bps / 100) + '%';
  if (fall.low < 8_000) beats.push({tick: at(fall.family, Math.min), kind: 'low', title: `${names.family(fall.family)} bottoms out`,
    text: `${names.family(fall.family)} falls to ${pct(fall.low)} of its usual price, the week's deepest drop.`});
  if (rise.high > 12_500) beats.push({tick: at(rise.family, Math.max), kind: 'high', title: `${names.family(rise.family)} peaks`,
    text: `${names.family(rise.family)} climbs to ${pct(rise.high)} of its usual price, the week's highest.`});
  const chosen = beats.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.tick - b.tick).slice(0, MAX_BEATS);
  return chosen.sort((a, b) => a.tick - b.tick || SAME_HOUR[a.kind] - SAME_HOUR[b.kind]);
}
