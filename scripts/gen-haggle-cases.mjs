// Writes tests/fixtures/haggle-cases.json: haggling and job checks worked out by js/market/merchant-rules.js for
// every merchant across many prices, offers and books. contracts/items/tests/parity.rs replays them through the
// contract's pricing module and must agree on every one. Run: node scripts/gen-haggle-cases.mjs
import {mkdir, writeFile} from 'node:fs/promises';
import * as R from '../js/market/merchant-rules.js';

export function buildHaggleCases() {
  const haggles = [], jobs = [];
  for (const merchant of R.MERCHANTS) {
    for (const side of ['sell', 'buy']) {
      for (const posted of [1, 199, 1_000, 98_765]) {
        for (const helps of [false, true]) {
          for (const struggling of [false, true]) {
            for (const permille of [0, 500, 1_000, 1_010, 1_020, 1_030, 1_045, 1_060, 1_080, 1_100, 1_200, 2_000]) {
              const offer = side === 'sell' ? Math.max(1, Math.trunc(posted * permille / 1_000)) : Math.max(1, Math.trunc(posted * (2_000 - permille) / 1_000));
              const h = R.haggle({merchant, side, posted, offer, helps, struggling});
              haggles.push({m: merchant.id, side, posted, offer, helps, struggling, outcome: h.outcome, price: h.price, bendBps: h.bendBps});
            }
          }
        }
      }
    }
    let n = 0;
    for (const [stock, target] of [[120, 120], [80, 120], [5, 40], [0, 15], [30, 25]]) {
      for (const [bid, mid] of [[150, 190], [190, 150], [1, 1]]) {
        for (const cash of [merchant.startCash, Math.trunc(merchant.startCash / 8), 30_000]) {
          for (const open of [true, false]) {
            for (const units of [0, 1, 7, 20, 21]) {
              for (const payEach of [bid - 1, bid, Math.trunc((bid + mid) / 2), Math.max(bid, mid), Math.max(bid, mid) + 1]) {
                if ((n++ % 7) !== 0) continue; // keep the fixture small but varied
                const books = {stock, target, bid, mid, cash, open};
                jobs.push({m: merchant.id, ...books, units, payEach, code: R.checkJob(merchant, books, {units, payEach})});
              }
            }
          }
        }
      }
    }
  }
  return {haggles, jobs};
}

if (process.argv[1]?.endsWith('gen-haggle-cases.mjs')) {
  await mkdir(new URL('../tests/fixtures/', import.meta.url), {recursive: true});
  const cases = buildHaggleCases();
  await writeFile(new URL('../tests/fixtures/haggle-cases.json', import.meta.url), JSON.stringify(cases) + '\n');
  console.log(`Wrote tests/fixtures/haggle-cases.json: ${cases.haggles.length} haggles, ${cases.jobs.length} job checks`);
}
