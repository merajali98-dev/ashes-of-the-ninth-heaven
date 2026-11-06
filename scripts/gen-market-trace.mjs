// Records every merchant-rules operation from a simulated week, for the contract parity test.
// The Rust contract must replay tests/fixtures/market-trace.json and match every quote and every daily snapshot.
// Run: node scripts/gen-market-trace.mjs   (tests fail if the fixture is stale, so rerun after changing the rules)
import {writeFile, mkdir} from 'node:fs/promises';
import {runFastForward} from '../js/market/fastforward.js';

export const TRACE_RUN = Object.freeze({seed: 1, days: 7, cast: {wanderers: 8}, shocks: [{id: 'storm-rush', tick: 60}, {id: 'ministry-audit', tick: 100}]});

export function buildTrace() {
  const trace = [];
  runFastForward(TRACE_RUN, {trace});
  const count = op => trace.filter(x => x.op === op).length;
  return {version: 1, run: TRACE_RUN, steps: count('trade') + count('tick') + count('adjust'),
    counts: {trade: count('trade'), tick: count('tick'), adjust: count('adjust'), check: count('check')}, ops: trace};
}

if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('gen-market-trace.mjs')) {
  const fixture = buildTrace();
  await mkdir(new URL('../tests/fixtures/', import.meta.url), {recursive: true});
  await writeFile(new URL('../tests/fixtures/market-trace.json', import.meta.url), JSON.stringify(fixture) + '\n');
  console.log(`Wrote ${fixture.steps} steps (${JSON.stringify(fixture.counts)}) to tests/fixtures/market-trace.json`);
}
