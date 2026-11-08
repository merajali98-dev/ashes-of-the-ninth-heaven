// Read-only checks of the live testnet deployment. Needs no keys and sends no transactions: anyone can run it.
//   1. The deployed contract is the committed binary (code hash = sha256 of contracts/items/res/items.wasm).
//   2. Live parity: for every merchant, the rules file prices trades from the on-chain books exactly as the contract does.
//   3. Escrow adds up: the contract's own jade equals every deed vault plus every job's unpaid wages.
//   4. Shop Deeds: nine NEP-171 tokens, one per merchant, nobody over the per-account cap. Each deed's history agrees
//      with it: the vault equals the opening vault + earnings - claims, the shares by day add up to the earnings, and
//      the last holder in the history is the deed's owner.
//   5. Jobs: each open job's escrow equals its units times its pay, within the rules' unit cap.
//   6. Agent keys: every merchant's function-call keys may call only merchant_set_strategy, merchant_post_job and
//      merchant_fill_job.
// Run: npm run chain:verify
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {base58} from '../js/online/signer.js';
import {CONTRACT, query, view} from '../server/chain/near.js';

let failures = 0;
const check = (ok, text) => { console.log(`${ok ? '✓' : '✗'} ${text}`); if (!ok) failures++; };

// 1. The binary
const wasm = await readFile(new URL('../contracts/items/res/items.wasm', import.meta.url));
const local = base58(createHash('sha256').update(wasm).digest());
const deployed = (await query({request_type: 'view_account', account_id: CONTRACT})).code_hash;
check(local === deployed, `${CONTRACT} runs the committed contracts/items/res/items.wasm (code hash ${deployed})`);

// 2. Live parity, merchant by merchant (re-read once if a market hour turns between the two reads)
const info = await view('contract_info');
const ids = await view('market_merchants');
let quotes = 0, mismatches = [];
for (const id of ids) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const books = await view('market_merchant', {merchant_id: id});
    const merchant = R.MERCHANTS.find(m => m.id === books.rules_id);
    const map = key => Object.fromEntries(books.goods.map(g => [g.token_id, Number(g[key])]));
    const state = {cash: Number(books.cash), stock: map('stock'), target: map('target'), baseTarget: map('base_target'),
      flow: Object.fromEntries(books.goods.map(g => [g.token_id, g.flow])), closed: books.closed, specialty: books.specialty};
    const sample = books.goods.filter((_, i) => i % 7 === 0).slice(0, 4);
    const local = [], remote = [];
    for (const g of sample) for (const side of ['sell', 'buy']) {
      const q = R.quote({merchant, state, token: MARKET_TOKENS[g.token_id], side, qty: 3, tick: books.tick, testimonyBps: info.testimony_bps});
      local.push(`${g.token_id} ${side} ${q.ok ? q.total : q.code}`);
      const c = await view('market_quote', {merchant_id: id, token_id: g.token_id, side, amount: '3'});
      remote.push(`${g.token_id} ${side} ${c.code === 'OK' ? Number(c.total) : c.code}`);
    }
    const tickNow = await view('market_tick');
    if (local.join() === remote.join()) { quotes += local.length; break; }
    if (attempt === 1 || tickNow === books.tick) { mismatches.push({id, local, remote}); break; }
  }
}
check(!mismatches.length, `the rules file and the contract quote ${quotes} live trades identically across ${ids.length} merchants`);
for (const m of mismatches) console.log('  ', JSON.stringify(m));

// 3 and 4. Deeds and escrow
const deeds = await view('deeds');
const jobs = await view('jobs');
const vaults = deeds.reduce((sum, d) => sum + BigInt(d.vault), 0n), wages = jobs.reduce((sum, j) => sum + BigInt(j.escrow), 0n);
const held = BigInt(await view('mt_balance_of', {account_id: CONTRACT, token_id: 'jade'}));
check(held === vaults + wages, `escrow adds up: the contract holds ${R.jade(Number(held))} jade = deed vaults ${R.jade(Number(vaults))} + job wages ${R.jade(Number(wages))}`);
const owners = {};
for (const d of deeds) if (!d.held_by_ministry) owners[d.owner_id] = (owners[d.owner_id] ?? 0) + 1;
check(deeds.length === R.MERCHANTS.length && new Set(deeds.map(d => d.rules_id)).size === R.MERCHANTS.length,
  `${deeds.length} Shop Deeds (NEP-171), one per merchant; nft_total_supply ${await view('nft_total_supply')}`);
check(Object.values(owners).every(n => n <= R.DEED.maxPerAccount), `no account holds more than ${R.DEED.maxPerAccount} deeds (${Object.keys(owners).length} player holders)`);
const records = await Promise.all(deeds.map(d => view('deed_history', {token_id: d.token_id})));
const disagree = records.filter(({deed, history: h}) => {
  const days = h.days.reduce((sum, d) => sum + BigInt(d.share), 0n);
  return BigInt(h.opening_vault) + BigInt(h.earned) - BigInt(h.claimed) !== BigInt(deed.vault) || h.holdings.at(-1).owner !== deed.owner_id
    || (h.days.length < 60 && days !== BigInt(h.earned));
});
const sold = records.reduce((n, r) => n + r.history.sales, 0), events = records.reduce((n, r) => n + r.history.events.length, 0);
check(!disagree.length, `every deed's history agrees with the deed: vault = opening + earned - claimed, days add up, last holder = owner (${sold} sales, ${events} holder actions on record)`);
for (const r of disagree) console.log('  ', r.deed.token_id, JSON.stringify({vault: r.deed.vault, opening: r.history.opening_vault, earned: r.history.earned, claimed: r.history.claimed}));

// 5. Jobs
check(jobs.every(j => BigInt(j.escrow) === BigInt(j.wanted) * BigInt(j.pay_each) && Number(j.wanted) <= R.JOBS.maxUnits),
  `${jobs.length} open jobs, each escrowing exactly its units × pay, none over ${R.JOBS.maxUnits} units`);

// 6. Agent keys
let limited = 0;
const allowed = ['merchant_set_strategy', 'merchant_post_job', 'merchant_fill_job'];
for (const id of ids) {
  const keys = (await query({request_type: 'view_access_key_list', account_id: id})).keys;
  for (const k of keys) {
    const fc = k.access_key.permission?.FunctionCall;
    if (!fc) continue;
    limited++;
    check(fc.receiver_id === CONTRACT && fc.method_names.length > 0 && fc.method_names.every(m => allowed.includes(m)),
      `${id}: agent key may call only ${fc.method_names.join(', ')} on ${fc.receiver_id}`);
  }
}
check(limited >= ids.length, `every merchant has a limited agent key (${limited} found)`);

const tick = await view('market_tick');
console.log(`\nmarket hour ${tick} · one market hour = ${info.tick_ms / 1000}s · ${ids.length} merchants · ${info.tokens} tokens · ${failures ? failures + ' FAILED' : 'all checks passed'}`);
process.exitCode = failures ? 1 : 0;
