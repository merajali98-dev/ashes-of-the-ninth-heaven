// The town crier: the market's drama as short lines in the game, so a player feels the week without opening a chart.
// Practice market: the notable entries of the market log. Honest Ledger: what changed between two readings of it
// (a shop shuttered or rekindled, a new Edict, a new event, a merchant's decision).
import * as R from './merchant-rules.js';
import {schools} from '../content.js';

const NOTABLE = new Set(['closed', 'reopened', 'rekindle', 'shock', 'event', 'edict']);
const schoolName = id => schools.find(s => s.id === id)?.name ?? id;

export const crierFromLog = events => (events ?? []).filter(e => NOTABLE.has(e.type)).map(e => e.text);

/** A small picture of the ledger's market, to compare with the next one. */
export const snapshot = ledger => ledger?.books ? {
  tick: ledger.books.tick,
  merchants: Object.fromEntries(Object.entries(ledger.books.merchants).map(([id, m]) => [id, {name: m.name, closed: m.closed}])),
  journal: Object.fromEntries(Object.entries(ledger.journal ?? {}).map(([id, e]) => [id, {day: e.day, say: e.say}])),
} : null;

export function crierFromLedger(before, after) {
  if (!before || !after) return [];
  const lines = [];
  for (const [id, m] of Object.entries(after.merchants)) {
    const was = before.merchants[id];
    if (was && !was.closed && m.closed) lines.push(`${m.name}'s shutters are down: the purse ran dry. Patrons can rekindle the shop.`);
    if (was?.closed && !m.closed) lines.push(`${m.name} has reopened, rekindled by patrons.`);
  }
  if (Math.floor(before.tick / R.TIME.ticksPerWeek) !== Math.floor(after.tick / R.TIME.ticksPerWeek)) {
    lines.push(`A new week: the Pagoda Edict now favours ${schoolName(R.edictSchool(after.tick))}.`);
  }
  const event = R.activeEvent(after.tick);
  if (event && event.id !== R.activeEvent(before.tick)?.id) lines.push(event.text + '.');
  const decided = Object.entries(after.journal).filter(([id, e]) => e.say && (before.journal[id]?.day ?? -1) < e.day);
  if (decided.length) {
    const [id, e] = decided[decided.length - 1];
    lines.push(`${after.merchants[id]?.name ?? id}: “${e.say}”`);
  }
  return lines;
}
