// Live testnet check of the whole online path, through the game's own HTTP API, exactly as the browser does it:
//   guest sign-in → device key made with WebCrypto → ledger seal (a new account) → welcome grant from the minter →
//   a sale to Lu Yan signed in "the browser" and relayed by the server → the jade lands. Then a forbidden method is
//   refused by the relayer. Creates one new testnet account per run (0.01 NEAR from the parent).
// Run: npm run chain:e2e
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

process.env.PORT = '0';
process.env.ASHES_STORE ||= join(tmpdir(), `ashes-e2e-${Date.now()}.json`);
const {server} = await import('../server.js');
const {createDeviceKey, publicKeyOf, signDelegate} = await import('../js/online/signer.js');
const {CONTRACT, merchantAccount, view} = await import('../server/chain/near.js');
if (!server.listening) await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

let jar = '';
async function api(method, path, body) {
  const res = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', 'X-Ashes': '1', ...(jar ? {Cookie: jar} : {})},
    body: body ? JSON.stringify(body) : undefined});
  if (res.headers.get('set-cookie')) jar = res.headers.get('set-cookie').split(';')[0];
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}
const balance = (accountId, tokenId) => view('mt_balance_of', {account_id: accountId, token_id: tokenId}).then(BigInt);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const session = await api('GET', '/api/session');
  if (!session.ledger) throw new Error('The server has no testnet keys (see internal/08); nothing to check');
  const name = 'trial-' + randomBytes(3).toString('hex');
  await api('POST', '/api/auth/guest', {name});
  const device = await createDeviceKey(), publicKey = await publicKeyOf(device);
  const sealed = await api('POST', '/api/seal', {publicKey, name});
  const accountId = sealed.user.seal.id;
  console.log(`+ seal ${accountId} (device key ${publicKey.slice(0, 16)}…)`);

  const TOKEN = 'mat:essence-ember-1', MERCHANT = merchantAccount('lu-yan'), QTY = 3;
  let held = 0n;
  for (let i = 0; i < 40 && held < BigInt(QTY); i++) { await wait(1500); held = await balance(accountId, TOKEN); }
  if (held < BigInt(QTY)) throw new Error('The welcome grant did not arrive');
  console.log(`+ welcome grant arrived: ${held} Cinder Essence, ${await balance(accountId, 'jade')} jade cents`);

  const quote = await view('market_quote', {merchant_id: MERCHANT, token_id: TOKEN, side: 'sell', amount: String(QTY), account_id: accountId});
  const next = await api('GET', '/api/seal/next?key=' + encodeURIComponent(publicKey));
  const delegate = {senderId: accountId, receiverId: CONTRACT, publicKey, nonce: BigInt(next.nonce), maxBlockHeight: BigInt(next.maxBlockHeight),
    actions: [{methodName: 'market_sell', args: {merchant_id: MERCHANT, token_id: TOKEN, amount: String(QTY), min_total: quote.total}, gas: 100_000_000_000_000n, deposit: 0n}]};
  const before = await balance(accountId, 'jade');
  const result = await api('POST', '/api/seal/relay', await signDelegate(device, delegate));
  if (!result.ok) throw new Error('Relayed sale failed: ' + result.code);
  const after = await balance(accountId, 'jade');
  console.log(`+ sold ${QTY} to Lu Yan for ${quote.total} (receipt total ${result.receipt?.total}); jade ${before} → ${after}`);
  if (after - before !== BigInt(quote.total)) throw new Error('Paid amount differs from the quote');

  const bad = {...delegate, nonce: delegate.nonce + 1n, actions: [{methodName: 'mt_transfer', args: {receiver_id: MERCHANT, token_id: 'jade', amount: '1'}, gas: 30_000_000_000_000n, deposit: 0n}]};
  const refused = await api('POST', '/api/seal/relay', await signDelegate(device, bad)).then(() => false, error => /NOT_ALLOWED/.test(error.message));
  console.log(`  relayer refused mt_transfer: ${refused}`);
  if (!refused) throw new Error('The relayer accepted a method outside the market');

  console.log(JSON.stringify({ok: true, account: accountId, tx: `https://testnet.nearblocks.io/txns/${result.tx}`, status: await api('GET', '/api/status')}, null, 1));
} finally {
  server.closeAllConnections();
  server.close();
}
