// Sign-in, the ledger seal and the relay route, against a stand-in chain (no network). Also checks that no API reply
// a player sees mentions wallets, recovery words, gas or the chain (only the `seal` and `ledger` fields may).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {generateKeyPairSync, sign} from 'node:crypto';
import {openStore} from '../server/store.js';
import {createApi} from '../server/api.js';
import {WELCOME} from '../server/grants.js';

const CHAIN_WORDS = /\b(wallets?|seed ?phrases?|recovery (?:words|phrase)|mnemonic|private key|gas|yocto\w*|testnet|blockchain|crypto|NEAR)\b/i;
const visible = body => JSON.stringify(body, (key, value) => key === 'seal' || key === 'ledger' ? undefined : value);
const KEY = 'ed25519:' + '1'.repeat(1) + 'A'.repeat(43);

function fakeChain() {
  const calls = {created: [], devices: [], grants: [], relays: []};
  return {calls, online: async () => true,
    async createPlayer({prefix, devicePublicKey}) { calls.created.push(prefix); return {accountId: `${prefix}.ashes-ninth.testnet`, recovery: 'v1:x', devices: [devicePublicKey]}; },
    async addDevice(player, key) { calls.devices.push(key); if (!player.devices.includes(key)) player.devices.push(key); return player; },
    async prepare() { return {nonce: '8', maxBlockHeight: '120'}; },
    async relay(player, body) { calls.relays.push({player: player.accountId, body}); return {ok: true, receipt: {total: '1595'}, tx: 'abc'}; },
    grant(entries, memo) { calls.grants.push({entries, memo}); },
    async report() { return {network: 'testnet', online: true}; }};
}

async function harness(options = {}) {
  const store = await openStore('memory'), chain = fakeChain();
  const server = createServer(createApi({store, chain, ...options}));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let jar = '';
    const call = async (method, path, body, headers = {}) => {
      const res = await fetch(base + path, {method, redirect: 'manual', headers: {'Content-Type': 'application/json', 'X-Ashes': '1', ...(jar ? {Cookie: jar} : {}), ...headers},
        body: body === undefined ? undefined : JSON.stringify(body)});
      const set = res.headers.get('set-cookie');
      if (set) jar = set.split(';')[0];
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!path.startsWith('/api/status')) assert.doesNotMatch(visible(json), CHAIN_WORDS, `${path} shows a chain word`);
      return {status: res.status, json, headers: res.headers};
    };
    return {get: path => call('GET', path), post: (path, body, headers) => call('POST', path, body ?? {}, headers), cookie: () => jar};
  };
  return {store, chain, client, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); })};
}

test('a guest plays at once, then signs in by email and keeps the same account and seal', async () => {
  const h = await harness();
  try {
    const c = h.client();
    assert.equal((await c.get('/api/session')).json.signedIn, false);
    const guest = await c.post('/api/auth/guest', {name: 'Shen Luo'});
    assert.equal(guest.json.user.kind, 'guest');
    const seal = await c.post('/api/seal', {publicKey: KEY, name: 'shen-luo'});
    assert.equal(seal.json.user.seal.id, 'shen-luo.ashes-ninth.testnet');
    assert.deepEqual(h.chain.calls.created, ['shen-luo']);
    assert.equal(h.chain.calls.grants.length, 1);
    assert.deepEqual(h.chain.calls.grants[0].entries.map(e => e.tokenId), WELCOME.map(w => w.tokenId));

    const asked = await c.post('/api/auth/email', {email: 'Shen@Example.com '});
    assert.equal(asked.json.sent, false, 'development sign-in shows the code instead of emailing it');
    assert.match(asked.json.dev.code, /^\d{6}$/);
    assert.equal((await c.post('/api/auth/email/verify', {email: 'shen@example.com', code: '000000' === asked.json.dev.code ? '111111' : '000000'})).json.error, 'WRONG_CODE');
    const verified = await c.post('/api/auth/email/verify', {email: 'shen@example.com', code: asked.json.dev.code});
    assert.equal(verified.json.user.kind, 'member');
    assert.equal(verified.json.user.seal.id, 'shen-luo.ashes-ninth.testnet', 'the upgraded guest keeps the seal');
    assert.equal(verified.json.user.email, 's•••@example.com');

    // A new device on another browser: sign in again with the same email; the server adds the new key.
    const other = h.client();
    const code = (await other.post('/api/auth/email', {email: 'shen@example.com'})).json.dev.code;
    await other.post('/api/auth/email/verify', {email: 'shen@example.com', code});
    const KEY2 = 'ed25519:' + 'B'.repeat(44);
    const again = await other.post('/api/seal', {publicKey: KEY2});
    assert.equal(again.json.user.seal.id, 'shen-luo.ashes-ninth.testnet');
    assert.deepEqual(h.chain.calls.devices, [KEY2]);
    assert.equal(h.chain.calls.grants.length, 1, 'the welcome pack is given once');
  } finally { await h.close(); }
});

test('the emailed link signs in once; codes expire after five wrong tries', async () => {
  const h = await harness();
  try {
    const c = h.client();
    const {link} = (await c.post('/api/auth/email', {email: 'yi.ning@example.com'})).json.dev;
    const path = new URL(link).pathname + new URL(link).search;
    const opened = await c.get(path);
    assert.equal(opened.status, 302);
    assert.equal(opened.headers.get('location'), '/#market');
    assert.equal((await c.get('/api/session')).json.user.kind, 'member');
    assert.equal((await h.client().get(path)).headers.get('location'), '/#signin-expired', 'a link works once');

    const d = h.client();
    await d.post('/api/auth/email', {email: 'kuang@example.com'});
    for (let i = 0; i < 5; i++) await d.post('/api/auth/email/verify', {email: 'kuang@example.com', code: 'nope'});
    assert.equal((await d.post('/api/auth/email/verify', {email: 'kuang@example.com', code: 'nope'})).json.error, 'CODE_EXPIRED');
  } finally { await h.close(); }
});

test('Google sign-in verifies the token and joins the account that used the same email', async () => {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  const jwk = {...publicKey.export({format: 'jwk'}), kid: 'k1', alg: 'RS256', use: 'sig'};
  const token = claims => {
    const part = o => Buffer.from(JSON.stringify(o)).toString('base64url');
    const body = `${part({alg: 'RS256', kid: 'k1', typ: 'JWT'})}.${part(claims)}`;
    return `${body}.${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
  };
  process.env.GOOGLE_CLIENT_ID = 'client-1.apps.googleusercontent.com';
  const h = await harness({googleKeys: async () => [jwk]});
  try {
    const claims = {iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, sub: '42', email: 'mu.xiao@example.com', email_verified: true,
      exp: Math.floor(Date.now() / 1000) + 600, given_name: 'Mu'};
    const e = h.client();
    const code = (await e.post('/api/auth/email', {email: 'mu.xiao@example.com'})).json.dev.code;
    const byEmail = await e.post('/api/auth/email/verify', {email: 'mu.xiao@example.com', code});

    const g = h.client();
    assert.equal((await g.post('/api/auth/google', {credential: token({...claims, aud: 'someone-else'})})).json.error, 'GOOGLE_REFUSED');
    assert.equal((await g.post('/api/auth/google', {credential: token({...claims, exp: 1})})).json.error, 'GOOGLE_REFUSED');
    const ok = await g.post('/api/auth/google', {credential: token(claims)});
    assert.equal(ok.status, 200);
    assert.equal(Object.keys(h.store.data.users).length, 1, 'Google with the same verified email is the same player');
    assert.equal(ok.json.user.email, byEmail.json.user.email);
    assert.equal((await g.get('/api/session')).json.signIn.google, process.env.GOOGLE_CLIENT_ID);
  } finally { delete process.env.GOOGLE_CLIENT_ID; await h.close(); }
});

test('state-changing calls need our page, a session, and a seal before relaying', async () => {
  const h = await harness();
  try {
    const c = h.client();
    assert.equal((await c.post('/api/auth/guest', {}, {'X-Ashes': ''})).status, 403);
    assert.equal((await c.post('/api/auth/guest', {}, {Origin: 'https://evil.example'})).status, 403);
    assert.equal((await c.post('/api/seal', {publicKey: KEY})).json.error, 'SIGN_IN');
    await c.post('/api/auth/guest', {});
    assert.equal((await c.post('/api/seal/relay', {})).json.error, 'NO_SEAL');
    assert.equal((await c.post('/api/seal', {publicKey: KEY, name: 'm-lu-yan'})).json.error, 'BAD_NAME');
    assert.equal((await c.post('/api/seal', {publicKey: 'not-a-key'})).json.error, 'BAD_KEY');
    const sealed = await c.post('/api/seal', {publicKey: KEY});
    assert.match(sealed.json.user.seal.id, /^p-[0-9a-f]{12}\.ashes-ninth\.testnet$/, 'no name: a private id, never the email');
    assert.deepEqual((await c.get('/api/seal/next?key=' + KEY)).json, {nonce: '8', maxBlockHeight: '120'});
    const relayed = await c.post('/api/seal/relay', {delegate: {senderId: 'x'}, signature: 'y'});
    assert.equal(relayed.json.receipt.total, '1595');
    assert.equal(h.chain.calls.relays.length, 1);
    assert.equal((await c.get('/api/nope')).status, 404);
  } finally { await h.close(); }
});

test('guest creation is rate limited per address', async () => {
  const h = await harness();
  try {
    const statuses = [];
    for (let i = 0; i < 9; i++) statuses.push((await h.client().post('/api/auth/guest', {})).status);
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 200, 200, 200, 429]);
  } finally { await h.close(); }
});

test('a commission on the ledger is replayed by the server before its rewards are minted, once', async () => {
  const rules = await import('../js/progression.js');
  const h = await harness();
  try {
    const c = h.client();
    await c.post('/api/auth/guest', {});
    await c.post('/api/seal', {publicKey: KEY});
    const game = rules.freshGame(42);
    rules.begin(game, 'Shen', 'wayfarer');
    const dealt = (await c.post('/api/battle/start', {school: 'ember', tier: 1, inputs: rules.battleInputs(game), difficulty: game.difficulty})).json;
    assert.ok(dealt.battleId && Number.isSafeInteger(dealt.seed));
    rules.startBounty(game, 'ember', 1, dealt);
    const combat = game.active.combat;
    for (let guard = 0; guard < 600 && !combat.outcome; guard++) {
      let played = false;
      for (let i = 0; i < combat.hand.length && !played; i++) played = rules.fight(game, 'play', i).ok;
      if (!played) rules.fight(game, 'end');
    }
    assert.equal(combat.outcome, 'victory', 'the autopilot wins a tier-1 commission');
    const forged = await c.post('/api/battle/claim', {battleId: dealt.battleId, actions: game.active.actions.slice(0, 2)});
    assert.equal(forged.status, 409, 'a log that does not end in a win proves nothing');
    const claim = await c.post('/api/battle/claim', {battleId: dealt.battleId, actions: game.active.actions});
    assert.deepEqual(claim.json.granted, {jade: 1300, 'mat:seal-jade-1': 8, 'mat:essence-ember-1': 3});
    assert.equal(h.chain.calls.grants.at(-1).entries.length, 3);
    assert.match(h.chain.calls.grants.at(-1).memo, /battle replayed/);
    assert.equal((await c.post('/api/battle/claim', {battleId: dealt.battleId, actions: game.active.actions})).json.error, 'ALREADY_CLAIMED');
    assert.equal((await h.client().post('/api/battle/claim', {battleId: dealt.battleId, actions: []})).json.error, 'SIGN_IN');
  } finally { await h.close(); }
});
