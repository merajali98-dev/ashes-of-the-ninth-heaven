// Market screens: merchant stalls with reasoning tooltips, the price board, and the fast-forward week.
import * as R from './merchant-rules.js';
import {MARKET_TOKENS} from './tokens.js';
import {bestPrices, marketWorld, playerQuote, walletCents} from './local.js';
import {CAST} from './npc.js';
import {SHOCKS} from './engine.js';
import {FAMILIES} from './fastforward.js';
import {characters, items, schools} from '../content.js';
import {materialById} from '../economy.js';
import {itemIcon} from '../item-art.js';
import {icon, esc, button} from '../ui.js';

const characterById = Object.fromEntries(characters.map(c => [c.id, c]));
const itemById = Object.fromEntries(items.map(i => [i.id, i]));
const schoolName = Object.fromEntries(schools.map(s => [s.id, s.name]));
const REGION = {'ashen-prefecture': 'Ashen Prefecture', 'salt-estuary': 'Salt Estuary', 'hollow-theatre': 'Hollow Theatre',
  'lotus-vault': 'Lotus Vault', 'thunder-span': 'Thunder Span', 'last-observatory': 'Last Observatory'};
const TEMPERAMENT = {cautious: 'Cautious: slow to move prices, wide margins', loyal: 'Loyal: trims margins for regulars',
  greedy: 'Greedy: prices jump with every trade'};
const FAMILY_LABEL = {'seal-jade': 'Seal Jade', 'essence-iron': 'Oathsteel', 'essence-ember': 'Cinder', 'essence-tide': 'Frosttide',
  'essence-shade': 'Umbral', 'essence-lotus': 'Verdant', 'essence-thunder': 'Storm', 'essence-star': 'Astral', 'essence-neutral': 'Mortal'};
const FAMILY_COLOR = Object.fromEntries(FAMILIES.map(f => [f, materialById[f + '-1']?.color ?? '#d5a477']));
const MERCHANT_COLOR = {'granny-qiu': '#d5a477', 'auntie-shi': '#e28f87', 'mu-xiao': FAMILY_COLOR['essence-iron'],
  'lu-yan': FAMILY_COLOR['essence-ember'], 'elder-ya': FAMILY_COLOR['essence-tide'], 'black-bamboo': FAMILY_COLOR['essence-shade'],
  'kuang-yi': FAMILY_COLOR['essence-lotus'], 'he-feng': FAMILY_COLOR['essence-thunder'], 'gao-shan': FAMILY_COLOR['essence-star']};
const portrait = id => id === 'black-bamboo' ? 'assets/art/card-black-bamboo-testimony.webp' : `assets/art/portrait-${id}.webp`;
const picture = (src, className = '') => `<img src="${esc(src)}" class="${className}" alt="" loading="lazy" decoding="async">`;
const pct = bps => `${Math.round(bps / 100)}%`;
const statusLabel = {open: 'Open', struggling: 'Struggling', closed: 'Shuttered'};

function tokenIcon(token) {
  if (token.kind === 'material') return picture(materialById[token.id.slice(4)].art, 'market-token-icon');
  return picture(itemIcon(itemById[token.id.slice(5)]), 'market-token-icon');
}
export const owned = (game, tokenId) => tokenId.startsWith('mat:') ? game.materials?.[tokenId.slice(4)] ?? 0 : game.bag?.[tokenId.slice(5)] ?? 0;

let tipCount = 0;
/** A price with the merchant's reasoning: shown on hover, keyboard focus or tap. */
export function priceTip(price, lines, label, extra = '') {
  const id = 'price-tip-' + (++tipCount);
  return `<span class="price-tip ${extra}" tabindex="0" aria-describedby="${id}" aria-label="${esc(label)}: ${R.jade(price)} jade">
    <b>${R.jade(price)}</b><span class="price-tip-body" role="tooltip" id="${id}">${lines.map(line => `<span>${esc(line)}</span>`).join('')}</span></span>`;
}

function merchantCard(game, world, m, selected) {
  const state = world.markets[m.id], status = R.merchantStatus(m, state), who = characterById[m.id];
  return `<button class="merchant-card status-${status} ${selected ? 'selected' : ''}" data-action="market-merchant" data-id="${m.id}" aria-pressed="${selected}">
    ${picture(portrait(m.id), 'merchant-face')}<span class="merchant-card-text"><b>${esc(m.name)}</b><small>${esc(who?.role ?? '')}</small>
    <small>${esc(REGION[m.region] ?? '')}</small></span><span class="merchant-status">${statusLabel[status]}</span>
    <span class="merchant-purse" aria-label="Purse ${pct(state.cash * R.BPS / m.startCash)} of usual"><i style="width:${Math.min(100, Math.round(state.cash * 100 / m.startCash))}%"></i></span></button>`;
}

function goodsRow(game, world, m, tokenId) {
  const token = world.tokens[tokenId], state = world.markets[m.id];
  const sell = playerQuote(game, m.id, tokenId, 'sell', 1), buy = playerQuote(game, m.id, tokenId, 'buy', 1);
  const have = owned(game, tokenId), stock = state.stock[tokenId] ?? 0, target = state.target[tokenId];
  const sellMany = Math.min(have, 10), buyMany = Math.min(stock, 10);
  const tint = sell.bid * R.BPS >= token.base * 9_500 ? 'dear' : sell.bid * R.BPS <= token.base * 6_000 ? 'cheap' : '';
  return `<tr class="${tint}"><th scope="row"><span class="market-good">${tokenIcon(token)}<span><b>${esc(token.name)}</b>
      <small>${token.tier ? 'Tier ' + token.tier + ' · ' : ''}stock ${stock} / wants ${target}</small></span></span></th>
    <td data-label="Pays">${priceTip(sell.bid, sell.lines, `${m.name} pays`, 'bid')}</td><td data-label="Charges">${priceTip(buy.ask, buy.lines, `${m.name} charges`, 'ask')}</td>
    <td class="market-have">${have}</td>
    <td class="market-actions">${button('Sell 1', 'market-sell', `${m.id}|${tokenId}|1`, {className: 'compact', disabled: !have || !sell.ok})}
      ${sellMany > 1 ? button(`Sell ${sellMany}`, 'market-sell', `${m.id}|${tokenId}|${sellMany}`, {className: 'compact quiet', disabled: !sell.ok}) : ''}
      ${button('Buy 1', 'market-buy', `${m.id}|${tokenId}|1`, {className: 'compact', disabled: !buy.ok || walletCents(game) < buy.ask})}
      ${buyMany > 1 ? button(`Buy ${buyMany}`, 'market-buy', `${m.id}|${tokenId}|${buyMany}`, {className: 'compact quiet', disabled: !buy.ok}) : ''}</td></tr>`;
}

function stall(game, world, m, ui) {
  const state = world.markets[m.id], status = R.merchantStatus(m, state), who = characterById[m.id];
  const patrons = world.patrons[m.id] ?? {}, mine = patrons.player ?? 0;
  const stake = Object.values(patrons).reduce((a, b) => a + b, 0);
  const tokens = Object.keys(state.target).filter(id => !ui.marketQuery || world.tokens[id].name.toLowerCase().includes(ui.marketQuery.toLowerCase()))
    .sort((a, b) => (owned(game, b) > 0) - (owned(game, a) > 0) || (world.tokens[a].tier ?? 0) - (world.tokens[b].tier ?? 0));
  const focus = ui.focusToken && tokens.includes(ui.focusToken) ? [ui.focusToken, ...tokens.filter(t => t !== ui.focusToken)] : tokens;
  const need = Math.max(0, Math.ceil((m.startCash * R.PURSE.reopenAtBps / R.BPS - state.cash) / R.CENTS) + 1);
  return `<section class="merchant-stall status-${status}" aria-labelledby="stall-title">
    <header class="stall-head">${picture(portrait(m.id), 'stall-face')}<div><div class="eyebrow">${esc(REGION[m.region] ?? '')} · ${esc(who?.role ?? '')}</div>
      <h2 id="stall-title">${esc(m.name)}'s stall</h2><p class="stall-quote">“${esc(who?.quote ?? '')}”</p>
      <p class="stall-temperament">${esc(TEMPERAMENT[m.temperament])}${state.specialty ? ` · Specialising in ${esc(schoolName[state.specialty])} today` : ''}</p></div>
      <dl class="stall-facts"><div><dt>Purse</dt><dd>${R.jade(state.cash)} jade</dd></div><div><dt>Status</dt><dd class="merchant-status">${statusLabel[status]}</dd></div>
      <div><dt>Patrons</dt><dd>${Object.keys(patrons).length} · ${pct(Math.min(R.PATRONAGE.maxPublicBps, stake * R.BPS / m.startCash))} owned</dd></div>
      ${mine ? `<div><dt>Your stake</dt><dd>${R.jade(mine)} jade</dd></div>` : ''}</dl></header>
    ${status === 'closed' ? `<div class="stall-closed">${icon('lock')}<div><b>The shutters are down.</b><p>${esc(m.name)} ran out of jade. The shop reopens once rekindled to ${pct(R.PURSE.reopenAtBps)} of its usual purse: about ${need} more jade. Rekindlers become patrons.</p></div>
      <div class="stall-closed-actions">${[10, 50, need].filter((n, i, a) => n > 0 && a.indexOf(n) === i).map(n => button(`Put in ${n} jade`, 'market-invest', `${m.id}|${n}`, {className: 'primary compact', disabled: game.jade < n})).join('')}</div></div>` : ''}
    <div class="stall-table-wrap"><table class="stall-table"><caption class="sr-only">Goods ${esc(m.name)} trades</caption>
      <thead><tr><th scope="col">Good</th><th scope="col">${esc(m.name.split(' ')[0])} pays</th><th scope="col">Charges</th><th scope="col">You have</th><th scope="col"><span class="sr-only">Trade</span></th></tr></thead>
      <tbody>${focus.map(id => goodsRow(game, world, m, id)).join('')}</tbody></table></div>
    <p class="microcopy">Hover, focus or tap a price to hear the merchant's reasons. Every price comes from <code>js/market/merchant-rules.js</code>.</p>
    ${status !== 'closed' ? `<div class="stall-patron"><div><b>Become a patron</b><small>Patrons own up to 49% together and share ${esc(m.name)}'s profit each market day.</small></div>
      ${button('Invest 25 jade', 'market-invest', `${m.id}|25`, {className: 'quiet compact', disabled: game.jade < 25})}${button('Invest 100 jade', 'market-invest', `${m.id}|100`, {className: 'quiet compact', disabled: game.jade < 100})}</div>` : ''}
  </section>`;
}

const LOG_ICON = {closed: 'lock', reopened: 'check', rekindle: 'heart', dividend: 'jade', shock: 'spark', edict: 'tower', event: 'compass'};
export function newsFeed(events, tickLabel = true, limit = 8) {
  const list = events.filter(e => e.type !== 'dividend' || e.actor === 'player').slice(-limit).reverse();
  if (!list.length) return '<p class="microcopy">The market is quiet.</p>';
  return `<ol class="market-news">${list.map(e => `<li class="news-${e.type}">${icon(LOG_ICON[e.type] ?? 'spark')}<span>${tickLabel ? `<small>Day ${Math.floor(e.tick / 24) + 1}, ${String(e.tick % 24).padStart(2, '0')}:00</small>` : ''}${esc(e.text)}</span></li>`).join('')}</ol>`;
}

export function merchantsTab(game, ui = {}) {
  const world = marketWorld(game), merchants = Object.values(world.merchants);
  const selected = world.merchants[ui.merchant] ?? merchants[0];
  return `<div class="market-layout"><nav class="merchant-list" aria-label="Merchants">${merchants.map(m => merchantCard(game, world, m, m.id === selected.id)).join('')}</nav>
    <div class="market-main">${stall(game, world, selected, ui)}</div>
    <aside class="market-side"><div class="eyebrow">Market whispers</div><p class="market-clock">Day ${Math.floor(world.tick / 24) + 1}, ${String(world.tick % 24).padStart(2, '0')}:00 · one market hour passes each minute</p>
      <p class="market-edict">${icon('tower')} The Pagoda Edict favours <b>${esc(schoolName[R.edictSchool(world.tick)])}</b> this week.</p>
      ${R.activeEvent(world.tick) ? `<p class="market-edict">${icon('compass')} ${esc(R.activeEvent(world.tick).text)}.</p>` : ''}
      ${newsFeed(world.log)}${button('Watch a week of the market', 'nav', 'market-sim', {className: 'quiet', icon: 'spark'})}</aside></div>`;
}

export function priceBoard(game) {
  const world = marketWorld(game);
  const rows = FAMILIES.map(family => `<tr><th scope="row"><span class="family-swatch" style="--swatch:${FAMILY_COLOR[family]}"></span>${esc(FAMILY_LABEL[family])}</th>${[1, 2, 3, 4, 5].map(tier => {
    const token = MARKET_TOKENS[`mat:${family}-${tier}`], {bid, ask} = bestPrices(game, token.id);
    if (!bid && !ask) return '<td class="board-none">—</td>';
    const tint = bid && bid.bid * R.BPS >= token.base * 9_500 ? 'dear' : bid && bid.bid * R.BPS <= token.base * 6_000 ? 'cheap' : '';
    return `<td class="${tint}"><button class="board-cell" data-action="market-merchant" data-id="${bid?.merchant ?? ask.merchant}|${token.id}" aria-label="${esc(token.name)}: best bid ${bid ? R.jade(bid.bid) : 'none'}, best ask ${ask ? R.jade(ask.ask) : 'none'}">
      <b>${bid ? R.jade(bid.bid) : '—'}</b><small>${ask ? R.jade(ask.ask) : '—'}</small><small class="board-who">${esc(world.merchants[bid?.merchant ?? ask.merchant].name)}</small></button></td>`;
  }).join('')}</tr>`).join('');
  return `<div class="price-board"><p class="microcopy">Best price anyone pays (top) and the cheapest asking price (below), by material and tier. Warm cells pay at or above the usual price; cool cells are flooded. Select a cell to visit that merchant.</p>
    <div class="stall-table-wrap"><table class="board-table"><thead><tr><th scope="col">Material</th>${[1, 2, 3, 4, 5].map(t => `<th scope="col">Tier ${t}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

/** "Sells best at …" for a commission's essence. */
export function bestBidHint(game, tokenId) {
  const {bid} = bestPrices(game, tokenId);
  if (!bid) return '';
  return `<p class="bounty-market">${icon('market')} Sells best at ${esc(marketWorld(game).merchants[bid.merchant].name)}: ${priceTip(bid.bid, bid.lines, 'Best bid')} jade each</p>`;
}

export function awayDialog(result) {
  const notable = result.events.filter(e => e.type !== 'dividend' || e.actor === 'player');
  return {title: 'While you were away', subtitle: `${result.hours} MARKET HOURS PASSED`, body: `<p class="dialog-lead">The market kept trading without you.${result.earned > 0 ? ` Your patron shares paid <b>${R.jade(result.earned)} jade</b>.` : ''}</p>
    ${newsFeed(notable, true, 10)}<div class="dialog-actions">${button('Visit the market', 'nav', 'market', {className: 'primary'})}${button('Close', 'close', '', {className: 'quiet'})}</div>`};
}

// ---------------------------------------------------------------------------------------------------------------
// Fast-forward page

/** Fit the axis to the data (always including the baseline), with a little headroom. */
function fitRange(series, baseline, floor = 0) {
  const all = series.flatMap(s => s.values).concat(baseline ?? []);
  const lo = Math.min(...all), hi = Math.max(...all), pad = Math.max((hi - lo) * 0.12, baseline ? baseline * 0.05 : 1);
  return [Math.max(floor, lo - pad), hi + pad];
}
function lineChart({series, frame, min, max, height = 190, baseline = null, marks = [], label}) {
  const width = 640, pad = 28, n = Math.max(2, series[0]?.values.length ?? 2);
  const x = i => pad + (width - pad * 2) * i / (n - 1), y = v => height - pad - (height - pad * 2) * (Math.min(max, Math.max(min, v)) - min) / (max - min);
  const path = values => values.slice(0, frame + 1).map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const days = Array.from({length: Math.floor(n / 24)}, (_, d) => `<line class="chart-day" x1="${x(d * 24)}" x2="${x(d * 24)}" y1="${pad}" y2="${height - pad}"/><text x="${x(d * 24) + 3}" y="${height - 9}">Day ${d + 1}</text>`).join('');
  return `<svg class="sim-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${days}
    ${baseline !== null ? `<line class="chart-base" x1="${pad}" x2="${width - pad}" y1="${y(baseline)}" y2="${y(baseline)}"/>` : ''}
    ${series.map(s => `<path d="${path(s.values)}" stroke="${s.color}" class="chart-line"/><circle cx="${x(Math.min(frame, n - 1))}" cy="${y(s.values[Math.min(frame, n - 1)])}" r="3" fill="${s.color}"/>`).join('')}
    ${marks.filter(m => m.i <= frame).map(m => `<text class="chart-mark ${m.kind}" x="${x(m.i)}" y="${y(m.v) - 6}" text-anchor="middle">${m.kind === 'closed' ? '✕' : '✓'}</text>`).join('')}
    <line class="chart-now" x1="${x(Math.min(frame, n - 1))}" x2="${x(Math.min(frame, n - 1))}" y1="${pad}" y2="${height - pad}"/></svg>`;
}
const rangeOf = (series, baseline) => { const [min, max] = fitRange(series, baseline); return {min, max}; };
const legend = (series, frame) => `<ul class="sim-legend">${series.map(s => `<li><i style="background:${s.color}"></i>${esc(s.label)} <b>${s.format(s.values[frame])}</b></li>`).join('')}</ul>`;

export function simStage(sim, ui) {
  const frame = Math.min(ui.simFrame ?? 0, sim.frames.length - 1), f = sim.frames[frame];
  const families = FAMILIES.map(fam => ({label: FAMILY_LABEL[fam], color: FAMILY_COLOR[fam], values: sim.frames.map(x => x.families[fam]), format: v => pct(v)}));
  const purses = Object.keys(f.cash).map(id => ({label: sim.world.merchants[id].name, color: MERCHANT_COLOR[id], format: v => R.jade(v),
    values: sim.frames.map(x => Math.round(x.cash[id] * 100 / sim.world.merchants[id].startCash))}));
  purses.forEach((p, i) => { const id = Object.keys(f.cash)[i]; p.format = v => R.jade(sim.frames[frame].cash[id]); });
  const marks = sim.events.filter(e => e.type === 'closed' || e.type === 'reopened').map(e => ({i: Math.min(e.tick, sim.frames.length - 1), kind: e.type,
    v: Math.round(sim.frames[Math.min(e.tick, sim.frames.length - 1)].cash[e.merchant] * 100 / sim.world.merchants[e.merchant].startCash)}));
  const events = sim.events.filter(e => e.tick <= f.tick && e.type !== 'dividend');
  const done = frame === sim.frames.length - 1, s = sim.summary;
  const table = ui.simTable ? `<div class="stall-table-wrap"><table class="board-table"><caption>Price index at the end of each day (100% = usual price)</caption><thead><tr><th scope="col">Day</th>${FAMILIES.map(fam => `<th scope="col">${FAMILY_LABEL[fam]}</th>`).join('')}</tr></thead><tbody>
    ${sim.frames.filter((_, i) => i % 24 === 23 && i <= frame).map(x => `<tr><th scope="row">${x.day}</th>${FAMILIES.map(fam => `<td>${pct(x.families[fam])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  return `<div class="sim-clock"><b>Day ${f.day}, ${String(f.hour).padStart(2, '0')}:00</b><span>Pagoda Edict: ${esc(schoolName[f.edict])}</span>${f.event ? `<span>${esc(R.EVENTS.list.find(e => e.id === f.event).text)}</span>` : ''}${f.closed.length ? `<span class="sim-closed">${icon('lock')} Shuttered: ${f.closed.map(id => esc(sim.world.merchants[id].name)).join(', ')}</span>` : ''}</div>
    <div class="sim-grid"><figure class="sim-figure"><figcaption>Material prices against their usual price</figcaption>${lineChart({series: families, frame, ...rangeOf(families, 10_000), baseline: 10_000, label: 'Price index by material family over the week'})}${legend(families, frame)}</figure>
      <figure class="sim-figure"><figcaption>Merchant purses, as a share of their usual purse (✕ shuttered, ✓ reopened)</figcaption>${lineChart({series: purses, frame, ...rangeOf(purses, 100), baseline: 100, marks, label: 'Merchant purses over the week'})}${legend(purses, frame)}</figure>
      <section class="sim-feed"><div class="eyebrow">What happened</div>${newsFeed(events, true, 12)}</section></div>${table}
    ${done ? `<div class="sim-summary"><div><b>${s.closures}</b><small>shops shuttered</small></div><div><b>${s.reopenings}</b><small>rekindled</small></div><div><b>${s.trades}</b><small>trades</small></div>
      <div><b>${FAMILY_LABEL[s.biggestFall.family]} ${pct(s.biggestFall.low)}</b><small>lowest price</small></div><div><b>${FAMILY_LABEL[s.biggestRise.family]} ${pct(s.biggestRise.high)}</b><small>highest price</small></div>
      <div><b>${(s.jadeGrowthPerDayBps / 100).toFixed(2)}%</b><small>jade supply per day</small></div></div>` : ''}`;
}

export function simPage(sim, ui = {}) {
  const p = sim.params, frame = Math.min(ui.simFrame ?? 0, sim.frames.length - 1);
  const toggle = (key, entry) => `<label class="sim-toggle"><input type="checkbox" data-sim-cast="${key}" ${p.cast[key] ? 'checked' : ''}><span><b>${esc(entry.label)}</b><small>${esc(entry.text)}</small></span></label>`;
  return `<section class="sim-screen"><header class="commerce-heading"><div><div class="eyebrow">FAST-FORWARD · A LABELLED SIMULATION</div><h1>A week of the market in a minute</h1>
      <p>The same rules and engine as the live market, played by simulated traders. Nothing here is sent anywhere. Seed ${p.seed}.</p></div>${button('Back to the market', 'nav', 'market', {className: 'quiet'})}</header>
    <div class="sim-scenarios" role="group" aria-label="Scenarios">${[['week', 'Run a week'], ['flood', 'Flood the market with Cinder'], ['audit', 'Ministry audit on day 3']].map(([id, label]) =>
      button(label, 'sim-scenario', id, {className: (ui.simScenario ?? 'week') === id ? 'primary' : '', icon: id === 'week' ? 'spark' : id === 'flood' ? 'burn' : 'lock', pressed: (ui.simScenario ?? 'week') === id})).join('')}</div>
    <div class="sim-controls">${button(ui.simPlaying ? 'Pause' : 'Play', 'sim-play', '', {icon: ui.simPlaying ? 'moon' : 'arrow'})}
      ${[1, 2, 4].map(n => button(n + '×', 'sim-speed', String(n), {className: 'compact ' + ((ui.simSpeed ?? 1) === n ? 'selected' : 'quiet'), pressed: (ui.simSpeed ?? 1) === n})).join('')}
      <label class="sim-scrub"><span class="sr-only">Market hour</span><input type="range" min="0" max="${sim.frames.length - 1}" value="${frame}" data-sim-scrub aria-label="Market hour"></label>
      ${button(ui.simTable ? 'Hide table' : 'Show table', 'sim-table', '', {className: 'quiet compact'})}</div>
    <div id="sim-stage" aria-live="off">${simStage(sim, ui)}</div>
    <details class="sim-cast"><summary>Cast and shocks</summary><div class="sim-cast-grid">
      <label class="sim-toggle"><span><b>Wandering cultivators</b><small>${esc(CAST.wanderer.text)}</small></span><select data-sim-wanderers aria-label="Wandering cultivators">${[0, 3, 6, 9, 12].map(n => `<option ${p.cast.wanderers === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${toggle('flooder', CAST.flooder)}${toggle('speculator', CAST.speculator)}${toggle('patron', CAST.patron)}${toggle('forgeMaster', CAST.forgeMaster)}</div>
      <div class="sim-shocks"><span>Inject a shock at the current hour:</span>${Object.entries(SHOCKS).map(([id, s]) => button(s.text.split(':')[0], 'sim-shock', id, {className: 'quiet compact'})).join('')}</div></details>
    <p class="microcopy">Commission win rates for simulated cultivators are assumptions, not measured from combat. Rules: <code>js/market/merchant-rules.js</code> · engine: <code>js/market/engine.js</code>.</p></section>`;
}

/** The sanctuary's third shrine button: the most notable price in the market right now. */
export function marketTeaser(game) {
  let note = 'Nine merchants, nine purses', best = 0;
  for (const family of FAMILIES) {
    const token = MARKET_TOKENS[`mat:${family}-1`], {bid} = bestPrices(game, token.id);
    if (!bid) continue;
    const swing = Math.abs(bid.bid * R.BPS / token.base - 8_700);
    if (swing > best && swing > 1_500) {
      best = swing;
      note = `${FAMILY_LABEL[family]} ${bid.bid * R.BPS / token.base > 8_700 ? 'dear' : 'cheap'} at ${marketWorld(game).merchants[bid.merchant].name}'s`;
    }
  }
  return `<button class="shrine-action shrine-market" data-action="nav" data-id="market">${picture('assets/art/sect-neutral.webp')}<span>${icon('market')} Night Bazaar <b>${esc(note)}</b></span></button>`;
}

/**
 * The calm front of the Night Bazaar (internal/14): what you can sell right now and to whom, what the week's Edict wants,
 * and one merchant worth a visit. The full stalls, price board and patronage are one tap away.
 */
export function quickTrade(game, ui = {}) {
  const world = marketWorld(game);
  const merchantName = id => world.merchants[id]?.name ?? id;
  const held = Object.keys(world.tokens).filter(id => owned(game, id) > 0)
    .map(id => ({id, have: owned(game, id), best: bestPrices(game, id).bid}))
    .filter(row => row.best)
    .sort((a, b) => b.best.bid * b.have - a.best.bid * a.have);
  const sellRows = held.slice(0, 8).map(({id, have, best}) => {
    const token = world.tokens[id], many = Math.min(have, 10);
    const manyOk = many > 1 && playerQuote(game, best.merchant, id, 'sell', many).ok;
    return `<li class="quick-row">${tokenIcon(token)}<span class="quick-name"><b>${esc(token.name)}</b><small>You have ${have}</small></span>
      <span class="quick-price"><small>${esc(merchantName(best.merchant))} pays</small>${priceTip(best.bid, best.lines, `${merchantName(best.merchant)} pays`, 'bid')}</span>
      <span class="quick-actions">${button('Sell 1', 'market-sell', `${best.merchant}|${id}|1`, {className: 'compact'})}${manyOk ? button(`Sell ${many}`, 'market-sell', `${best.merchant}|${id}|${many}`, {className: 'compact quiet'}) : ''}</span></li>`;
  }).join('');

  const school = R.edictSchool(world.tick);
  const wanted = Object.values(world.tokens).filter(t => t.school === school && (t.tier ?? 1) <= 2).slice(0, 4).map(token => {
    const {bid, ask} = bestPrices(game, token.id);
    if (!ask && !bid) return '';
    return `<li class="quick-row">${tokenIcon(token)}<span class="quick-name"><b>${esc(token.name)}</b><small>${ask ? `${esc(merchantName(ask.merchant))} sells` : 'Nobody is selling'}</small></span>
      <span class="quick-price">${ask ? priceTip(ask.ask, ask.lines, `${merchantName(ask.merchant)} charges`, 'ask') : ''}</span>
      <span class="quick-actions">${ask ? button('Buy 1', 'market-buy', `${ask.merchant}|${token.id}|1`, {className: 'compact', disabled: walletCents(game) < ask.ask}) : ''}</span></li>`;
  }).join('');

  const ids = Object.keys(world.merchants);
  const closed = ids.find(id => R.merchantStatus(world.merchants[id], world.markets[id]) === 'closed');
  const struggling = ids.find(id => R.merchantStatus(world.merchants[id], world.markets[id]) === 'struggling');
  const spotlight = closed ?? struggling ?? ids.reduce((a, b) => world.markets[b].cash / world.merchants[b].startCash > world.markets[a].cash / world.merchants[a].startCash ? b : a);
  const story = closed ? `${merchantName(closed)}'s shop has closed: the purse ran dry. Patrons can rekindle it and share in what it earns.`
    : struggling ? `${merchantName(struggling)} is short of jade and pays less than usual. Buying there helps the shop recover.`
    : `${merchantName(spotlight)} has the fullest purse in the bazaar today and can afford to pay for good goods.`;

  return `<div class="quick-trade">
    <section class="quick-panel quick-sell"><h2>Sell what you carry</h2>
      ${sellRows ? `<ul class="quick-list">${sellRows}</ul><p class="microcopy">Each price is the best offer in the bazaar right now. Hover or tap a price to hear why.</p>`
        : '<p class="microcopy">You carry nothing the merchants buy yet. Commissions in the Expeditions bring back essences and seals to sell.</p>'}</section>
    <section class="quick-panel quick-wanted"><h2>Wanted this week: ${esc(schoolName[school] ?? school)}</h2>
      <p class="microcopy">The Pagoda Edict favours ${esc(schoolName[school] ?? school)} techniques, so cultivators pay more for these goods.</p>
      ${wanted ? `<ul class="quick-list">${wanted}</ul>` : ''}</section>
    <section class="quick-panel quick-spotlight">${picture(portrait(spotlight), 'merchant-face')}<div><h2>${esc(merchantName(spotlight))}</h2><p>${esc(story)}</p>
      ${button(`Visit ${merchantName(spotlight)}`, 'market-merchant', spotlight, {className: 'quiet'})}</div></section>
    <div class="quick-more">${button('Open the full bazaar', 'tab', 'merchants', {icon: 'market'})}</div>
  </div>`;
}
