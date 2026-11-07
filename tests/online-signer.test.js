// The browser signer encodes NEAR delegate actions by hand. These checks pin its bytes to near-api-js, so the relayer
// and the chain accept what the browser signs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {actions, buildDelegateAction, encodeDelegateAction, KeyPair, PublicKey} from 'near-api-js';
import {base58, base58Decode, createDeviceKey, encodeDelegate, fromBase64, publicKeyOf, signDelegate} from '../js/online/signer.js';

const sample = publicKey => ({
  senderId: 'shen-luo.ashes-ninth.testnet', receiverId: 'items.ashes-ninth.testnet',
  actions: [{methodName: 'market_sell', args: {merchant_id: 'm-lu-yan.ashes-ninth.testnet', token_id: 'mat:essence-ember-1', amount: '7', min_total: '1595'}, gas: 100_000_000_000_000n, deposit: 0n}],
  nonce: 123456789012345n, maxBlockHeight: 987654321n, publicKey,
});

test('base58 round-trips keys, including leading zero bytes', () => {
  const key = KeyPair.fromRandom('ed25519').getPublicKey();
  assert.equal(base58(key.data), key.toString().split(':')[1]);
  assert.deepEqual([...base58Decode(base58(Uint8Array.of(0, 0, 7, 255)))], [0, 0, 7, 255]);
});

test('the delegate bytes equal near-api-js encodeDelegateAction', () => {
  const pk = KeyPair.fromRandom('ed25519').getPublicKey().toString();
  const d = sample(pk);
  const reference = encodeDelegateAction(buildDelegateAction({
    senderId: d.senderId, receiverId: d.receiverId, nonce: d.nonce, maxBlockHeight: d.maxBlockHeight, publicKey: PublicKey.from(pk),
    actions: d.actions.map(a => actions.functionCall(a.methodName, a.args, a.gas, a.deposit)),
  }));
  assert.deepEqual(encodeDelegate(d), reference);
});

test('a WebCrypto device key signs a delegate that near-api-js verifies', async () => {
  const keyPair = await createDeviceKey();
  const pk = await publicKeyOf(keyPair);
  const signed = await signDelegate(keyPair, sample(pk));
  const hash = createHash('sha256').update(encodeDelegate(sample(pk))).digest();
  assert.ok(PublicKey.from(pk).verify(hash, fromBase64(signed.signature)));
  assert.equal(signed.delegate.nonce, '123456789012345');
  assert.equal(Buffer.from(signed.delegate.actions[0].args, 'base64').toString(), JSON.stringify(sample(pk).actions[0].args));
});
