// The Judge's Desk (/judge). This page is for judges, so unlike the game it names the chain plainly.
import * as session from './online/session.js';
import * as R from './market/merchant-rules.js';

const $ = selector => document.querySelector(selector);
const EXPLORER = 'https://testnet.nearblocks.io';
const LU = 'lu-yan', TOKEN = 'mat:essence-ember-1';
let ledger = null;

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const jade = cents => (Number(cents) / 100).toFixed(2);
const txLink = tx => tx ? ` · <a href="${EXPLORER}/txns/${encodeURIComponent(tx)}" target="_blank" rel="noopener">view the transaction</a>` : '';
const accountLink = id => `<a href="${EXPLORER}/address/${encodeURIComponent(id)}" target="_blank" rel="noopener"><code>${esc(id)}</code></a>`;

function log(ok, html) {
  const list = $('#log');
  if (list.firstElementChild?.classList.contains('muted')) list.innerHTML = '';
  list.insertAdjacentHTML('afterbegin', `<li><b class="${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</b> ${html}</li>`);
}
async function api(path, init) {
  const res = await fetch(path, {credentials: 'same-origin', headers: {'X-Ashes': '1', ...(init?.body ? {'Content-Type': 'application/json'} : {})}, ...init});
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || res.status), {code: json.error});
  return json;
}

async function loadLedger() {
  ledger = (await api('/api/ledger')).ledger;
  $('#contract').innerHTML = `Contract ${accountLink(ledger.contract)} · market hour ${ledger.tick}`;
  $('#jobs').innerHTML = (ledger.jobs ?? []).map(j => `<li><b>${esc(j.name)}</b> wants ${esc(j.wanted)} <code>${esc(j.token_id)}</code> at ${jade(j.pay_each)} jade each
    <span class="muted">(${jade(j.escrow)} jade in escrow${j.expired ? ', expired: the wage returns on the shop\u2019s next move' : `, closes at market hour ${j.expires_tick}`})</span></li>`).join('')
    || '<li class="muted">No merchant is hiring right now. Jobs appear when a shop runs short and its agent decides to hire (checked once per market day).</li>';
  $('#merchants tbody').innerHTML = ledger.merchants.map(m => `<tr><td>${esc(m.name)}</td><td>${accountLink(m.account_id)}</td>
    <td class="num">${jade(m.cash)}</td><td>${esc(m.status)}${m.closed ? ' (closed)' : ''}</td><td class="num">${m.patrons.length}</td></tr>`).join('');
  return ledger;
}
async function loadStatus() {
  const s = await api('/api/status');
  $('#status').innerHTML = `Network <b>${esc(s.network)}</b> · ledger ${s.online ? '<b class="ok">online</b>' : 'offline'}<br>
    Relayer balance ${esc(s.relayerBalance ?? '?')} NEAR · minter batch #${esc(s.minterSeq ?? '?')} · ${esc(s.seals)} player accounts<br>
    ${s.lastRelay ? `Last relayed trade${txLink(s.lastRelay.tx)}<br>` : ''}${s.lastMint ? `Last minter batch${txLink(s.lastMint.tx)}` : ''}`;
}
const balances = async () => (await loadLedger()).balances ?? {};

function showSeal() {
  const id = session.state.user?.seal?.id;
  $('#seal-state').innerHTML = id ? `Account ${accountLink(id)}. It received a welcome pack from the minter: 150 jade and some essences.` : 'Not created yet.';
  document.querySelectorAll('[data-act]').forEach(b => { b.disabled = !id; });
  $('#make-seal').disabled = Boolean(id);
}

$('#make-seal').addEventListener('click', async () => {
  const button = $('#make-seal');
  button.disabled = true;
  button.textContent = 'Creating the account on testnet…';
  try {
    await session.load();
    if (!session.state.ledger) throw new Error('The ledger is offline on this server.');
    if (!session.state.signedIn) await session.guest('Judge');
    await session.ensureSeal('jury-' + Math.random().toString(36).slice(2, 7));
    showSeal();
    log(true, `Made ${accountLink(session.state.user.seal.id)}: one transaction from the game's parent account created it with the browser's market-only key.`);
    for (let i = 0; i < 20 && !((await balances())[TOKEN] > 0); i++) await new Promise(r => setTimeout(r, 1500));
    const b = await balances();
    log(true, `Welcome pack arrived from <code>minter.ashes-ninth.testnet</code>: ${jade(b.jade)} jade, ${b[TOKEN]} Mortal Cinder Essence.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Make a judge seal (a new testnet account)';
    log(false, `Could not make the seal: ${esc(error.code || error.message)}`);
  }
});

async function act(kind) {
  const merchant = ledger.merchants.find(m => m.rules_id === LU);
  if (kind === 'forbidden') {
    try {
      await session.sealCall(ledger.contract, 'mt_transfer', {receiver_id: merchant.account_id, token_id: 'jade', amount: '1', approval: null, memo: null});
      log(false, 'The relayer accepted a transfer outside the market. That should not happen.');
    } catch (error) {
      log(true, `Refused (<code>${esc(error.code)}</code>): the trade key and the relayer only allow the game's own market methods (trading, haggling, stalls, deeds, jobs). Moving goods freely needs the standard 1-yoctoNEAR <code>mt_transfer</code>, which a limited key cannot sign.`);
    }
    return;
  }
  if (kind === 'deed') {
    const jadeNow = (await balances()).jade;
    const deed = (ledger.deeds ?? []).find(d => d.for_sale && Number(d.for_sale) <= jadeNow && d.owner_id !== session.state.user.seal.id);
    if (!deed) { log(false, 'No deed is for sale within this account’s jade right now.'); return; }
    const bought = await session.sealCall(ledger.contract, 'deed_buy', {token_id: deed.token_id, max_price: deed.for_sale});
    if (!bought.ok) { log(false, `Refused: ${esc(bought.code)}${txLink(bought.tx)}`); return; }
    const relisted = await session.sealCall(ledger.contract, 'deed_list', {token_id: deed.token_id, price: deed.for_sale});
    const token = await api('/api/ledger').then(r => r.ledger.deeds.find(d => d.token_id === deed.token_id));
    log(true, `Bought <code>${esc(deed.token_id)}</code> for ${jade(deed.for_sale)} jade from ${esc(String(deed.owner_id).split('.')[0])}: it now belongs to ${accountLink(token.owner_id)}${txLink(bought.tx)}.
      Listed again at the same price so the next visitor can buy it${txLink(relisted.tx)}. Its picture is drawn live from the shop:
      <a href="/deeds/${esc(deed.rules_id)}.svg" target="_blank" rel="noopener">/deeds/${esc(deed.rules_id)}.svg</a>. Spec and threat model: <code>docs/shop-deeds.md</code>.`);
    return;
  }
  if (kind === 'haggle') {
    // Ask for a little more than the rules let Lu Yan give (1.5× her room), so she counters; then take the counter.
    const quote = (await api(`/api/ledger/quote?m=${encodeURIComponent(merchant.account_id)}&t=${encodeURIComponent(TOKEN)}&side=sell&n=1`)).ledger;
    if (quote.code !== 'OK') { log(false, `Lu Yan will not buy right now: ${esc(quote.code)}`); return; }
    const good = merchant.goods.find(g => g.token_id === TOKEN), helps = Number(good.stock) < Number(good.target);
    const def = R.MERCHANTS.find(m => m.id === LU), posted = Number(quote.total);
    const room = Math.trunc(posted * (R.temperamentOf(def).haggleBps + (helps ? R.HAGGLE.needBps : 0)) / R.BPS);
    const offer = posted + Math.max(1, Math.trunc(room * 3 / 2));
    const said = await session.sealCall(ledger.contract, 'market_haggle', {merchant_id: merchant.account_id, token_id: TOKEN, amount: '1', sell: true, offer: String(offer)});
    if (!said.ok) { log(false, `Refused: <code>${esc(said.code)}</code>${said.code === 'HAGGLED_TODAY' ? ' (one haggle per merchant per market day; a market day is 24 minutes here)' : ''}${txLink(said.tx)}`); return; }
    const r = said.receipt;
    log(true, `Offered ${jade(offer)} jade for 1 Mortal Cinder Essence against Lu Yan's posted ${jade(r.posted)}. The contract's <code>haggle()</code> gave her ${r.bend_bps / 100}% of room${r.helps ? ' (more, because she is short of it)' : ''}:
      <b>${esc(r.outcome)}</b>${r.outcome === 'countered' ? ` at ${jade(r.price)} jade` : r.outcome === 'accepted' ? ` at ${jade(r.price)} jade` : ''}${txLink(said.tx)}<br>
      Lu Yan (${said.voice === 'near-ai' ? 'NEAR AI, in character' : 'the rules\u2019 words'}): “${esc(said.say)}”`);
    if (r.outcome !== 'countered') return;
    const taken = await session.sealCall(ledger.contract, 'market_take_counter', {merchant_id: merchant.account_id});
    log(taken.ok, taken.ok ? `Took the counter: sold for ${jade(taken.receipt?.total)} jade${txLink(taken.tx)}` : `Could not take the counter: ${esc(taken.code)}${txLink(taken.tx)}`);
    return;
  }
  if (kind === 'job') {
    const held = await balances();
    const job = (ledger.jobs ?? []).find(j => !j.expired && (held[j.token_id] ?? 0) > 0);
    if (!job) { log(false, `No open job wants what this account holds right now (${(ledger.jobs ?? []).length} open). The board below shows what merchants want; commissions in the game bring those goods back.`); return; }
    const n = Math.min(held[job.token_id], Number(job.wanted));
    const result = await session.sealCall(ledger.contract, 'job_fill', {merchant_id: job.merchant_id, amount: String(n)});
    log(result.ok, result.ok ? `Delivered ${n} <code>${esc(job.token_id)}</code> to ${esc(job.name)}'s job and was paid ${jade(result.receipt?.paid)} jade from escrow (tax ${jade(result.receipt?.tax)})${txLink(result.tx)}`
      : `Refused: ${esc(result.code)}${txLink(result.tx)}`);
    return;
  }
  if (kind === 'invest') {
    const result = await session.sealCall(ledger.contract, 'patron_invest', {merchant_id: merchant.account_id, amount: '100'});
    log(result.ok, result.ok ? `You are a patron of Lu Yan with 1.00 jade: patrons share the shop's profit at the end of each market day${txLink(result.tx)}` : `Refused: ${esc(result.code)}${txLink(result.tx)}`);
    return;
  }
  const side = kind === 'sell' ? 'sell' : 'buy';
  const quote = (await api(`/api/ledger/quote?m=${encodeURIComponent(merchant.account_id)}&t=${encodeURIComponent(TOKEN)}&side=${side}&n=1`)).ledger;
  if (quote.code !== 'OK') { log(false, `Lu Yan will not ${side} right now: ${esc(quote.code)}`); return; }
  const before = await balances();
  const result = await session.sealCall(ledger.contract, side === 'sell' ? 'market_sell' : 'market_buy',
    {merchant_id: merchant.account_id, token_id: TOKEN, amount: '1', [side === 'sell' ? 'min_total' : 'max_total']: quote.total});
  if (!result.ok) { log(false, `Refused: ${esc(result.code)}${txLink(result.tx)}`); return; }
  const after = await balances();
  log(true, `${side === 'sell' ? 'Sold' : 'Bought'} 1 Mortal Cinder Essence ${side === 'sell' ? 'to' : 'from'} Lu Yan for ${jade(result.receipt?.total ?? quote.total)} jade, exactly the contract's quote
    (the rules file computes the same number). Jade ${jade(before.jade)} → ${jade(after.jade)}, essence ${before[TOKEN]} → ${after[TOKEN]}${txLink(result.tx)}`);
}

document.querySelectorAll('[data-act]').forEach(button => button.addEventListener('click', async () => {
  document.querySelectorAll('[data-act]').forEach(b => { b.disabled = true; });
  try { await act(button.dataset.act); } catch (error) { log(false, `Failed: ${esc(error.code || error.message)}`); }
  finally { showSeal(); loadStatus().catch(() => {}); }
}));

session.load().then(showSeal);
loadLedger().catch(error => { $('#merchants tbody').innerHTML = `<tr><td colspan="5">The ledger is offline here (${esc(error.code || error.message)}). Run the hosted game, or set testnet keys.</td></tr>`; });
loadStatus().catch(() => { $('#status').textContent = 'Status unavailable.'; });
api('/api/journal').then(({ledger: journal, haggles}) => {
  const rows = Object.entries(journal).map(([id, [e]]) => e && `<li><b>${esc(id)}</b> <span class="muted">(${e.source === 'near-ai' ? 'NEAR AI' : e.source === 'ministry' ? 'Ministry relief, by the contract owner' : 'rules'}, day ${e.day + 1})</span><br>“${esc(e.say)}”
    <br><span class="muted">${(e.changes ?? []).map(c => `${esc(c.name)} ${c.from / 100}% → ${c.to / 100}%`).join(' · ') || 'no changes'}</span>${txLink(e.tx)}
    ${e.job ? `<br><span class="muted">Hiring: ${esc(e.job.units)} ${esc(e.job.name)} at ${jade(e.job.payEach)} each, ${e.job.ok ? 'posted' : `refused (${esc(e.job.code)})`}</span>${txLink(e.job.tx)}` : ''}</li>`).filter(Boolean);
  $('#haggles').innerHTML = (haggles ?? []).slice(0, 8).map(h => `<li><b>${esc(h.name ?? h.rules_id)}</b> · ${esc(h.player)} offered ${jade(h.offer)} against ${jade(h.posted)}:
    <b>${esc(h.outcome)}</b>${h.outcome === 'walked' ? '' : ` at ${jade(h.price)}`} <span class="muted">(${h.source === 'near-ai' ? 'NEAR AI' : 'rules'})</span><br>“${esc(h.say)}”${txLink(h.tx)}</li>`).join('')
    || '<li class="muted">No haggles yet. Try the button above.</li>';
  $('#journal').innerHTML = rows.join('') || '<li class="muted">No decisions yet today; the first comes within a few minutes of the market day starting.</li>';
}).catch(() => { $('#journal').innerHTML = '<li class="muted">Journal unavailable.</li>'; });
