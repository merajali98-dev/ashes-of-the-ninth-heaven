// The Judge's Desk (/judge). This page is for judges, so unlike the game it names the chain plainly.
import * as session from './online/session.js';

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
      log(true, `Refused (<code>${esc(error.code)}</code>): the trade key and the relayer only allow <code>market_sell</code>, <code>market_buy</code> and <code>patron_invest</code>. Moving goods freely needs the standard 1-yoctoNEAR <code>mt_transfer</code>, which a limited key cannot sign.`);
    }
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
