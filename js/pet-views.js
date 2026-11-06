import * as pets from './pets.js';
import * as rules from './progression.js';
import {playSound,stopAudioScope} from './audio-engine.js';
import {REALMS} from './cultivation.js';
import {cardLevel,materialById,materialIcon} from './economy.js';
import {reservedCopies} from './decks.js';
import {cardArt} from './art.js';
import {describeEffect,petAbilityStatus} from './combat.js';
import {effectBadges} from './game-symbols.js';
import {icon,esc,button,titleCase,meter} from './ui.js';

const MAP={
  'azure-dragon':{x:18,y:22},'vermilion-phoenix':{x:73,y:20},'white-tiger':{x:13,y:55},
  'black-tortoise':{x:78,y:76},'nine-tail-fox':{x:44,y:55},'jade-qilin':{x:44,y:28},
  'kun-peng':{x:72,y:47},'thunder-serpent':{x:39,y:82},
};
const image=(src,cls='',alt='')=>`<img src="${esc(src)}" class="${cls}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
const lore=id=>pets.petById[id];
const hasPet=(game,id)=>Boolean(game.pets?.[id]);
const petState=(game,id)=>pets.petStatus(game,id);
const effectText=effects=>(effects||[]).map(describeEffect).join(' ');
const realmName=index=>REALMS[index]?.name||'Qi Condensation';
const petImage=(game,id)=>pets.petArt(id,hasPet(game,id)?game.pets[id].realm:null);
const currentPreview=(game,id)=>pets.previewPet(id,game.pets?.[id]?.realm||0);
const realmHalo=realm=>`<span class="pet-realm-halo" aria-hidden="true">${Array.from({length:Math.max(1,realm+1)},(_,i)=>`<i style="--ring:${i}"></i>`).join('')}</span>`;
const ABILITY_SIGILS={
  'cloudpiercer':'M3 20 17 6m-5 0h6v6M4 13c-4-3 1-8 4-5 0-6 9-7 11-2M8 20l3-1',
  'rain-seal':'M5 11c-4-3 0-8 4-6 1-5 9-4 9 1 5-1 6 6 1 6H5Zm3 3-1 3m6-3-1 3m6-3-1 3M5 21h14',
  'sky-rend':'M4 3v7l5 2-6 4m17-13v7l-5 2 6 4M12 2l-2 7 4 2-4 5 2 6',
  'heaven-descends':'M12 2 15 8l6 1-5 5 1 7-5-3-5 3 1-7-5-5 6-1 3-6Zm0 3v11M8 19l-3 3m11-3 3 3',
  'cinder-feather':'M3 21 17 7m-9 9c-4-6 0-13 12-14 1 12-6 17-12 14Zm2-6 5 1m-2-5 5 1M5 14v5h5',
  'warmth-of-return':'M12 21 4 13C0 7 7 3 12 8c5-5 12-1 8 5l-8 8Zm0-5c-3-3-2-5 0-8 2 3 3 5 0 8Z',
  'scarlet-wing':'M3 4c2 7 8 14 17 15l-5-5 6 1-6-5 5-1-9-4 2 5-5-4 1 6-6-8Z',
  'sun-that-remains':'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2',
  'silver-claw':'M5 3 3 17l4 4L9 4M12 2l-2 16 4 3L16 3m3 2-3 13 3 2 3-12',
  'frostpine-roar':'M4 5 7 2l3 5h4l3-5 3 3-2 7 2 6-8 4-8-4 2-6-2-7Zm4 6 2 2m6-2-2 2m-4 3 2 2 2-2M1 9v8m22-8v8',
  'oath-hunter':'M8 15c-7-5-7-12 0-11m8 11c7-5 7-12 0-11M7 22c-7-6 2-12 5-9 3-3 12 3 5 9H7ZM8 7l2-3m6 3-2-3',
  'winter-verdict':'M12 2v20M3 7l18 10M3 17 21 7M8 3l4 3 4-3M8 21l4-3 4 3M2 11l4 1-1 4m17-5-4 1 1 4',
  'river-shell':'M12 3 4 7 2 16l6 6h8l6-6-2-9-8-4Zm0 4-5 4 2 7h6l2-7-5-4Zm0 0v-4M7 11 3 9m6 9-2 4m8-4 2 4m0-11 4-2',
  'deepwater-pulse':'M12 2C8 7 5 11 5 15a7 7 0 0 0 14 0c0-4-3-8-7-13ZM1 13l5 2 4-3 4 6 4-3h5',
  'wash-the-ledger':'M5 3h14v18H5V3Zm4 4h6m-6 4h6M2 16c3-4 6 4 10 0s7 4 10 0M2 20c3-4 6 4 10 0s7 4 10 0',
  'mountain-on-the-sea':'M3 16 10 3l4 7 3-5 5 11H3ZM8 7l3 3 2-3M2 20c3-4 6 4 10 0s7 4 10 0',
  'moonlit-needle':'M19 3c-9-4-17 5-12 13 3 5 9 6 13 1-7 1-11-6-7-11M3 22 17 8m-2 1 2 2',
  'borrowed-face':'M3 5c4-3 6 3 9 3s5-6 9-3v8c0 6-5 9-9 9s-9-3-9-9V5Zm4 6 3 2m7-2-3 2m-5 4c2-2 4-2 6 0',
  'steal-the-blessing':'M12 2 15 8l7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6ZM3 21l7-8m-1 8 5-6',
  'nine-lanterns':'M7 7h10v12H7V7Zm-2 3h14M5 16h14M10 3h4v4m-2 12v4M2 4v6m20-6v6M2 15v5m20-5v5M4 2h2m12 0h2',
  'springstep':'M4 21c3-5 9-10 15-14M6 15c-7-1-5-8-1-9 6 0 5 6 1 9Zm7-6c-1-7 6-9 9-5 2 6-4 9-9 5M8 21h11',
  'jade-antler':'M12 22V8m0 4L5 7V2m0 5L2 4m3 3V4m7 8 7-5V2m0 5 3-3M8 13l-4-2m12 2 4-2M9 19l3-3 3 3',
  'unwritten-spring':'M12 2v9M7 5l5 6 5-6M4 13c4-4 12-4 16 0M2 18c3-4 6 4 10 0s7 4 10 0M4 22h16',
  'mercy-and-judgment':'M12 2v19M4 6h16M7 6l-5 9h10L7 6Zm10 0-5 9h10l-5-9ZM7 22h10M12 2l2 3h-4l2-3Z',
  'sea-sky-breath':'M2 9c5-7 10 1 20-4-1 6-7 10-13 8L4 9M2 18c3-4 6 4 10 0s7 4 10 0M6 22h12',
  'cloudwake':'M5 11c-4-3 0-8 4-6 1-5 9-4 9 1 5-1 6 6 1 6H5ZM2 16c4-3 7 3 11 0s6 3 9 0M5 21c4-3 7 3 11 0',
  'turn-the-horizon':'M2 12h20M5 8c3-7 11-7 14-1m-4-4 4 4 2-5M19 16c-3 7-11 7-14 1m4 4-4-4-2 5',
  'boundless-descent':'M2 4c7 4 13 4 20 0-2 7-5 10-10 13C7 14 4 11 2 4Zm10 13v5m-4-4 4 4 4-4M8 7v3m8-3v3',
  'forked-spark':'M13 2 6 12h6l-2 10 8-12h-6l1-8ZM3 3l3 3m12-3 3 3M3 17l3-1m12 4 3 1',
  'stormcoil':'M17 4C4-3-4 17 10 21c10 3 18-10 7-13-8-3-13 7-5 9 6 1 8-5 3-6M12 1 9 8h4l-2 6',
  'shed-the-storm':'M5 3 2 11l10 11 10-11-3-8-7 4-7-4Zm7 4-4 6h5l-2 6 6-8h-5V7Z',
  'returning-thunder':'M10 2 4 12h6l-2 10 8-12h-6V2Zm7 0-3 5h4l-2 7 6-8h-5V2ZM2 4h3m14 15h3',
};
const abilitySigil=ability=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ABILITY_SIGILS[ability.id]||ABILITY_SIGILS['cloudpiercer']}"/></svg>`;
const requirement=quote=>quote?.ok?'':quote?.reason||'Unavailable.';
const blocked=quote=>quote?.ok?'':`<p class="pet-blocker">${icon('lock')}${esc(requirement(quote))}</p>`;

function costs(quote) {
  const reagents=Object.entries(quote?.materials||{});
  return `<div class="pet-costs"><span>${icon('jade')}<b>${quote?.jade||0}</b> jade</span>${reagents.map(([id,n])=>`<span title="${esc(materialById[id]?.name||id)}">${materialIcon(id)}<b>${n}</b><small>${esc(materialById[id]?.name||id)}</small></span>`).join('')}</div>`;
}

function petProgress(game,id) {
  const status=petState(game,id);
  if(!hasPet(game,id))return '<div class="pet-dormant-caption">An unbroken spirit waits within this egg.</div>';
  return `<div class="pet-cultivation"><div><b>${esc(realmName(game.pets[id].realm))}</b><span>Layer ${status.layer} / 9 · Lv. ${status.level} / 90</span></div>${meter(Math.round((status.progress||0)*100),100,'purple','Pet cultivation layer')}<small>${status.perfected?'True Immortal · perfected':status.experienceReady?'The spirit is ready for a realm evolution.':`${status.xpToNext} nourishment to ${status.layer===9?'the realm threshold':'the next layer'}`}</small></div>`;
}

function abilityList(game,id) {
  const preview=currentPreview(game,id);
  return `<div class="pet-ability-catalogue"><div class="eyebrow">INNATE INSTINCTS</div>${(preview.passives||[]).map(passive=>{
    const unlocked=hasPet(game,id)&&game.pets[id].realm>=passive.unlockRealm;
    return `<article class="pet-ability-detail ${unlocked?'unlocked':'locked'}"><span class="pet-ability-symbol">${icon(passive.trigger==='opening'?'ward':passive.trigger==='turn-end'?'moon':'regen')}</span><div><h4>${esc(passive.name)}<small>${unlocked?'Passive':realmName(passive.unlockRealm)}</small></h4><p>${esc(passive.description||'')}</p><span class="pet-rule">${esc(titleCase(passive.trigger))} · ${esc(effectText(passive.effects))}</span></div></article>`;
  }).join('')}<div class="eyebrow">SPIRIT COMMANDS</div>${(preview.abilities||[]).map(ability=>{
    const unlocked=hasPet(game,id)&&game.pets[id].realm>=ability.unlockRealm;
    return `<article class="pet-ability-detail ${unlocked?'unlocked':'locked'}"><span class="pet-ability-symbol">${abilitySigil(ability)}</span><div><h4>${esc(ability.name)}<small>${ability.cooldown} turn cooldown</small></h4><p>${esc(ability.description||'')}</p><span class="pet-rule">${esc(effectText(ability.effects))}</span>${!unlocked?`<span class="pet-unlock">${icon('lock')} ${esc(realmName(ability.unlockRealm))}</span>`:''}</div></article>`;
  }).join('')}<p class="pet-fineprint">Invoke one spirit command per turn. Commands have separate turn cooldowns and do not spend Qi.</p></div>`;
}

function selectedPanel(game,id) {
  const pet=lore(id),hatched=hasPet(game,id),active=game.activePetId===id;
  const hatch=pets.quoteHatch(game,id),evolution=hatched?pets.quoteEvolve(game,id):null;
  return `<aside class="pet-detail-panel" style="--pet-color:${esc(pet.color)}"><div class="pet-panel-heading"><span class="eyebrow">${esc(pet.title||pet.biome)}</span>${active?'<span class="pet-active-badge">Travelling companion</span>':''}</div><div class="pet-selected-art ${hatched?'living':'egg'}" style="--pet-realm:${game.pets?.[id]?.realm||0}">${hatched?realmHalo(game.pets[id].realm):''}${image(petImage(game,id),'',pet.name)}<span class="pet-art-aura"></span></div><h2>${esc(pet.name)}</h2><p class="pet-species-description">${esc(pet.description)}</p>${petProgress(game,id)}<div class="pet-main-actions">${hatched?`${button(active?'Return to habitat':'Take into battle',active?'pet-unequip':'pet-equip',id,{className:active?'quiet':'primary',disabled:Boolean(game.active),icon:'compass'})}${button('Feed techniques','pet-feed-picker',id,{icon:'cards',disabled:Boolean(game.active)})}${game.pets[id].realm<9?button('Evolve realm','pet-evolve-preview',id,{icon:'spark',disabled:!evolution.ok}):''}`:`${costs(hatch)}${button('Awaken this spirit','pet-hatch-preview',id,{className:'primary',icon:'essence',disabled:!hatch.ok})}`}</div>${hatched&&game.pets[id].realm<9?blocked(evolution):!hatched?blocked(hatch):''}${abilityList(game,id)}</aside>`;
}

export function petHabitat(game,ui={}) {
  const selected=lore(ui.petId||ui.selectedPetId)?ui.petId||ui.selectedPetId:game.activePetId||pets.spiritPets[0].id;
  const view=ui.petView==='list'?'list':'map';
  const zoom=Math.max(1,Math.min(1.6,Number(ui.petZoom)||1));
  const owned=pets.spiritPets.filter(pet=>hasPet(game,pet.id)).length;
  return `<section class="spirit-sanctuary"><header class="pet-page-heading"><div><div class="eyebrow">THE EIGHTFOLD SPIRIT DOMAIN</div><h1>Sanctuary of living legends</h1><p>Eight ancient spirits. One companion at your side. Awaken the creature you choose, then nourish it with spare techniques.</p></div><div class="pet-habitat-tally"><b>${owned} / 8</b><small>spirits awakened</small><span>${game.activePetId?esc(lore(game.activePetId)?.name):'No travelling companion'}</span></div></header><div class="pet-sanctuary-toolbar"><div class="pet-view-toggle">${button('World map','pet-view','map',{className:view==='map'?'selected':'quiet',icon:'compass'})}${button('Spirit ledger','pet-view','list',{className:view==='list'?'selected':'quiet',icon:'book'})}</div><span class="pet-sanctuary-hint">${icon('cards')} Feeding destroys the selected copies. Deck reserves are protected.</span></div><div class="pet-sanctuary-layout"><div class="pet-world-column">${view==='map'?`<div class="pet-map-frame"><div class="pet-map-viewport" tabindex="0" aria-label="Spirit habitat map. Scroll to pan when zoomed."><div class="pet-world" style="--pet-map-zoom:${zoom};--pet-map-art:url('${new URL('../'+pets.PET_MAP_ART,import.meta.url).href}');width:${zoom*100}%;"><div class="pet-map-clouds" aria-hidden="true"></div><div class="pet-map-river" aria-hidden="true"></div>${pets.spiritPets.map(pet=>{
    const pos=pet.map||MAP[pet.id],hatched=hasPet(game,pet.id);
    return `<button type="button" class="pet-biome-node ${hatched?'hatched':'unhatched'} ${pet.id===selected?'selected':''} ${game.activePetId===pet.id?'equipped':''}" style="left:${pos.x}%;top:${pos.y}%;--pet-color:${esc(pet.color)};--pet-realm:${game.pets?.[pet.id]?.realm||0}" data-action="pet-select" data-id="${pet.id}" aria-pressed="${pet.id===selected}" aria-label="${esc(pet.name)} · ${esc(pet.biome)} · ${hatched?'Awakened':'Unhatched egg'}"><span class="pet-node-runes" aria-hidden="true"></span><span class="pet-node-creature">${image(petImage(game,pet.id),'',pet.name)}</span><span class="pet-node-name">${esc(pet.name)}</span><small>${esc(pet.biome)}</small><span class="pet-node-state">${game.activePetId===pet.id?'Companion':hatched?realmName(game.pets[pet.id].realm):'Spirit egg'}</span></button>`;
  }).join('')}<div class="pet-map-cartouche"><span>THE EIGHTFOLD DOMAIN</span><small>A sanctuary beneath the broken heavens</small></div></div></div><div class="pet-map-controls">${button('−','pet-map-zoom','-',{className:'compact',ariaLabel:'Zoom out habitat'})}<span>${Math.round(zoom*100)}%</span>${button('+','pet-map-zoom','+',{className:'compact',ariaLabel:'Zoom into habitat'})}<small>${zoom>1?'Drag or scroll to explore':'Choose a biome to meet its spirit'}</small></div></div>`:`<div class="pet-ledger">${pets.spiritPets.map(pet=>`<button type="button" class="pet-ledger-entry ${pet.id===selected?'selected':''}" data-action="pet-select" data-id="${pet.id}" aria-pressed="${pet.id===selected}" style="--pet-color:${esc(pet.color)}">${image(petImage(game,pet.id),'',pet.name)}<span><b>${esc(pet.name)}</b><small>${esc(pet.biome)}</small><em>${hasPet(game,pet.id)?realmName(game.pets[pet.id].realm):'Unhatched spirit egg'}</em></span>${game.activePetId===pet.id?icon('check'):icon('arrow')}</button>`).join('')}</div>`}<div class="pet-domain-note">${icon('ward')}<p>Hatching is a deliberate choice. Your first spirit is a gift; further eggs require an offering. Feeding and evolution happen here, while one selected companion joins your battles.</p></div></div>${selectedPanel(game,selected)}</div></section>`;
}

export function petDetails(game,id) {
  const pet=lore(id);if(!pet)return null;
  return {title:pet.name,subtitle:pet.biome,body:`<div class="pet-dialog-portrait">${image(petImage(game,id),'',pet.name)}</div><p>${esc(pet.description)}</p>${petProgress(game,id)}${abilityList(game,id)}`};
}

export function bindPetMapControls(container=document) {
  const viewport=container.querySelector('.pet-map-viewport');
  if(!viewport||viewport.dataset.panBound)return;
  viewport.dataset.panBound='true';
  let drag=null;
  viewport.addEventListener('pointerdown',event=>{
    if(event.pointerType!=='mouse'||event.button!==0||event.target.closest('button')||viewport.scrollWidth<=viewport.clientWidth)return;
    drag={x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);viewport.classList.add('panning');event.preventDefault();
  });
  viewport.addEventListener('pointermove',event=>{
    if(!drag)return;
    viewport.scrollLeft=drag.left-(event.clientX-drag.x);viewport.scrollTop=drag.top-(event.clientY-drag.y);
  });
  const stop=()=>{drag=null;viewport.classList.remove('panning')};
  viewport.addEventListener('pointerup',stop);viewport.addEventListener('pointercancel',stop);viewport.addEventListener('lostpointercapture',stop);
}

export function petHatchPreview(game,id) {
  const pet=lore(id);if(!pet)return null;
  const quote=pets.quoteHatch(game,id);
  return {title:`Awaken ${pet.name}?`,subtitle:'A SPIRIT BOND BEGINS',body:`<div class="pet-dialog-portrait egg">${image(pets.petArt(id,null),'',pet.name+' egg')}</div><p class="dialog-lead">${esc(pet.description)}</p><p>${quote.first?'Your first hatch is a gift.':'Offer the jade and essences below to awaken another companion.'} This choice awakens this species at Qi Condensation, layer 1. Choose it as your travelling companion after hatching.</p>${costs(quote)}${blocked(quote)}<div class="dialog-actions">${button('Keep the egg','close')}${button('Hatch spirit','pet-hatch',id,{className:'primary',icon:'essence',disabled:!quote.ok})}</div>`};
}

export function petEvolutionPreview(game,id) {
  const pet=lore(id);if(!pet||!hasPet(game,id))return null;
  const quote=pets.quoteEvolve(game,id),current=game.pets[id].realm,next=Math.min(9,current+1);
  return {title:`Evolve ${pet.name}`,subtitle:'THE NEXT SPIRIT REALM',body:`<div class="pet-evolution-preview"><div>${image(pets.petArt(id,current))}<small>${esc(realmName(current))}</small></div>${icon('arrow')}<div>${image(pets.petArt(id,next))}<small>${esc(realmName(next))}</small></div></div><p>The spirit keeps all accumulated nourishment. A realm evolution unlocks stronger instincts and commands; it cannot pass your own cultivation realm.</p>${costs(quote)}${blocked(quote)}<div class="dialog-actions">${button('Wait','close')}${button('Begin evolution','pet-evolve',id,{className:'primary',icon:'spark',disabled:!quote.ok})}</div>`};
}

export function petFeedPicker(game,id,ui={}) {
  const pet=lore(id);if(!pet||!hasPet(game,id))return null;
  const source=rules.cards.filter(card=>(game.known[card.id]||0)>0);
  const query=String(ui.petFeedQuery||'').toLowerCase();
  const cards=source.filter(card=>!query||card.name.toLowerCase().includes(query));
  const selected=ui.petFeedCardId&&cards.some(card=>card.id===ui.petFeedCardId)?ui.petFeedCardId:cards.find(card=>(game.known[card.id]||0)>reservedCopies(game,card.id))?.id||cards[0]?.id;
  const card=rules.cardById[selected],quote=card?pets.quoteFeed(game,id,selected,1):null;
  return {title:`Nourish ${pet.name}`,subtitle:'TECHNIQUES BECOME SPIRIT ESSENCE',body:`<p class="pet-feed-warning">${icon('cards')} Feeding permanently destroys card copies. Copies in active, saved, or draft decks are protected. Shared card quality remains learned.</p>${petProgress(game,id)}${!cards.length?'<p class="pet-blocker">No owned techniques are available.</p>':`<form data-form="pet-feed-select" data-id="${id}"><input type="hidden" name="petId" value="${id}"><label class="field">Find a technique<input type="search" name="petFoodSearch" placeholder="Search your owned techniques…" autocomplete="off"></label><p class="pet-fineprint" data-pet-feed-empty hidden>No spare techniques match this search.</p><label class="field">Choose an owned technique<select name="cardId" aria-label="Technique to feed">${cards.map(card=>{
    const owned=game.known[card.id]||0,reserved=reservedCopies(game,card.id),safe=Math.max(0,owned-reserved);
    return `<option value="${card.id}" ${card.id===selected?'selected':''} ${!safe?'disabled':''}>${esc(card.name)} · ${safe} spare / ${owned} owned · ${pets.feedExperience(card)} nourishment</option>`;
  }).join('')}</select></label><div data-pet-feed-card>${card?feedCardSummary(game,card):''}</div><label class="field">Copies to feed<input type="number" name="quantity" value="1" min="1" max="99" inputmode="numeric" required></label><div data-pet-feed-quote aria-live="polite">${card?petFeedQuoteSummary(game,id,selected,1):''}</div><div class="dialog-actions">${button('Keep my cards','close')}<button type="submit" class="btn primary" data-pet-feed-submit ${!quote?.ok?'disabled':''}>Review feeding</button></div></form>`}`};
}

function feedCardSummary(game,card) {
  const owned=game.known[card.id]||0,reserved=reservedCopies(game,card.id);
  return `<div class="pet-feed-card-summary">${image(cardArt(card),'',card.name)}<div><b>${esc(card.name)}</b><span>${esc(titleCase(card.rarity))} · Card Lv. ${cardLevel(game,card.id)}</span><small>Owned ${owned} · Reserved ${reserved} · Spare ${Math.max(0,owned-reserved)}</small><em>+${pets.feedExperience(card)} nourishment per copy</em></div></div>`;
}

export function petFeedCardSummary(game,cardId) {return rules.cardById[cardId]?feedCardSummary(game,rules.cardById[cardId]):''}

export function petFeedQuoteSummary(game,petId,cardId,quantity) {
  const quote=pets.quoteFeed(game,petId,cardId,quantity);
  const result=quote.result||{};
  return `<div class="pet-feed-live"><span>Copies destroyed <b>${Number.isSafeInteger(quantity)&&quantity>0?quantity:'—'}</b></span><span>Nourishment gained <b>+${result.gained??result.experience??0}</b></span><span>Safe spare copies <b>${quote.available??0}</b></span></div>${result.wasted?`<p class="pet-blocker">${result.wasted} nourishment would exceed final perfection.</p>`:''}${blocked(quote)}`;
}

export function petFeedPreview(game,id,cardId,quantity=1) {
  const pet=lore(id),card=rules.cardById[cardId];if(!pet||!card)return null;
  const quote=pets.quoteFeed(game,id,cardId,quantity),result=quote.result||{};
  return {title:`Feed ${quantity} ${quantity===1?'technique':'techniques'}?`,subtitle:`${pet.name.toUpperCase()} · PERMANENT CARD CONSUMPTION`,body:`${feedCardSummary(game,card)}<p class="pet-feed-warning">Destroy <b>${quantity} ${esc(card.name)}</b> ${quantity===1?'copy':'copies'} to nourish ${esc(pet.name)}. This cannot be undone.</p>${petFeedQuoteSummary(game,id,cardId,quantity)}<div class="pet-feed-result"><span>Pet nourishment</span><b>${game.pets?.[id]?.essence||0} → ${result.essence??game.pets?.[id]?.essence??0}</b></div><p class="pet-fineprint">Your learned card level is retained. Deck-reserved copies are never consumed. Realm evolution is a separate action when its threshold is reached.</p><div class="dialog-actions">${button('Keep these cards','close')}${button(`Feed ${quantity} ${quantity===1?'copy':'copies'}`,'pet-feed-confirm',`${id}:${cardId}:${quantity}`,{className:'danger',disabled:!quote.ok,icon:'essence'})}</div>`};
}

export function battlePetPanel(combat) {
  const companion=combat?.pet;if(!companion)return '';
  const pet=lore(companion.id);if(!pet)return '';
  return `<aside class="battle-spirit" style="--pet-color:${esc(pet.color)}" aria-label="${esc(pet.name)} spirit companion"><div class="battle-spirit-header"><span class="battle-spirit-portrait">${image(pets.petArt(companion.id,companion.realm),'',pet.name)}</span><div><small>SPIRIT COMPANION</small><b>${esc(pet.name)}</b><span>${esc(realmName(companion.realm))}</span></div></div><div class="battle-spirit-passives">${(companion.passives||[]).filter(passive=>companion.realm>=passive.unlockRealm).map(passive=>`<span title="${esc(passive.name)} · ${esc(titleCase(passive.trigger))} · ${esc(effectText(passive.effects))}">${icon('ward')}<b>${esc(passive.name)}</b></span>`).join('')}</div><div class="battle-pet-abilities">${(companion.abilities||[]).map(ability=>{
    const state=petAbilityStatus(combat,ability.id),locked=companion.realm<ability.unlockRealm;
    return `<button type="button" class="pet-command ${state.ok?'ready':'cooling'} ${locked?'locked':''}" data-action="pet-ability" data-id="${ability.id}" ${state.ok?'':'disabled'} title="${esc(ability.name)} · ${esc(effectText(ability.effects))} · ${ability.cooldown} turn cooldown${state.ok?'':' · '+esc(state.reason)}" aria-label="${esc(ability.name)}${state.remaining?` · ${state.remaining} turns remaining`:locked?' · locked':''}"><span class="pet-command-glyph">${abilitySigil(ability)}</span><b>${esc(ability.name)}</b><small>${locked?realmName(ability.unlockRealm):state.remaining?`${state.remaining} turns`:state.ok?'Ready':'Next turn'}</small>${state.remaining?`<i class="pet-cooldown-dial"><b>${state.remaining}</b></i>`:locked?`<i class="pet-cooldown-dial">${icon('lock')}</i>`:''}</button>`;
  }).join('')}</div></aside>`;
}

let celebrationTimer=null;
let celebrationCallback=null;
let celebrationSoundSerial=0;
let celebrationSoundScope=null;
export function clearPetCelebration({complete=false,natural=false}={}) {
  clearTimeout(celebrationTimer);celebrationTimer=null;
  if(celebrationSoundScope&&!natural)stopAudioScope(celebrationSoundScope);
  celebrationSoundScope=null;
  document.querySelector('#pet-celebration')?.remove();
  const app=document.querySelector('#app');if(app)app.inert=false;
  const callback=celebrationCallback;celebrationCallback=null;
  if(complete)callback?.();
}

export function showPetCelebration({petId,realm=0,kind='hatch',onComplete}={}) {
  clearPetCelebration();
  const pet=lore(petId);if(!pet)return;
  celebrationCallback=onComplete;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  celebrationSoundScope='spirit-ceremony-'+(++celebrationSoundSerial);
  playSound(kind==='hatch'?'pet-hatch':'pet-evolve',{scope:celebrationSoundScope,priority:6});
  if(kind==='hatch')playSound('egg-crack',{scope:celebrationSoundScope,delay:reduced?0:900,priority:4,volume:.8});
  playSound('pet-'+petId,{scope:celebrationSoundScope,delay:reduced?100:1800,priority:4,volume:.65});
  const overlay=document.createElement('section');
  overlay.id='pet-celebration';overlay.className=`pet-celebration ${kind} pet-realm-${realm} ${reduced?'reduced-motion':''}`;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',kind==='hatch'?`${pet.name} awakened`:`${pet.name} evolved`);
  overlay.style.setProperty('--pet-color',pet.color);
  overlay.innerHTML=`<div class="pet-cinematic-sky"></div><div class="pet-cinematic-ring ring-one"></div><div class="pet-cinematic-ring ring-two"></div><div class="pet-cinematic-ring ring-three"></div><div class="pet-cinematic-rays"></div><div class="pet-cinematic-particles">${Array.from({length:24},(_,i)=>`<i style="--i:${i}"></i>`).join('')}</div><div class="pet-cinematic-egg">${image(pets.petArt(petId,null))}<span class="pet-shell-crack"></span></div><div class="pet-cinematic-reveal">${image(pets.petArt(petId,realm),'',pet.name)}</div><div class="pet-cinematic-title"><div class="eyebrow">${kind==='hatch'?'A SPIRIT BOND AWAKENS':'THE HEAVENS ANSWER'}</div><h1>${esc(pet.name)}</h1><p>${kind==='hatch'?'Qi Condensation · Layer 1':esc(realmName(realm))}</p><span>${kind==='hatch'?'Your companion has hatched.':'Your companion has entered a new realm.'}</span></div><button type="button" class="btn pet-cinematic-skip">${reduced?'Continue':'Skip reveal'}</button>`;
  overlay.querySelector('.pet-cinematic-skip').addEventListener('click',()=>clearPetCelebration({complete:true}));
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();clearPetCelebration({complete:true})}
    if(event.key==='Tab'){event.preventDefault();overlay.querySelector('button').focus({preventScroll:true})}
  });
  const app=document.querySelector('#app');if(app)app.inert=true;
  document.body.append(overlay);overlay.querySelector('button').focus({preventScroll:true});
  if(!reduced)celebrationTimer=setTimeout(()=>clearPetCelebration({complete:true,natural:true}),4300);
}
