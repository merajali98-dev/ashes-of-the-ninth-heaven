// The game's HTTP API (everything under /api/). Sign-in with Google, an emailed code or link, or as a guest; the
// player's "ledger seal" (their testnet account and device key); the relayer; and a status report for judges.
// Players never see a wallet, recovery words or gas: an account is recovered by signing in again.
import {createHash, randomBytes, randomInt, randomUUID, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {HttpError, clientIp, cookie, parseCookies, rateLimiter, readJson, requireSameOrigin, sendJson} from './http.js';
import {verifyGoogleToken} from './google.js';
import {mailConfigured, sendSignInMail} from './mail.js';
import {privateId} from './secrets.js';
import {ChainError} from './chain/service.js';
import {WELCOME} from './grants.js';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {replayCommission} from '../js/progression.js';
import {haggleSay, ownerLetter} from './agents.js';
import {DEED_ID, createRoomGate} from './room.js';

const LEDGER_TOKENS = ['jade', ...Object.keys(MARKET_TOKENS)];
// What one account may add to its holdings per hour without a market trade (battle rewards, selling gear). Day 7 adds
// battle replay; until then this cap bounds what an edited save could claim.
const SYNC_CAP = {jade: 200_000, units: 150};

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

  // Shop Deeds: each deed's public history, and the counting room only its current holder can open (server/room.js).
  const gate = createRoomGate({chain});
  async function deedRecord(tokenId) {
    if (!DEED_ID.test(tokenId)) throw new HttpError(400, 'NO_DEED');
    const [record, market] = await Promise.all([chain.deedHistory(tokenId), chain.market()]);
    return {...record, books: market.merchants.find(m => m.rules_id === record.deed.rules_id) ?? null, tick: market.tick, contract: chain.contract};
  }
  async function countingRoom(tokenId, accountId) {
    const record = await deedRecord(tokenId);
    // The letter is written once per holder, market day and vault, so a refresh does not ask the model again.
    const key = [accountId, Math.floor(record.tick / 24), record.deed.vault, record.deed.agent].join('|');
    data.letters ??= {};
    if (data.letters[tokenId]?.key !== key) {
      const letter = await ownerLetter(record.books, record.deed, record.history, record.tick);
      data.letters[tokenId] = {key, letter: {say: letter.say, lines: letter.lines, voice: letter.source}};
      store.save();
    }
    return {ledger: {...record, holder: accountId, journal: (data.journal ?? {})[record.deed.rules_id] ?? []}, letter: data.letters[tokenId].letter};
  }

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
        try { await sendSignInMail({to: email, code, link}); }
        catch (error) { console.error('mail', error.message); delete data.codes[key]; store.save(); throw new HttpError(502, 'MAIL_FAILED'); }
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
      const result = await chain.relay(user.player, body);
      if (result.ok && body.delegate?.actions?.[0]?.methodName === 'market_haggle' && result.receipt) {
        // The ledger decided the haggle; the merchant now says so in its own voice (NEAR AI, or the rules' words).
        const market = await chain.market().catch(() => null);
        const books = market?.merchants.find(m => m.account_id === result.receipt.merchant_id);
        const voice = await haggleSay(result.receipt, books);
        Object.assign(result, {say: voice.say, lines: voice.lines, voice: voice.source});
        data.haggles = [{at: Date.now(), rules_id: books?.rules_id ?? null, name: books?.name ?? null, player: user.player.accountId.split('.')[0],
          token_id: result.receipt.token_id, amount: result.receipt.amount, side: result.receipt.sell ? 'sell' : 'buy', posted: result.receipt.posted,
          offer: result.receipt.offer, outcome: result.receipt.outcome, price: result.receipt.price, say: voice.say, source: voice.source, tx: result.tx},
          ...(data.haggles ?? [])].slice(0, 30);
        store.save();
      }
      return result;
    },

    // The market as the ledger has it: nine merchants' books, and (when sealed) the player's balances.
    'GET /api/ledger': async req => {
      const user = currentUser(req);
      const market = await chain.market();
      const [balances, haggles] = user?.player ? await Promise.all([chain.balances(user.player.accountId, LEDGER_TOKENS),
        chain.haggles ? chain.haggles(user.player.accountId) : []]) : [null, []];
      const journal = Object.fromEntries(Object.entries(data.journal ?? {}).map(([id, entries]) => [id, entries[0]]));
      return {ledger: {...market, balances, haggles, seal: user?.player?.accountId ?? null, contract: chain.contract, journal, talk: (data.haggles ?? []).slice(0, 6)}};
    },

    'GET /api/ledger/quote': async (req, _body, url) => {
      const user = needSeal(req);
      const side = url.searchParams.get('side') === 'buy' ? 'buy' : 'sell';
      const amount = String(Math.max(1, Math.floor(Number(url.searchParams.get('n')) || 1)));
      return {ledger: await chain.quote({merchant_id: url.searchParams.get('m') || '', token_id: url.searchParams.get('t') || '', side, amount, account_id: user.player.accountId})};
    },

    // Rewards and costs that happen outside the market (battle drops, forging, gear sales) are recorded on the ledger.
    'POST /api/ledger/sync': async (req, body) => {
      const user = needSeal(req);
      limit('sync:' + user.id, 60, 60e3);
      const clean = map => Object.entries(map && typeof map === 'object' ? map : {})
        .map(([tokenId, n]) => [tokenId, Math.floor(Number(n))]).filter(([tokenId, n]) => LEDGER_TOKENS.includes(tokenId) && n > 0 && n < 1e9);
      const gains = clean(body.gains), spends = clean(body.spends);
      if (!gains.length && !spends.length) throw new HttpError(400, 'NOTHING');
      const id = user.player.accountId, hour = Math.floor(Date.now() / 3600e3);
      const used = data.syncs?.[id]?.hour === hour ? data.syncs[id] : {hour, jade: 0, units: 0};
      const jade = gains.filter(([t]) => t === 'jade').reduce((a, [, n]) => a + n, 0), units = gains.filter(([t]) => t !== 'jade').reduce((a, [, n]) => a + n, 0);
      if (used.jade + jade > SYNC_CAP.jade || used.units + units > SYNC_CAP.units) throw new HttpError(429, 'REWARD_CAP');
      if (spends.length) {
        const have = await chain.balances(id, spends.map(([t]) => t));
        if (spends.some(([t, n]) => have[t] < n)) throw new HttpError(409, 'NOT_HELD');
      }
      const reason = String(body.reason || 'the game').slice(0, 60);
      chain.grant(gains.map(([tokenId, amount]) => ({accountId: id, tokenId, amount})), reason);
      chain.burn(spends.map(([tokenId, amount]) => ({accountId: id, tokenId, amount})), reason);
      (data.syncs ??= {})[id] = {hour, jade: used.jade + jade, units: used.units + units};
      store.save();
      return {ok: true};
    },

    // Proof of battle: the server deals the seed when a commission starts and replays the battle before minting rewards.
    'POST /api/battle/start': async (req, body) => {
      const user = needSeal(req);
      limit('battle:' + user.id, 40, 3600e3);
      const school = String(body.school || ''), tier = Number(body.tier), inputs = body.inputs;
      const sane = inputs && Array.isArray(inputs.deck) && inputs.deck.length >= 1 && inputs.deck.length <= 80 &&
        Number.isFinite(inputs.hp) && Number.isFinite(inputs.maxHp) && inputs.hp > 0 && inputs.hp <= inputs.maxHp && inputs.maxHp <= 2000;
      if (!MARKET_TOKENS[`mat:essence-${school}-1`] || !Number.isInteger(tier) || tier < 1 || tier > 5 || !sane) throw new HttpError(400, 'BAD_BATTLE');
      const now = Date.now();
      data.battles = Object.fromEntries(Object.entries(data.battles ?? {}).filter(([, b]) => now - b.at < 864e5));
      const battleId = randomBytes(12).toString('base64url'), seed = randomInt(1, 2 ** 31);
      data.battles[battleId] = {userId: user.id, school, tier, inputs, difficulty: String(body.difficulty || 'wayfarer'), seed, at: now, claimed: false};
      store.save();
      return {battleId, seed};
    },

    'POST /api/battle/claim': async (req, body) => {
      const user = needSeal(req);
      const battle = data.battles?.[String(body.battleId || '')];
      if (!battle || battle.userId !== user.id) throw new HttpError(404, 'NO_BATTLE');
      if (battle.claimed) throw new HttpError(409, 'ALREADY_CLAIMED');
      const proof = replayCommission({...battle, actions: body.actions});
      if (!proof.ok) throw new HttpError(409, proof.reason);
      battle.claimed = true;
      const granted = {jade: (proof.rewards.gold ?? 0) * 100,
        ...Object.fromEntries(Object.entries(proof.rewards.materials ?? {}).map(([id, n]) => ['mat:' + id, n]))};
      chain.grant(Object.entries(granted).map(([tokenId, amount]) => ({accountId: user.player.accountId, tokenId, amount})),
        `commission ${battle.school} ${battle.tier}, battle replayed`);
      store.save();
      return {ok: true, granted};
    },

    'GET /api/deeds/history': async (req, _body, url) => ({ledger: await deedRecord(url.searchParams.get('id') || '')}),

    'POST /api/deeds/room/challenge': async (req, body) => {
      limit('room:' + clientIp(req), 30, 60e3);
      return {challenge: gate.challenge(String(body.token_id || ''), new URL(origin(req)).host)};
    },
    'POST /api/deeds/room': async (req, body) => {
      limit('room:' + clientIp(req), 30, 60e3);
      const tokenId = String(body.token_id || '');
      const {pass, accountId} = await gate.enter({tokenId, accountId: String(body.account_id || ''), publicKey: String(body.public_key || ''),
        signature: String(body.signature || ''), nonce: String(body.nonce || '')});
      return {pass, ...(await countingRoom(tokenId, accountId))};
    },
    'GET /api/deeds/room': async (req, _body, url) => {
      const tokenId = url.searchParams.get('id') || '';
      return countingRoom(tokenId, await gate.check(tokenId, req.headers['x-room-pass']));
    },

    'GET /api/journal': async () => ({ledger: data.journal ?? {}, haggles: data.haggles ?? []}),

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
    const deedPicture = /^\/deeds\/([a-z][a-z-]{1,30})\.svg$/.exec(url.pathname);
    if (deedPicture && req.method === 'GET') {
      try {
        const picture = await deedSvg(await chain.market(), deedPicture[1]);
        if (!picture) { res.writeHead(404).end('No such deed'); return; }
        res.writeHead(200, {'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff'});
        res.end(picture);
      } catch { res.writeHead(503).end('The ledger is unavailable'); }
      return;
    }
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

// ------------------------------------------------------------------ the deed's picture (NEP-171 media), drawn live

const ART = new URL('../assets/art/', import.meta.url);
const portraitCache = new Map();
async function portrait(id) {
  if (!portraitCache.has(id)) {
    const file = id === 'black-bamboo' ? 'card-black-bamboo-testimony.webp' : `portrait-${id}.webp`;
    portraitCache.set(id, readFile(new URL(file, ART)).then(b => 'data:image/webp;base64,' + b.toString('base64')).catch(() => ''));
  }
  return portraitCache.get(id);
}
const xml = text => String(text ?? '').replace(/[<>&"']/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]));
const jade = cents => (Number(cents) / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});

export async function deedSvg(market, rulesId) {
  const deed = market.deeds?.find(d => d.rules_id === rulesId), books = market.merchants.find(m => m.rules_id === rulesId);
  if (!deed || !books) return null;
  const holder = deed.held_by_ministry ? 'the Ministry of Ash' : String(deed.owner_id).split('.')[0];
  const status = books.closed ? 'SHUTTERED' : books.status === 'struggling' ? 'STRUGGLING' : 'OPEN';
  const sale = deed.for_sale ? `For sale · ${jade(deed.for_sale)} jade` : 'Not for sale';
  const img = await portrait(rulesId);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2230"/><stop offset="1" stop-color="#120f16"/></linearGradient>
  <clipPath id="c"><circle cx="300" cy="250" r="150"/></clipPath></defs>
  <rect width="600" height="840" rx="28" fill="url(#g)"/><rect x="14" y="14" width="572" height="812" rx="20" fill="none" stroke="#c8a064" stroke-width="3"/>
  <text x="300" y="70" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="6" fill="#c8a064">DEED TO A SHOP</text>
  ${img ? `<image href="${img}" x="150" y="100" width="300" height="300" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>` : ''}
  <circle cx="300" cy="250" r="150" fill="none" stroke="#c8a064" stroke-width="4"/>
  <text x="300" y="460" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#ffe1a2">${xml(books.name)}</text>
  <text x="300" y="500" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="${status === 'OPEN' ? '#9fd39a' : '#f0a09a'}" letter-spacing="4">${status}</text>
  <g font-family="system-ui,Segoe UI,sans-serif" font-size="24" fill="#e9e2d6">
    <text x="70" y="575">Purse</text><text x="530" y="575" text-anchor="end">${jade(books.cash)} jade</text>
    <text x="70" y="620">Deed's vault</text><text x="530" y="620" text-anchor="end" fill="#ffe1a2">${jade(deed.vault)} jade</text>
    <text x="70" y="665">Holder</text><text x="530" y="665" text-anchor="end">${xml(holder)}</text>
    <text x="70" y="710">Decides</text><text x="530" y="710" text-anchor="end">${deed.agent ? "the merchant's agent" : 'the holder'}</text>
  </g>
  <text x="300" y="770" text-anchor="middle" font-family="system-ui,sans-serif" font-size="18" fill="#b3ab9e">${xml(sale)} · owner's share ${Number(deed.owner_share_bps) / 100}% of each good day</text>
</svg>`;
}
