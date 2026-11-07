// Verifies a Google Identity Services ID token (the "Sign in with Google" button) without any library:
// RS256 signature against Google's published keys, then issuer, audience, expiry and a verified email.
import {createPublicKey, verify} from 'node:crypto';

const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
let cache = {keys: [], until: 0};

export async function googleKeys() {
  if (Date.now() < cache.until) return cache.keys;
  const res = await fetch('https://www.googleapis.com/oauth2/v3/certs', {signal: AbortSignal.timeout(8000)});
  if (!res.ok) throw new Error('google keys ' + res.status);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  cache = {keys: (await res.json()).keys, until: Date.now() + maxAge * 1000};
  return cache.keys;
}

const part = text => JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));

/** Returns {sub, email, name} or throws. */
export async function verifyGoogleToken(credential, {clientId, keys = googleKeys, now = Date.now()} = {}) {
  if (!clientId) throw new Error('google sign-in is not configured');
  const [h, p, s] = String(credential || '').split('.');
  if (!h || !p || !s) throw new Error('malformed token');
  const header = part(h), payload = part(p);
  if (header.alg !== 'RS256') throw new Error('unexpected algorithm');
  const jwk = (await keys()).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('unknown signing key');
  const ok = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey({key: jwk, format: 'jwk'}), Buffer.from(s, 'base64url'));
  if (!ok) throw new Error('bad signature');
  if (!ISSUERS.has(payload.iss)) throw new Error('wrong issuer');
  if (payload.aud !== clientId) throw new Error('wrong audience');
  if (!(payload.exp * 1000 > now)) throw new Error('expired');
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('email not verified');
  return {sub: String(payload.sub), email: String(payload.email || '').toLowerCase(), name: payload.given_name || payload.name || ''};
}
