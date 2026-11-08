// The counting room: a page only a deed's current holder can open.
//
// The visitor proves they control the holder's account with a NEP-413 signed message (the standard any NEAR wallet's
// signMessage produces; the game's own device key signs one too). The server checks three things, all against the
// ledger, before it opens the room: the signature is valid for the challenge it issued (once, for five minutes); the
// signing key is an access key of that account right now (`view_access_key`); and that account holds the deed right
// now (`nft_token`). It then gives a pass for 30 minutes, but every request with the pass checks the holder again,
// so the moment a deed is sold or transferred its old holder is shut out.
import {createHash, createPublicKey, randomBytes, timingSafeEqual, verify} from 'node:crypto';
import {base58Decode, encodeSignedMessage} from '../js/online/signer.js';
import {HttpError} from './http.js';
import {privateId} from './secrets.js';

const CHALLENGE_MS = 5 * 60e3, PASS_MS = 30 * 60e3;
const SPKI_ED25519 = Buffer.from('302a300506032b6570032100', 'hex');
export const DEED_ID = /^deed:[a-z][a-z-]{1,30}$/;

/** True if `signature` (base64) is `publicKey`'s (ed25519:base58) signature of NEP-413 `payload`. */
export function verifySignedMessage({publicKey, signature, message, nonce, recipient}) {
  try {
    const [type, key] = String(publicKey).split(':');
    const raw = type === 'ed25519' ? base58Decode(key) : null;
    if (!raw || raw.length !== 32) return false;
    const signer = createPublicKey({key: Buffer.concat([SPKI_ED25519, raw]), format: 'der', type: 'spki'});
    const hash = createHash('sha256').update(encodeSignedMessage({message, nonce, recipient})).digest();
    return verify(null, hash, signer, Buffer.from(String(signature), 'base64'));
  } catch { return false; }
}

/**
 * chain: {holderOf(tokenId) → accountId|null, hasKey(accountId, publicKey) → boolean}
 * The pass is `<base64url payload>.<mac>`, the payload being {a: account, t: deed, e: expiry}.
 */
export function createRoomGate({chain, now = Date.now}) {
  const challenges = new Map();
  const mac = payload => privateId('counting-room|' + payload);

  function challenge(tokenId, recipient) {
    if (!DEED_ID.test(tokenId)) throw new HttpError(400, 'NO_DEED');
    const t = now();
    for (const [k, c] of challenges) if (c.expires < t) challenges.delete(k);
    if (challenges.size > 5_000) throw new HttpError(429, 'SLOW_DOWN');
    const nonce = randomBytes(32).toString('base64');
    const c = {tokenId, recipient, message: `Open the counting room of ${tokenId}`, expires: t + CHALLENGE_MS};
    challenges.set(nonce, c);
    return {message: c.message, nonce, recipient, expires: c.expires};
  }

  async function enter({tokenId, accountId, publicKey, signature, nonce}) {
    const c = challenges.get(String(nonce));
    challenges.delete(String(nonce)); // one try per challenge
    if (!c || c.expires < now() || c.tokenId !== tokenId) throw new HttpError(401, 'STALE_CHALLENGE');
    const ok = verifySignedMessage({publicKey, signature, message: c.message, nonce: Buffer.from(String(nonce), 'base64'), recipient: c.recipient});
    if (!ok) throw new HttpError(401, 'BAD_SIGNATURE');
    if (!(await chain.hasKey(String(accountId), String(publicKey)))) throw new HttpError(403, 'NOT_THEIR_KEY');
    if ((await chain.holderOf(tokenId)) !== accountId) throw new HttpError(403, 'NOT_HOLDER');
    const payload = Buffer.from(JSON.stringify({a: accountId, t: tokenId, e: now() + PASS_MS})).toString('base64url');
    return {pass: `${payload}.${mac(payload)}`, accountId};
  }

  /** The account a pass was given to, if the pass is genuine and current and that account still holds the deed. */
  async function check(tokenId, pass) {
    const [payload, given] = String(pass ?? '').split('.');
    const want = payload ? Buffer.from(mac(payload)) : null, got = Buffer.from(given ?? '');
    if (!want || want.length !== got.length || !timingSafeEqual(want, got)) throw new HttpError(401, 'NO_PASS');
    const {a, t, e} = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (t !== tokenId || e < now()) throw new HttpError(401, 'NO_PASS');
    if ((await chain.holderOf(tokenId)) !== a) throw new HttpError(403, 'NOT_HOLDER');
    return a;
  }

  return {challenge, enter, check};
}
