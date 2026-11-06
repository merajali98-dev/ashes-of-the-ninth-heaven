// Deploys the items contract to NEAR testnet and opens the merchants' shops. Safe to re-run: finished steps are skipped.
//   1. npm run contract:build (or use the committed contracts/items/res/items.wasm)
//   2. npm run chain:deploy
import {readFile} from 'node:fs/promises';
import {parseNearAmount, teraToGas} from 'near-api-js';
import {MERCHANTS} from '../js/market/merchant-rules.js';
import {CONTRACT, MINISTRY, MINTER, PARENT, account, exists, explorer, merchantAccount, newKeyPair, saveKey, view} from './chain.mjs';

const TICK_MS = Number(process.env.ASHES_TICK_MS || 60_000);
const BASE_URI = process.env.ASHES_BASE_URI || null;
const parent = await account(PARENT);
const funding = {[CONTRACT]: '8.2', [MINTER]: '0.3', [MINISTRY]: '0.05', ...Object.fromEntries(MERCHANTS.map(m => [merchantAccount(m.id), '0.1']))};

for (const [id, near] of Object.entries(funding)) {
  if (await exists(id)) { console.log(`✓ ${id} exists`); continue; }
  const keyPair = newKeyPair();
  await saveKey(id, keyPair);
  await parent.createSubAccount({accountOrPrefix: id, publicKey: keyPair.getPublicKey(), nearToTransfer: BigInt(parseNearAmount(near))});
  console.log(`+ created ${id} with ${near} NEAR`);
}

const contract = await account(CONTRACT);
const code = await contract.getContractCode().catch(() => null);
const wasm = await readFile(new URL('../contracts/items/res/items.wasm', import.meta.url));
if (!code?.code_base64 || process.argv.includes('--redeploy')) {
  await contract.deployContract(new Uint8Array(wasm));
  console.log(`+ deployed ${wasm.length} bytes to ${CONTRACT}`);
} else console.log(`✓ contract code present`);

let info = await view('contract_info').catch(() => null);
if (!info) {
  await contract.callFunction({contractId: CONTRACT, methodName: 'new', gas: teraToGas(50),
    args: {owner_id: PARENT, minter_id: MINTER, ministry_id: MINISTRY, tick_ms: TICK_MS, base_uri: BASE_URI}});
  info = await view('contract_info');
  console.log(`+ initialised: one market hour every ${TICK_MS / 1000}s`);
} else console.log(`✓ initialised (${info.tokens} tokens, ${info.merchants} merchants)`);

const registry = JSON.parse(await readFile(new URL('../contracts/items/tokens.json', import.meta.url), 'utf8'));
for (let from = info.tokens - 1; from < registry.length; from += 80) {
  const chunk = registry.slice(from, from + 80);
  if (!chunk.length) break;
  const total = await parent.callFunction({contractId: CONTRACT, methodName: 'register_tokens', args: {tokens: chunk}, gas: teraToGas(300)});
  console.log(`+ registered tokens ${from + 1}–${from + chunk.length} (${total} total)`);
}

const open = new Set(await view('market_merchants'));
for (const m of MERCHANTS) {
  const id = merchantAccount(m.id);
  if (open.has(id)) { console.log(`✓ ${m.name}'s shop is open`); continue; }
  await parent.callFunction({contractId: CONTRACT, methodName: 'add_merchant', args: {account_id: id, rules_id: m.id}, gas: teraToGas(300)});
  console.log(`+ opened ${m.name}'s shop at ${id}`);
}

info = await view('contract_info');
const state = await contract.getState();
console.log(JSON.stringify({contract: CONTRACT, explorer: explorer(CONTRACT), ...info, storage_bytes: state.storageUsage,
  balance_near: Number(state.balance.total / 10n ** 21n) / 1000, storage_near: Number(state.balance.usedOnStorage / 10n ** 21n) / 1000}, null, 1));
