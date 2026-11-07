// The game's HTTP API (everything under /api/). Sign-in with Google, an emailed code or link, or as a guest; the
// player's "ledger seal" (their testnet account and device key); the relayer; and a status report for judges.
// Players never see a wallet, recovery words or gas: an account is recovered by signing in again.
import {createHash, randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {HttpError, clientIp, cookie, parseCookies, rateLimiter, readJson, requireSameOrigin, sendJson} from './http.js';
import {verifyGoogleToken} from './google.js';
import {mailConfigured, sendSignInMail} from './mail.js';
import {privateId} from './secrets.js';
import {ChainError} from './chain/service.js';
import {WELCOME} from './grants.js';

const SESSION = 'ashes_session', SESSION_DAYS = 30, CODE_MINUTES = 15;
const NAME = /^[a-z][a-z0-9-]{2,18}[a-z0-9]$/;
const RESERVED = /^(?:[mpg]-|items$|minter$|ministry$|relay|admin|ashes|market|judge|status)/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const sha = text => createHash('sha256').update(text).digest('hex');
const sameHash = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function createApi({store, chain, googleKeys} = {}) {
  const limit = rateLimiter();
  const data = store.data;

  const currentUser = req => {
    const token = parseCookies(req.headers.cookie)[SESSION];
    const session = token && data.sessions[sha(token)];
    if (!session || session.expires < Date.now()) return null;
    return data.users[session.userId] || null;
  };
  const startSession = (req, user) => {
    const token = randomBytes(32).toString('base64url');
    data.sessions[sha(token)] = {userId: user.id, expires: Date.now() + SESSION_DAYS * 864e5};
    store.save();
    return cookie(req, SESSION, token, SESSION_DAYS * 86400);
  };

  /** Finds or creates the player for an identity. A guest who signs in keeps their account (the guest is upgraded). */
  function signIn(req, identity, profile) {
    let user = data.users[data.identities[identity]];
    const current = currentUser(req);
    if (!user && current?.kind === 'guest') {
      user = current;
      user.kind = 'member';
    }
    if (!user) {
      user = {id: randomUUID(), kind: 'member', name: '', createdAt: Date.now(), player: null, welcomed: false};
      data.users[user.id] = user;
    }
    data.identities[identity] = user.id;
    if (profile.email) user.email = profile.email;
    if (!user.name && profile.name) user.name = profile.name.slice(0, 24);
    store.save();
    return user;
  }

  const view = user => user && ({
    name: user.name || 'Cultivator',
    kind: user.kind,
    email: user.email ? user.email.replace(/^(.).*(@.*)$/, '$1•••$2') : null,
    seal: user.player ? {id: user.player.accountId, devices: user.player.devices.length} : null,
  });
  const origin = req => process.env.ASHES_PUBLIC_URL || `http://${req.headers.host}`;

  const routes = {
    'GET /api/session': async req => ({signedIn: Boolean(currentUser(req)), user: view(currentUser(req)),
      signIn: {google: process.env.GOOGLE_CLIENT_ID || null, email: true, emailIsSent: mailConfigured(), guest: true},
      ledger: await chain.online()}),

    'POST /api/auth/guest': async (req, body) => {
      limit('guest:' + clientIp(req), 8, 3600e3);
      const user = {id: randomUUID(), kind: 'guest', name: String(body.name || '').trim().slice(0, 24), createdAt: Date.now(), player: null, welcomed: false};
      data.users[user.id] = user;
      data.identities['guest:' + user.id] = user.id;
      return {body: {user: view(user)}, headers: {'Set-Cookie': startSession(req, user)}};
    },

    'POST /api/auth/email': async (req, body) => {
      const email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL.test(email)) throw new HttpError(400, 'BAD_EMAIL');
      limit('mail-ip:' + clientIp(req), 12, 900e3);
      limit('mail:' + email, 4, 900e3);
      const code = String(randomInt(0, 1e6)).padStart(6, '0'), token = randomBytes(24).toString('base64url');
      const key = privateId('email:' + email);
      data.codes[key] = {email, code: sha(code), token: sha(token), expires: Date.now() + CODE_MINUTES * 60e3, tries: 0};
      store.save();
      const link = `${origin(req)}/api/auth/link?k=${key}&t=${token}`;
      if (mailConfigured()) {
        await sendSignInMail({to: email, code, link});
        return {sent: true};
      }
      return {sent: false, dev: {code, link}}; // development sign-in: shown on screen instead of emailed
    },

    'POST /api/auth/email/verify': async (req, body) => {
      const email = String(body.email || '').trim().toLowerCase();
      const entry = data.codes[privateId('email:' + email)];
      if (!entry || entry.expires < Date.now() || entry.tries >= 5) throw new HttpError(400, 'CODE_EXPIRED');
      entry.tries += 1;
      if (!sameHash(sha(String(body.code || '').trim()), entry.code)) { store.save(); throw new HttpError(400, 'WRONG_CODE'); }
      delete data.codes[privateId('email:' + email)];
      const user = signIn(req, 'email:' + email, {email});
      return {body: {user: view(user)}, headers: {'Set-Cookie': startSession(req, user)}};
    },

    'GET /api/auth/link': async (req, _body, url) => {
      const key = url.searchParams.get('k') || '', entry = data.codes[key];
      if (!entry || entry.expires < Date.now() || !sameHash(sha(url.searchParams.get('t') || ''), entry.token)) {
        return {status: 302, headers: {Location: '/#signin-expired'}, body: {}};
      }
      delete data.codes[key];
      const user = signIn(req, 'email:' + entry.email, {email: entry.email});
      return {status: 302, headers: {Location: '/#market', 'Set-Cookie': startSession(req, user)}, body: {}};
    },

    'POST /api/auth/google': async (req, body) => {
      limit('google:' + clientIp(req), 20, 900e3);
      let profile;
      try { profile = await verifyGoogleToken(body.credential, {clientId: process.env.GOOGLE_CLIENT_ID, ...(googleKeys ? {keys: googleKeys} : {})}); }
      catch { throw new HttpError(401, 'GOOGLE_REFUSED'); }
      if (profile.email && data.identities['email:' + profile.email] && !data.identities['google:' + profile.sub]) {
        data.identities['google:' + profile.sub] = data.identities['email:' + profile.email]; // same person, same account
      }
      const user = signIn(req, 'google:' + profile.sub, profile);
      return {body: {user: view(user)}, headers: {'Set-Cookie': startSession(req, user)}};
    },

    'POST /api/auth/logout': async req => {
      const token = parseCookies(req.headers.cookie)[SESSION];
      if (token) delete data.sessions[sha(token)];
      store.save();
      return {body: {ok: true}, headers: {'Set-Cookie': cookie(req, SESSION, '', 0)}};
    },

    // The ledger seal: the player's testnet account. The browser sends the public half of its device key.
    'POST /api/seal': async (req, body) => {
      const user = needUser(req);
      const publicKey = String(body.publicKey || '');
      if (!/^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(publicKey)) throw new HttpError(400, 'BAD_KEY');
      if (!user.player) {
        limit('seal:' + clientIp(req), 6, 3600e3);
        const wanted = String(body.name || '').trim().toLowerCase();
        if (wanted && (!NAME.test(wanted) || wanted.includes('--') || RESERVED.test(wanted))) throw new HttpError(400, 'BAD_NAME');
        if (wanted && data.names[wanted]) throw new HttpError(409, 'NAME_TAKEN');
        const prefix = wanted || 'p-' + privateId('user:' + user.id).slice(0, 12);
        user.player = await chain.createPlayer({prefix, devicePublicKey: publicKey});
        data.names[prefix] = user.id;
        if (wanted && !user.name) user.name = wanted;
      } else {
        await chain.addDevice(user.player, publicKey);
      }
      if (!user.welcomed) {
        user.welcomed = true;
        chain.grant(WELCOME.map(g => ({...g, accountId: user.player.accountId})), 'welcome to the Ash Market');
      }
      store.save();
      return {user: view(user)};
    },

    'GET /api/seal/next': async (req, _body, url) => {
      const user = needSeal(req);
      return chain.prepare(user.player, url.searchParams.get('key') || '');
    },

    'POST /api/seal/relay': async (req, body) => {
      const user = needSeal(req);
      limit('relay:' + user.id, 30, 60e3);
      return chain.relay(user.player, body);
    },

    'GET /api/status': async () => ({...(await chain.report()), players: Object.keys(data.users).length,
      seals: Object.values(data.users).filter(u => u.player).length}),
  };

  function needUser(req) {
    const user = currentUser(req);
    if (!user) throw new HttpError(401, 'SIGN_IN');
    return user;
  }
  function needSeal(req) {
    const user = needUser(req);
    if (!user.player) throw new HttpError(409, 'NO_SEAL');
    return user;
  }

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const route = routes[`${req.method} ${url.pathname}`];
    try {
      if (!route) throw new HttpError(404, 'NOT_FOUND');
      if (req.method !== 'GET') requireSameOrigin(req);
      const body = req.method === 'POST' ? await readJson(req) : {};
      const out = await route(req, body, url);
      if (out && 'body' in out && ('headers' in out || 'status' in out)) sendJson(res, out.status || 200, out.body, out.headers);
      else sendJson(res, 200, out);
    } catch (error) {
      if (error instanceof HttpError) sendJson(res, error.status, {error: error.code});
      else if (error instanceof ChainError) sendJson(res, error.code === 'OFFLINE' ? 503 : 409, {error: error.code});
      else {
        console.error('api', req.method, url.pathname, error.message);
        sendJson(res, 500, {error: 'SERVER'});
      }
    }
  };
}
