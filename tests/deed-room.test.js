// The counting room's gate (server/room.js): NEP-413 signed messages, checked against near-api-js; the signing key and the
// deed's holder checked on the ledger; one use per challenge; and a pass that stops working the moment the deed moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {KeyPair, KeyPairSigner} from 'near-api-js';
import {createDeviceKey, encodeSignedMessage, signMessage} from '../js/online/signer.js';
import {createRoomGate, verifySignedMessage} from '../server/room.js';

const RECIPIENT = 'ashes-ninth.duckdns.org';

test('a NEP-413 message is encoded as the standard says and signed exactly as near-api-js signs it', async () => {
  const nonce = new Uint8Array(32).fill(7);
  const bytes = encodeSignedMessage({message: 'hi', nonce, recipient: 'r'});
  assert.deepEqual([...bytes.slice(0, 4)], [0x9d, 0x01, 0x00, 0x80], 'the 2^31 + 413 prefix, little-endian');
  assert.deepEqual([...bytes.slice(4)], [2, 0, 0, 0, 104, 105, ...nonce, 1, 0, 0, 0, 114, 0]);

  // near-api-js signs; our verifier accepts it (and nothing else).
  const keyPair = KeyPair.fromRandom('ed25519');
  const payload = {message: 'Open the counting room of deed:lu-yan', nonce: randomBytes(32), recipient: RECIPIENT};
  const signed = await new KeyPairSigner(keyPair).signNep413Message('alice.testnet', payload);
  const signature = Buffer.from(signed.signature).toString('base64');
  const publicKey = keyPair.getPublicKey().toString();
  assert.ok(verifySignedMessage({publicKey, signature, ...payload}));
  assert.ok(!verifySignedMessage({publicKey, signature, ...payload, message: payload.message + '!'}));
  assert.ok(!verifySignedMessage({publicKey, signature, ...payload, recipient: 'evil.example'}));
  assert.ok(!verifySignedMessage({publicKey: KeyPair.fromRandom('ed25519').getPublicKey().toString(), signature, ...payload}));
  assert.ok(!verifySignedMessage({publicKey: 'ed25519:bad', signature, ...payload}));

  // The browser's device key signs; our verifier accepts it.
  const device = await createDeviceKey();
  const mine = await signMessage(device, 'alice.testnet', {...payload, nonce: Buffer.from(payload.nonce).toString('base64')});
  assert.ok(verifySignedMessage({publicKey: mine.publicKey, signature: mine.signature, ...payload}));
});

function world() {
  const keys = new Map(); // account → Set of public keys
  const holders = new Map([['deed:lu-yan', 'alice.testnet']]);
  let clock = 1_000_000;
  const chain = {
    holderOf: async id => holders.get(id) ?? null,
    hasKey: async (account, key) => keys.get(account)?.has(key) ?? false,
  };
  const gate = createRoomGate({chain, now: () => clock});
  const addKey = async account => {
    const device = await createDeviceKey();
    const sign = async challenge => signMessage(device, account, challenge);
    const {publicKey} = await sign({message: 'x', nonce: Buffer.alloc(32).toString('base64'), recipient: 'x'});
    if (!keys.has(account)) keys.set(account, new Set());
    keys.get(account).add(publicKey);
    return sign;
  };
  const answer = (signed, nonce, tokenId = 'deed:lu-yan') => ({tokenId, accountId: signed.accountId, publicKey: signed.publicKey, signature: signed.signature, nonce});
  return {gate, holders, addKey, answer, tick: ms => { clock += ms; }};
}

test('the holder enters with a signed challenge, and the pass works only while they still hold the deed', async () => {
  const w = world();
  const alice = await w.addKey('alice.testnet');
  const c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  assert.equal(c.message, 'Open the counting room of deed:lu-yan');
  const {pass, accountId} = await w.gate.enter(w.answer(await alice(c), c.nonce));
  assert.equal(accountId, 'alice.testnet');
  assert.equal(await w.gate.check('deed:lu-yan', pass), 'alice.testnet');
  await assert.rejects(w.gate.check('deed:mu-xiao', pass), {code: 'NO_PASS'}, 'a pass opens one room');
  await assert.rejects(w.gate.check('deed:lu-yan', pass.slice(0, -2) + 'xx'), {code: 'NO_PASS'}, 'a forged pass');

  w.holders.set('deed:lu-yan', 'bob.testnet'); // alice sells the deed
  await assert.rejects(w.gate.check('deed:lu-yan', pass), {code: 'NOT_HOLDER'}, 'the old holder is shut out at once');
});

test('the gate refuses non-holders, keys of other accounts, replays and late answers', async () => {
  const w = world();
  const alice = await w.addKey('alice.testnet'), bob = await w.addKey('bob.testnet');

  let c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  await assert.rejects(w.gate.enter(w.answer(await bob(c), c.nonce)), {code: 'NOT_HOLDER'});

  // bob signs but claims to be alice: his key is not one of alice's keys.
  c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  const lie = {...(await bob(c)), accountId: 'alice.testnet'};
  await assert.rejects(w.gate.enter(w.answer(lie, c.nonce)), {code: 'NOT_THEIR_KEY'});

  // A signature over a different message (or another room's challenge) does not count.
  c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  const wrong = await alice({...c, message: 'something else'});
  await assert.rejects(w.gate.enter(w.answer(wrong, c.nonce)), {code: 'BAD_SIGNATURE'});

  // Each challenge works once, and for five minutes.
  c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  const good = await alice(c);
  await w.gate.enter(w.answer(good, c.nonce));
  await assert.rejects(w.gate.enter(w.answer(good, c.nonce)), {code: 'STALE_CHALLENGE'});
  c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  const late = await alice(c);
  w.tick(5 * 60e3 + 1);
  await assert.rejects(w.gate.enter(w.answer(late, c.nonce)), {code: 'STALE_CHALLENGE'});
  c = w.gate.challenge('deed:mu-xiao', RECIPIENT);
  await assert.rejects(w.gate.enter(w.answer(await alice(c), c.nonce, 'deed:lu-yan')), {code: 'STALE_CHALLENGE'});
  assert.throws(() => w.gate.challenge('items.ashes-ninth.testnet', RECIPIENT), {code: 'NO_DEED'});
});

test('a pass expires after 30 minutes', async () => {
  const w = world();
  const alice = await w.addKey('alice.testnet');
  const c = w.gate.challenge('deed:lu-yan', RECIPIENT);
  const {pass} = await w.gate.enter(w.answer(await alice(c), c.nonce));
  w.tick(30 * 60e3 + 1);
  await assert.rejects(w.gate.check('deed:lu-yan', pass), {code: 'NO_PASS'});
});
