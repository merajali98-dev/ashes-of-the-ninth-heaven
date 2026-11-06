// Replays the recorded week using only merchant-rules.js: exactly what the Rust contract's parity test does.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from '../js/market/merchant-rules.js';
import {buildTrace} from '../scripts/gen-market-trace.mjs';

const fixture = JSON.parse(await readFile(new URL('./fixtures/market-trace.json', import.meta.url), 'utf8'));

test('the parity fixture is current: regenerate it with node scripts/gen-market-trace.mjs after changing the rules', () => {
  assert.equal(JSON.stringify(buildTrace()), JSON.stringify(fixture));
});

test('the fixture covers at least 2,500 rules steps with daily snapshots', () => {
  assert.ok(fixture.steps >= 2_500, `${fixture.steps} steps`);
  assert.equal(fixture.counts.check, 7);
  assert.ok(fixture.counts.trade > 500 && fixture.counts.adjust > 0);
  assert.ok(fixture.ops.some(op => op.op === 'trade' && op.code !== 'OK'), 'refusals are part of the trace');
});

test('replaying the trace with only the rules file reproduces every quote and every snapshot', () => {
  const [genesis] = fixture.ops;
  assert.equal(genesis.op, 'genesis');
  const tokens = Object.fromEntries(genesis.tokens.map(t => [t.id, t]));
  const merchants = Object.fromEntries(R.MERCHANTS.map(m => [m.id, m]));
  assert.deepEqual(genesis.merchants, R.MERCHANTS.map(m => m.id));
  const markets = Object.fromEntries(genesis.merchants.map(id => [id, R.openingState(merchants[id], tokens)]));
  let checked = 0;
  for (const [index, op] of fixture.ops.entries()) {
    const where = `step ${index} (${op.op} ${op.m ?? ''})`;
    if (op.op === 'trade') {
      const q = R.quote({merchant: merchants[op.m], state: markets[op.m], token: tokens[op.token], side: op.side, qty: op.qty,
        tick: op.tick, reputationBps: op.rep, testimonyBps: op.testimony});
      assert.equal(q.code, op.code, where);
      assert.equal(q.total, op.total, where);
      assert.equal(q.taxPaid ?? 0, op.taxPaid, where);
      markets[op.m] = R.applyQuote(markets[op.m], q);
    } else if (op.op === 'tick') {
      markets[op.m] = R.tickMerchant(merchants[op.m], markets[op.m], op.tick, tokens);
    } else if (op.op === 'adjust') {
      const s = markets[op.m];
      markets[op.m] = {...s, cash: s.cash + (op.cash ?? 0),
        stock: {...s.stock, ...Object.fromEntries(Object.entries(op.stock ?? {}).map(([t, d]) => [t, (s.stock[t] ?? 0) + d]))},
        flow: {...s.flow, ...Object.fromEntries(Object.entries(op.flow ?? {}).map(([t, d]) => [t, (s.flow[t] ?? 0) + d]))}};
    } else if (op.op === 'check') {
      assert.deepEqual(markets, op.markets, `snapshot at tick ${op.tick}`);
      checked++;
    }
  }
  assert.equal(checked, 7);
});
