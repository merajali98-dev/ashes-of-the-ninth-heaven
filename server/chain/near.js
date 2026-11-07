// Shared NEAR testnet helpers for the server and scripts. Testnet only: anything else is refused.
// Keys come from NEAR_KEY_<ACCOUNT> environment variables (for hosting) or the local legacy keychain that
// near-cli-rs writes to ~/.near-credentials/testnet (for development). Keys are never logged.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {Account, FailoverRpcProvider, JsonRpcProvider, KeyPair} from 'near-api-js';

export const NETWORK = 'testnet';
export const PARENT = process.env.ASHES_PARENT || 'ashes-ninth.testnet';
export const RELAYER = process.env.ASHES_RELAYER || 'ashes-relay.testnet';
export const CONTRACT = process.env.ASHES_CONTRACT || 'items.' + PARENT;
export const MINTER = 'minter.' + PARENT;
export const MINISTRY = 'ministry.' + PARENT;
export const merchantAccount = id => `m-${id}.${PARENT}`;
// Reads go to the first endpoint and fall back to the next; free public RPCs drop requests under load.
const RPC = (process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com,https://rpc.testnet.near.org').split(',').map(u => u.trim()).filter(Boolean);
for (const id of [PARENT, RELAYER, CONTRACT]) if (!id.endsWith('.testnet')) throw new Error(`Refusing non-testnet account ${id}`);
for (const url of RPC) if (!/testnet|\/\/test\.rpc\./.test(url)) throw new Error('Refusing a non-testnet RPC endpoint');

const readers = RPC.map(url => new JsonRpcProvider({url}));
// Transactions fail over between endpoints too (a dropped connection must not lose a player's trade).
export const provider = readers.length > 1 ? new FailoverRpcProvider(readers) : readers[0];
/** A read with retries across the endpoints (network errors and rate limits only; contract errors are thrown at once). */
async function read(task) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await task(readers[attempt % readers.length]); }
    catch (error) {
      last = error;
      if (!/fetch failed|ECONNRESET|ETIMEDOUT|429|Too Many|socket|network|timeout|503|502/i.test(String(error?.message) + String(error?.cause?.code))) throw error;
      await new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw last;
}
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
  try { await read(p => p.query({request_type: 'view_account', account_id: accountId, finality: 'final'})); return true; }
  catch (error) { if (/does not exist|UNKNOWN_ACCOUNT/i.test(String(error?.message) + JSON.stringify(error?.data ?? ''))) return false; throw error; }
}
export async function view(methodName, args = {}, contractId = CONTRACT) {
  return read(p => p.callFunction({contractId, method: methodName, args}));
}
export const newKeyPair = () => KeyPair.fromRandom('ed25519');

// Merchant agent keys (function-call only: merchant_set_strategy), kept apart from full keys.
const agentDir = join(homedir(), '.near-credentials', NETWORK + '-agents');
const agentEnv = id => 'NEAR_AGENT_KEY_' + id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
export async function loadAgentKey(accountId) {
  if (process.env[agentEnv(accountId)]) return process.env[agentEnv(accountId)];
  const file = join(agentDir, accountId + '.json');
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')).private_key : null;
}
export async function saveAgentKey(accountId, keyPair) {
  await mkdir(agentDir, {recursive: true});
  await writeFile(join(agentDir, accountId + '.json'), JSON.stringify({account_id: accountId, public_key: keyPair.getPublicKey().toString(),
    private_key: keyPair.toString()}), {mode: 0o600});
}
export const agentEnvName = agentEnv;
export const explorer = id => `https://testnet.nearblocks.io/address/${id}`;
