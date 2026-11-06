import * as rules from './progression.js';
import * as views from './views.js';
import { getCard, getIntent, previewEndTurn, describeEffect, techniqueRules } from './combat.js';
import { cardArt, regions, enemyArt } from './art.js';
import { itemIcon } from './item-art.js';
import { effectBadges, statusBadges, mechanicBadges } from './game-symbols.js';
import { frameClasses, frameCrest, typeSeal } from './card-frame.js';
import { icon, esc, button, meter } from './ui.js';
import {battlePetPanel} from './pet-views.js';

const picture = (src, className = '', eager = false) =>
  `<img src="${esc(src)}" class="${className}" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
const art = stem => `assets/art/${stem}.webp`;
const scene = stem => new URL(`../assets/art/${stem}.webp`, import.meta.url).href;
const navArt = {
  home:'region-rest',campaign:'region-ashen-prefecture',deck:'card-palm-strike',inventory:'relic-relic',
  forge:'sect-cinder-house',market:'sect-neutral',pets:'pet-azure-dragon-egg',trial:'region-ninth-gate',codex:'relic-manual',
};
const currency = (glyph,n,label) => `<span class="currency-gem" title="${label}">${icon(glyph)}<b>${n}</b></span>`;

export function shell(game,page) {
  const combat = game.active?.combat;
  return `<div class="game-shell page-${esc(page)}">
    <header class="game-topbar">
      <button class="game-wordmark" data-action="nav" data-id="home" ${game.active ? 'disabled' : ''}>
        ${icon('crest')}<span>ASHES <small>OF THE NINTH HEAVEN</small></span></button>
      <div class="game-resources">${currency('heart',combat?.player.hp ?? game.hp,'Vitality')}
        ${currency('jade',game.jade,'Jade')}${currency('essence',game.essence,'Essence')}</div>
      <div class="game-settings"><button class="icon-btn" data-action="help" aria-label="Field guide">${icon('book')}</button>
        <button class="icon-btn" data-action="sound" aria-label="${game.sound ? 'Mute' : 'Enable sound effects'}" aria-pressed="${game.sound}">${icon(game.sound ? 'sound' : 'mute')}</button>
        <button class="icon-btn" data-action="settings" aria-label="Settings">${icon('gear')}</button></div>
    </header>
    <main id="screen" tabindex="-1" data-page="${esc(page)}"></main>
    ${game.active ? '' : `<nav class="game-dock" aria-label="Game navigation">${views.NAV.map(([id,glyph,label]) =>
      `<button data-action="nav" data-id="${id}" class="dock-button ${id === page ? 'selected' : ''}" ${id === page ? 'aria-current="page"' : ''}>
        <span class="dock-icon">${picture(art(navArt[id]))}${icon(glyph)}</span><b>${label}</b></button>`).join('')}</nav>`}
  </div>`;
}

export function home(game) {
  const chapter = rules.currentChapter(game);
  const nextMission = rules.missions.find(m => m.chapter === chapter.id && rules.missionStatus(game,m) === 'Available');
  const status=rules.cultivationStatus(game);
  const next=status.next;
  const reason=rules.breakthroughRequirement(game);
  return `<section class="sanctuary-scene">
    <div class="sanctuary-title"><span class="eyebrow">THE FALLEN REALM</span><h1>Ashes of the<br><em>Ninth Heaven</em></h1></div>
    <aside class="cultivator-plaque">${picture(rules.realmAvatar(game),'cultivator-face',true)}
      <div class="cultivator-name"><h2>${esc(game.name)}</h2><span>${esc(rules.REALMS[game.realm].name)}</span></div>
      <div class="cultivation-layer"><span>Layer ${status.layer} / 9</span><b class="cultivation-level">Lv. ${status.level} / 90</b></div>
      <div class="plaque-progress">${meter(game.essence-status.layerStart,status.layerEnd-status.layerStart,'purple','Current cultivation layer')}
        <small>${status.perfected?'True Immortal · perfected':status.experienceReady?'Realm threshold attained':`${status.xpToNext} essence to ${status.layer===9?'breakthrough':'next layer'}`}</small></div>
      ${next ? button('Breakthrough','breakthrough','',{icon:'spark',disabled:Boolean(reason)}) : ''}
      ${next?`<p class="breakthrough-reason">${esc(reason||`${next.jade} jade · enter ${next.name}`)}</p>`:''}
      <div class="cultivation-actions">${button('Realm path','realm-path','',{className:'quiet compact'})}${button('Gather','open-bounties','',{className:'quiet compact'})}</div>
    </aside>
    <div class="journey-plaque"><div class="eyebrow">CHAPTER ${String(rules.chapters.indexOf(chapter)+1).padStart(2,'0')}</div><h2>${esc(chapter.name)}</h2>
      <div class="next-mission">${icon('compass')}<span>${esc(nextMission?.name || 'The chronicle is written')}</span></div>
      ${button(game.started ? 'Continue journey' : 'Begin your journey',game.started ? 'nav' : 'begin',game.started ? 'campaign' : '',{className:'primary journey-button',icon:'sword'})}
    </div>
    <div class="shrine-controls">
      <button class="shrine-action" data-action="rest" ${game.hp >= rules.maxHp(game) ? 'disabled' : ''}>${picture(art('region-rest'))}<span>${icon('moon')} Rest at shrine</span></button>
      <button class="shrine-action" data-action="nav" data-id="deck">${picture(art('card-write-a-new-heaven'))}<span>${icon('cards')} Shape your deck <b>${game.deck.length}</b></span></button>
    </div>
  </section>`;
}

export function campaign(game,ui) {
  const chapter = rules.chapterById[ui.chapter] || rules.currentChapter(game);
  const list = rules.missions.filter(m => m.chapter === chapter.id);
  return `<section class="world-map" style="--map-art:url('${esc(scene(regions[chapter.id]))}')">
    <div class="map-title"><div class="eyebrow">${esc(chapter.region)}</div><h1>${esc(chapter.name)}</h1>
      ${button('Chapter story','chapter-story',chapter.id,{icon:'book',className:'quiet'})}</div>
    <div class="region-selector">${rules.chapters.map((entry,i) => `<button class="region-medallion ${entry.id === chapter.id ? 'selected' : ''}"
      data-action="chapter" data-id="${entry.id}" aria-label="${esc(entry.name)}" aria-pressed="${entry.id === chapter.id}">
      ${picture(art(regions[entry.id]))}<b>${i+1}</b><span>${esc(entry.region)}</span></button>`).join('')}</div>
    <div class="expedition-path">${list.map((mission,i) => {
      const state = rules.missionStatus(game,mission);
      const opponent = rules.enemyById[mission.enemy];
      const src = opponent ? art('portrait-' + enemyArt[opponent.id]) : art('region-rest');
      return `<button class="expedition-node state-${state.toLowerCase()}" data-action="mission" data-id="${mission.id}"
        style="--step:${i % 2}" aria-label="${esc(mission.name)} · ${state}">
        <span class="node-portrait">${picture(src)}<i>${icon(state === 'Sealed' ? 'lock' : state === 'Complete' ? 'check' : opponent ? 'sword' : 'book')}</i></span>
        <b>${esc(mission.name)}</b><small>${esc(mission.type)}${state === 'Available' ? ' · Enter' : ''}</small></button>`;
    }).join('')}</div>
    <div class="map-progress">${icon('compass')} ${list.filter(m => game.complete[m.id]).length} / ${list.length}</div>
  </section>`;
}

export function realmDetails(game) {
  const status=rules.cultivationStatus(game);
  return {title:'The ten realms',subtitle:`CULTIVATION · LEVEL ${status.level} / 90 · LAYER ${status.layer} / 9`,body:`<p class="workbench-notice">Cultivation essence is lifetime experience. Nine layers form a realm; breakthroughs cost jade and unlock higher-grade materials. Card requirements use your cultivation level. Earned cards stay usable.</p><div class="cultivation-path">${rules.REALMS.map((realm,index)=>`<article class="cultivation-realm ${index===game.realm?'current':index>game.realm?'locked':''}"><img src="${realm.avatar}" alt="${esc(realm.name)} armor"><div><b>${index+1}. ${esc(realm.name)}</b><small>Levels ${index*9+1}–${index*9+9} · ${realm.essence} lifetime essence</small><small>${index?`${realm.jade} jade breakthrough · `:''}+${realm.hp} vitality</small><small>${esc(realm.description)}</small></div></article>`).join('')}</div>`};
}

export function bounties(game,ui={}) {
  const selected=Math.max(1,Math.min(5,Number(ui.tier)||rules.materialTier(game)));
  return `<section class="bounty-screen"><header class="bounty-heading"><div><div class="eyebrow">THE SECT COMMISSION BOARD</div><h1>Hunt for your next breakthrough</h1><p>Repeatable duels. Choose the school essence you need; every victory grants the exact rewards shown. Defeat and withdrawal grant no materials.</p></div>${button('Workshop','open-forge','',{className:'quiet'})}</header><div class="bounty-tiers">${rules.MATERIAL_TIERS.map(grade=>button(`${grade.name} · Tier ${grade.tier}`,'bounty-tier',String(grade.tier),{className:selected===grade.tier?'selected':''})).join('')}</div><div class="bounty-grid">${rules.schools.map(school=>{
    const offer=rules.bountyOffer(game,school.id,selected);
    return `<article class="bounty-card"><div class="bounty-art">${picture(art('school-'+school.id))}<span class="eyebrow">${esc(school.name)} · TIER ${selected}</span></div><div class="bounty-body"><h3>${esc(offer.enemy.name)}</h3><small>${Math.round(offer.enemy.hp*offer.scale*(game.difficulty==='tribulation'?1.25:1))} enemy vitality · Two-hero duel</small><div class="bounty-materials">${Object.entries(offer.rewards.materials).map(([id,n])=>`<span class="bounty-reagent" title="${esc(rules.materialById[id].name)}">${rules.materialIcon(id)}<b>+${n}</b></span>`).join('')}</div><div class="bounty-currencies"><span>${icon('jade')} +${offer.rewards.gold} jade</span><span>${icon('essence')} +${offer.rewards.essence} essence</span></div><p class="bounty-notice">${esc(offer.reason||'Guaranteed payout after victory. Claim once per duel.')}</p>${button('Accept commission','start-bounty',`${school.id}:${selected}`,{className:'primary',disabled:!offer.ok})}</div></article>`;
  }).join('')}</div></section>`;
}

export function cardTarget(card) {
  const afflictions = new Set(['burn','poison','bleed','weak','vulnerable']);
  const effects = [...card.effects,...(card.bonusEffects || []),...(card.aura?.effects || []),...(card.delayed?.effects || [])];
  return effects.some(effect => effect.target !== 'self' &&
    (['damage','dispel'].includes(effect.type) || effect.type === 'status' && afflictions.has(effect.status))) ? 'enemy' : 'player';
}

function hero(combat,entity,name,portrait,target,selected) {
  const unit = combat[entity];
  const targeting = selected && target === entity;
  return `<div class="duel-hero ${entity === 'enemy' ? 'opponent' : 'disciple'} hero-${entity}">
    <button class="hero-medallion ${targeting ? 'target-ready' : ''}" data-action="cast-card" data-id="${entity}"
      ${targeting && !combat.outcome ? '' : 'disabled'} aria-label="${targeting ? 'Cast on ' : ''}${esc(name)}">
      <span class="fighter-portrait">${picture(portrait.startsWith('assets/')?portrait:art('portrait-' + portrait),'',true)}</span>
      <span class="hero-life" title="Vitality">${icon('heart')}<b>${unit.hp}</b></span>
      ${unit.block ? `<span class="hero-guard" title="Guard">${icon('shield')}<b>${unit.block}</b></span>` : ''}
      ${targeting ? '<span class="target-ring"></span>' : ''}
    </button>
    <div class="hero-nameplate"><b>${esc(name)}</b>${meter(unit.hp,unit.maxHp,entity === 'enemy' ? 'red' : 'green',name + ' vitality')}</div>
    ${statusBadges(unit)}
  </div>`;
}

function handCard(combat,index,selected) {
  const card = getCard(combat,index);
  return `<button class="battle-card duel-card ${frameClasses(card)} school-${esc(card.school)} ${selected ? 'card-selected' : ''}" data-action="select-card" data-id="${index}"
    data-target="${cardTarget(card)}" draggable="${card.cost <= combat.energy && !combat.outcome}" ${card.cost > combat.energy || combat.outcome ? 'disabled' : ''}
    title="${esc(card.name)} · ${esc(techniqueRules(card).join(' '))}" aria-pressed="${selected}">
    ${frameCrest(card)}
    <span class="cost">${card.cost}</span>
    <span class="card-school-icon">${picture(art('school-' + card.school))}</span>
    <span class="battle-card-art">${picture(cardArt(card),'',true)}</span>
    <span class="battle-card-body"><b>${esc(card.name)}${card.level?` <small class="card-battle-level">Lv.${card.level}</small>`:card.upgrade ? ` +${card.upgrade}` : ''}</b>
      ${typeSeal(card)}${effectBadges(card.effects)}${mechanicBadges(card)}${card.exhaust ? '<small>Exhaust</small>' : ''}</span></button>`;
}

function castTrajectory(selected,target) {
  return selected ? `<svg class="cast-trajectory" viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">
        <path d="${target === 'enemy' ? 'M500 420 Q730 260 505 100' : 'M450 250 Q310 335 480 415'}"/>
        <path class="trajectory-tip" d="${target === 'enemy' ? 'm505 100 20 40-25-9-12 19Z' : 'm480 415-39-3 16-14-8-23Z'}"/>
      </svg>` : '';
}

function castControls(selected,target) {
  return selected ? `<div class="selected-technique">${picture(cardArt(selected))}<b>${esc(selected.name)}</b></div>
        ${button(target === 'enemy' ? 'Cast at enemy' : 'Cast on self','cast-card',target,{className:'primary',icon:'spell'})}
        ${button('Inspect','card-details',selected.id,{className:'quiet compact'})}` :
        '<span class="board-whisper">Choose a technique</span>';
}

// Selection is presentation state. Keep the hand, portraits, forecast and their
// decoded images mounted until an actual combat action changes the encounter.
export function updateBattleSelection(root,game,ui={}) {
  const combat=game.active?.combat,stage=root.querySelector('.duel-stage');
  if(!stage||!combat||combat.outcome)return false;
  const selected=Number.isInteger(ui.selectedCard)?getCard(combat,ui.selectedCard):null;
  const target=selected&&cardTarget(selected);
  stage.dataset.castTarget=target||'';
  for(const node of stage.querySelectorAll('.battle-card[data-action="select-card"]')) {
    const pressed=Number(node.dataset.id)===ui.selectedCard;
    node.classList.toggle('card-selected',pressed);
    node.setAttribute('aria-pressed',String(pressed));
  }
  for(const entity of ['enemy','player']) {
    const node=stage.querySelector(`.hero-${entity} .hero-medallion`);
    const targeting=Boolean(selected&&target===entity);
    node.classList.toggle('target-ready',targeting);
    node.disabled=!targeting;
    node.setAttribute('aria-label',(targeting?'Cast on ':'')+(entity==='enemy'?combat.enemy.name:game.name));
    const ring=node.querySelector('.target-ring');
    if(targeting&&!ring)node.insertAdjacentHTML('beforeend','<span class="target-ring"></span>');
    else if(!targeting)ring?.remove();
  }
  stage.querySelector('.cast-trajectory')?.remove();
  const zone=stage.querySelector('.cast-zone');
  zone.insertAdjacentHTML('beforebegin',castTrajectory(selected,target));
  zone.innerHTML=castControls(selected,target);
  return true;
}

export function battle(game,ui={}) {
  const combat = game.active?.combat;
  if (!combat || combat.outcome && !ui.finishing) return views.battle(game,ui);
  const mission = rules.missionById[game.active.id];
  const selected = Number.isInteger(ui.selectedCard) ? getCard(combat,ui.selectedCard) : null;
  const target = selected && cardTarget(selected);
  const intent = getIntent(combat);
  const forecast = previewEndTurn(combat);
  const supplies = rules.items.filter(item => game.bag[item.id] && ['pill','talisman'].includes(item.type) && item.effects?.length);
  const enemyPortrait = enemyArt[combat.enemy.id] || 'paper-taxman';
  const stem = mission?.chapter && mission.chapter !== 'ashen-prefecture' ? regions[mission.chapter] : 'ash-pass';
  return `<section class="duel-stage" style="--board-art:url('${esc(scene(stem))}')" data-cast-target="${target || ''}">
    <div class="duel-heading"><span class="eyebrow">${esc(mission?.name || (game.active.kind==='bounty'?`${rules.schoolById[game.active.school].name} commission · Tier ${game.active.tier}`:`Pagoda · Floor ${game.active.floor}`))}</span>
      ${button('Withdraw','withdraw','',{className:'quiet',disabled:Boolean(combat.outcome)})}</div>
    <div class="arena duel-arena">
      <div class="enemy-intent-token"><span class="intent-glyph">${icon('sword')}</span><div><small>ENEMY INTENT</small><b>${esc(intent?.name || combat.outcome || '')}</b>
        ${intent ? effectBadges(intent.effects) : ''}</div></div>
      ${hero(combat,'enemy',combat.enemy.name,enemyPortrait,target,selected)}
      <div class="round-dial"><small>ROUND</small><b>${combat.turn}</b></div>
      <div class="board-sigil" aria-hidden="true"><i></i>${icon('crest')}</div>
      ${castTrajectory(selected,target)}
      <div class="cast-zone">${castControls(selected,target)}</div>
      <div class="turn-stone">${button('End turn','end','',{className:'primary',disabled:Boolean(combat.outcome)})}
        <span class="forecast">${forecast ? forecast.outcome === 'victory' ? 'Victory on resolve' : forecast.outcome === 'defeat' ? 'Lethal incoming' : forecast.hpChange < 0 ? `${Math.abs(forecast.hpChange)} incoming` : forecast.hpChange > 0 ? `+${forecast.hpChange} recovery` : 'Vitality holds' : ''}</span></div>
      <div class="battle-satchel">${supplies.map(item => `<button class="supply-icon" data-action="use" data-id="${item.id}" ${combat.outcome ? 'disabled' : ''}
        aria-label="Use ${esc(item.name)}" title="${esc(item.name)} · ${esc(item.effects.map(describeEffect).join(' '))}">
        ${picture(itemIcon(item))}<b>${game.bag[item.id]}</b></button>`).join('')}</div>
      ${(combat.auras?.length || combat.rituals?.length) ? `<div class="active-arts" aria-label="Active arts and rituals">
        ${[...(combat.auras || []).map(aura => ({...aura,remaining:aura.expires - combat.turn})),
          ...(combat.rituals || []).map(ritual => ({...ritual,remaining:ritual.due - combat.turn}))].map(art => {
          const source = combat.cards[art.source];
          return `<button class="active-art" data-action="card-details" data-id="${esc(art.source)}" title="${esc(art.name)} · ${art.remaining} turns">
            ${picture(cardArt(source))}<b>${art.remaining}</b><span>${esc(art.name)}</span></button>`;
        }).join('')}</div>` : ''}
      ${hero(combat,'player',game.name,rules.realmAvatar(game),target,selected)}
      ${combat.pet?`<button class="battle-companion realm-${combat.pet.realm}" style="--pet-color:${rules.petById[combat.pet.id].color};--pet-realm:${combat.pet.realm}" data-action="pet-details" data-id="${esc(combat.pet.id)}" title="${esc(combat.pet.name)} · Spirit companion" aria-label="Inspect ${esc(combat.pet.name)}"><span class="battle-companion-halo" aria-hidden="true"></span>${picture(rules.petArt(combat.pet.id,combat.pet.realm),'',true)}<small>${esc(combat.pet.name)}</small></button>`:''}
      <div class="draw-stack" title="Draw pile">${icon('cards')}<b>${combat.drawPile.length}</b><small>DRAW</small>
        <span title="Discard / Exhaust">${combat.discard.length} / ${combat.exhausted.length}</span></div>
      ${combat.enemy.phaseName ? `<div class="boss-phase">${icon('ward')}${esc(combat.enemy.phaseName)}</div>` : ''}
    </div>
    <div class="player-resource-bar"><div class="qi"><b>${combat.energy}<small> / ${combat.maxEnergy}</small></b>
      <span class="qi-crystals" aria-label="${combat.energy} Qi">${Array.from({length:Math.min(10,Math.max(combat.maxEnergy,combat.energy))},(_,i) =>
        `<i class="${i < combat.energy ? 'charged' : ''}">${icon('jade')}</i>`).join('')}</span></div>
      <div class="resonance"><span class="resonance-school">${picture(art('school-' + (combat.resonance.element || 'neutral')))}</span>
        <span><small>RESONANCE</small><b>${combat.resonance.count} / 3</b></span></div>
      ${button('Battle record','battle-record','',{icon:'book',className:'quiet compact'})}</div>
    ${battlePetPanel(combat)}
    <div class="hand duel-hand" aria-label="Your hand">${combat.hand.map((_,i) => handCard(combat,i,ui.selectedCard === i)).join('')}</div>
    <div class="duel-feedback">${ui.feedback ? `<b>${esc(ui.feedback.title)}</b><span>${esc(ui.feedback.details.slice(0,4).join(' · '))}</span>` :
      '<span>Drag a card onto a hero, or select it and tap the glowing target.</span>'}</div>
  </section>`;
}
