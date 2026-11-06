// Live testnet check of the whole no-wallet trade path, end to end:
//   1. a player account gets Cinder Essence from the minter (a commission reward);
//   2. the player is given a key that can only call the market methods of the items contract;
//   3. the player sells to Lu Yan with a delegate action signed by that limited key, and the relayer pays the gas;
//   4. the on-chain result must equal the JavaScript rules file's quote, computed from the on-chain books;
//   5. the limited key must NOT be able to call the standard 1-yocto mt_transfer.
// Run: node scripts/chain-smoke.mjs
import {actions, parseNearAmount, teraToGas} from 'near-api-js';
import {Account} from 'near-api-js';
import * as R from '../js/market/merchant-rules.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {CONTRACT, MINTER, PARENT, RELAYER, account, exists, explorer, merchantAccount, newKeyPair, provider, saveKey, view} from './chain.mjs';

const PLAYER = 'p-smoke.' + PARENT, MERCHANT = merchantAccount('lu-yan'), TOKEN = 'mat:essence-ember-1', QTY = 7;
const failed = result => [result.status, ...(result.receipts_outcome ?? []).map(r => r.outcome.status)].find(s => s && typeof s === 'object' && 'Failure' in s);

if (!(await exists(PLAYER))) {
  const key = newKeyPair();
  await saveKey(PLAYER, key);
  await (await account(PARENT)).createSubAccount({accountOrPrefix: PLAYER, publicKey: key.getPublicKey(), nearToTransfer: BigInt(parseNearAmount('0.05'))});
  console.log('+ created', PLAYER);
}

const minter = await account(MINTER);
const seq = (await view('seq_of', {account_id: MINTER})) + 1;
await minter.callFunction({contractId: CONTRACT, methodName: 'game_mint_batch', gas: teraToGas(50),
  args: {mints: [{account_id: PLAYER, token_id: TOKEN, amount: String(QTY)}], seq, memo: 'smoke test commission'}});
console.log(`+ minter granted ${QTY} ${TOKEN} (batch ${seq})`);

// The JavaScript rules file prices the same trade from the on-chain books.
const books = await view('market_merchant', {merchant_id: MERCHANT});
const toMap = key => Object.fromEntries(books.goods.map(g => [g.token_id, Number(g[key])]));
const state = {cash: Number(books.cash), stock: toMap('stock'), target: toMap('target'), baseTarget: toMap('base_target'),
  flow: Object.fromEntries(books.goods.map(g => [g.token_id, g.flow])), closed: books.closed, specialty: books.specialty};
const merchant = R.MERCHANTS.find(m => m.id === books.rules_id);
const info = await view('contract_info');
const expected = R.quote({merchant, state, token: MARKET_TOKENS[TOKEN], side: 'sell', qty: QTY, tick: books.tick, testimonyBps: info.testimony_bps});
const onChain = await view('market_quote', {merchant_id: MERCHANT, token_id: TOKEN, side: 'sell', amount: String(QTY), account_id: PLAYER});
console.log(`  rules file quote ${expected.total} · contract quote ${onChain.total} (tick ${books.tick})`);
if (String(expected.total) !== onChain.total) throw new Error('The contract and the rules file disagree');

// A key that can only call the market, added by the player's own full key (in the game, the server does this at sign-in).
const limited = newKeyPair();
await (await account(PLAYER)).addFunctionCallAccessKey({publicKey: limited.getPublicKey(), contractId: CONTRACT,
  methodNames: ['market_sell', 'market_buy', 'patron_invest'], allowance: BigInt(parseNearAmount('0.25'))});
const player = new Account(PLAYER, provider, limited.toString());
const before = BigInt(await view('mt_balance_of', {account_id: PLAYER, token_id: 'jade'}));

const {signedDelegate} = await player.createSignedMetaTransaction({receiverId: CONTRACT, blockHeightTtl: 120,
  actions: [actions.functionCall('market_sell', {merchant_id: MERCHANT, token_id: TOKEN, amount: String(QTY), min_total: onChain.total}, teraToGas(100), 0n)]});
const relay = await account(RELAYER);
const relayed = await relay.signAndSendTransaction({receiverId: PLAYER, actions: [actions.signedDelegate(signedDelegate)], waitUntil: 'FINAL'});
if (failed(relayed)) throw new Error('Relayed trade failed: ' + JSON.stringify(failed(relayed)).slice(0, 300));
const after = BigInt(await view('mt_balance_of', {account_id: PLAYER, token_id: 'jade'}));
console.log(`+ relayed sale settled: player jade ${before} → ${after} (tx ${relayed.transaction.hash})`);
if (after - before !== BigInt(onChain.total)) throw new Error('Paid amount differs from the quote');

// The same limited key cannot move goods with the standard transfer (it needs 1 yoctoNEAR and is not in the method list).
let refused = false;
try {
  const {signedDelegate: bad} = await player.createSignedMetaTransaction({receiverId: CONTRACT, blockHeightTtl: 120,
    actions: [actions.functionCall('mt_transfer', {receiver_id: RELAYER, token_id: 'jade', amount: '1', approval: null, memo: null}, teraToGas(30), 1n)]});
  const result = await relay.signAndSendTransaction({receiverId: PLAYER, actions: [actions.signedDelegate(bad)], waitUntil: 'FINAL', throwOnFailure: false});
  refused = Boolean(failed(result));
} catch { refused = true; }
console.log(`  limited key refused for mt_transfer: ${refused}`);
if (!refused) throw new Error('A limited key moved tokens with mt_transfer');

console.log(JSON.stringify({ok: true, player: PLAYER, contract: CONTRACT, explorer: explorer(PLAYER), tx: `https://testnet.nearblocks.io/txns/${relayed.transaction.hash}`}, null, 1));
