// Everything the server does on NEAR testnet, behind one object:
//   • player accounts: `<name>.ashes-ninth.testnet`, created by the parent with a server-held recovery key and the
//     browser's device key (function-call only, market methods only);
//   • the relayer: checks a delegate action signed by a device key and submits it, paying the gas (NEP-366);
//   • the minter: grants (commission rewards, the welcome pack) queued and sent in batches with sequence numbers,
//     so a retry after a crash can never pay twice.
// The chain is optional. Without keys (or with ASHES_CHAIN=off, the default under `node --test`) the game runs on the
// practice market and every method here reports `offline`.
import {createHash} from 'node:crypto';
import {actions, buildDelegateAction, encodeDelegateAction, parseNearAmount, PublicKey, Signature, teraToGas} from 'near-api-js';
import {CONTRACT, MINTER, PARENT, RELAYER, account, exists, loadKey, newKeyPair, provider, view} from './near.js';
import {decryptSecret, encryptSecret} from '../secrets.js';

export const PLAYER_METHODS = ['market_sell', 'market_buy', 'patron_invest'];
const DEVICE_ALLOWANCE = BigInt(parseNearAmount('0.25'));
const ACCOUNT_FUNDING = BigInt(parseNearAmount('0.01'));
const FLOOR = {parent: BigInt(parseNearAmount('0.3')), relayer: BigInt(parseNearAmount('1'))};
const MAX_GAS = 300_000_000_000_000n;
const RELAYS_PER_DAY = 600;
const BATCH = 60;

export class ChainError extends Error {
  constructor(code, detail = code) { super(detail); this.code = code; }
}

const failureOf = result => [result.status, ...(result.receipts_outcome ?? []).map(r => r.outcome.status)]
  .find(s => s && typeof s === 'object' && 'Failure' in s);
const codeOf = failure => /\b([A-Z][A-Z_]{3,})\b/.exec(JSON.stringify(failure))?.[1] || 'FAILED';
const valueOf = (result, contractId) => {
  for (const r of result.receipts_outcome ?? []) {
    const v = r.outcome.status?.SuccessValue;
    if (r.outcome.executor_id === contractId && v) {
      try { return JSON.parse(Buffer.from(v, 'base64').toString('utf8')); } catch { /* not JSON */ }
    }
  }
  return null;
};

export function createChain({store, enabled = defaultEnabled()} = {}) {
  let ready = null, relayQueue = Promise.resolve(), minting = false, timer = null;
  const status = {lastRelay: null, lastMint: null, lastError: null};

  async function online() {
    if (!enabled) return false;
    ready ??= Promise.all([PARENT, RELAYER, MINTER].map(loadKey)).then(keys => keys.every(Boolean));
    return ready;
  }
  async function need() { if (!(await online())) throw new ChainError('OFFLINE'); }
  const balanceOf = async id => BigInt((await provider.viewAccount({accountId: id})).amount);

  /** Creates `<name>.<parent>` with a fresh recovery key and the device key; returns what the store keeps. */
  async function createPlayer({prefix, devicePublicKey}) {
    await need();
    const accountId = `${prefix}.${PARENT}`;
    if (await exists(accountId)) throw new ChainError('NAME_TAKEN');
    if (await balanceOf(PARENT) < FLOOR.parent) throw new ChainError('BUSY', 'parent account is low on funds');
    const recovery = newKeyPair();
    const parent = await account(PARENT);
    const result = await parent.signAndSendTransaction({receiverId: accountId, waitUntil: 'EXECUTED_OPTIMISTIC', throwOnFailure: false, actions: [
      actions.createAccount(), actions.transfer(ACCOUNT_FUNDING),
      actions.addFullAccessKey(recovery.getPublicKey()),
      actions.addFunctionCallAccessKey(PublicKey.from(devicePublicKey), CONTRACT, PLAYER_METHODS, DEVICE_ALLOWANCE),
    ]});
    if (failureOf(result)) throw new ChainError(codeOf(failureOf(result)));
    return {accountId, recovery: encryptSecret(recovery.toString()), devices: [devicePublicKey], createdTx: result.transaction.hash};
  }

  /** A returning player on a new device: the recovery key signs an add-key delegate, the relayer pays. */
  async function addDevice(player, devicePublicKey) {
    await need();
    if (player.devices.includes(devicePublicKey)) return player;
    const owner = new (await import('near-api-js')).Account(player.accountId, provider, decryptSecret(player.recovery));
    const {signedDelegate} = await owner.createSignedMetaTransaction({receiverId: player.accountId, blockHeightTtl: 120,
      actions: [actions.addFunctionCallAccessKey(PublicKey.from(devicePublicKey), CONTRACT, PLAYER_METHODS, DEVICE_ALLOWANCE)]});
    const result = await relayed(() => account(RELAYER).then(r => r.signAndSendTransaction({receiverId: player.accountId,
      actions: [actions.signedDelegate(signedDelegate)], waitUntil: 'EXECUTED_OPTIMISTIC', throwOnFailure: false})));
    if (failureOf(result)) throw new ChainError(codeOf(failureOf(result)));
    player.devices = [...player.devices, devicePublicKey].slice(-6);
    return player;
  }

  /** What the browser needs to sign its next delegate: the key's next nonce and an expiry height. */
  async function prepare(player, publicKey) {
    await need();
    if (!player.devices.includes(publicKey)) throw new ChainError('UNKNOWN_DEVICE');
    const [key, block] = await Promise.all([
      provider.viewAccessKey({accountId: player.accountId, publicKey: PublicKey.from(publicKey)}),
      provider.viewBlock({finality: 'final'}),
    ]);
    return {nonce: String(key.nonce + 1n), maxBlockHeight: String(BigInt(block.header.height) + 120n)};
  }

  const relayed = task => {
    const run = relayQueue.then(task, task);
    relayQueue = run.catch(() => {});
    return run;
  };

  /** Checks and submits a signed delegate from a player's device; returns the market's receipt. */
  async function relay(player, {delegate: d, signature}) {
    await need();
    if (!d || typeof signature !== 'string') throw new ChainError('BAD_REQUEST');
    if (d.senderId !== player.accountId) throw new ChainError('NOT_YOURS');
    if (d.receiverId !== CONTRACT) throw new ChainError('NOT_ALLOWED');
    if (!player.devices.includes(d.publicKey)) throw new ChainError('UNKNOWN_DEVICE');
    if (!Array.isArray(d.actions) || !d.actions.length || d.actions.length > 4) throw new ChainError('BAD_REQUEST');
    for (const a of d.actions) {
      if (!PLAYER_METHODS.includes(a.methodName) || String(a.deposit) !== '0' || BigInt(a.gas) > MAX_GAS) throw new ChainError('NOT_ALLOWED');
    }
    const day = new Date().toISOString().slice(0, 10), budget = store.data.relays[player.accountId] ?? {day, count: 0};
    if (budget.day !== day) Object.assign(budget, {day, count: 0});
    if (budget.count >= RELAYS_PER_DAY) throw new ChainError('SLOW_DOWN');

    const delegateAction = buildDelegateAction({senderId: d.senderId, receiverId: d.receiverId, nonce: BigInt(d.nonce),
      maxBlockHeight: BigInt(d.maxBlockHeight), publicKey: PublicKey.from(d.publicKey),
      actions: d.actions.map(a => actions.functionCall(a.methodName, Uint8Array.from(Buffer.from(a.args, 'base64')), BigInt(a.gas), 0n))});
    const sig = Uint8Array.from(Buffer.from(signature, 'base64'));
    const hash = createHash('sha256').update(encodeDelegateAction(delegateAction)).digest();
    if (!PublicKey.from(d.publicKey).verify(hash, sig)) throw new ChainError('BAD_SIGNATURE');

    const result = await relayed(async () => {
      if (await balanceOf(RELAYER) < FLOOR.relayer) throw new ChainError('BUSY', 'relayer is low on funds');
      const relayer = await account(RELAYER);
      return relayer.signAndSendTransaction({receiverId: d.senderId, waitUntil: 'EXECUTED_OPTIMISTIC', throwOnFailure: false,
        actions: [actions.signedDelegate({delegateAction, signature: new Signature({keyType: 0, data: sig})})]});
    });
    budget.count += 1;
    store.data.relays[player.accountId] = budget;
    store.save();
    const tx = result.transaction.hash;
    status.lastRelay = {at: Date.now(), tx};
    const failure = failureOf(result);
    if (failure) return {ok: false, code: codeOf(failure), tx};
    return {ok: true, receipt: valueOf(result, CONTRACT), tx};
  }

  /** Queues grants; they reach the chain within a few seconds, in order, exactly once. */
  function grant(entries, memo) {
    const mints = store.data.mints;
    for (const e of entries) if (BigInt(e.amount) > 0n) mints.queue.push({account_id: e.accountId, token_id: e.tokenId, amount: String(e.amount), memo});
    store.save();
    schedule();
  }
  function schedule() {
    if (timer || !enabled) return;
    timer = setTimeout(() => { timer = null; flushMints().catch(error => { status.lastError = error.message; schedule(); }); }, 1500);
    timer.unref?.();
  }
  async function flushMints() {
    if (minting || !(await online())) return;
    minting = true;
    const mints = store.data.mints;
    try {
      while (mints.inflight || mints.queue.length) {
        if (!mints.inflight) {
          const batch = mints.queue.slice(0, BATCH);
          const seq = (await view('seq_of', {account_id: MINTER})) + 1;
          mints.inflight = {seq, memo: batch[0].memo, mints: batch.map(({account_id, token_id, amount}) => ({account_id, token_id, amount}))};
          mints.queue = mints.queue.slice(batch.length);
          await store.save(); // the batch is written down before it is sent
        }
        const minter = await account(MINTER);
        const {seq, mints: list, memo} = mints.inflight;
        const result = await minter.signAndSendTransaction({receiverId: CONTRACT, waitUntil: 'EXECUTED_OPTIMISTIC', throwOnFailure: false,
          actions: [actions.functionCall('game_mint_batch', {mints: list, seq, memo}, teraToGas(200), 0n)]});
        const failure = failureOf(result);
        if (failure && codeOf(failure) === 'SEQ_GAP') {
          // Someone else used the minter; renumber the same batch.
          mints.inflight.seq = (await view('seq_of', {account_id: MINTER})) + 1;
          continue;
        }
        if (failure) throw new ChainError(codeOf(failure));
        status.lastMint = {at: Date.now(), tx: result.transaction.hash, seq};
        mints.inflight = null; // true = applied now, false = applied by an earlier attempt: done either way
        await store.save();
      }
    } finally { minting = false; }
  }

  async function report() {
    const base = {network: 'testnet', contract: CONTRACT, online: await online(), queuedGrants: store.data.mints.queue.length,
      grantInFlight: Boolean(store.data.mints.inflight), ...status};
    if (!base.online) return base;
    try {
      const [parent, relayer, seq, tick] = await Promise.all([balanceOf(PARENT), balanceOf(RELAYER), view('seq_of', {account_id: MINTER}), view('market_tick')]);
      return {...base, parentBalance: (Number(parent / 10n ** 21n) / 1000).toFixed(3), relayerBalance: (Number(relayer / 10n ** 21n) / 1000).toFixed(3), minterSeq: seq, marketHour: tick};
    } catch (error) { return {...base, rpcError: error.message}; }
  }

  return {online, createPlayer, addDevice, prepare, relay, grant, flushMints, report, contract: CONTRACT, parent: PARENT};
}

function defaultEnabled() {
  if (process.env.ASHES_CHAIN) return process.env.ASHES_CHAIN !== 'off';
  return !process.env.NODE_TEST_CONTEXT;
}
