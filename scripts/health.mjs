// Is the live game healthy? A read-only check for judging week: no keys, no transactions. Run it once a day:
//   npm run health                      (checks https://ashes-ninth.duckdns.org)
//   ASHES_BASE=http://127.0.0.1:4173 npm run health
// It checks that the pages answer, the accounts that pay for play have NEAR, the shops are open, the merchant agents
// decided recently (and through NEAR AI), sign-in emails are really sent, and the contract has room for its storage.
// Exit code 1 if anything needs attention; each failure says what to do.
import {query, CONTRACT} from '../server/chain/near.js';

const BASE = process.env.ASHES_BASE || 'https://ashes-ninth.duckdns.org';
const MARKET_DAY_MS = 24 * 300_000; // 24 market hours of 5 real minutes
let failed = 0;
const check = (ok, text, fix = '') => {
  console.log(`${ok ? '✓' : '✗'} ${text}${ok || !fix ? '' : `\n    → ${fix}`}`);
  if (!ok) failed++;
};
const get = async path => {
  const started = Date.now();
  const res = await fetch(BASE + path, {signal: AbortSignal.timeout(20_000)});
  return {res, ms: Date.now() - started, json: /json/.test(res.headers.get('content-type') ?? '') ? await res.json() : null};
};

// 1. Pages and pictures
for (const path of ['/', '/judge', '/deed/lu-yan', '/#market-sim', '/deeds/lu-yan.svg', '/api/deeds/history?id=deed:lu-yan']) {
  const {res, ms} = await get(path).catch(error => ({res: {ok: false, status: error.message}, ms: 0}));
  check(res.ok && ms < 8_000, `${path} answers (${res.status}, ${ms} ms)`, 'Check the VM: gcloud compute ssh with CLOUDSDK_ACTIVE_CONFIG_NAME=ashes, then systemctl status ashes');
}

// 2. Money for play: the relayer pays every player's and agent's gas; the parent creates accounts
const {json: status} = await get('/api/status');
check(status?.online === true, 'the server is connected to the ledger', 'Redeploy with npm run deploy -- --env (keys missing on the VM?)');
check(Number(status?.relayerBalance) >= 2, `relayer balance ${status?.relayerBalance} NEAR (needs at least 2)`, 'Top up ashes-relay.testnet from the testnet faucet');
check(Number(status?.parentBalance) >= 0.5, `parent balance ${status?.parentBalance} NEAR (new players need 0.01 each)`, 'Top up ashes-ninth.testnet');
check(!status?.lastError, `no recent relayer or minter error${status?.lastError ? `: ${JSON.stringify(status.lastError).slice(0, 160)}` : ''}`);
check((status?.queuedGrants ?? 0) < 20, `${status?.queuedGrants ?? '?'} grants waiting for the minter`, 'The minter may be stuck: check the server log');
const account = await query({request_type: 'view_account', account_id: CONTRACT});
const spare = Number(BigInt(account.amount) - BigInt(account.storage_usage) * 10n ** 19n) / 1e24;
check(spare >= 0.5, `the contract has ${spare.toFixed(2)} NEAR spare for storage (${account.storage_usage} bytes used)`, 'Send 1 NEAR to items.ashes-ninth.testnet');

// 3. The bazaar: shops open, agents deciding, NEAR AI speaking
const {json: ledger} = await get('/api/ledger');
const shut = (ledger?.ledger?.merchants ?? []).filter(m => m.closed);
check(shut.length === 0, shut.length ? `shuttered: ${shut.map(m => m.name).join(', ')} (Ministry relief rekindles a shop after 2 hours)` : 'all nine shops are open',
  'If one stays shut for more than 2 hours, check the agents in the server log');
const {json: journal} = await get('/api/journal');
const latest = Object.values(journal?.ledger ?? {}).map(entries => entries[0]).filter(Boolean);
const newest = Math.max(0, ...latest.map(e => e.at));
check(Date.now() - newest < 1.5 * MARKET_DAY_MS, `the merchant agents last decided ${Math.round((Date.now() - newest) / 60_000)} minutes ago (once per market day, 2 hours)`,
  'The agents have stopped: check the server log (agent keys, NEAR AI key, relayer)');
const voiced = latest.filter(e => e.source === 'near-ai').length;
check(voiced >= Math.ceil(latest.length / 2), `${voiced} of ${latest.length} latest decisions came through NEAR AI`, 'Check NEAR_AI_API_KEY on the VM and its credit');
check(latest.every(e => e.ok !== false), `every latest decision reached the ledger${latest.some(e => e.ok === false) ? `: ${latest.filter(e => e.ok === false).map(e => e.code).join(', ')}` : ''}`);
const hires = journal?.hires ?? [];
console.log(`  · ${(ledger?.ledger?.jobs ?? []).length} open jobs, ${hires.filter(h => h.ok).length} merchant-to-merchant deliveries on record, ${(journal?.haggles ?? []).length} recent haggles`);

// 4. Sign-in
const {json: session} = await get('/api/session');
check(session?.signIn?.emailIsSent === true, 'sign-in emails are really sent', 'Set SMTP_USER and SMTP_PASS in .env and run npm run deploy -- --env');
check(Boolean(session?.signIn?.google), 'Google sign-in is configured');

console.log(failed ? `\n${failed} need attention.` : '\nAll healthy.');
process.exit(failed ? 1 : 0);
