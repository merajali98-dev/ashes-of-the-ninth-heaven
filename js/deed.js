// The Deed Registry (/deed/<merchant>): one Shop Deed's history as the Honest Ledger keeps it (every holder, what the
// shop paid them, what they claimed, each sale), and the counting room, which only the deed's current holder can open.
// The room's gate is on the server (server/room.js): a signed challenge, the signing key checked on the ledger, and the
// holder checked on the ledger on every visit.
import * as session from './online/session.js';
import * as R from './market/merchant-rules.js';
import {MARKET_TOKENS} from './market/tokens.js';

const $ = selector => document.querySelector(selector);
const EXPLORER = 'https://testnet.nearblocks.io'; // chain-words-ok: links for anyone who wants to check the ledger themselves
const id = location.pathname.split('/')[2] || new URLSearchParams(location.search).get('id') || 'lu-yan';
const def = R.MERCHANTS.find(m => m.id === id) ?? R.MERCHANTS[0];
const tokenId = `deed:${def.id}`;
const PASS_KEY = 'ashes-room:' + tokenId;
let record = null;

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const jade = cents => R.jade(Number(cents ?? 0));
const when = ms => Number(ms) ? new Date(Number(ms)).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}) : 'from the start';
const short = account => String(account ?? '').startsWith('ministry.') ? 'the Ministry of Ash' : String(account ?? '').split('.')[0];
const holderLink = account => `<a href="${EXPLORER}/address/${encodeURIComponent(account)}" target="_blank" rel="noopener">${esc(short(account))}</a>`;
const txLink = tx => tx ? ` <a href="${EXPLORER}/txns/${encodeURIComponent(tx)}" target="_blank" rel="noopener">receipt</a>` : '';
const store = {
  get: () => { try { return sessionStorage.getItem(PASS_KEY); } catch { return null; } },
  set: value => { try { if (value) sessionStorage.setItem(PASS_KEY, value); else sessionStorage.removeItem(PASS_KEY); } catch { /* tab only */ } },
};

async function api(path, {method = 'GET', body, headers = {}} = {}) {
  const res = await fetch(path, {method, credentials: 'same-origin', headers: {'X-Ashes': '1', ...(body ? {'Content-Type': 'application/json'} : {}), ...headers},
    body: body ? JSON.stringify(body) : undefined});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || String(res.status)), {code: json.error || 'SERVER'});
  return json;
}

const REFUSED = {
  NOT_HOLDER: 'The ledger says someone else holds this deed, so the room stays shut.',
  NOT_THEIR_KEY: 'That key does not belong to the account it names.',
  BAD_SIGNATURE: 'The signature does not match the challenge.',
  STALE_CHALLENGE: 'That challenge has expired or was already used. Ask for a new one.',
  NO_PASS: 'Your pass has expired. Prove you hold the deed again.',
  SLOW_DOWN: 'Too many tries. Wait a minute.',
};
const refusal = error => REFUSED[error.code] ?? `The registry could not answer (${esc(error.code ?? error.message)}).`;

// ------------------------------------------------------------------ the public record

function renderRecord() {
  const {deed, history, books} = record;
  document.title = `Deed to ${def.name}'s shop · Ashes of the Ninth Heaven`;
  $('#title').textContent = `Deed to ${def.name}'s shop`;
  $('#deeds').innerHTML = R.MERCHANTS.map(m => `<a href="/deed/${m.id}"${m.id === def.id ? ' aria-current="page"' : ''}>${esc(m.name)}</a>`).join('');
  $('#art').src = `/deeds/${def.id}.svg?at=${Date.now()}`;
  $('#art').alt = `The deed to ${def.name}'s shop`;
  const tiles = [
    [jade(deed.vault) + ' jade', 'in the vault now'],
    [jade(history.earned) + ' jade', `earned for its holders since ${when(history.since_ms)}`],
    [jade(history.claimed) + ' jade', 'claimed by holders'],
    [String(history.sales), `sales, ${jade(history.sold_for)} jade in all`],
    [String(history.holders), history.holdings[0]?.how === 'minted' ? 'holders, the Ministry included' : 'holders since the record began'],
    [short(deed.owner_id), deed.agent ? `holds it · ${def.name}'s agent runs the shop` : 'holds it and runs the shop'],
  ];
  $('#tiles').innerHTML = tiles.map(([value, label]) => `<div class="tile"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('');
  const sum = Number(history.opening_vault) + Number(history.earned) - Number(history.claimed);
  const ok = sum === Number(deed.vault);
  $('#check').innerHTML = `<b class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</b> The vault ${ok ? 'matches' : 'does not match'} its history: ${jade(history.opening_vault)} when the record began
    + ${jade(history.earned)} earned − ${jade(history.claimed)} claimed = ${jade(sum)} jade.`;
  $('#where').innerHTML = `Token <code>${esc(tokenId)}</code> (NEP-171), kept by <a href="${EXPLORER}/address/${encodeURIComponent(record.contract)}" target="_blank" rel="noopener">the Honest Ledger</a>.
    ${books ? `The shop is ${esc(books.closed ? 'shuttered' : books.status)}, its purse ${jade(books.cash)} jade.` : ''} ${deed.for_sale ? `For sale at ${jade(deed.for_sale)} jade in the game's market.` : 'Not for sale.'}`;
  renderDays();
  renderHolders();
  renderEvents();
}

function renderDays() {
  const days = record.history.days ?? [], owner = record.deed.owner_id;
  const total = days.reduce((sum, d) => sum + Number(d.share), 0);
  $('#days-note').textContent = days.length
    ? `${days.length} profitable market ${days.length === 1 ? 'day' : 'days'} recorded, ${jade(total)} jade in all. A day without profit pays nothing; brighter bars were earned under the current holder.`
    : 'No profitable market day has paid this deed yet. The Ministry takes no share, so a deed starts earning once a cultivator holds it.';
  if (!days.length) { $('#days').innerHTML = ''; return; }
  const top = Math.max(...days.map(d => Number(d.share))), w = 600 / Math.max(days.length, 12);
  $('#days').innerHTML = `<svg class="bars" viewBox="0 0 600 120" preserveAspectRatio="none" role="img" aria-label="The owner's share of each profitable day">${days.map((d, i) => {
    const h = Math.max(2, Math.round(110 * Number(d.share) / top));
    return `<rect class="${d.holder === owner ? '' : 'other'}" x="${(i * w + 1).toFixed(1)}" y="${120 - h}" width="${Math.max(1, w - 2).toFixed(1)}" height="${h}"><title>Day ${Number(d.day) + 1}: ${jade(d.share)} jade to ${esc(short(d.holder))}</title></rect>`;
  }).join('')}</svg>`;
}

const HOW = {minted: 'Minted to the Ministry', bought: 'Bought', transferred: 'Handed over', returned: 'Returned to its sender', 'held when the log began': 'Held when the record began'};
function renderHolders() {
  $('#holders tbody').innerHTML = [...record.history.holdings].reverse().map(h => `<tr><td>${holderLink(h.owner)}</td><td>${esc(HOW[h.how] ?? h.how)}</td>
    <td>${esc(when(h.since_ms))}</td><td class="num">${h.price ? jade(h.price) : '—'}</td><td class="num">${jade(h.earned)}</td><td class="num">${jade(h.claimed)}</td></tr>`).join('');
}

function eventText(e) {
  const who = holderLink(e.account), amount = `${jade(e.amount)} jade`;
  switch (e.kind) {
    case 'bought': return `${who} bought it from ${esc(short(e.note))} for ${amount}`;
    case 'transferred': return `${who} handed it over`;
    case 'returned': return `${esc(short(e.note))} sent it back, so it returned to its sender`;
    case 'claimed': return `${who} claimed ${amount} from the vault`;
    case 'listed': return `${who} put it up for sale at ${amount}`;
    case 'unlisted': return `${who} took it off sale`;
    case 'took the decisions': return `${who} took over running the shop`;
    case 'appointed the agent': return `${who} let ${esc(def.name)}'s agent run the shop again`;
    case 'ran the shop': return `${who} set the shop's day${e.note ? ` (specialty: ${esc(e.note)})` : ''}`;
    default: return `${who}: ${esc(e.kind)}`;
  }
}
function renderEvents() {
  const events = [...(record.history.events ?? [])].reverse();
  $('#events').innerHTML = events.map(e => `<li><span class="muted">${esc(when(e.at_ms))} · market hour ${esc(e.tick)}</span><br>${eventText(e)}</li>`).join('')
    || '<li class="muted">Nobody has done anything with this deed yet.</li>';
}

// ------------------------------------------------------------------ the counting room

async function loadRecord() {
  record = (await api(`/api/deeds/history?id=${encodeURIComponent(tokenId)}`)).ledger;
  renderRecord();
}

function locked(note = '') {
  const room = $('#room');
  room.classList.add('locked');
  const seal = session.state.user?.seal?.id;
  const holder = record.deed.owner_id;
  const mine = seal && seal === holder;
  const intro = `<p>Only the deed's current holder may enter. Inside: ${esc(def.name)}'s private letter to its owner, the shop's full books and the agent's journal, and the vault to claim.
    The room checks with the Honest Ledger who holds the deed each time it is opened, so the day a deed is sold its old holder is shut out.</p>`;
  const action = seal
    ? `<div class="row"><button id="enter">${mine ? 'Enter the counting room' : 'Try to enter with your seal'}</button>
       <span class="muted">${mine ? 'You hold this deed.' : `You hold seal <code>${esc(short(seal))}</code>; the deed is held by ${esc(short(holder))}.`}</span></div>`
    : `<p class="muted">Sign in and press your seal <a href="/">in the game</a>, buy this deed in the market's Shop deeds, then come back.</p>`;
  const other = `<details style="margin-top:12px"><summary>Hold this deed with another key?</summary>
    <p class="muted">Ask for a challenge, sign it as a standard signed message (NEP-413) with any key of the holding account, and paste <code>{"accountId", "publicKey", "signature"}</code> here.</p>
    <div class="row"><button id="challenge" type="button">Get a challenge</button></div><pre id="challenge-text" class="muted" style="white-space:pre-wrap"></pre>
    <textarea id="signed" placeholder='{"accountId": "...", "publicKey": "ed25519:...", "signature": "base64..."}' aria-label="Signed challenge"></textarea>
    <div class="row"><button id="enter-signed" type="button" disabled>Enter with this signature</button></div></details>`;
  $('#room-body').innerHTML = `${intro}${note ? `<p class="no">${note}</p>` : ''}${action}${other}`;
  $('#enter')?.addEventListener('click', enterWithSeal);
  let pending = null;
  $('#challenge').addEventListener('click', async () => {
    pending = (await api('/api/deeds/room/challenge', {method: 'POST', body: {token_id: tokenId}})).challenge;
    $('#challenge-text').textContent = JSON.stringify({message: pending.message, nonce: pending.nonce, recipient: pending.recipient}, null, 1);
    $('#enter-signed').disabled = false;
  });
  $('#enter-signed').addEventListener('click', async () => {
    try {
      const signed = JSON.parse($('#signed').value);
      await enter(signed, pending.nonce);
    } catch (error) { locked(error.code ? refusal(error) : 'That is not the JSON a signed message gives.'); }
  });
}

async function enterWithSeal() {
  const button = $('#enter');
  button.disabled = true;
  button.textContent = 'Pressing your seal…';
  try {
    const {challenge} = await api('/api/deeds/room/challenge', {method: 'POST', body: {token_id: tokenId}});
    await enter(await session.signChallenge(challenge), challenge.nonce);
  } catch (error) { locked(refusal(error)); }
}

async function enter(signed, nonce) {
  const opened = await api('/api/deeds/room', {method: 'POST', body: {token_id: tokenId, account_id: signed.accountId, public_key: signed.publicKey,
    signature: signed.signature, nonce}});
  store.set(opened.pass);
  renderRoom(opened);
}

function renderRoom({ledger, letter}) {
  record = {...record, ...ledger};
  renderRecord();
  const {deed, books, journal} = ledger;
  const sealed = session.state.user?.seal?.id === deed.owner_id;
  $('#room').classList.remove('locked');
  const goods = (books?.goods ?? []).filter(g => (MARKET_TOKENS[g.token_id]?.tier ?? 1) <= 3)
    .map(g => ({name: MARKET_TOKENS[g.token_id]?.name ?? g.token_id, stock: Number(g.stock), target: Number(g.target)}))
    .sort((a, b) => a.stock / Math.max(1, a.target) - b.stock / Math.max(1, b.target));
  $('#room-body').innerHTML = `<p class="muted">Welcome, ${esc(short(ledger.holder))}. The ledger confirms you hold this deed.</p>
    <div class="letter">${esc(letter.say)}<footer>${letter.voice === 'rules' ? `From ${esc(def.name)}'s books, word for word` : `In ${esc(def.name)}'s own words, from the ledger's figures`}</footer></div>
    <div class="row">
      ${Number(deed.vault) > 0 && sealed ? `<button id="claim">Claim ${jade(deed.vault)} jade from the vault</button>` : `<span class="muted">The vault holds ${jade(deed.vault)} jade.</span>`}
      ${sealed ? `<button id="agent">${deed.agent ? 'I will run the shop myself' : `Let ${esc(def.name)}'s agent run it`}</button>` : ''}
      <button id="leave" type="button">Leave the room</button>
    </div>
    <p class="muted" id="room-note"></p>
    <h2 style="margin-top:14px">The shop's books</h2>
    <div class="scroll"><table><thead><tr><th>Good</th><th class="num">On the shelf</th><th class="num">Wanted</th><th></th></tr></thead><tbody>
      ${goods.map(g => `<tr><td>${esc(g.name)}</td><td class="num">${g.stock}</td><td class="num">${g.target}</td><td>${g.stock * 100 < g.target * 85 ? 'short' : g.stock > g.target * 2 ? 'glut' : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <h2 style="margin-top:14px">The agent's journal</h2>
    <ul class="events">${(journal ?? []).map(j => `<li><span class="muted">Market day ${esc(j.day)}${j.source === 'ministry' ? ' · the Ministry' : ''}</span><br><span class="say">${esc(j.say)}</span>
      ${(j.changes ?? []).length ? `<span class="muted"> · ${j.changes.length} ${j.changes.length === 1 ? 'want' : 'wants'} changed</span>` : ''}${j.ok === false ? ` <span class="muted">(refused: ${esc(j.code)})</span>` : ''}${txLink(j.tx)}</li>`).join('')
      || '<li class="muted">The agent has not decided anything yet.</li>'}</ul>`;
  $('#leave').addEventListener('click', () => { store.set(null); locked(); });
  const act = async (button, method, args, said) => {
    button.disabled = true;
    const result = await session.sealCall(ledger.contract, method, args).catch(error => ({ok: false, code: error.code}));
    $('#room-note').textContent = result.ok ? said : `Refused: ${result.code}`;
    await visit();
  };
  $('#claim')?.addEventListener('click', event => act(event.target, 'deed_claim', {token_id: tokenId}, 'The vault is yours.'));
  $('#agent')?.addEventListener('click', event => act(event.target, 'deed_appoint_agent', {token_id: tokenId, appoint: !deed.agent},
    deed.agent ? 'You run the shop now.' : `${def.name}'s agent runs the shop again.`));
}

/** Opens the room with the pass from this tab, if there is one and its holder still holds the deed; otherwise shows the door. */
async function visit() {
  const pass = store.get();
  if (pass) {
    try { renderRoom(await api(`/api/deeds/room?id=${encodeURIComponent(tokenId)}`, {headers: {'X-Room-Pass': pass}})); return; }
    catch (error) { store.set(null); await loadRecord(); locked(refusal(error)); return; }
  }
  await loadRecord();
  locked();
}

(async () => {
  try {
    await session.load();
    await visit();
  } catch (error) {
    $('#room-body').innerHTML = `<p class="muted">The registry is unavailable right now (${esc(error.code ?? error.message)}). The game's server keeps it; try again shortly.</p>`;
  }
})();
