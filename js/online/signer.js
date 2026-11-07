// The player's device key: an Ed25519 key made by the browser (WebCrypto), whose private half never leaves it.
// It can only call the market methods of the items contract (the server adds it as a function-call key), and it
// signs NEP-366 delegate actions that the game's relayer submits and pays for. No library is needed: the delegate
// is borsh-encoded here and the bytes are checked against near-api-js in tests/online-signer.test.js.
// Works in browsers and in Node 22+ (globalThis.crypto).

const subtle = globalThis.crypto?.subtle;
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DELEGATE_PREFIX = 2 ** 30 + 366; // NEP-461 prefix for meta transactions (NEP-366)
const FUNCTION_CALL = 2; // borsh enum index of Action::FunctionCall

export function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let out = '';
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = '1' + out; }
  return out;
}
export function base58Decode(text) {
  let n = 0n;
  for (const ch of text) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error('bad base58');
    n = n * 58n + BigInt(v);
  }
  const bytes = [];
  while (n > 0n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  for (const ch of text) { if (ch !== '1') break; bytes.unshift(0); }
  return Uint8Array.from(bytes);
}
export const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
export const fromBase64 = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));

class Writer {
  constructor() { this.parts = []; }
  u8(v) { this.parts.push(Uint8Array.of(v)); }
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); this.parts.push(b); }
  u64(v) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); this.parts.push(b); }
  u128(v) { const x = BigInt(v); this.u64(x & 0xffffffffffffffffn); this.u64(x >> 64n); }
  bytes(b) { this.u32(b.length); this.parts.push(b); }
  string(s) { this.bytes(new TextEncoder().encode(s)); }
  done() {
    const out = new Uint8Array(this.parts.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of this.parts) { out.set(p, i); i += p.length; }
    return out;
  }
}

/**
 * The exact bytes a NEAR delegate action is signed over (before sha256).
 * delegate = {senderId, receiverId, actions:[{methodName, args (object or Uint8Array), gas, deposit}], nonce, maxBlockHeight, publicKey}
 */
export function encodeDelegate(delegate) {
  const w = new Writer();
  w.u32(DELEGATE_PREFIX);
  w.string(delegate.senderId);
  w.string(delegate.receiverId);
  w.u32(delegate.actions.length);
  for (const a of delegate.actions) {
    w.u8(FUNCTION_CALL);
    w.string(a.methodName);
    w.bytes(argsBytes(a.args));
    w.u64(a.gas);
    w.u128(a.deposit ?? 0);
  }
  w.u64(delegate.nonce);
  w.u64(delegate.maxBlockHeight);
  const [type, key] = delegate.publicKey.split(':');
  if (type !== 'ed25519') throw new Error('only ed25519 device keys');
  w.u8(0);
  w.parts.push(base58Decode(key));
  return w.done();
}
export const argsBytes = args => args instanceof Uint8Array ? args : new TextEncoder().encode(JSON.stringify(args));

export const supported = () => Boolean(subtle);

export async function createDeviceKey() {
  // The private key is not extractable: it can sign, but no script can read it out.
  return subtle.generateKey({name: 'Ed25519'}, false, ['sign', 'verify']);
}
export async function publicKeyOf(keyPair) {
  return 'ed25519:' + base58(new Uint8Array(await subtle.exportKey('raw', keyPair.publicKey)));
}

/** Signs a delegate; returns the JSON the relayer accepts ({delegate, signature}). */
export async function signDelegate(keyPair, delegate) {
  const hash = new Uint8Array(await subtle.digest('SHA-256', encodeDelegate(delegate)));
  const signature = new Uint8Array(await subtle.sign({name: 'Ed25519'}, keyPair.privateKey, hash));
  return {
    delegate: {...delegate, nonce: String(delegate.nonce), maxBlockHeight: String(delegate.maxBlockHeight),
      actions: delegate.actions.map(a => ({methodName: a.methodName, args: toBase64(argsBytes(a.args)), gas: String(a.gas), deposit: String(a.deposit ?? 0)}))},
    signature: toBase64(signature),
  };
}
