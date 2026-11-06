import {deckWorkspace, cardInspection} from './workshop-views.js';
import {bountyRewards,materialIcon} from './economy.js';
import {
  cards, items, missions, chapters, characters, schools, sects, recipes, cardById, itemById, missionById,
  chapterById, enemyById, schoolById, missionStatus, currentChapter, market, catalogue, price, maxHp, REALMS, SLOTS,
  MIN_DECK, MAX_DECK, DIFFICULTIES, bonuses,
} from './progression.js';
import { getCard, getIntent, previewEndTurn, describeEffect, techniqueRules, STATUS_INFO, RESONANCE_INFO } from './combat.js';
import { icon, esc, titleCase, button, tag, meter, effectText } from './ui.js';
import { portraits, regions, enemyArt, cardArt } from './art.js';
import { itemArt, itemIcon } from './item-art.js';

export const NAV = [
  ['home','home','Sanctuary'], ['campaign','compass','Expeditions'], ['deck','cards','Decks'],
  ['inventory','bag','Inventory'], ['forge','forge','Workshop'], ['market','market','Shop'],
  ['pets','spark','Spirit Pets'], ['trial','tower','Endless Pagoda'], ['codex','book','Chronicle'],
];

const art = (type, key) => `assets/art/${type}-${key}.webp`;
const scene = stem => new URL(`../assets/art/${stem}.webp`, import.meta.url).href;
const category = value => titleCase(value);
const format = value => new Intl.NumberFormat().format(value);
const amount = (name, value, color = '') => `<span class="amount ${color}">${icon(name)}<b>${format(value)}</b></span>`;
const primary = (label, action, id = '', disabled = false) => button(label, action, id, {className:'primary', icon:'arrow', disabled});
const section = (eyebrow, title, description, right = '', artwork = '') => `
  <header class="page-heading${artwork ? ' illustrated-heading' : ''}"${artwork ? ` style="--heading-art:url('${esc(scene(artwork))}')"` : ''}><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>
  ${description ? `<p>${esc(description)}</p>` : ''}</div>${right}</header>`;
const empty = (title, detail) => `<div class="empty"><span>${icon('moon')}</span><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
const img = (src, className = '', loading = 'lazy') => `<img class="${className}" src="${esc(src)}" alt="" loading="${loading}" decoding="async">`;
const school = id => schoolById[id]?.name || titleCase(id || 'neutral');
const rarity = id => `rarity-${esc(String(id || 'common').toLowerCase().replace(/[^a-z0-9-]/g, ''))}`;
const cardDesc = card => techniqueRules(card).join(' ');
const bonusLabels = {maxHp:'Vitality', block:'opening Guard', heal:'opening healing', draw:'draw each turn', energy:'Qi each turn'};
const signed = number => (number >= 0 ? '+' : '') + number;
const itemBonus = item => Object.entries(item.bonuses || {}).flatMap(([stat, n]) => stat === 'school' ?
  Object.entries(n).map(([id,modifiers]) => school(id) + ' ' + Object.entries(modifiers)
    .map(([key,amount]) => `${signed(amount)} ${key === 'block' ? 'Guard' : key}`).join(', ')) :
  `${signed(n)} ${bonusLabels[stat] || titleCase(stat)}`).join(' · ');

export function shell(game, page, mobileOpen) {
  const nav = page === 'battle' ? `<div class="nav-locked">${icon('lock')} Expedition in progress</div>` : NAV.map(([id,glyph,name]) => `
    <button class="nav-item ${page === id ? 'selected' : ''}" data-action="nav" data-id="${id}" ${page === id ? 'aria-current="page"' : ''}>
      ${icon(glyph)} <span>${name}</span>${page === id ? '<i></i>' : ''}</button>`).join('');
  return `
    <aside class="sidebar ${mobileOpen ? 'is-open' : ''}" aria-label="Game navigation" id="game-nav">
      <button class="brand" data-action="nav" data-id="home" ${page === 'battle' ? 'disabled' : ''}><span class="brand-icon">${icon('crest')}</span>
      <span>ASHES <small>OF THE NINTH HEAVEN</small></span></button>
      <div class="sidebar-rule"></div>
      <nav><div class="nav-caption">THE WAYFARER</div>${nav}</nav>
      <div class="sidebar-foot"><div class="sidebar-rule"></div>
        <button class="nav-item" data-action="help">${icon('book')}<span>Field guide</span></button>
        <div class="edition"><i></i> CHRONICLE I <span>1.0</span></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <button class="icon-btn mobile-menu" data-action="menu" aria-label="Toggle navigation" aria-controls="game-nav" aria-expanded="${mobileOpen}">${icon('menu')}</button>
        <div class="crumb"><span>THE FALLEN REALM</span><i></i>${esc(page === 'battle' ? 'Encounter' : NAV.find(entry => entry[0] === page)?.[2])}</div>
        <div class="top-stats">
          <span class="health" title="Vitality">${icon('heart')} <b>${game.active?.combat?.player.hp ?? game.hp}</b><span> / ${maxHp(game)}</span></span>
          <span title="Jade">${amount('jade', game.jade, 'gold')}</span>
          <span title="Essence">${amount('essence', game.essence, 'purple')}</span>
        </div>
        <div class="top-actions"><button class="icon-btn" data-action="sound" aria-label="${game.sound ? 'Mute' : 'Enable sound effects'}" aria-pressed="${game.sound}">${icon(game.sound ? 'sound' : 'mute')}</button>
        <button class="icon-btn" data-action="settings" aria-label="Settings">${icon('gear')}</button></div>
      </header>
      <main id="screen" tabindex="-1"></main>
    </div>`;
}

function rewardIcons(rewards) {
  if (!rewards) return '';
  return `<span class="reward-icons">
    ${rewards.gold ? `<span class="reward-currency">${icon('jade')}${rewards.gold}</span>` : ''}
    ${rewards.essence ? `<span class="reward-currency">${icon('essence')}${rewards.essence}</span>` : ''}
    ${(rewards.items || []).map(id => {
      const item = itemById[id];
      return item ? `<span class="reward-icon" title="${esc(item.name)}">${img(itemIcon(item))}<span class="sr-only">${esc(item.name)}</span></span>` : '';
    }).join('')}
    ${(rewards.cards || []).map(id => {
      const card = cardById[id];
      return card ? `<span class="reward-icon skill-icon" title="${esc(card.name)}">${img(cardArt(card))}<span class="sr-only">${esc(card.name)}</span></span>` : '';
    }).join('')}
  </span>`;
}

function missionTile(game, mission) {
  const status = missionStatus(game, mission);
  const glyph = status === 'Sealed' ? 'lock' : status === 'Complete' ? 'check' : mission.enemy ? 'sword' : 'compass';
  return `<button class="mission-row ${status.toLowerCase()}" data-action="mission" data-id="${esc(mission.id)}">
    <span class="row-glyph">${icon(glyph)}</span><span class="mission-label"><b>${esc(mission.name)}</b>
    <small>${esc(mission.location || chapterById[mission.chapter]?.region || 'The Fallen Realm')} · ${esc(mission.type || 'Expedition')}</small></span>
    <span class="mission-state">${status}</span>${icon('arrow')}</button>`;
}

function profile(game) {
  const next = REALMS[game.realm + 1];
  const slots = SLOTS.filter(slot => game.equipped[slot]).length;
  return `<aside class="profile-panel panel">
    <div class="profile-art">${img(art('portrait','shen-luo'), '', 'eager')}<div class="profile-veil"></div>
    <span class="profile-sigil">${icon('crest')}</span></div>
    <div class="profile-body"><div class="eyebrow">THE DISCIPLE</div><h2>${esc(game.name)}</h2>
      <div class="realm">${icon('spark')} ${esc(REALMS[game.realm].name)} <span>REALM ${String(game.realm + 1).padStart(2,'0')}</span></div>
      ${next ? `<div class="profile-progress"><div><span>Essence to breakthrough</span><b>${game.essence} / ${next.essence}</b></div>
        ${meter(game.essence,next.essence,'purple','Essence to breakthrough')}</div>` : '<p>Final realm attained.</p>'}
      <div class="profile-counts"><span><b>${game.deck.length}</b> Techniques</span><span><b>${slots}/${SLOTS.length}</b> Equipped</span></div>
      ${next ? button(`Breakthrough · ${next.jade} jade`,'breakthrough','',{icon:'spark',disabled:!game.started || game.essence < next.essence || game.jade < next.jade}) : ''}
    </div></aside>`;
}

export function home(game) {
  const chapter = currentChapter(game);
  const active = missions.filter(m => m.chapter === chapter.id && missionStatus(game,m) === 'Available');
  const done = Object.keys(game.complete).length;
  const finished = game.complete['ashes-of-the-ninth-heaven'];
  return `<div class="home-intro"><div><span class="eyebrow"><i></i> THE FALLEN REALM</span><h1>Sanctuary</h1>
    <p>A refuge between expeditions.</p></div><span class="live-label"><i></i> ${finished ? 'THE FIRST UNTAXED DAWN' : game.started ? DIFFICULTIES[game.difficulty]?.name || 'CHRONICLE ACTIVE' : 'AWAITING AN OATH'}</span></div>
    <div class="home-grid"><div class="home-main">
      <section class="hero">
        <div class="hero-copy"><div class="hero-kicker"><span></span> A CULTIVATION CHRONICLE</div>
          <h2>Ashes of the<br><em>Ninth Heaven</em></h2>
          <p>The heavens burned. The dead still pay tribute. Take up the blade and find what answers from beyond the veil.</p>
          ${finished ? primary('Read your chronicle','nav','codex') : game.started ? primary('Continue the chronicle','nav','campaign') : primary('Begin your journey','begin')}
          <div class="hero-note"><i></i> SINGLE-PLAYER DECKBUILDING RPG</div>
        </div><span class="hero-index">九 天 灰 燼</span>
      </section>
      <section class="panel home-missions"><div class="panel-head"><div><div class="eyebrow">CHAPTER ${String(chapters.indexOf(chapter) + 1).padStart(2,'0')}</div><h2>${esc(chapter.name)}</h2></div>
      ${button('View expeditions','nav','campaign',{icon:'compass',className:'quiet'})}</div>
      ${active.length ? active.slice(0,3).map(m => missionTile(game,m)).join('') : empty('The road is quiet', 'The known expeditions have been resolved.')}
      </section>
    </div><div class="home-aside">${profile(game)}
      <section class="panel refuge"><div class="eyebrow">THE STILL POINT</div><h2>Ember Shrine</h2><p>Rest by the shrine to recover your vitality between battles.</p>
      ${button('Rest at shrine','rest','',{icon:'moon',disabled:game.hp >= maxHp(game)})}</section>
    </div></div>
    <div class="home-foot"><span>${icon('compass')} ${done} / ${missions.length} expeditions recorded</span><span>The dead remember their names.</span></div>`;
}

export function campaign(game, ui) {
  const current = currentChapter(game);
  const chapter = chapterById[ui.chapter] || current;
  const list = missions.filter(m => m.chapter === chapter.id);
  const artKey = regions[chapter.id];
  const chapterImage = scene(artKey || 'ninth-heaven');
  return section('CAMPAIGN', 'Expeditions', 'Follow the trail of the heavenly fracture across the Fallen Realm.',
    button('Return to sanctuary','nav','home',{icon:'home',className:'quiet'})) +
    `<div class="campaign-grid"><div class="panel chapter-rail"><div class="eyebrow">CHRONICLE I</div>
    ${chapters.map((entry,i) => {
      const unlocked = missions.some(m => m.chapter === entry.id && missionStatus(game,m) !== 'Sealed');
      return `<button class="chapter-btn ${chapter.id === entry.id ? 'selected' : ''}" data-action="chapter" data-id="${esc(entry.id)}" aria-pressed="${chapter.id === entry.id}">
        <span class="chapter-no">${String(i + 1).padStart(2,'0')}</span><span><b>${esc(entry.name)}</b><small>${esc(entry.region || 'Fallen Realm')}</small></span>
        ${icon(unlocked ? 'arrow' : 'lock')}</button>`;
    }).join('')}</div><div>
      <div class="chapter-banner" style="--chapter-art:url('${esc(chapterImage)}')"><div class="eyebrow">${esc(chapter.region || 'THE FALLEN REALM')}</div>
      <h2>${esc(chapter.name)}</h2><p>${esc(chapter.opening || chapter.description || chapter.summary)}</p></div>
      <section class="panel missions"><div class="panel-head"><div><div class="eyebrow">THE ROAD AHEAD</div><h2>Mission ledger</h2></div>${tag(`${list.filter(m => game.complete[m.id]).length} / ${list.length} complete`)}</div>
      ${list.map(m => missionTile(game,m)).join('') || empty('Sealed roads','No expeditions are recorded in this region.')}</section>
      ${list.length && list.every(m => game.complete[m.id]) && chapter.closing ? `<div class="panel closing"><div class="eyebrow">CHAPTER EPILOGUE</div><p>${esc(chapter.closing)}</p></div>` : ''}
    </div></div>`;
}

export function missionDetails(game, id) {
  const mission = missionById[id];
  if (!mission) return null;
  const status = missionStatus(game, mission);
  const opponent = enemyById[mission.enemy];
  const need = (mission.requires || []).filter(key => !game.complete[key]);
  const chosen = mission.choices?.find(choice => choice.id === game.complete[id]?.choice);
  return {title:mission.name, subtitle:`${mission.location || chapterById[mission.chapter]?.name || ''} · ${mission.type || 'Expedition'}`, body:`
    <p class="dialog-lead">${esc(mission.story || mission.description)}</p>
    ${status === 'Complete' ? `<div class="inset">${icon('check')} <span>${esc(chosen?.epilogue || chosen?.text || mission.victory || 'This expedition is recorded in your chronicle.')}</span></div>` : ''}
    ${opponent && status !== 'Sealed' ? `<div class="inset">${icon('sword')} <span>Opponent <b>${esc(opponent.name)}</b></span></div>` : ''}
    ${need.length ? `<div class="inset">${icon('lock')} <span>Requires ${need.map(key => esc(missionById[key]?.name)).join(', ')}</span></div>` : ''}
    ${rewardIcons(mission.rewards)}
    <div class="dialog-actions">${status === 'Available' ? primary(game.started ? 'Enter expedition' : 'Swear your oath', game.started ? 'encounter' : 'begin', id) : button('Close','close')}</div>`};
}

function filterBox(label, values, current, name, labelOf = category) {
  return `<label class="filter"><span>${esc(label)}</span><select data-filter="${name}"><option value="">All ${esc(label.toLowerCase())}</option>
    ${values.map(id => `<option value="${esc(id)}" ${current === id ? 'selected' : ''}>${esc(labelOf(id))}</option>`).join('')}</select></label>`;
}

function searchBox(query) {
  return `<form class="search-form" data-form="search"><label class="filter"><span>Search</span><input type="search" name="query" value="${esc(query || '')}" placeholder="Search by name…" maxlength="60"></label><button class="btn compact" type="submit">Find</button></form>`;
}

const matches = (entry, query) => !query || [entry.name,entry.description,entry.role,entry.type,entry.condition,entry.flavor].some(value => String(value || '').toLowerCase().includes(query.toLowerCase()));

export function deck(game, ui) {
  return deckWorkspace(game,ui);
}

function tab(label, id, selected) {
  return `<button type="button" class="tab ${selected ? 'selected' : ''}" aria-pressed="${selected}" data-action="tab" data-id="${id}">${esc(label)}</button>`;
}

export function cardDetails(game,id) {
  return cardInspection(game,id);
}

function itemTile(item, game, mode) {
  const owned = game.bag[item.id] || 0;
  const equipped = Object.values(game.equipped).includes(item.id);
  const detail = item.card ? 'Teaches ' + cardById[item.card]?.name : itemBonus(item) || (item.effects || []).map(effectText).join(' · ') || item.description;
  return `<article class="item-tile panel school-${esc(item.school || 'neutral')}">
    <button class="item-art" data-action="item-details" data-id="${esc(item.id)}" aria-label="Details for ${esc(item.name)}" title="${esc(item.name)} · ${esc(detail)}">${img(itemIcon(item))}</button>
    <div class="item-body"><div class="card-rare ${rarity(item.rarity)}">${esc(category(item.rarity || 'common'))}</div>
      <h3>${esc(item.name)}</h3><p class="item-tooltip">${esc(detail)}</p>
      <div class="item-actions">
      ${['buy','order'].includes(mode) ? `${amount('jade',price(item,game),'gold')}${button(mode === 'order' ? 'Order' : 'Buy',mode,item.id,{className:'compact',disabled:game.jade < price(item,game)})}` :
        mode === 'sell' ? `${tag(`Owned ×${owned}`)}${button(`Sell · ${Math.max(1,Math.floor(price(item)/2))}`,'sell',item.id,{className:'compact',disabled:owned <= Number(equipped)})}` :
        mode === 'archive' ? tag(owned ? `Owned ×${owned}` : 'Undiscovered') :
        `${tag(equipped ? 'Equipped' : `Owned ×${owned}`)}${item.card ? button('Study','study',item.id,{className:'compact'}) : SLOTS.includes(item.slot || item.type) ? button(equipped ? 'Unequip' : 'Equip','equip',item.id,{className:'compact'}) : ''}`}
      </div></div></article>`;
}

const itemTypes = [...new Set(items.map(item => item.type))];

export function inventory(game,ui) {
  const archive = ui.tab === 'archive';
  const list = items.filter(item => (archive || game.bag[item.id]) && (!ui.filter || ui.filter === item.type) && matches(item,ui.query));
  return section('THE DISCIPLE','Inventory','Equip heirlooms, carry remedies, and catalogue the relics of the Fallen Realm.') +
    `<div class="loadout">${SLOTS.map(slot => {
      const item = itemById[game.equipped[slot]];
      return `<button class="loadout-slot panel" data-action="${item ? 'item-details' : 'tab'}" data-id="${item?.id || 'bag'}">
        <span class="loadout-icon">${img(item ? itemIcon(item) : art('relic',slot))}</span><span><span class="eyebrow">${category(slot)}</span><b>${esc(item?.name || 'Empty')}</b></span></button>`;
    }).join('')}</div>
    <div class="toolbar"><div class="tabs">${tab('Satchel','bag',!archive)}${tab('Item archive','archive',archive)}</div>
    <div class="filters">${filterBox('Types',itemTypes,ui.filter,'category')}${searchBox(ui.query)}</div></div>
    <div class="item-grid">${list.map(item => itemTile(item,game,archive ? 'archive' : 'bag')).join('')}</div>
    ${list.length ? '' : empty('Nothing in this view','Expeditions, the Night Market, and the forge can fill your satchel.')}`;
}

export function itemDetails(game,id) {
  const item = itemById[id];
  if (!item) return null;
  const recipe = recipes.find(entry => entry.item === id);
  return {title:item.name, subtitle:`${category(item.rarity || 'common')} · ${category(item.type)}`, body:`
    <div class="detail-art item-detail-art">${img(itemArt(item))}</div><p class="dialog-lead">${esc(item.description)}</p>
    ${itemBonus(item) ? `<p class="reward">${esc(itemBonus(item))}</p>` : ''}
    ${item.card ? `<div class="manual-technique"><span class="reward-icon skill-icon">${img(cardArt(cardById[item.card]))}</span><p>Teaches ${esc(cardById[item.card]?.name)}. Studying consumes the manual.</p></div>` : ''}
    ${(item.effects || []).length ? `<ul class="detail-effects">${item.effects.map(effect => `<li>${esc(effectText(effect))}</li>`).join('')}</ul>` : ''}
    <p class="microcopy">Owned ${game.bag[id] || 0} · Value ${price(item)} jade${recipe ? ' · Forge recipe available' : ''}</p>`};
}

export function nightMarket(game,ui) {
  const selling = ui.tab === 'sell';
  const ordering = ui.tab === 'order';
  const list = (selling ? items.filter(item => game.bag[item.id]) : ordering ? catalogue(game) : market(game))
    .filter(item => (!ui.filter || ui.filter === item.type) && matches(item,ui.query));
  return section('TRADE', 'Night Market', 'Shop rotating stalls or order from the catalogue. Sect standing reduces the cost of associated goods.',
    `<div class="heading-stat">${amount('jade',game.jade,'gold')} jade</div>`, 'sect-neutral') +
    `<div class="toolbar"><div class="tabs">${tab('Stall stock','buy',!selling && !ordering)}${tab('Catalogue','order',ordering)}${tab('Sell','sell',selling)}</div>
    <div class="filters">${filterBox('Types',itemTypes,ui.filter,'category')}${searchBox(ui.query)}</div></div>
    <div class="item-grid">${list.map(item => itemTile(item,game,selling ? 'sell' : ordering ? 'order' : 'buy')).join('')}</div>
    ${list.length ? '' : empty('The stalls are quiet','There are no items matching these filters.')}`;
}

export function forge(game,ui) {
  const list = recipes.filter(recipe => itemById[recipe.item] && (!ui.filter || itemById[recipe.item].type === ui.filter) && matches(itemById[recipe.item],ui.query));
  return section('CRAFT', 'Alchemy & Forge', 'Smelt materials into arms and talismans, or distill remedies for the road.',
    `<div class="heading-stat">${amount('jade',game.jade,'gold')} jade</div>`, 'sect-cinder-house') +
    `<div class="toolbar"><div class="eyebrow">${list.length} RECIPES</div><div class="filters">${filterBox('Types', [...new Set(recipes.map(recipe => itemById[recipe.item]?.type).filter(Boolean))],ui.filter,'category')}${searchBox(ui.query)}</div></div>
    <div class="recipe-grid">${list.map(recipe => {
      const item = itemById[recipe.item];
      const costs = Object.entries(recipe.materials);
      const affordable = game.jade >= recipe.gold && costs.every(([id,n]) => (game.bag[id] || 0) >= n);
      return `<article class="panel recipe"><button class="item-art" data-action="item-details" data-id="${esc(item.id)}" aria-label="Details for ${esc(item.name)}" title="${esc(item.name)}">${img(itemIcon(item))}</button><div class="recipe-body">
        <div class="eyebrow">${esc(category(item.type))}</div><h3>${esc(item.name)}</h3><p>${esc(itemBonus(item) || item.description)}</p>
        <ul class="recipe-materials">${costs.map(([id,n]) => `<li class="${(game.bag[id] || 0) >= n ? 'ready' : ''}" title="${esc(itemById[id]?.name)}" aria-label="${esc(itemById[id]?.name)} ${game.bag[id] || 0} of ${n}">
        ${img(itemIcon(itemById[id]))}<b>${game.bag[id] || 0} / ${n}</b></li>`).join('')}</ul>
        ${button(`Craft · ${recipe.gold} jade`,'craft',item.id,{icon:'forge',disabled:!affordable})}</div></article>`;
    }).join('')}</div>${list.length ? '' : empty('No recipes found','Try another item type or search term.')}`;
}

export function trial(game) {
  return section('TRIBULATION', 'Endless Pagoda', 'A shifting tower built around the echo of an unanswered prayer.') +
    `<div class="trial-hero"><div class="eyebrow">THE STAIRS REMEMBER</div><h2>Climb through the ash.</h2><p>Face the realm’s foes in succession. New floor records award jade and essence. Defeat or withdrawal sends you back to the ground.</p>
    <div class="trial-stats"><span><b>${game.trial.floor}</b> Current floor</span><span><b>${game.trial.best}</b> Highest floor</span></div>
    ${primary(game.victories ? `Enter floor ${game.trial.floor + 1}` : 'Win a campaign battle to unlock', 'trial', '', !game.victories)}</div>`;
}

export function codex(game,ui) {
  const selected = ui.tab || 'journal';
  let body;
  if (selected === 'people') {
    const list = characters.filter(entry => (!ui.filter || entry.sect === ui.filter) && matches(entry,ui.query));
    body = `<div class="toolbar"><div class="eyebrow">${list.length} ENTRIES</div><div class="filters">${filterBox('Sects',sects.map(entry => entry.id),ui.filter,'category',id => sects.find(entry => entry.id === id)?.name || category(id))}${searchBox(ui.query)}</div></div>
    <div class="character-grid">${list.map(entry => `<button class="panel character" data-action="character" data-id="${esc(entry.id)}">
      <div class="character-art">${portraits.has(entry.id) ? img(art('portrait',entry.id)) : `<span>${icon('crest')}</span>`}</div>
      <div><div class="eyebrow">${esc(entry.role || 'Wanderer')}</div><h3>${esc(entry.name)}</h3></div></button>`).join('')}</div>
    ${list.length ? '' : empty('No records found','Try a different sect or search term.')}`;
  } else if (selected === 'sects') {
    body = `<div class="sect-grid">${sects.map(entry => `<article class="panel sect">${img(art('sect',entry.id))}
      <h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p>${tag(`${game.reputation[entry.id] || 0} standing`)}
      ${(game.reputation[entry.id] || 0) >= 2 ? tag(`${Math.min(15,Math.floor(game.reputation[entry.id] / 2) * 5)}% market discount`) : ''}</article>`).join('')}</div>`;
  } else if (selected === 'schools') {
    body = `<div class="sect-grid">${schools.map(entry => `<article class="panel sect school-panel">${img(art('school',entry.id))}
      <h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p>
      ${RESONANCE_INFO[entry.id] ? `<p class="microcopy">${esc(RESONANCE_INFO[entry.id].description)}</p>` : ''}</article>`).join('')}</div>`;
  } else {
    body = game.journal.length ? `<ol class="journal">${game.journal.map(entry => `<li class="panel"><span class="row-glyph">${icon('book')}</span>
      <div><h3>${esc(entry.title)}</h3><p>${esc(entry.detail)}</p></div></li>`).join('')}</ol>` :
      empty('Your page is blank', 'Swear an oath at the sanctuary and your choices will begin to appear here.');
  }
  return section('WORLD ARCHIVE','Chronicle','Read your story alongside the people, sects, and fighting schools of the Fallen Realm.') +
    `<div class="toolbar"><div class="tabs">${[['Journal','journal'],['People','people'],['Sects','sects'],['Schools','schools']].map(([label,id]) => tab(label,id,selected === id)).join('')}</div></div>${body}`;
}

export function characterDetails(entry) {
  return {title:entry.name, subtitle:entry.role, body:`
    ${portraits.has(entry.id) ? `<div class="detail-art character-detail-art">${img(art('portrait',entry.id))}</div>` : ''}
    <p class="dialog-lead">${esc(entry.description)}</p>${entry.quote ? `<blockquote>${esc(entry.quote)}</blockquote>` : ''}
    ${entry.sect ? tag(sects.find(sect => sect.id === entry.sect)?.name || category(entry.sect)) : ''}`};
}

function battleCard(combat, handIndex) {
  const card = getCard(combat,handIndex);
  const cost = card.cost;
  return `<button class="battle-card school-${esc(card.school || 'neutral')}" data-action="play" data-id="${handIndex}" ${combat.outcome || cost > combat.energy ? 'disabled' : ''}>
    <span class="battle-card-art">${img(cardArt(card), '', 'eager')}<span class="cost">${cost}</span></span>
    <span class="battle-card-body"><span class="card-rare">${esc(school(card.school))}</span>
    <b>${esc(card.name)}${card.upgrade ? ` +${card.upgrade}` : ''}</b><span>${esc(cardDesc(card))}</span>${card.exhaust ? '<small>Exhaust</small>' : ''}</span></button>`;
}

function statuses(entity) {
  const list = Object.entries(entity.statuses || {}).filter(([,value]) => value > 0);
  return `<div class="statuses">${list.map(([id,value]) => `<span class="tag" title="${esc(STATUS_INFO[id]?.description || '')}">${esc(STATUS_INFO[id]?.name || category(id))} ${value}</span>`).join('')}</div>`;
}

function fighter(entity, portrait, isEnemy) {
  return `<div class="fighter ${isEnemy ? 'opponent' : 'disciple'}"><div class="fighter-portrait">
    ${portrait ? img(art('portrait',portrait),'','eager') : `<span>${icon(isEnemy ? 'sword' : 'crest')}</span>`}
    ${entity.block ? `<span class="guard" title="Guard">${icon('shield')} ${entity.block}</span>` : ''}</div>
    <div class="fighter-stats"><h3>${esc(entity.name)}</h3><div class="vitality"><span>Vitality</span><b>${entity.hp} / ${entity.maxHp}</b></div>
      ${meter(entity.hp,entity.maxHp,isEnemy ? 'red' : 'green',entity.name + ' vitality')}${statuses(entity)}</div></div>`;
}

function lastAction(feedback) {
  return `<div class="action-feedback">${feedback ?
    `<b>${esc(feedback.title)}</b>${feedback.details.length ? `<span>${feedback.details.map(esc).join(' / ')}</span>` : ''}` :
    '<span>Play a technique or end your turn.</span>'}</div>`;
}

export function battle(game, ui = {}) {
  const active = game.active;
  const combat = active.combat;
  const mission = active.kind === 'mission' ? missionById[active.id] : null;
  const label = mission?.name || (active.kind==='bounty'?`${school(active.school)} material commission · Tier ${active.tier}`:`Pagoda floor ${active.floor}`);
  const context = mission?.location || (mission ? chapterById[mission.chapter]?.region : active.kind==='bounty'?'SECT COMMISSION':'Endless Pagoda');
  if (!combat || combat.outcome && !ui.finishing) {
    const defeat = combat?.outcome === 'defeat';
    return `<div class="outcome panel ${defeat ? 'outcome-defeat' : 'outcome-arrive'}"><span class="outcome-icon">${icon(defeat ? 'moon' : combat ? 'sword' : 'compass')}</span>
      <div class="eyebrow">${defeat ? 'DEFEAT' : combat ? 'VICTORY' : 'EXPEDITION'}</div>
      <h1>${esc(defeat ? 'Returned through ash' : label)}</h1>
      <p class="outcome-story">${esc(defeat ? 'The sanctuary calls your spirit back. Recover your vitality and return when you are ready.' :
        combat ? mission?.victory || `${combat.enemy.name} falls. The way ahead lies open.` : mission.story || mission.description)}</p>
      ${ui.feedback ? lastAction(ui.feedback) : ''}
      ${!defeat ? rewardIcons(mission?.rewards) : ''}
      ${!defeat && active.kind==='bounty'?`<div class="commission-rewards">${Object.entries(bountyRewards(active.school,active.tier).materials).map(([id,n])=>`<span>${materialIcon(id)} +${n}</span>`).join('')}<span>${icon('jade')} +${bountyRewards(active.school,active.tier).gold} jade</span><span>${icon('essence')} +${bountyRewards(active.school,active.tier).essence} essence</span></div>`:''}
      ${!defeat && mission?.choices?.length ? `<div class="choices">${mission.choices.map(choice => `
        <button class="choice" data-action="resolve" data-id="${esc(choice.id)}"><b>${esc(choice.label)}</b><span>${esc(choice.text)}</span>
        ${rewardIcons(choice.rewards)}${icon('arrow')}</button>`).join('')}</div>` :
        `<div class="dialog-actions">${primary(defeat ? 'Return to sanctuary' : combat ? 'Claim rewards' : 'Record expedition','resolve')}</div>`}
    </div>`;
  }
  const intent = getIntent(combat);
  const forecast = previewEndTurn(combat);
  const supplies = items.filter(item => ['pill','talisman'].includes(item.type) && game.bag[item.id] && item.effects?.length);
  const portrait = enemyArt[combat.enemy.id] || (portraits.has(combat.enemy.id) ? combat.enemy.id : '');
  const region = mission?.chapter === 'ashen-prefecture' ? 'ash-pass' : mission && regions[mission.chapter];
  return `<div class="battle-head"><div><div class="eyebrow">${esc(context || 'ENCOUNTER')} · ROUND ${combat.turn}</div><h1>${esc(label)}</h1></div>
    ${button('Withdraw','withdraw','',{className:'quiet',disabled:Boolean(combat.outcome)})}</div>
    <div class="arena" style="--arena-art:url('${esc(scene(region || 'ash-pass'))}')">
      ${fighter({...combat.player,name:game.name},'shen-luo',false)}
      <div class="arena-center"><div class="versus">VS</div><div class="intent">${icon('sword')}<span>ENEMY INTENT</span>
      <b>${esc(intent?.name || (combat.outcome === 'victory' ? 'Victory' : 'Defeat'))}</b><small>${esc(intent?.effects?.map(describeEffect).join(' · '))}</small>
      ${combat.enemy.phaseName ? `<em>${esc(combat.enemy.phaseName)}${combat.enemy.sealPhases && combat.enemyMove === 0 ? ' · Seal active' : ''}</em>` : ''}
      ${forecast ? `<small class="forecast">${forecast.outcome === 'victory' ? 'End turn to win' : forecast.outcome === 'defeat' ? 'End turn: lethal' :
        forecast.hpChange ? `End turn: ${forecast.hpChange > 0 ? '+' : '−'}${Math.abs(forecast.hpChange)} vitality` : 'End turn: vitality holds'}</small>` : ''}</div></div>
      ${fighter(combat.enemy,portrait,true)}
    </div>
    <div class="battle-toolbar"><div class="qi"><span>${icon('essence')} ${combat.energy} / ${combat.maxEnergy}</span><small>QI</small></div>
    <div class="piles"><span>Draw <b>${combat.drawPile.length}</b></span><span>Discard <b>${combat.discard.length}</b></span><span>Exhaust <b>${combat.exhausted.length}</b></span></div>
    <div class="resonance"><small>RESONANCE</small><b>${combat.resonance.element ? esc(school(combat.resonance.element)) : '—'} ${combat.resonance.count ? `${combat.resonance.count}/3` : ''}</b></div>
    ${primary('End turn','end','',Boolean(combat.outcome))}</div>
    ${lastAction(ui.feedback)}
    <div class="hand" aria-label="Your hand">${combat.hand.map((_,i) => battleCard(combat,i)).join('') || '<p>No techniques remain in hand.</p>'}</div>
    <div class="battle-bottom"><section class="panel battle-log"><div class="eyebrow">BATTLE RECORD</div>
      <ol aria-live="polite">${combat.log.slice(-7).reverse().map(entry => `<li>${esc(entry)}</li>`).join('')}</ol></section>
      <section class="panel battle-supply"><div class="eyebrow">SUPPLIES</div>${supplies.length ?
        supplies.map(item => `<button class="btn compact" data-action="use" data-id="${esc(item.id)}" title="${esc(item.effects.map(effectText).join(' · '))}" ${combat.outcome ? 'disabled' : ''}>${esc(item.name)} ×${game.bag[item.id]}</button>`).join('') :
        '<p class="microcopy">No remedies or talismans in the satchel.</p>'}</section></div>`;
}
