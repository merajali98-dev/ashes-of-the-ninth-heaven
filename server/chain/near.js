// Shared NEAR testnet helpers for the server and scripts. Testnet only: anything else is refused.
// Keys come from NEAR_KEY_<ACCOUNT> environment variables (for hosting) or the local legacy keychain that
// near-cli-rs writes to ~/.near-credentials/testnet (for development). Keys are never logged.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {Account, JsonRpcProvider, KeyPair} from 'near-api-js';

export const NETWORK = 'testnet';
export const PARENT = process.env.ASHES_PARENT || 'ashes-ninth.testnet';
export const RELAYER = process.env.ASHES_RELAYER || 'ashes-relay.testnet';
export const CONTRACT = process.env.ASHES_CONTRACT || 'items.' + PARENT;
export const MINTER = 'minter.' + PARENT;
export const MINISTRY = 'ministry.' + PARENT;
export const merchantAccount = id => `m-${id}.${PARENT}`;
const RPC = [process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com'];
for (const id of [PARENT, RELAYER, CONTRACT]) if (!id.endsWith('.testnet')) throw new Error(`Refusing non-testnet account ${id}`);
for (const url of RPC) if (!/testnet|\/\/test\.rpc\./.test(url)) throw new Error('Refusing a non-testnet RPC endpoint');

export const provider = new JsonRpcProvider({url: RPC[0]});
const keychain = join(homedir(), '.near-credentials', NETWORK);
const envName = id => 'NEAR_KEY_' + id.toUpperCase().replace(/[^A-Z0-9]/g, '_');

export async function loadKey(accountId) {
  if (process.env[envName(accountId)]) return process.env[envName(accountId)];
  const file = join(keychain, accountId + '.json');
  if (!existsSync(file)) return null;
  return JSON.parse(await readFile(file, 'utf8')).private_key;
}
export async function saveKey(accountId, keyPair) {
  await mkdir(keychain, {recursive: true});
  await writeFile(join(keychain, accountId + '.json'), JSON.stringify({account_id: accountId, public_key: keyPair.getPublicKey().toString(),
    private_key: keyPair.toString()}), {mode: 0o600});
}
export async function account(accountId) {
  const key = await loadKey(accountId);
  if (!key) throw new Error(`No key for ${accountId}: set ${envName(accountId)} or create it with near-cli-rs`);
  return new Account(accountId, provider, key);
}
export async function exists(accountId) {
  try { await provider.query({request_type: 'view_account', account_id: accountId, finality: 'final'}); return true; }
  catch { return false; }
}
export async function view(methodName, args = {}, contractId = CONTRACT) {
  return provider.callFunction({contractId, method: methodName, args});
}
export const newKeyPair = () => KeyPair.fromRandom('ed25519');
export const explorer = id => `https://testnet.nearblocks.io/address/${id}`;
