import * as rules from './progression.js';
import * as economy from './economy.js';
import {cultivationLevel, REALMS, LAYERS_PER_REALM} from './cultivation.js';
import {resolveTechnique, techniqueRules} from './combat.js';
import {cardArt} from './art.js';
import {itemIcon} from './item-art.js';
import {frameClasses, frameCrest, typeSeal, CARD_TYPES, cardForm} from './card-frame.js';
import {effectBadges, mechanicBadges} from './game-symbols.js';
import {icon, esc, titleCase, button, tag} from './ui.js';
import {merchantsTab, playerStalls, priceBoard, quickTrade} from './market/views.js';

const PAGE_SIZE=24;
const gradeNames=['common','uncommon','rare','legendary'];
const count=(list,id)=>list.filter(entry=>entry===id).length;
const counts=list=>list.reduce((map,id)=>(map[id]=(map[id]||0)+1,map),{});
const school=id=>rules.schoolById[id]?.name||titleCase(id||'neutral');
const art=stem=>new URL(`../assets/art/${stem}.webp`,import.meta.url).href;
const image=(url,className='')=>`<img src="${esc(url)}" alt="" loading="lazy" decoding="async" class="${className}">`;
const levelOf=(game,id)=>economy.cardLevel(game,id);
const matches=(entry,query)=>!query||[entry.name,entry.description,entry.flavor,entry.type,entry.family,entry.school].some(value=>String(value||'').toLowerCase().includes(query.toLowerCase()));
const priceLabel=(jade)=>`${icon('jade')}<b>${jade}</b>`;
const quoteReason=quote=>quote.ok?'':quote.reason||'This operation is unavailable.';
const tab=(label,id,selected)=>`<button type="button" class="tab ${selected?'selected':''}" data-action="tab" data-id="${id}" aria-pressed="${selected}">${esc(label)}</button>`;
const tabs=(entries,current)=>`<div class="commerce-tabs">${entries.map(([id,label])=>tab(label,id,id===current)).join('')}</div>`;
const schoolOptions=()=>rules.schools.map(entry=>[entry.id,entry.name]);
const typeOptions=()=>Object.entries(CARD_TYPES).map(([id,entry])=>[id,entry.name]);
const rarityOptions=()=>gradeNames.map(id=>[id,titleCase(id)]);
const filter=(label,key,options,current)=>`<label class="filter"><span>${esc(label)}</span><select data-filter="${key}" aria-label="${esc(label)}"><option value="">All</option>${options.map(([id,name])=>`<option value="${esc(id)}" ${String(current)===String(id)?'selected':''}>${esc(name)}</option>`).join('')}</select></label>`;
const search=ui=>`<form class="commerce-search" data-form="search"><label class="filter"><span>Search</span><input type="search" name="query" value="${esc(ui.query||'')}" maxlength="60" placeholder="Name, school, or technique…"></label><button type="submit" class="btn compact">Find</button></form>`;

function requirementLabel(level) {
  const realm=Math.min(REALMS.length-1,Math.max(0,Math.floor((Math.max(1,level)-1)/LAYERS_PER_REALM)));
  const layer=(Math.max(1,level)-1)%LAYERS_PER_REALM+1;
  return `${REALMS[realm].name} · Layer ${layer}`;
}

function header(game,title,subtitle,kind='forge',extra='') {
  return `<header class="commerce-heading" style="--commerce-art:url('${art(kind==='market'?'sect-neutral':'sect-cinder-house')}')"><div><div class="eyebrow">${kind==='market'?'THE NIGHT BAZAAR':kind==='deck'?'YOUR PATH, YOUR TECHNIQUES':'THE JADE CRUCIBLE'}</div><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div><div class="commerce-wallet"><span class="commerce-currency" title="Jade">${priceLabel(game.jade)}</span><span class="card-level-pill" title="Cultivation level">${icon('spark')}Cultivation Lv. ${cultivationLevel(game)}</span>${extra}</div></header>`;
}

function cardFilters(ui,amount,{ownership=true,tiers=true}={}) {
  return `<div class="commerce-controls"><div class="commerce-filters">${filter('School','category',schoolOptions(),ui.filter)}${filter('Type','cardType',typeOptions(),ui.cardType)}${filter('Rarity','rarity',rarityOptions(),ui.rarity)}${filter('Qi','cost',[0,1,2,3].map(n=>[n,n]),ui.cost)}${tiers?filter('Tier','tier',[1,2,3,4,5].map(n=>[n,`Tier ${n}`]),ui.tier):''}${ownership?filter('Collection','ownership',[['new','Not owned'],['owned','Owned']],ui.ownership):''}${filter('Show','available',[['ready','Ready now']],ui.available)}</div>${search(ui)}<span class="commerce-count">${amount} techniques</span></div>`;
}

function filterCards(game,ui,list,quote) {
  return list.filter(card=>(!ui.filter||ui.filter===(card.school||'neutral'))&&(!ui.cardType||cardForm(card)===ui.cardType)&&(!ui.rarity||card.rarity===ui.rarity)&&(!ui.cost||String(card.cost)===ui.cost)&&(!ui.tier||String(economy.cardRequirement(card).tier)===String(ui.tier))&&(ui.ownership!=='new'||!game.known[card.id])&&(ui.ownership!=='owned'||game.known[card.id])&&matches(card,ui.query)&&(ui.available!=='ready'||quote(game,card.id).ok));
}

function paginated(list,ui,render) {
  const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
  const page=Math.max(0,Math.min(pages-1,ui.cardPage||0));
  return `<div class="commerce-grid">${list.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(render).join('')}</div>${list.length?`<div class="commerce-pages">${button('Previous','card-page',String(page-1),{disabled:page===0})}<span>${page+1} / ${pages}</span>${button('Next','card-page',String(page+1),{disabled:page===pages-1})}</div>`:empty('No techniques found','Change a filter or try another search.')}`;
}

function empty(title,description,actions='') {
  return `<div class="commerce-empty">${icon('cards')}<h3>${esc(title)}</h3><p>${esc(description)}</p>${actions?`<div class="dialog-actions">${actions}</div>`:''}</div>`;
}

export function cardPreview(game,card,level=levelOf(game,card.id),gear={}) {
  // The combat resolver is the authority for printed and played magnitudes.
  return resolveTechnique(card,0,gear,level);
}

function cardTile(game,card,{mode='shop',selected=false,draft}={}) {
  const owned=game.known[card.id]||0;
  const level=levelOf(game,card.id);
  const ready=cardPreview(game,card,level);
  const requirement=economy.cardRequirement(card);
  let displayRequirement=requirement.level;
  let locked=['shop','forge'].includes(mode)&&cultivationLevel(game)<displayRequirement;
  let action='';
  let under='';
  if(mode==='shop') {
    const quote=economy.quoteBuyCard(game,card.id);
    under=`<div class="commerce-price">${priceLabel(economy.cardPrice(card))}</div><div class="commerce-requirement">${locked?esc(requirementLabel(requirement.level)):'Acquisition unlocked'}</div>`;
    action=button('Inspect & buy','shop-inspect',card.id,{className:'compact',ariaLabel:`Inspect and buy ${card.name}`});
  } else if(mode==='deck') {
    const inDraft=count(draft.cards,card.id);
    action=`<div class="deck-counter">${button('−','draft-remove',card.id,{disabled:!inDraft,className:'compact',ariaLabel:`Remove ${card.name} from draft`})}<span>${inDraft} / ${owned}</span>${button('+','draft-add',card.id,{disabled:inDraft>=Math.min(4,owned)||draft.cards.length>=22,className:'compact',ariaLabel:`Add ${card.name} to draft`})}</div>${button('Details','card-details',card.id,{className:'quiet compact'})}`;
  } else {
    const quote=mode==='upgrade'?economy.quoteUpgrade(game,card.id):mode==='salvage'?economy.quoteSalvage(game,card.id,1):economy.quoteForge(game,card.id);
    if(mode==='upgrade') {displayRequirement=quote.requiredLevel;locked=cultivationLevel(game)<displayRequirement}
    const summary=mode==='salvage'?`${quote.reserved??rules.reservedCopies?.(game,card.id)??0} reserved`:`${mode==='upgrade'?`Next Lv. ${Math.min(5,level+1)}`:`Tier ${requirement.tier} recipe`}`;
    under=`<div class="commerce-requirement">${esc(summary)}</div>`;
    action=button(selected?'Selected':'Select','workshop-select',card.id,{className:'compact',ariaLabel:`Select ${card.name} for ${mode}`});
  }
  return `<article class="collection-card panel commerce-card ${frameClasses(card)} school-${esc(card.school||'neutral')} ${selected?'is-selected':''} ${locked?'is-locked':''}">${frameCrest(card)}<span class="cost">${ready.cost}</span><div class="card-image">${image(cardArt(card))}<span class="card-level-pill level-overlay">Lv. ${level}</span>${locked?`<span class="commerce-lock">${icon('lock')}Lv. ${displayRequirement}</span>`:''}</div><div class="collection-body"><div class="card-rare rarity-${esc(card.rarity)}">${esc(titleCase(card.rarity))}</div><h3>${esc(card.name)}</h3>${typeSeal(card)}${effectBadges(ready.effects)}${mechanicBadges(ready)}${mode==='deck'?'':`<span class="commerce-owned">${owned?`Owned ×${owned}`:'Not owned'}</span>`}${under}<div class="card-actions">${action}</div></div></article>`;
}

function materialIcon(material) {
  if(!material) return `<span class="material-icon">${icon('essence')}</span>`;
  return `<span class="material-icon grade-${esc(material.rarity)}" style="--material-color:${esc(material.color||'#b3e3cf')}">${economy.materialIcon(material)}</span>`;
}

function materialMeta(material) {
  return `<span class="material-meta"><span class="material-tier">T${material.tier}</span><span class="rarity-${esc(material.rarity)}">${esc(titleCase(material.rarity))}</span><span>${esc(material.school?school(material.school):titleCase(material.family))}</span></span>`;
}

// Pills and talismans trade with Auntie Shi in the market, so the gear stall leaves them out.
const merchantGood=item=>item.type==='pill'||item.type==='talisman';
function legacyGoods(game,ui,selling=false) {
  const listed=(selling?rules.items.filter(item=>game.bag[item.id]):rules.catalogue(game)).filter(item=>!merchantGood(item));
  const list=listed.filter(item=>(!ui.filter||item.type===ui.filter)&&matches(item,ui.query));
  return `<div class="commerce-controls"><div class="commerce-filters">${filter('Type','category',[...new Set(rules.items.filter(item=>!merchantGood(item)).map(item=>item.type))].map(id=>[id,titleCase(id)]),ui.filter)}</div>${search(ui)}<span class="commerce-count">${list.length} goods</span></div><div class="commerce-item-grid">${list.map(item=>{
    const equipped=Object.values(game.equipped).includes(item.id);
    const jade=selling?Math.max(1,Math.floor(rules.price(item)/2)):rules.price(item,game);
    return `<article class="commerce-item"><button data-action="item-details" data-id="${esc(item.id)}" aria-label="${esc(item.name)} details">${image(itemIcon(item))}</button><div><div class="card-rare rarity-${esc(item.rarity)}">${esc(titleCase(item.rarity||'common'))} · ${esc(titleCase(item.type))}</div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><span class="commerce-owned">Owned ×${game.bag[item.id]||0}${equipped?' · Equipped':''}</span><div class="card-actions">${button(`${selling?'Sell':'Buy'} · ${jade} jade`,selling?'sell':'order',item.id,{className:'compact',disabled:selling?(game.bag[item.id]||0)<=Number(equipped):game.jade<jade})}</div></div></article>`;
  }).join('')}</div>${list.length?'':empty(selling?'Nothing to sell':'No goods found',selling?'Expedition supplies and equipment appear here.':'Change your filters or progress through the chronicle.')}`;
}

export const SHOP_TABS=[['quick','Quick trade'],['merchants','Merchants'],['stalls','Player stalls'],['prices','Price board'],['cards','Techniques'],['goods','Gear'],['sell','Sell gear']];
export function shop(game,ui={}) {
  const tabId=SHOP_TABS.some(([id])=>id===ui.tab)?ui.tab:'quick';
  let body;
  if(tabId==='quick') body=quickTrade(game,ui);
  else if(tabId==='stalls') body=playerStalls(game,ui);
  else if(tabId==='merchants') body=merchantsTab(game,ui);
  else if(tabId==='prices') body=priceBoard(game);
  else if(tabId==='goods'||tabId==='sell') body=legacyGoods(game,ui,tabId==='sell');
  else {
    const list=filterCards(game,ui,rules.cards,economy.quoteBuyCard);
    body=cardFilters(ui,list.length)+paginated(list,ui,card=>cardTile(game,card));
  }
  return `<section class="commerce-screen" data-tutorial="shop-content">${header(game,'Night Bazaar','Nine merchants with their own purses and their own reasons. Techniques and gear for the long path.','market',ui.sealChip||'')}${tabs(SHOP_TABS,tabId)}${body}</section>`;
}

function costRows(game,materials,{yieldOnly=false}={}) {
  return `<div class="ingredient-list">${Object.entries(materials||{}).map(([id,amount])=>{
    const material=economy.materialById[id];
    const owned=game.materials?.[id]||0;
    return `<div class="ingredient-row ${!yieldOnly&&owned<amount?'short':''}">${materialIcon(material)}<span class="ingredient-label"><b>${esc(material?.name||titleCase(id))}</b><small>${material?`Tier ${material.tier} · ${titleCase(material.rarity)}`:''}</small>${!yieldOnly&&owned<amount?`<button type="button" class="material-link" data-action="open-material" data-id="${esc(id)}">Shop material</button>`:''}</span><span class="ingredient-quantity">${yieldOnly?`+${amount}`:`${owned} <em>/ ${amount}</em>`}</span></div>`;
  }).join('')}</div>`;
}

function blockerList(quote) {
  const reasons=quote.reasons||quote.blockers||(quote.ok?[]:[quoteReason(quote)]);
  return reasons.length?`<ul class="workbench-blockers">${reasons.map(reason=>`<li>${icon('lock')}<span>${esc(reason)}</span></li>`).join('')}</ul>`:'';
}

function workbench(game,card,mode) {
  if(!card) return `<aside class="workbench-panel">${empty('Choose a technique','Select a card to inspect its recipe and result.')}</aside>`;
  const current=levelOf(game,card.id);
  const quote=mode==='upgrade'?economy.quoteUpgrade(game,card.id):mode==='salvage'?economy.quoteSalvage(game,card.id,1):economy.quoteForge(game,card.id);
  const action=mode==='upgrade'?'upgrade-card':mode==='salvage'?'salvage-preview':'forge-card';
  const labels={forge:'Forge a technique',upgrade:'Temper the spirit',salvage:'Return to essence'};
  const buttonLabels={forge:'Forge 1 copy',upgrade:`Upgrade to Lv. ${Math.min(5,current+1)}`,salvage:'Review salvage'};
  const owned=game.known[card.id]||0;
  let content='';
  if(mode==='upgrade') {
    const before=cardPreview(game,card,current),after=cardPreview(game,card,Math.min(5,current+1));
    content=`<div class="workbench-steps" aria-label="Card level ${current} of 5">${Array.from({length:5},(_,i)=>`<span class="workbench-step ${i<current?'filled':''}"></span>`).join('')}</div><div class="upgrade-comparison"><div class="comparison-side"><small>CURRENT · LV. ${current}</small>${effectBadges(before.effects)}</div>${icon('arrow')}<div class="comparison-side"><small>${current>=5?'PERFECTED':`NEXT · LV. ${current+1}`}</small>${effectBadges(after.effects)}</div></div><p class="workbench-notice">Card levels apply to every owned copy of this technique. Qi costs, timing, and exhaustion stay explicit in its rules.</p>`;
  } else if(mode==='salvage') {
    const reserved=quote.reserved??rules.reservedCopies?.(game,card.id)??0;
    const safe=Math.max(0,owned-reserved);
    content=`<p class="workbench-notice danger">Consumes one card copy. Preview the materials before confirming.</p><div class="workbench-fee"><span>Owned / reserved</span><b>${owned} / ${reserved}</b></div><div class="workbench-fee"><span>Safe surplus</span><b>${safe} ${safe===1?'copy':'copies'}</b></div><p class="workbench-caption">Your active deck, saved decks, and editing draft reserve copies. Remove a card from those lists to release it. Learned card levels remain; upgrade costs are not refunded.</p>`;
  } else content=`<div class="workbench-fee"><span>Inventory after forging</span><b>${owned>=4?`${owned} / 4 · Full`:`${owned} → ${owned+1} copies`}</b></div><p class="workbench-caption">A guaranteed copy at Lv. ${current}. No random roll or failure chance.</p>`;
  const materials=mode==='salvage'?(quote.result?.materials||economy.salvageYield(card)):quote.materials;
  const completed=mode==='upgrade'&&current>=5;
  const materialSection=completed?'<p class="workbench-notice">Perfected · all five card levels attained. This quality applies to every copy you own or acquire later.</p>':`<div class="eyebrow">${mode==='salvage'?'MATERIALS RETURNED':'REQUIRED MATERIALS'}</div>${costRows(game,materials,{yieldOnly:mode==='salvage'})}${mode!=='salvage'?`<div class="workbench-fee"><span>Artisan fee</span><b>${priceLabel(quote.jade||0)}</b></div><p class="workbench-caption">Acquisition requirement: ${esc(requirementLabel(quote.requiredLevel||economy.cardRequirement(card).level))}</p>`:''}`;
  return `<aside class="workbench-panel" data-tutorial="workshop-bench"><div class="eyebrow">${esc(labels[mode])}</div><div class="workbench-output">${image(cardArt(card))}<div><span class="card-level-pill">Lv. ${current}</span><h3>${esc(card.name)}</h3><div class="type-line">${typeSeal(card)}</div><span class="commerce-owned">${esc(school(card.school))} · ${esc(titleCase(card.rarity))}</span></div></div>${content}<div class="workbench-divider"></div>${materialSection}${blockerList(quote)}${button(completed?'Maximum level':buttonLabels[mode],action,card.id,{className:'primary workbench-primary',icon:mode==='salvage'?'essence':'forge',disabled:!quote.ok})}<div class="workbench-links">${button('Full card rules','card-details',card.id,{className:'quiet compact'})}${button('Buy materials','open-material','',{className:'quiet compact'})}${button('Earn resources','open-bounties','',{className:'quiet compact'})}</div></aside>`;
}

function equipmentRecipes(game,ui) {
  const list=rules.recipes.filter(recipe=>{
    const item=rules.itemById[recipe.item];
    return item&&(!ui.filter||item.type===ui.filter)&&matches(item,ui.query);
  });
  return `<div class="commerce-controls"><div class="commerce-filters">${filter('Type','category',[...new Set(rules.recipes.map(recipe=>rules.itemById[recipe.item]?.type).filter(Boolean))].map(id=>[id,titleCase(id)]),ui.filter)}</div>${search(ui)}<span class="commerce-count">${list.length} recipes</span></div><div class="commerce-item-grid">${list.map(recipe=>{
    const item=rules.itemById[recipe.item];
    const affordable=game.jade>=recipe.gold&&Object.entries(recipe.materials).every(([id,n])=>(game.bag[id]||0)>=n);
    return `<article class="commerce-item"><button data-action="item-details" data-id="${esc(item.id)}" aria-label="${esc(item.name)} details">${image(itemIcon(item))}</button><div><div class="eyebrow">${esc(titleCase(item.type))}</div><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="ingredient-list">${Object.entries(recipe.materials).map(([id,n])=>`<div class="ingredient-row ${(game.bag[id]||0)<n?'short':''}">${image(itemIcon(rules.itemById[id]))}<span class="ingredient-label">${esc(rules.itemById[id]?.name||id)}</span><span class="ingredient-quantity">${game.bag[id]||0} / ${n}</span></div>`).join('')}</div>${button(`Craft · ${recipe.gold} jade`,'craft',item.id,{disabled:!affordable,icon:'forge'})}</div></article>`;
  }).join('')}</div>${list.length?'':empty('No recipes found','Change the item type or search term.')}`;
}

export function workshop(game,ui={}) {
  const mode=['forge','upgrade','salvage','equipment'].includes(ui.tab)?ui.tab:'forge';
  let body;
  if(mode==='equipment') body=equipmentRecipes(game,ui);
  else {
    const quote=mode==='upgrade'?economy.quoteUpgrade:mode==='salvage'?(g,id)=>economy.quoteSalvage(g,id,1):economy.quoteForge;
    const ownedOnly=mode!=='forge';
    const source=ownedOnly?rules.cards.filter(card=>game.known[card.id]):rules.cards;
    const list=filterCards(game,ui,source,quote);
    const selected=rules.cardById[ui.selectedCardId]||list[0];
    body=cardFilters(ui,list.length,{ownership:!ownedOnly})+`<div class="workbench-layout"><div>${paginated(list,ui,card=>cardTile(game,card,{mode,selected:card.id===selected?.id}))}</div>${workbench(game,selected,mode)}</div>`;
  }
  return `<section class="commerce-screen" data-tutorial="workshop-content">${header(game,'Jade Crucible','Forge new techniques, temper their power, or salvage spare copies.')}${tabs([['forge','Forge cards'],['upgrade','Upgrade cards'],['salvage','Salvage cards'],['equipment','Equipment & alchemy']],mode)}${body}</section>`;
}

export function shopInspect(game,id,material=false) {
  if(material) {
    const entry=economy.materialById[id];
    if(!entry) return null;
    const quote=economy.quoteBuyMaterial(game,id,1);
    return {title:entry.name,subtitle:'SHOP · MATERIAL',body:`<div class="purchase-summary"><div class="material-card">${materialIcon(entry)}<div class="material-info">${materialMeta(entry)}<h3>${esc(entry.name)}</h3><span class="material-count">Owned ${game.materials?.[id]||0}</span></div></div><div class="commerce-price">${priceLabel(economy.materialPrice(entry))}<small>/ unit</small></div></div><p class="workbench-notice">Used in guaranteed card forging and upgrades. Tier ${entry.tier} materials unlock at ${esc(requirementLabel(entry.requiredLevel))}.</p><div data-material-quote aria-live="polite">${materialQuantityPreview(game,id,1)}</div><form class="purchase-form" data-form="shop-purchase" data-kind="material" data-id="${esc(id)}"><label class="field">Quantity<input name="quantity" type="number" min="1" max="99" value="1" inputmode="numeric"></label><button type="submit" class="btn primary" data-material-submit ${!quote.ok?'disabled':''}>Buy material</button></form><div class="workbench-links">${button('Earn resources','open-bounties','',{className:'quiet compact'})}</div>`};
  }
  const card=rules.cardById[id];
  if(!card) return null;
  const quote=economy.quoteBuyCard(game,id);
  const ready=cardPreview(game,card);
  return {title:card.name,subtitle:'SHOP · TECHNIQUE',body:`${inspectionTablet(game,card,ready)}<div class="workbench-fee"><span>Price for one copy</span><b>${priceLabel(economy.cardPrice(card))}</b></div><div class="workbench-fee"><span>Owned copies</span><b>${(game.known[id]||0)>=4?`${game.known[id]} / 4 · Full`:`${game.known[id]||0} → ${(game.known[id]||0)+1}`}</b></div><p class="workbench-notice">Acquisition requirement: ${esc(requirementLabel(quote.requiredLevel||economy.cardRequirement(card).level))}. Mission rewards and owned cards remain usable.</p>${blockerList(quote)}<div class="dialog-actions">${button('Forge instead','open-forge',id,{className:'quiet'})}${button(`Buy · ${economy.cardPrice(card)} jade`,'purchase-card',id,{className:'primary',disabled:!quote.ok,icon:'jade'})}</div>`};
}

export function materialQuantityPreview(game,id,quantity) {
  const quote=economy.quoteBuyMaterial(game,id,quantity);
  return `<div class="workbench-fee"><span>Total for ${Number.isSafeInteger(quantity)&&quantity>0?quantity:'—'} units</span><b data-material-total>${priceLabel(quote.jade||0)}</b></div><div class="workbench-fee"><span>Jade remaining</span><b>${game.jade-(quote.jade||0)}</b></div>${blockerList(quote)}`;
}

export function workshopInspect(game,id,mode='forge') {
  const card=rules.cardById[id];
  if(!card) return null;
  if(mode!=='salvage') return {title:card.name,subtitle:`WORKSHOP · ${titleCase(mode)}`,body:workbench(game,card,mode)};
  const quote=economy.quoteSalvage(game,id,1);
  return {title:`Salvage ${card.name}?`,subtitle:'CONSUMES ONE CARD COPY',body:`<div class="workbench-output">${image(cardArt(card))}<div><h3>${esc(card.name)}</h3><span class="commerce-owned">Owned ${game.known[id]||0} → ${Math.max(0,(game.known[id]||0)-1)}</span></div></div><p class="workbench-notice danger">This consumes one spare copy. Cards reserved by your active deck, saved decks, and editing draft are protected. Your learned card level remains; upgrade costs are not refunded.</p><div class="eyebrow">YOU RECEIVE</div>${costRows(game,quote.result?.materials||economy.salvageYield(card),{yieldOnly:true})}${blockerList(quote)}<div class="dialog-actions">${button('Keep card','close')}${button('Salvage 1 copy','salvage-card',id,{className:'danger',disabled:!quote.ok})}</div>`};
}

function inspectionTablet(game,card,ready) {
  return `<div class="inspected-tablet ${frameClasses(card)}">${frameCrest(card)}<span class="cost">${ready.cost}</span><div class="card-image">${image(cardArt(card))}</div><div class="collection-body"><h3>${esc(card.name)}</h3>${typeSeal(card)}${effectBadges(ready.effects)}</div></div><div class="inspection-level"><span class="card-level-pill">Card Lv. ${levelOf(game,card.id)} / 5</span><span>Owned ×${game.known[card.id]||0}</span></div><ul class="upgrade-rules">${techniqueRules(ready).map(rule=>`<li>${esc(rule)}</li>`).join('')}</ul>`;
}

export function cardInspection(game,id) {
  const card=rules.cardById[id];
  if(!card) return null;
  const combat=game.active?.combat;
  const entry=combat&&['hand','drawPile','discard','exhausted'].flatMap(key=>combat[key]||[]).find(entry=>entry.id===id);
  const ready=entry?resolveTechnique(combat.cards[id],entry.upgrade,combat.bonuses,entry.level):cardPreview(game,card,levelOf(game,id),game.known[id]?rules.bonuses(game):{});
  return {title:card.name,subtitle:`${school(card.school)} · ${titleCase(card.rarity)} · ${ready.cost} Qi`,body:`${inspectionTablet(game,card,ready)}${card.flavor?`<blockquote>${esc(card.flavor)}</blockquote>`:''}${game.active?'<p class="workbench-notice">Return from this expedition to use the Shop or Workshop. These rules show the technique in your current battle.</p>':''}<div class="card-inspect-links">${button('Buy copy','open-shop',id,{icon:'market',disabled:Boolean(game.active)})}${button('Forge copy','open-forge',id,{icon:'forge',disabled:Boolean(game.active)})}${game.known[id]?button('Upgrade','open-upgrade',id,{icon:'spark',disabled:Boolean(game.active)}):''}</div>`};
}

function deckTray(game,draft) {
  const grouped=counts(draft.cards);
  const preset=(game.deckPresets||[]).find(entry=>entry.id===draft.sourceId);
  const active=game.activeDeckId===draft.sourceId;
  const savedCurrent=preset&&JSON.stringify(preset.cards)===JSON.stringify(draft.cards)&&preset.name===draft.name;
  const liveCurrent=JSON.stringify(game.deck)===JSON.stringify(draft.cards);
  const legal=draft.cards.length>=8&&draft.cards.length<=22&&Object.entries(grouped).every(([id,n])=>n<=Math.min(4,game.known[id]||0));
  const curve=[0,1,2,3,4].map(q=>draft.cards.filter(id=>Math.min(4,rules.cardById[id]?.cost||0)===q).length);
  const highest=Math.max(1,...curve);
  const schoolCounts=draft.cards.reduce((all,id)=>{const school=rules.cardById[id]?.school||'neutral';all[school]=(all[school]||0)+1;return all},{});
  return `<aside class="deck-tray" data-tutorial="deck-tray"><div class="eyebrow">${preset?'EDITING SAVED DECK':'NEW DECK DRAFT'}</div><h2>${esc(draft.name||'Untitled deck')}</h2><div class="deck-status"><b class="${legal?'':'incomplete'}">${draft.cards.length} / 22 cards</b><span>${legal?'Ready to save':'Minimum 8 · maximum 4 per card'}</span></div><form data-form="deck-save"><label class="field">Deck name<input name="deckName" maxlength="24" value="${esc(draft.name||'')}" required placeholder="Name your path"></label><div class="deck-curve" aria-label="Qi curve">${curve.map((n,i)=>`<div title="${i===4?'4+':i} Qi: ${n} cards"><i style="height:${Math.max(3,n/highest*42)}px"></i><b>${i===4?'4+':i}</b></div>`).join('')}</div><div class="deck-curve-label">Qi cost distribution</div><div class="deck-schools">${Object.entries(schoolCounts).map(([id,n])=>`<span class="deck-school-pill">${esc(school(id))} ${n}</span>`).join('')}</div><div class="deck-tray-list">${Object.entries(grouped).sort(([a],[b])=>(rules.cardById[a]?.cost||0)-(rules.cardById[b]?.cost||0)).map(([id,n])=>{
    const card=rules.cardById[id];
    if(!card) return '';
    return `<div class="deck-tray-row">${image(cardArt(card))}<span class="deck-tray-name"><b>${esc(card.name)}</b><small>${card.cost} Qi · Lv. ${levelOf(game,id)}</small></span>${button('−','draft-remove',id,{className:'compact',ariaLabel:`Remove ${card.name}`})}<span class="deck-copy-count">${n}</span>${button('+','draft-add',id,{className:'compact',disabled:n>=Math.min(4,game.known[id]||0)||draft.cards.length>=22,ariaLabel:`Add ${card.name}`})}</div>`;
  }).join('')||'<p class="workbench-caption">Choose owned techniques from the collection to begin.</p>'}</div><div class="deck-change-notice">${active&&liveCurrent?'This is your current battle deck.':active?'Saved changes take effect after you activate this deck.':'Editing this draft leaves your current battle deck ready to play.'}</div><div class="deck-tray-actions"><button type="submit" class="btn primary" ${!legal?'disabled':''}>${icon('book')}Save deck</button>${preset?button('Activate','deck-activate',preset.id,{disabled:!savedCurrent||!legal,className:'primary'}):''}</div></form><div class="deck-tray-actions">${button('New deck','deck-edit','new',{className:'quiet compact'})}${preset?button('Duplicate','deck-duplicate',preset.id,{className:'quiet compact'}):''}${preset?button('Delete','deck-delete-preview',preset.id,{className:'quiet compact'}):''}</div></aside>`;
}

export function deckWorkspace(game,ui={}) {
  const draft=rules.deckDraft?rules.deckDraft(game):game.deckDraft||{name:'Journey deck',cards:[...game.deck],sourceId:game.activeDeckId};
  const presets=game.deckPresets||[];
  const archive=ui.tab==='archive'||ui.tab==='lineages';
  const source=rules.cards.filter(card=>(archive||game.known[card.id])&&(ui.tab!=='lineages'||card.expansion));
  const list=filterCards(game,ui,source,archive?economy.quoteBuyCard:(g,id)=>({ok:Boolean(g.known[id])}));
  const presetStrip=`<div class="deck-presets" aria-label="Saved decks">${presets.map(preset=>`<button class="deck-preset ${preset.id===game.activeDeckId?'active':''} ${preset.id===draft.sourceId?'editing':''}" data-action="deck-edit" data-id="${esc(preset.id)}">${icon('cards')}<b>${esc(preset.name)}</b><small>${preset.cards.length} cards · ${preset.id===game.activeDeckId?'Active':'Saved'}</small></button>`).join('')}<button class="deck-preset deck-preset-new" data-action="deck-edit" data-id="new" ${(presets.length>=8)?'disabled':''}>${icon('spark')}<b>New deck</b></button></div>`;
  return `<section class="commerce-screen" data-tutorial="deck-content">${header(game,'Decks & Techniques','Build a path from your collection. Save different decks and activate one for battle.','deck')}${presetStrip}${tabs([['known','Owned cards'],['archive','Technique archive'],['lineages','Forbidden Lineages']],ui.tab||'known')}${cardFilters(ui,list.length,{ownership:archive,tiers:false})}<div class="deck-workspace"><div>${paginated(list,ui,card=>archive?cardTile(game,card,{mode:'shop'}):cardTile(game,card,{mode:'deck',draft}))}</div>${deckTray(game,draft)}</div></section>`;
}
