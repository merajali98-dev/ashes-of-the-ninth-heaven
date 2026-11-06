import {esc} from './ui.js';

const sanctuary=[
  {page:'home',target:'.cultivator-plaque',title:'Your path to immortality',text:'Essence raises you through nine layers of each realm. At the threshold, pay jade to break through, gain vitality and reveal a stronger appearance.'},
  {page:'campaign',target:'.expedition-path',title:'Follow the chronicle',text:'Choose an open expedition. Story rewards grant cards, gear, jade and cultivation essence. Your choices are recorded permanently.'},
  {page:'deck',target:'.deck-tray',title:'Build a deck from your cards',text:'Add owned copies to an editing draft. Save a named deck, then activate it for battle. Decks carry 8–22 cards, with up to four of each technique.'},
  {page:'market',target:'[data-tutorial="shop-content"]',title:'Choose your next technique',text:'The Shop lists every card and all raw materials. Cultivation unlocks higher offers. Select an item to inspect its exact price and requirements.'},
  {page:'forge',target:'.workbench-panel',title:'Shape your collection',text:'Forge cards from Seal Jade and school essences. Upgrade a technique for every owned copy, or salvage spare cards. Copies reserved by decks are protected.'},
  {page:'bounties',target:'.bounty-grid',title:'Earn what you need',text:'Material commissions are repeatable duels with guaranteed rewards. Choose a school and material tier to gather toward an exact recipe. Your story card rewards remain yours.'},
];
const battle=[
  {target:'.enemy-intent-token',title:'Read the next move',text:'The enemy announces its next action. Guard absorbs damage; the forecast beside End turn shows what will reach your vitality.'},
  {target:'.player-resource-bar .qi',title:'Spend your Qi',text:'Each card has a Qi cost. Qi refreshes each turn. Three consecutive techniques of one school trigger Resonance; Common Form preserves the chain.'},
  {target:'.duel-hand',title:'Play a technique',text:'Drag a card onto its target hero, or select a card and tap the glowing hero. Press 1–9 to select and Enter to cast. Pacts also require vitality.'},
  {target:'.turn-stone',title:'Pass the storm',text:'End your turn when ready. The enemy acts, timed arts resolve and you draw a new hand. Win the duel, then claim its rewards. You can replay this guide in Settings.'},
];
let configuration=null;
let currentKey='';
let activeTarget=null;

function clear() {
  document.querySelector('#tutorial-layer')?.remove();
  activeTarget?.classList.remove('tutorial-focus');
  activeTarget=null;
}

export function renderTutorial(game,page,{navigate,persist}={}) {
  clear();
  configuration={game,page,navigate,persist};
  if(!game.started||!game.tutorial||document.querySelector('#dialog')?.open) return;
  const phase=page==='battle'?'battle':'sanctuary';
  if(phase==='battle'&&game.active?.combat?.outcome) return;
  const steps=phase==='battle'?battle:sanctuary;
  const index=game.tutorial[phase];
  if(index>=steps.length) return;
  const step=steps[index];
  const key=`${phase}-${index}`;
  if(step.page&&step.page!==page) return;
  const target=document.querySelector(step.target);
  if(!target) return;
  activeTarget=target;
  activeTarget.classList.add('tutorial-focus');
  if(currentKey!==key) target.scrollIntoView({block:'center',behavior:'instant'});
  currentKey=key;
  const box=target.getBoundingClientRect();
  const width=Math.min(370,window.innerWidth-24);
  const topSpace=box.top;
  const bottomSpace=window.innerHeight-box.bottom;
  let top=bottomSpace>245?box.bottom+16:topSpace>245?box.top-235:window.innerHeight-250;
  top=Math.max(12,Math.min(window.innerHeight-240,top));
  const left=Math.max(12,Math.min(window.innerWidth-width-12,box.left+box.width/2-width/2));
  const layer=document.createElement('div');
  layer.id='tutorial-layer';layer.className='tutorial-layer';
  layer.innerHTML=`<div class="tutorial-spotlight" style="left:${Math.max(2,box.left-5)}px;top:${Math.max(2,box.top-5)}px;width:${Math.min(window.innerWidth-4,box.width+10)}px;height:${Math.min(window.innerHeight-4,box.height+10)}px"></div><section class="tutorial-card" role="dialog" aria-label="${esc(step.title)}" style="width:${width}px;left:${left}px;top:${top}px"><div class="eyebrow">${phase==='battle'?'YOUR FIRST DUEL':'THE SHRINE KEEPER’S GUIDE'} · ${index+1} / ${steps.length}</div><h2>${esc(step.title)}</h2><p>${esc(step.text)}</p><div class="tutorial-dots">${steps.map((_,i)=>`<i class="${i<=index?'lit':''}"></i>`).join('')}</div><div class="tutorial-actions"><button type="button" class="btn quiet compact" data-tutorial-action="skip">Skip guide</button><button type="button" class="btn primary compact" data-tutorial-action="next">${index===steps.length-1?'Begin':'Next'}</button></div></section>`;
  layer.addEventListener('click',event=>{
    const action=event.target.closest('[data-tutorial-action]')?.dataset.tutorialAction;
    if(!action) return;
    game.tutorial[phase]=action==='skip'?steps.length:index+1;
    persist?.();clear();
    const next=steps[game.tutorial[phase]];
    if(phase==='sanctuary') navigate?.(next?.page||'campaign');
    else renderTutorial(game,page,{navigate,persist});
  });
  document.body.append(layer);
  const card=layer.querySelector('.tutorial-card');
  card.style.top=Math.max(12,Math.min(window.innerHeight-card.offsetHeight-12,top))+'px';
}

export function dismissTutorial() {clear()}
window.addEventListener('resize',()=>{
  if(configuration) renderTutorial(configuration.game,configuration.page,configuration);
});
