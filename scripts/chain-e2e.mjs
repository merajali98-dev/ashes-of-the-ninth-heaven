// Live testnet check of the whole online path, through the game's own HTTP API, exactly as the browser does it:
//   guest sign-in → device key made with WebCrypto → ledger seal (a new account) → welcome grant from the minter →
//   a sale to Lu Yan signed in "the browser" and relayed by the server → the jade lands. Then a forbidden method is
//   refused by the relayer; a haggle with Lu Yan and her counter taken; a Shop Deed bought, its counting room opened
//   (and another deed's refused), the deed listed again; a commission replayed before its reward.
//   Creates one new testnet account per run (0.01 NEAR from the parent).
// Run: npm run chain:e2e
import {once} from 'node:events';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

// ASHES_BASE=https://ashes-ninth.duckdns.org npm run chain:e2e   checks the hosted server instead of a local one.
let server = null, base = process.env.ASHES_BASE;
if (!base) {
  process.env.PORT = '0';
  process.env.ASHES_STORE ||= join(tmpdir(), `ashes-e2e-${Date.now()}.json`);
  ({server} = await import('../server.js'));
  if (!server.listening) await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}
const {createDeviceKey, publicKeyOf, signDelegate, signMessage} = await import('../js/online/signer.js');
const {CONTRACT, merchantAccount, view} = await import('../server/chain/near.js');

let jar = '';
async function api(method, path, body) {
  const res = await fetch(base + path, {method, headers: {'Content-Type': 'application/json', 'X-Ashes': '1', ...(jar ? {Cookie: jar} : {})},
    body: body ? JSON.stringify(body) : undefined});
  if (res.headers.get('set-cookie')) jar = res.headers.get('set-cookie').split(';')[0];
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
}
const balance = (accountId, tokenId) => view('mt_balance_of', {account_id: accountId, token_id: tokenId}).then(BigInt);
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

try {
  const session = await api('GET', '/api/session');
  if (!session.ledger) throw new Error('The server has no testnet keys (see internal/08); nothing to check');
  const name = 'trial-' + randomBytes(3).toString('hex');
  await api('POST', '/api/auth/guest', {name});
  const device = await createDeviceKey(), publicKey = await publicKeyOf(device);
  const sealed = await api('POST', '/api/seal', {publicKey, name});
  const accountId = sealed.user.seal.id;
  console.log(`+ seal ${accountId} (device key ${publicKey.slice(0, 16)}…)`);

  const TOKEN = 'mat:essence-ember-1', MERCHANT = merchantAccount('lu-yan'), QTY = 3;
  let held = 0n;
  for (let i = 0; i < 40 && held < BigInt(QTY); i++) { await wait(1500); held = await balance(accountId, TOKEN); }
  if (held < BigInt(QTY)) throw new Error('The welcome grant did not arrive');
  console.log(`+ welcome grant arrived: ${held} Cinder Essence, ${await balance(accountId, 'jade')} jade cents`);

  const quote = await view('market_quote', {merchant_id: MERCHANT, token_id: TOKEN, side: 'sell', amount: String(QTY), account_id: accountId});
  const next = await api('GET', '/api/seal/next?key=' + encodeURIComponent(publicKey));
  const delegate = {senderId: accountId, receiverId: CONTRACT, publicKey, nonce: BigInt(next.nonce), maxBlockHeight: BigInt(next.maxBlockHeight),
    actions: [{methodName: 'market_sell', args: {merchant_id: MERCHANT, token_id: TOKEN, amount: String(QTY), min_total: quote.total}, gas: 100_000_000_000_000n, deposit: 0n}]};
  const before = await balance(accountId, 'jade');
  const result = await api('POST', '/api/seal/relay', await signDelegate(device, delegate));
  if (!result.ok) throw new Error('Relayed sale failed: ' + result.code);
  const after = await balance(accountId, 'jade');
  console.log(`+ sold ${QTY} to Lu Yan for ${quote.total} (receipt total ${result.receipt?.total}); jade ${before} → ${after}`);
  if (after - before !== BigInt(quote.total)) throw new Error('Paid amount differs from the quote');

  const bad = {...delegate, nonce: delegate.nonce + 1n, actions: [{methodName: 'mt_transfer', args: {receiver_id: MERCHANT, token_id: 'jade', amount: '1'}, gas: 30_000_000_000_000n, deposit: 0n}]};
  const refused = await api('POST', '/api/seal/relay', await signDelegate(device, bad)).then(() => false, error => /NOT_ALLOWED/.test(error.message));
  console.log(`  relayer refused mt_transfer: ${refused}`);
  if (!refused) throw new Error('The relayer accepted a method outside the market');

  // Haggling: ask 1.5 times the room the rules give Lu Yan, so she counters (the ledger decides; the merchant speaks),
  // then take the counter. The jade received must be exactly the counter.
  const R = await import('../js/market/merchant-rules.js');
  const call = async (methodName, args) => {
    const n = await api('GET', '/api/seal/next?key=' + encodeURIComponent(publicKey));
    return api('POST', '/api/seal/relay', await signDelegate(device, {senderId: accountId, receiverId: CONTRACT, publicKey, nonce: BigInt(n.nonce),
      maxBlockHeight: BigInt(n.maxBlockHeight), actions: [{methodName, args, gas: 100_000_000_000_000n, deposit: 0n}]}));
  };
  const books = await view('market_merchant', {merchant_id: MERCHANT});
  const good = books.goods.find(g => g.token_id === TOKEN), helps = Number(good.stock) < Number(good.target);
  const posted = Number((await view('market_quote', {merchant_id: MERCHANT, token_id: TOKEN, side: 'sell', amount: '3', account_id: accountId})).total);
  const lu = R.MERCHANTS.find(m => m.id === 'lu-yan');
  const room = Math.trunc(posted * (R.temperamentOf(lu).haggleBps + (helps ? R.HAGGLE.needBps : 0)) / R.BPS);
  const haggled = await call('market_haggle', {merchant_id: MERCHANT, token_id: TOKEN, amount: '3', sell: true, offer: String(posted + Math.max(1, Math.trunc(room * 3 / 2)))});
  if (!haggled.ok) throw new Error('Haggle failed: ' + haggled.code);
  console.log(`+ haggled: posted ${haggled.receipt.posted}, offered ${haggled.receipt.offer} → ${haggled.receipt.outcome} at ${haggled.receipt.price} (${haggled.voice}): "${haggled.say}"`);
  if (haggled.receipt.outcome === 'countered') {
    const jadeBefore = await balance(accountId, 'jade');
    const taken = await call('market_take_counter', {merchant_id: MERCHANT});
    if (!taken.ok) throw new Error('Taking the counter failed: ' + taken.code);
    const got = (await balance(accountId, 'jade')) - jadeBefore;
    console.log(`+ took the counter: received ${got} jade cents`);
    if (got !== BigInt(taken.receipt.total)) throw new Error('The counter paid a different amount');
  }

  // A Shop Deed: buy one that is for sale within this account's jade, open its counting room with a NEP-413 message
  // signed by the device key, check that another deed's room refuses the same proof, and list the deed again.
  const jadeNow = await balance(accountId, 'jade');
  const forSale = (await view('deeds')).find(d => d.for_sale && BigInt(d.for_sale) <= jadeNow && d.owner_id !== accountId);
  if (!forSale) console.log("  no deed is for sale within this account's jade: the deed and counting-room steps are skipped");
  else {
    const bought = await call('deed_buy', {token_id: forSale.token_id, max_price: forSale.for_sale});
    if (!bought.ok) throw new Error('Buying the deed failed: ' + bought.code);
    const enter = async tokenId => {
      const {challenge} = await api('POST', '/api/deeds/room/challenge', {token_id: tokenId});
      const signed = await signMessage(device, accountId, challenge);
      return api('POST', '/api/deeds/room', {token_id: tokenId, account_id: accountId, public_key: signed.publicKey, signature: signed.signature, nonce: challenge.nonce});
    };
    let opened = null;
    for (let i = 0; i < 6 && !opened; i++) opened = await enter(forSale.token_id).catch(async error => { if (!/NOT_HOLDER/.test(error.message)) throw error; await wait(1500); return null; });
    if (!opened) throw new Error('The holder could not open the counting room');
    console.log(`+ bought ${forSale.token_id} for ${forSale.for_sale}; counting room opened (${opened.letter.voice}): "${opened.letter.say.slice(0, 120)}…"`);
    const history = (await view('deed_history', {token_id: forSale.token_id})).history;
    if (history.holdings.at(-1).owner !== accountId) throw new Error('The deed history does not show the new holder');
    const other = (await view('deeds')).find(d => d.owner_id !== accountId);
    const shut = await enter(other.token_id).then(() => false, error => /NOT_HOLDER/.test(error.message));
    console.log(`  another deed's counting room refused this account: ${shut}`);
    if (!shut) throw new Error('A non-holder entered a counting room');
    const relisted = await call('deed_list', {token_id: forSale.token_id, price: forSale.for_sale});
    if (!relisted.ok) throw new Error('Listing the deed again failed: ' + relisted.code);
  }

  // Proof of battle: the server deals a seed, the commission is fought with the game's own rules, the server replays it
  // and only then the minter grants the rewards.
  const rules = await import('../js/progression.js');
  const game = rules.freshGame(7);
  rules.begin(game, 'Trial', 'wayfarer');
  let won = null;
  for (let attempt = 0; attempt < 4 && !won; attempt++) {
    game.hp = rules.maxHp(game);
    const dealt = await api('POST', '/api/battle/start', {school: 'ember', tier: 1, inputs: rules.battleInputs(game), difficulty: game.difficulty});
    rules.startBounty(game, 'ember', 1, dealt);
    const combat = game.active.combat;
    for (let guard = 0; guard < 600 && !combat.outcome; guard++) {
      let played = false;
      for (let i = 0; i < combat.hand.length && !played; i++) played = rules.fight(game, 'play', i).ok;
      if (!played) rules.fight(game, 'end');
    }
    if (combat.outcome === 'victory') won = {battleId: dealt.battleId, actions: game.active.actions};
    game.active = null;
  }
  if (!won) throw new Error('The autopilot lost four commissions');
  const sealBefore = await balance(accountId, 'mat:seal-jade-1');
  const claim = await api('POST', '/api/battle/claim', won);
  for (let i = 0; i < 30 && (await balance(accountId, 'mat:seal-jade-1')) === sealBefore; i++) await wait(1500);
  const sealAfter = await balance(accountId, 'mat:seal-jade-1');
  console.log(`+ commission replayed by the server (${won.actions.length} actions); minted ${JSON.stringify(claim.granted)}; Seal Jade ${sealBefore} → ${sealAfter}`);
  if (sealAfter - sealBefore !== BigInt(claim.granted['mat:seal-jade-1'])) throw new Error('The commission reward did not arrive');
  const again = await api('POST', '/api/battle/claim', won).then(() => false, error => /ALREADY_CLAIMED/.test(error.message));
  console.log(`  a second claim of the same battle refused: ${again}`);
  if (!again) throw new Error('A battle was paid twice');

  console.log(JSON.stringify({ok: true, account: accountId, tx: `https://testnet.nearblocks.io/txns/${result.tx}`, status: await api('GET', '/api/status')}, null, 1));
} finally {
  server?.closeAllConnections();
  server?.close();
}
