import * as gameRules from './progression.js';
import * as views from './views.js';
import * as hub from './game-hub.js';
import * as commerce from './workshop-views.js';
import * as petViews from './pet-views.js';
import {renderTutorial,dismissTutorial} from './tutorial.js';
import { icon, esc, button } from './ui.js';
import { STATUS_INFO, captureCombatEvents, getCard } from './combat.js';
import { snapshotBattle, battleFeedback, playBattleEffects, clearBattleEffects } from './battle-fx.js';
import {captureProgression,playProgressionEffects,clearProgressionEffects} from './progression-fx.js';
import {configureAudio,unlockAudio,preloadSounds,playSound,stopAudioScope,stopAllAudio} from './audio-engine.js';
import * as market from './market/local.js';
import * as marketViews from './market/views.js';
import {runFastForward} from './market/fastforward.js';
import {installPriceTooltips} from './market/tooltip.js';
import * as online from './online/session.js';
import * as onlineViews from './online/views.js';

const root = document.querySelector('#app');
const toast = document.querySelector('#toast');
const dialog = document.querySelector('#dialog');
const storage = {
  getItem:key => window.localStorage.getItem(key),
  setItem:(key,value) => window.localStorage.setItem(key,value),
};
const {game:loaded,warning} = gameRules.readSave(storage);
let game = loaded;
let page = game.active ? 'battle' : location.hash === '#market-sim' ? 'market-sim' : 'home';
let ui = {};
let toastTimer;
let combatMotion=null;
let combatMotionToken=0;
let combatBusy=false;
let combatControls=new Map();
let committedProgress=captureProgression(game);
let audioWarmup=null;
let audioIntent=0;
// Fast-forward scenarios for judges: the same engine and rules as the live market, labelled as a simulation.
const SIM_SCENARIOS={week:{cast:{flooder:false}},flood:{cast:{flooder:true}},audit:{cast:{flooder:false},shocks:[{id:'ministry-audit',tick:60}]}};
let simParams=structuredClone(SIM_SCENARIOS.week),simScenario='week',simResult=null,simTimer=null;
const announcedOutcomes=new WeakSet();
let dialogTrigger;
let saveWarningShown = false;
let draggedCard = null;
let suppressCardClickUntil = 0;
let shellMarkup='';
const screens = {home:hub.home,campaign:hub.campaign,deck:views.deck,inventory:views.inventory,
  forge:commerce.workshop,market:commerce.shop,'market-sim':(game,ui)=>marketViews.simPage(simulation(),ui),trial:views.trial,codex:views.codex,battle:hub.battle,bounties:hub.bounties,pets:petViews.petHabitat};
const combatActions=new Set(['select-card','cast-card','play','end','use','pet-ability']);
syncAudioPreferences();

function syncAudioPreferences() {
  const settings={...gameRules.DEFAULT_AUDIO_SETTINGS,...game.audioSettings};
  configureAudio({enabled:game.sound,masterVolume:settings.master,combatVolume:settings.combat,uiVolume:settings.ui,progressionVolume:settings.progression,petsVolume:settings.pets});
}

function warmAudio() {
  if(!game.sound)return Promise.resolve(false);
  const unlocked=unlockAudio();
  if(!audioWarmup)audioWarmup=Promise.resolve(unlocked).then(ready=>ready?preloadSounds():false).catch(()=>false);
  return audioWarmup;
}

function announceOutcome(combat) {
  if(!combat?.outcome||announcedOutcomes.has(combat))return;
  announcedOutcomes.add(combat);
  playSound(combat.outcome==='victory'?'victory':'defeat',{scope:'outcome',priority:5});
}

function lockCombatInput() {
  combatBusy=true;
  root.classList.add('combat-motion-busy');
  root.setAttribute('aria-busy','true');
  draggedCard=null;
  delete root.dataset.dragTarget;
  combatControls=new Map([...root.querySelectorAll('[data-action]')].filter(node=>combatActions.has(node.dataset.action)).map(node=>[node,node.disabled]));
  for(const node of combatControls.keys())node.disabled=true;
}

function unlockCombatInput() {
  combatBusy=false;
  root.classList.remove('combat-motion-busy');
  root.removeAttribute('aria-busy');
  for(const [node,disabled] of combatControls)if(node.isConnected)node.disabled=disabled;
  combatControls.clear();
}

function cancelCombatMotion({settle=false}={}) {
  combatMotionToken++;
  combatMotion?.cancel?.();
  combatMotion=null;
  clearBattleEffects();
  unlockCombatInput();
  if(ui.finishing) {
    ui.finishing=false;
    if(settle){render();announceOutcome(game.active?.combat)}
  }
}

function renderShell() {
  const markup=hub.shell(game,page);
  if(markup===shellMarkup)return;
  const current=root.querySelector('.game-shell');
  if(!current)root.innerHTML=markup;
  else {
    const template=document.createElement('template');template.innerHTML=markup;
    const next=template.content.firstElementChild;
    current.className=next.className;
    for(const selector of ['.game-topbar','.game-dock']) {
      const old=current.querySelector(selector),replacement=next.querySelector(selector);
      if(old?.outerHTML===replacement?.outerHTML)continue;
      if(old&&replacement)old.replaceWith(replacement);
      else if(old)old.remove();
      else if(replacement)current.append(replacement);
    }
    current.querySelector('#screen').dataset.page=page;
  }
  shellMarkup=markup;
}

function renderSelection() {
  if(!hub.updateBattleSelection(root,game,ui))return render();
  renderTutorial(game,page,{navigate,persist});
}

function render({focus = false, preserve = true} = {}) {
  const handScroll = root.querySelector('.duel-hand')?.scrollLeft || 0;
  const old = document.activeElement;
  const key = old?.dataset?.action;
  const id = old?.dataset?.id;
  renderShell();
  const main = root.querySelector('#screen');
  main.classList.remove('screen-enter');
  ui.sealChip = onlineViews.marketChip(online.state);
  main.innerHTML = screens[page](game,ui);
  if(page==='pets')petViews.bindPetMapControls(root);
  const hand = main.querySelector('.duel-hand');
  if (hand) hand.scrollLeft = handScroll;
  document.title = (page === 'home' ? '' : (views.NAV.find(entry => entry[0] === page)?.[2] || (page==='market-sim'?'Fast-forward':'Encounter')) + ' · ') + 'Ashes of the Ninth Heaven';
  if (focus) main.focus({preventScroll:true});
  else if (preserve && key && !dialog.open) {
    const next = Array.from(root.querySelectorAll('button[data-action]'))
      .find(entry => entry.dataset.action === key && entry.dataset.id === id && !entry.disabled);
    next?.focus({preventScroll:true});
  }
  renderTutorial(game,page,{navigate,persist});
}

function notify(message, error = false) {
  if (!message) return;
  clearTimeout(toastTimer);
  const target = dialog.open ? dialog.querySelector('.dialog-status') : toast;
  toast.classList.remove('visible');
  target.textContent = message;
  target.classList.toggle('error',error);
  target.classList.add('visible');
  toastTimer = setTimeout(() => target.classList.remove('visible'), 3900);
}

function persist() {
  if (!gameRules.writeSave(storage,game) && !saveWarningShown) {
    saveWarningShown = true;
    notify('This browser could not save your progress.',true);
  }
}

function interactionSound(action) {
  const cues={buy:'purchase',order:'purchase',sell:'purchase','purchase-card':'purchase','purchase-material':'purchase','market-sell':'purchase','market-buy':'purchase','market-invest':'purchase',learn:'purchase',craft:'forge','forge-card':'forge','upgrade-card':'upgrade',refine:'upgrade','salvage-card':'salvage','deck-save':'deck-save','deck-activate':'deck-equip',equip:'deck-equip','pet-equip':'deck-equip','pet-unequip':'deck-equip','deck-add':'ui-select','deck-remove':'ui-select','draft-add':'ui-select','draft-remove':'ui-select','deck-edit':'ui-select','deck-duplicate':'deck-save','deck-delete':'salvage',rest:'rest',resolve:'reward',study:'upgrade',begin:'reward','pet-feed-confirm':'pet-feed',retreat:'ui-close'};
  const cue=cues[action];if(cue)playSound(cue,{scope:'ui',volume:action==='resolve'?0.55:1});
}

function openDialog(spec) {
  if (!spec) return;
  const refreshing=dialog.open&&dialog.querySelector('#dialog-title')?.textContent===spec.title;
  if(!refreshing){audioIntent++;audioWarmup=null;stopAllAudio()}
  if(combatBusy)cancelCombatMotion({settle:true});
  dismissTutorial();
  if (!dialog.open) dialogTrigger = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">${esc(spec.subtitle || 'THE FALLEN REALM')}</div><h2 id="dialog-title">${esc(spec.title)}</h2></div>
    <button type="button" class="icon-btn" data-action="close" aria-label="Close dialog">${icon('close')}</button></div><div class="dialog-body">${spec.body}<div class="dialog-status" role="status"></div></div>`;
  if (!dialog.open) dialog.showModal();
  if(!refreshing)playSound('ui-open',{scope:'ui',volume:.65});
  (dialog.querySelector('[autofocus]') || dialog.querySelector('.icon-btn')).focus();
}

function closeDialog() {
  if (dialog.open){audioIntent++;stopAudioScope('preview');dialog.close();playSound('ui-close',{scope:'ui',volume:.6})}
}

dialog.addEventListener('close', () => {
  if (dialogTrigger?.isConnected) dialogTrigger.focus({preventScroll:true});
  else root.querySelector('#screen')?.focus({preventScroll:true});
  renderTutorial(game,page,{navigate,persist});
});

dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
});

function navigate(next) {
  if (!screens[next] || game.active && next !== 'battle' || !game.active && next === 'battle') return;
  stopAllAudio();
  audioIntent++;audioWarmup=null;
  closeDialog();
  petViews.clearPetCelebration();
  clearProgressionEffects();
  cancelCombatMotion();
  page = next;
  ui = {};
  stopSim();
  if(next==='market-sim'){ui.simPlaying=true;ui.simScenario=simScenario;startSim()}
  if((next==='market-sim')!==(location.hash==='#market-sim'))history.replaceState(null,'',next==='market-sim'?'#market-sim':location.pathname+location.search);
  render({focus:true});
  root.querySelector('#screen').classList.add('screen-enter');
  window.scrollTo(0,0);
  playSound('ui-click',{scope:'ui',volume:.65});
}

function change(action,result, next) {
  if (!result?.ok) {
    notify(result?.reason || 'This action is unavailable.',true);
    playSound('ui-error',{scope:'ui'});
    return false;
  }
  const beforeProgress=committedProgress;
  const afterProgress=captureProgression(game);
  committedProgress=afterProgress;
  persist();
  if (next) navigate(next);
  else render();
  interactionSound(action);
  notify(result.message);
  playProgressionEffects({before:beforeProgress,after:afterProgress,root,action,skipPetRealm:action==='pet-evolve'||action==='pet-hatch'});
  return true;
}

function oath(id) {
  openDialog({title:'The Oath in Ash',subtitle:'PROLOGUE',body:`
    <p class="dialog-lead">The Ninth Heaven broke open on the night the dead stopped answering their names. At dawn, a shrine keeper found you under the fallen gate with a scorched blade and a debt written on your wrist.</p>
    <p>“Keep your name close,” she says. “The heavens have started collecting again.”</p>
    <form data-form="begin" data-id="${esc(id)}"><label class="field">Your name<input name="name" maxlength="24" placeholder="Ash-Bearer" autocomplete="off" autofocus></label>
      <fieldset class="difficulty"><legend>Choose your path</legend>${Object.entries(gameRules.DIFFICULTIES).map(([key,entry],index) =>
        `<label><input type="radio" name="difficulty" value="${key}" ${index === 0 ? 'checked' : ''}><span><b>${entry.name}</b><small>${entry.description}</small></span></label>`).join('')}</fieldset>
      <div class="dialog-actions"><button type="submit" class="btn primary">${icon('arrow')} Swear the oath</button></div></form>`});
}

function guide() {
  openDialog({title:'Field guide',subtitle:'REFERENCE',body:`
    <div class="guide"><section><h3>Expeditions</h3><p>Choose an expedition on the world map. Choices and rewards are written to your Chronicle. Learn techniques through rewards and manuals.</p></section>
    <section><h3>Battle</h3><p>Two cultivators face each other on one board. Drag a technique onto its glowing target, or select a card and tap the target hero. Spend Qi to cast. Guard absorbs attack damage until your next turn. Read the enemy’s intent before ending the turn.</p>
    <p class="microcopy">Keyboard: 1–9 selects a card. Enter casts the selected card. Escape cancels selection. E ends your turn. The icons beside your hero are battle supplies.</p></section>
    <section><h3>Resonance</h3><p>Play three techniques of the same school in succession to gain a school effect, 1 Qi, and a card draw. Neutral techniques preserve the chain.</p></section>
    <section><h3>Cultivation</h3><p>Lifetime essence raises nine layers within each of ten realms. At a realm threshold, pay jade for a guaranteed breakthrough, more vitality and new armor. Your cultivation level unlocks card purchases and material grades. Earned cards stay usable. Material commissions offer repeatable duels with guaranteed jade, essence and your chosen school materials.</p></section>
    <section><h3>Shop & workshop</h3><p>Buy any unlocked technique or gather Seal Jade and school essences to forge it. Every card has an exact recipe. Temper a technique through five levels using materials; quality applies to all copies. Salvaging returns a quarter of its base ingredients and protects copies used by active decks, saved decks and drafts. There are no random crafting failures.</p></section>
    <section><h3>Decks</h3><p>Build an editing draft from owned cards, save a named deck and activate it for battle. Drafts may be incomplete; saved lists need 8–22 cards with at most four copies of one technique. Editing does not change your current battle deck until activation.</p></section>
    <section><h3>Spirit companions</h3><p>Visit Spirit Pets to choose any of eight mythical eggs. Your first hatch is free. Feed spare card copies for pet cultivation essence; feeding destroys those copies and preserves shared card quality. Cards reserved in active decks, saved decks, and drafts are protected. Guide your companion through the same ten realms and nine layers; it cannot evolve beyond your own realm.</p><p>Choose one hatched pet to travel with you. Its unlocked instincts trigger automatically in battle. Invoke one spirit command per turn without spending Qi; each command has its own cooldown. A two-turn cooldown used on turn one becomes ready on turn three. Cooldowns and companion state survive saving during battle.</p></section>
    <section><h3>Forbidden Lineages</h3><p>Browse 597 techniques in the archive. Obtain copies from the Shop, Workshop, or expedition rewards.</p>
    <p>Formations and stances are timed arts attached to your hero. Up to three can be active. Replaying one refreshes it. Rituals resolve after the indicated number of your turns, with six pending at most. Recovery returns spent techniques to discard and cannot return recovery arts.</p></section>
    <section><h3>Combat statuses</h3><dl>${Object.values(STATUS_INFO).map(entry => `<dt>${esc(entry.name)}</dt><dd>${esc(entry.description)}</dd>`).join('')}</dl></section></div>`});
}

function settings() {
  const mix={...gameRules.DEFAULT_AUDIO_SETTINGS,...game.audioSettings};
  openDialog({title:'Settings',subtitle:'CHRONICLE',body:`
    <p class="dialog-lead">Progress is saved automatically in this browser.</p>
    <section class="audio-mixer" aria-label="Sound settings"><div class="audio-mixer-heading"><h3>Sound mix</h3>${button(game.sound?'Mute sound effects':'Enable sound effects','sound','',{icon:game.sound?'sound':'mute'})}</div>
      <p class="microcopy">Adjust the mix. Your choices save with this chronicle.</p>
      ${Object.entries({master:'Master volume',combat:'Combat & spells',ui:'Interface & workshop',progression:'Cultivation',pets:'Spirit companions'}).map(([id,label])=>`<label class="audio-slider"><span>${label}</span><input type="range" min="0" max="100" step="1" value="${Math.round(mix[id]*100)}" data-audio-setting="${id}" aria-label="${label}"><output data-audio-value="${id}">${Math.round(mix[id]*100)}%</output></label>`).join('')}
      <div class="audio-mixer-actions">${button('Test sound','audio-preview','',{icon:'sound',disabled:!game.sound||!mix.master})}${button('Audio credits','audio-credits','',{className:'quiet'})}</div>
    </section>
    ${onlineViews.settingsSection(online.state)}
    <div class="settings-list">
      ${button('Download save','export','',{icon:'book'})}
      ${button('Load save file','import','',{icon:'bag'})}
      ${button('Replay shrine keeper’s guide','tutorial-replay','',{icon:'compass'})}
      ${button('Reset chronicle','reset','',{className:'danger'})}
    </div><input type="file" id="import-save" accept="application/json,.json" hidden>`});
}

// Sign-in and the ledger seal (js/online). The practice market keeps working whatever happens here.
let sealFlow={};
const SEAL_ERRORS={BAD_EMAIL:'That email does not look right.',WRONG_CODE:'That code is not right. Check it and try again.',
  CODE_EXPIRED:'That code has expired. Ask for a new one.',SLOW_DOWN:'Too many tries. Wait a few minutes and try again.',
  NAME_TAKEN:'That name is already in the ledger. Choose another.',BAD_NAME:'Names use 3–20 lowercase letters, numbers or dashes, starting with a letter.',
  BUSY:'The Honest Ledger is busy. Try again in a minute.',GOOGLE_REFUSED:'Google could not confirm that sign-in.',OFFLINE:'The Honest Ledger is closed right now. The practice market still works.'};
const sealError=error=>SEAL_ERRORS[error?.code]||'Something went wrong. Try again in a moment.';
const sealName=()=>(dialog.querySelector('#seal-name')?.value||sealFlow.name||'').trim().toLowerCase();
function openSeal(){
  openDialog(onlineViews.sealDialog(online.state,sealFlow));
  online.mountGoogleButton(dialog.querySelector('#seal-google'),credential=>sealStep(()=>online.google(credential)));
}
/** Runs a sign-in step, then presses the seal (account + this browser's key) if the ledger is open. */
async function sealStep(signIn){
  const name=sealName();
  sealFlow={...sealFlow,name,busy:true};openSeal();
  try{
    await signIn();
    if(online.state.ledger&&online.state.signedIn&&!online.state.user?.seal)await online.ensureSeal(name);
    else if(online.state.ledger&&online.state.signedIn)await online.ensureSeal();
    sealFlow={};openSeal();render();
    notify(online.state.user?.seal?'Your seal is pressed. The Honest Ledger will record your trades.':'Signed in.');
  }catch(error){sealFlow.busy=false;openSeal();notify(sealError(error),true)}
}

const mutations = {
  rest:() => gameRules.rest(game),
  breakthrough:() => gameRules.breakthrough(game),
  'deck-add':id => gameRules.changeDeck(game,id,1),
  'deck-remove':id => gameRules.changeDeck(game,id,-1),
  equip:id => gameRules.equip(game,id),
  study:id => gameRules.study(game,id),
  buy:id => gameRules.trade(game,id,'buy'),
  order:id => gameRules.trade(game,id,'order'),
  sell:id => gameRules.trade(game,id,'sell'),
  craft:id => gameRules.craft(game,id),
  play:id => gameRules.fight(game,'play',Number(id)),
  end:() => gameRules.fight(game,'end'),
  use:id => gameRules.fight(game,'use',id),
  'pet-ability':id=>gameRules.fight(game,'pet',id),
};

function activate(action,id = '') {
  if(combatBusy&&combatActions.has(action))return;
  if(combatBusy)cancelCombatMotion({settle:true});
  if(['tab','chapter','bounty-tier','card-page','pet-select','pet-view','pet-map-zoom','workshop-select'].includes(action))playSound('ui-select',{scope:'ui',volume:.6});
  if (action === 'select-card') {
    if (Date.now() < suppressCardClickUntil) return;
    const combat = game.active?.combat;
    const card = combat && getCard(combat,Number(id));
    if (!card || combat.outcome || card.cost > combat.energy) return;
    ui.selectedCard = ui.selectedCard === Number(id) ? null : Number(id);
    playSound('ui-select',{scope:'ui',volume:.7});
    renderSelection();
    return;
  }
  if (action === 'cast-card') {
    const combat = game.active?.combat;
    const card = combat && Number.isInteger(ui.selectedCard) && getCard(combat,ui.selectedCard);
    if (!card || hub.cardTarget(card) !== id) return;
    activate('play',String(ui.selectedCard));
    return;
  }
  if (action === 'play' || action === 'end' || action === 'use' || action==='pet-ability') {
    const combat = game.active?.combat;
    if (!combat || combat.outcome) return;
    const card = action === 'play' ? getCard(combat,Number(id)) : null;
    const item = action === 'use' ? gameRules.itemById[id] : null;
    const petAbility=action==='pet-ability'?combat.pet?.abilities.find(ability=>ability.id===id):null;
    const before = snapshotBattle(root,combat.hand,card ? Number(id) : -1);
    const {result,events} = captureCombatEvents(combat,() => mutations[action](id));
    if (result.ok) {
      ui.selectedCard = null;
      ui.feedback = battleFeedback(card?.name || item?.name || petAbility?.name,events,combat.outcome);
      ui.finishing = Boolean(combat.outcome);
    }
    if (!change(action,result)) return;
    const token=++combatMotionToken;
    lockCombatInput();
    const finished=()=>{
      if(token!==combatMotionToken)return;
      combatMotion=null;
      unlockCombatInput();
      if(game.active?.combat===combat&&combat.outcome) {
        ui.finishing=false;
        clearBattleEffects();
        render({focus:true});
        announceOutcome(combat);
        window.scrollTo(0,0);
      }
    };
    try {
      combatMotion=playBattleEffects(root,before,combat.hand,events,card?.school || item?.school || (petAbility?combat.pet.school:null) || 'neutral',action,{card,petAbility,outcome:combat.outcome,petId:combat.pet?.id});
      Promise.resolve(combatMotion?.finished).then(finished,finished);
    } catch(error) {
      clearBattleEffects();finished();throw error;
    }
    return;
  }
  if (mutations[action]) {
    change(action,mutations[action](id));
    return;
  }
  switch (action) {
    case 'nav': navigate(id); break;
    case 'close': closeDialog(); break;
    case 'begin': oath(id); break;
    case 'help': guide(); break;
    case 'tutorial-replay':
      game.tutorial={version:1,sanctuary:0,battle:0};persist();navigate(game.active?'battle':'home');break;
    case 'realm-path': openDialog(hub.realmDetails(game)); break;
    case 'pet-select':ui.petId=id;render();break;
    case 'pet-view':ui.petView=id==='list'?'list':'map';render();break;
    case 'pet-map-zoom':ui.petZoom=Math.max(1,Math.min(1.6,(ui.petZoom||1)+(id==='+'?0.2:-0.2)));render();break;
    case 'pet-details':openDialog(petViews.petDetails(game,id));break;
    case 'pet-hatch-preview':openDialog(petViews.petHatchPreview(game,id));break;
    case 'pet-evolve-preview':openDialog(petViews.petEvolutionPreview(game,id));break;
    case 'pet-hatch':case 'pet-evolve': {
      const result=action==='pet-hatch'?gameRules.hatchPet(game,id):gameRules.evolvePet(game,id);
      if(result.ok){closeDialog();ui.petId=id}
      if(change(action,result))petViews.showPetCelebration({petId:id,realm:game.pets[id].realm,kind:action==='pet-hatch'?'hatch':'evolve',onComplete:()=>root.querySelector('.pet-main-actions .btn')?.focus({preventScroll:true})});
      break;
    }
    case 'pet-equip':case 'pet-unequip':change(action,gameRules.equipPet(game,action==='pet-unequip'?null:id));break;
    case 'pet-feed-picker':openDialog(petViews.petFeedPicker(game,id,ui));break;
    case 'pet-feed-confirm': {
      const [petId,cardId,quantity]=id.split(':');
      const result=gameRules.feedPet(game,petId,cardId,Number(quantity));
      if(result.ok){closeDialog();ui.petId=petId}
      if(change(action,result))root.querySelector('.pet-selected-art')?.classList.add('pet-fed-glow');
      break;
    }
    case 'open-bounties': navigate('bounties');break;
    case 'bounty-tier': ui.tier=Number(id);render();break;
    case 'start-bounty': {
      const [school,tier]=id.split(':');
      change(action,gameRules.startBounty(game,school,Number(tier)),'battle');break;
    }
    case 'open-shop':
      navigate('market');ui.tab='cards';ui.selectedCardId=id;render();if(id)openDialog(commerce.shopInspect(game,id));break;
    case 'open-material':case 'material-inspect': {
      // Materials trade with merchants now: open the merchant with the cheapest asking price.
      const token='mat:'+id,{ask,bid}=market.bestPrices(game,token);
      navigate('market');ui.tab='merchants';ui.merchant=(ask||bid)?.merchant;ui.focusToken=token;render();break;
    }
    case 'market-merchant': {
      const [merchantId,token]=id.split('|');
      if(page!=='market')navigate('market');
      ui.tab='merchants';ui.merchant=merchantId;ui.focusToken=token||null;render();playSound('ui-select',{scope:'ui',volume:.6});break;
    }
    case 'market-sell':case 'market-buy': {
      const [merchantId,token,quantity]=id.split('|');
      change(action,market.playerTrade(game,merchantId,token,action==='market-sell'?'sell':'buy',Number(quantity)));break;
    }
    case 'market-invest': {
      const [merchantId,jade]=id.split('|');
      change(action,market.playerInvest(game,merchantId,Number(jade)));break;
    }
    case 'sim-scenario':
      simScenario=Object.hasOwn(SIM_SCENARIOS,id)?id:'week';simParams=structuredClone(SIM_SCENARIOS[simScenario]);ui.simScenario=simScenario;rerunSim();ui.simPlaying=true;startSim();render();break;
    case 'sim-play':
      if(ui.simPlaying){ui.simPlaying=false;stopSim()}
      else{if((ui.simFrame||0)>=simulation().frames.length-1)ui.simFrame=0;ui.simPlaying=true;startSim()}
      render();break;
    case 'sim-speed':ui.simSpeed=[1,2,4].includes(Number(id))?Number(id):1;if(ui.simPlaying)startSim();render();break;
    case 'sim-table':ui.simTable=!ui.simTable;render();break;
    case 'sim-shock': {
      const tick=simulation().frames[ui.simFrame||0].tick;
      simParams={...simParams,shocks:[...(simParams.shocks||[]),{id,tick}]};rerunSim(true);render();
      notify(`Shock injected on day ${Math.floor(tick/24)+1} at ${String(tick%24).padStart(2,'0')}:00. The week was replayed with it.`);break;
    }
    case 'open-forge':case 'open-upgrade':case 'open-salvage':
      navigate('forge');ui.tab=action==='open-upgrade'?'upgrade':action==='open-salvage'?'salvage':'forge';ui.selectedCardId=id;render();break;
    case 'shop-inspect': openDialog(commerce.shopInspect(game,id));break;
    case 'workshop-select':ui.selectedCardId=id;render();break;
    case 'purchase-card': {
      const result=gameRules.buyCard(game,id);
      if(change(action,result)&&dialog.open)openDialog(commerce.shopInspect(game,id));break;
    }
    case 'forge-card':case 'upgrade-card':case 'salvage-card': {
      const fn=action==='forge-card'?gameRules.forgeCard:action==='upgrade-card'?gameRules.upgradeCard:gameRules.salvageCard;
      const result=fn(game,id);
      if(result.ok&&action==='salvage-card')closeDialog();
      change(action,result);break;
    }
    case 'salvage-preview':openDialog(commerce.workshopInspect(game,id,'salvage'));break;
    case 'deck-edit':change(action,gameRules.beginDeckDraft(game,id));break;
    case 'draft-add':case 'draft-remove':change(action,gameRules.editDeckDraft(game,id,action==='draft-add'?1:-1));break;
    case 'deck-duplicate': {
      const preset=game.deckPresets.find(deck=>deck.id===id);
      if(!preset)break;
      const result=gameRules.beginDeckDraft(game,id);
      if(result.ok){game.deckDraft.sourceId=null;game.deckDraft.name=(preset.name+' copy').slice(0,24)}
      change(action,result);break;
    }
    case 'deck-activate':change(action,gameRules.activateDeck(game,id));break;
    case 'deck-delete-preview': {
      const preset=game.deckPresets.find(deck=>deck.id===id);
      if(preset)openDialog({title:'Delete '+preset.name+'?',subtitle:'SAVED DECK',body:`<p>${id===game.activeDeckId?'Activate another deck before deleting your current battle deck.':'Delete this saved list. All owned cards remain in your inventory.'}</p><div class="dialog-actions">${button('Keep deck','close')}${button('Delete deck','deck-delete',id,{className:'danger',disabled:id===game.activeDeckId})}</div>`});break;
    }
    case 'deck-delete': {
      const result=gameRules.deleteDeck(game,id);if(result.ok)closeDialog();change(action,result);break;
    }
    case 'settings': settings(); break;
    case 'seal-open': sealFlow={};openSeal(); break;
    case 'seal-back': sealFlow={name:sealFlow.name};openSeal(); break;
    case 'seal-use-code': sealFlow.code=id;openSeal(); break;
    case 'seal-guest': sealStep(()=>online.guest(sealName())); break;
    case 'seal-press': sealStep(async()=>{}); break;
    case 'seal-email-send': {
      const email=dialog.querySelector('#seal-email')?.value.trim()||'';sealFlow.name=sealName();
      sealFlow.busy=true;openSeal();
      online.emailStart(email).then(sent=>{sealFlow={...sealFlow,busy:false,step:'code',email,sent:sent.sent,dev:sent.dev};openSeal()},
        error=>{sealFlow.busy=false;openSeal();notify(sealError(error),true)});
      break;
    }
    case 'seal-email-verify': {
      const code=dialog.querySelector('#seal-code')?.value.trim()||'';
      sealStep(()=>online.emailVerify(sealFlow.email,code));break;
    }
    case 'seal-signout': online.signOut().then(()=>{sealFlow={};closeDialog();render();notify('Signed out on this device. Your seal is kept on the Honest Ledger.')}); break;
    case 'audio-preview': {
      const intent=++audioIntent;
      void warmAudio().then(()=>{if(intent===audioIntent&&game.sound)playSound('sound-preview',{scope:'preview',priority:5})});
      break;
    }
    case 'audio-credits':
      openDialog({title:'Sound credits',subtitle:'ASHES OF THE NINTH HEAVEN',body:'<p>Original layered sound design, with public-domain CC0 Foley by Kenney.</p><ul><li><a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noopener">Kenney Interface Sounds</a></li><li><a href="https://kenney.nl/assets/impact-sounds" target="_blank" rel="noopener">Kenney Impact Sounds</a></li><li><a href="https://kenney.nl/assets/rpg-audio" target="_blank" rel="noopener">Kenney RPG Audio</a></li></ul><p class="microcopy">Audio is bundled with the game and plays locally.</p><div class="dialog-actions">'+button('Back to settings','settings')+'</div>'});break;
    case 'sound':
      game.sound = !game.sound;
      audioIntent++;audioWarmup=null;
      syncAudioPreferences();
      persist();
      if(game.sound){const intent=audioIntent;void warmAudio().then(()=>{if(intent===audioIntent&&game.sound)playSound('ui-select',{scope:'ui'})})}
      render();
      if (dialog.open) settings();
      break;
    case 'chapter': ui.chapter = id; render(); break;
    case 'chapter-story': {
      const chapter = gameRules.chapterById[id];
      if (chapter) openDialog({title:chapter.name,subtitle:chapter.region,body:`<p class="dialog-lead">${esc(chapter.opening)}</p>`});
      break;
    }
    case 'battle-record':
      openDialog({title:'Battle record',subtitle:'THIS ENCOUNTER',body:`<ol class="record-lines">${game.active.combat.log.slice(-30).reverse().map(line => `<li>${esc(line)}</li>`).join('')}</ol>`});
      break;
    case 'tab': ui = {tab:id}; render(); break;
    case 'card-page':
      ui.cardPage = Math.max(0,Number(id) || 0);
      render({focus:true});
      window.scrollTo(0,0);
      break;
    case 'learn': {
      const result = gameRules.learn(game,id);
      if (result.ok && dialog.open) openDialog(views.cardDetails(game,id));
      change(action,result);
      break;
    }
    case 'mission': openDialog(views.missionDetails(game,id)); break;
    case 'card-details': openDialog(views.cardDetails(game,id)); break;
    case 'item-details': openDialog(views.itemDetails(game,id)); break;
    case 'character': {
      const entry = gameRules.characterById[id];
      if (entry) openDialog(views.characterDetails(entry));
      break;
    }
    case 'encounter': change(action,gameRules.encounter(game,id),'battle'); break;
    case 'trial': change(action,gameRules.startTrial(game),'battle'); break;
    case 'resolve': {
      const kind = game.active?.kind;
      const defeated = game.active?.combat?.outcome === 'defeat';
      const result = gameRules.resolveEncounter(game,id);
      const next = defeated || result.epilogue ? 'home' : kind === 'trial' ? 'trial' : kind==='bounty'?'bounties':'campaign';
      if (change(action,result,next) && result.epilogue) {
        openDialog({title:result.ending,subtitle:'THE FIRST UNTAXED DAWN',body:
          `<p class="dialog-lead">${esc(result.epilogue)}</p><div class="dialog-actions">${button('Return to sanctuary','close')}</div>`});
      }
      break;
    }
    case 'refine':
      {
        const result = gameRules.refine(game,id);
        if (result.ok) openDialog(views.cardDetails(game,id));
        change(action,result);
      }
      break;
    case 'withdraw':
      openDialog({title:'Withdraw from the encounter?',subtitle:'RETREAT',body:`
        <p>You will return with your current vitality. Your foe recovers, and a pagoda climb resets.</p><div class="dialog-actions">
        ${button('Stay','close')}${button('Withdraw','retreat','',{className:'danger'})}</div>`});
      break;
    case 'retreat': change(action,gameRules.retreat(game),'home'); break;
    case 'reset':
      openDialog({title:'Reset your chronicle?',subtitle:'SAVE DATA',body:`<p>Your current save will be replaced by a fresh chronicle.</p>
        <div class="dialog-actions">${button('Keep chronicle','settings')}${button('Reset chronicle','reset-confirm','',{className:'danger'})}</div>`});
      break;
    case 'reset-confirm':
      game = gameRules.freshGame();
      committedProgress=captureProgression(game);
      audioIntent++;audioWarmup=null;stopAllAudio();syncAudioPreferences();
      persist();
      navigate('home');
      notify('A fresh chronicle is ready.');
      break;
    case 'export': {
      const url = URL.createObjectURL(new Blob([JSON.stringify(game,null,2)],{type:'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ashes-chronicle.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case 'import': document.querySelector('#import-save')?.click(); break;
  }
}

document.addEventListener('click',event => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || trigger.disabled) return;
  activate(trigger.dataset.action,trigger.dataset.id);
});

document.addEventListener('dragstart',event => {
  const card = event.target.closest('.battle-card[data-action="select-card"]');
  if (!card) return;
  if(combatBusy||card.disabled){event.preventDefault();return}
  draggedCard = Number(card.dataset.id);
  ui.selectedCard = draggedCard;
  root.dataset.dragTarget = card.dataset.target;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain',String(draggedCard));
});

document.addEventListener('dragover',event => {
  if (draggedCard !== null && event.target.closest('.duel-arena')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }
});

document.addEventListener('drop',event => {
  if(combatBusy){event.preventDefault();return}
  if (draggedCard === null || !event.target.closest('.duel-arena')) return;
  event.preventDefault();
  const combat = game.active?.combat;
  const card = combat && getCard(combat,draggedCard);
  const target = event.target.closest('[data-action="cast-card"]')?.dataset.id;
  const index = draggedCard;
  draggedCard = null;
  delete root.dataset.dragTarget;
  suppressCardClickUntil = Date.now() + 350;
  if (card && (!target || hub.cardTarget(card) === target)) activate('play',String(index));
  else renderSelection();
});

document.addEventListener('dragend',() => {
  const hadDrag = draggedCard !== null;
  draggedCard = null;
  delete root.dataset.dragTarget;
  if (hadDrag) renderSelection();
});

document.addEventListener('change', async event => {
  if (event.target.matches('[data-sim-cast],[data-sim-wanderers]')) {
    const cast={...simParams.cast};
    if(event.target.dataset.simCast)cast[event.target.dataset.simCast]=event.target.checked;
    else cast.wanderers=Number(event.target.value);
    simParams={...simParams,cast};rerunSim();ui.simPlaying=true;startSim();render();
    return;
  }
  if (event.target.matches('[data-filter]')) {
    const {value} = event.target;
    const filter = event.target.dataset.filter;
    const key = filter === 'category' ? 'filter' : filter;
    ui[key] = value;
    ui.cardPage = 0;
    render();
    [...root.querySelectorAll('[data-filter]')].find(node => node.dataset.filter === filter)?.focus({preventScroll:true});
  }
  if (event.target.id !== 'import-save') return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('File exceeds save size limit');
    const result = gameRules.readSave(storage,await file.text());
    if (result.warning) throw new Error(result.warning);
    game = result.game;
    committedProgress=captureProgression(game);
    audioIntent++;audioWarmup=null;stopAllAudio();syncAudioPreferences();
    persist();
    navigate(game.active ? 'battle' : 'home');
    notify('Chronicle loaded.');
  } catch {
    notify('This file is not a readable chronicle save.',true);
  } finally {
    event.target.value = '';
  }
});

document.addEventListener('submit',event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const fields = new FormData(form);
  if (form.dataset.form === 'begin') {
    if (change('begin',gameRules.begin(game,String(fields.get('name') || ''),String(fields.get('difficulty') || 'wayfarer')),'home') && form.dataset.id) {
      openDialog(views.missionDetails(game,form.dataset.id));
    }
  } else if (form.dataset.form==='pet-feed-select') {
    openDialog(petViews.petFeedPreview(game,String(fields.get('petId')),String(fields.get('cardId')),Number(fields.get('quantity'))));
  } else if (form.dataset.form === 'deck-save') {
    change('deck-save',gameRules.saveDeckDraft(game,String(fields.get('deckName')||'')));
  } else if (form.dataset.form === 'search') {
    ui.query = String(fields.get('query') || '').trim().slice(0,60);
    ui.cardPage = 0;
    render();
    root.querySelector('[name=query]')?.focus({preventScroll:true});
  }
});

document.addEventListener('input',event=>{
  if(event.target.matches('[data-audio-setting]')) {
    const key=event.target.dataset.audioSetting;
    if(!Object.hasOwn(gameRules.DEFAULT_AUDIO_SETTINGS,key))return;
    game.audioSettings={...gameRules.DEFAULT_AUDIO_SETTINGS,...game.audioSettings,[key]:Math.max(0,Math.min(1,Number(event.target.value)/100))};
    syncAudioPreferences();persist();
    dialog.querySelector(`[data-audio-value="${key}"]`).textContent=Math.round(game.audioSettings[key]*100)+'%';
    const preview=dialog.querySelector('[data-action="audio-preview"]');if(preview)preview.disabled=!game.sound||!game.audioSettings.master;
    return;
  }
  if(event.target.matches('[data-sim-scrub]')) {
    ui.simFrame=Math.max(0,Math.min(simulation().frames.length-1,Number(event.target.value)||0));
    if(ui.simPlaying){ui.simPlaying=false;stopSim();render();root.querySelector('[data-sim-scrub]')?.focus({preventScroll:true})}
    else updateSimStage();
    return;
  }
  const form=event.target.closest('form');
  if(form?.dataset.form==='deck-save'&&event.target.name==='deckName') {
    if(event.target.value.trim()) {gameRules.renameDeckDraft(game,event.target.value);persist()}
  }
  if(form?.dataset.form==='pet-feed-select') {
    if(event.target.name==='petFoodSearch') {
      const query=event.target.value.trim().toLowerCase(),select=form.querySelector('[name="cardId"]');
      for(const option of select.options)option.hidden=!option.text.toLowerCase().includes(query);
      const choices=[...select.options].filter(option=>!option.hidden&&!option.disabled);
      if(!choices.some(option=>option.value===select.value))select.value=choices[0]?.value||'';
      form.querySelector('[data-pet-feed-empty]').hidden=choices.length>0;
    }
    updatePetFeedQuote(form);
  }
});

function updatePetFeedQuote(form) {
  const fields=new FormData(form),petId=String(fields.get('petId')),cardId=String(fields.get('cardId')),quantity=Number(fields.get('quantity'));
  const quote=gameRules.quoteFeed(game,petId,cardId,quantity);
  dialog.querySelector('[data-pet-feed-card]').innerHTML=petViews.petFeedCardSummary(game,cardId);
  dialog.querySelector('[data-pet-feed-quote]').innerHTML=petViews.petFeedQuoteSummary(game,petId,cardId,quantity);
  form.querySelector('[data-pet-feed-submit]').disabled=!quote.ok;
}

document.addEventListener('change',event=>{
  const form=event.target.closest('form');
  if(form?.dataset.form==='pet-feed-select')updatePetFeedQuote(form);
});

document.addEventListener('keydown',event => {
  if (page !== 'battle' || combatBusy || dialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey ||
      event.target.matches?.('input,select,textarea,[contenteditable]') || game.active?.combat?.outcome || !game.active?.combat) return;
  if (event.key.toLowerCase() === 'e') {
    event.preventDefault();
    activate('end');
  } else if (event.key === 'Escape' && Number.isInteger(ui.selectedCard)) {
    ui.selectedCard = null;
    renderSelection();
  } else if (event.key === 'Enter' && Number.isInteger(ui.selectedCard)) {
    event.preventDefault();
    const card = getCard(game.active.combat,ui.selectedCard);
    if (card) activate('cast-card',hub.cardTarget(card));
  } else if (/^[1-9]$/.test(event.key) && Number(event.key) <= game.active.combat.hand.length) {
    event.preventDefault();
    activate('select-card',String(Number(event.key) - 1));
  }
});

function simulation() {
  if(!simResult)simResult=runFastForward(simParams);
  return simResult;
}
function rerunSim(keepFrame=false) {
  const frame=ui.simFrame||0;
  simResult=runFastForward(simParams);
  ui.simFrame=keepFrame?Math.min(frame,simResult.frames.length-1):0;
}
function updateSimStage() {
  const stage=root.querySelector('#sim-stage');
  if(!stage||!simResult)return;
  stage.innerHTML=marketViews.simStage(simResult,ui);
  const scrub=root.querySelector('[data-sim-scrub]');
  if(scrub&&document.activeElement!==scrub)scrub.value=ui.simFrame||0;
}
function stopSim(){clearInterval(simTimer);simTimer=null}
function startSim() {
  stopSim();
  // A week is 168 market hours: about 357 ms each plays it in one minute at 1x.
  simTimer=setInterval(()=>{
    if(page!=='market-sim'){stopSim();return}
    const last=simulation().frames.length-1;
    if((ui.simFrame||0)>=last){ui.simPlaying=false;stopSim();render();return}
    ui.simFrame=Math.min(last,(ui.simFrame||0)+1);
    updateSimStage();
  },Math.round(60_000/168/(ui.simSpeed||1)));
}

document.addEventListener('pointerdown',()=>{void warmAudio()},{capture:true,passive:true});
document.addEventListener('keydown',()=>{void warmAudio()},{capture:true});
installPriceTooltips();
window.addEventListener('hashchange',()=>{if(location.hash==='#market-sim'&&page!=='market-sim')navigate('market-sim')});
// Sign-in state loads in the background; an emailed link returns here with #market (or #signin-expired).
online.load().then(async state=>{
  if(location.hash==='#signin-expired'){history.replaceState(null,'',location.pathname);notify('That sign-in link has expired or was already used. Ask for a new code.',true)}
  else if(location.hash==='#market'&&state.signedIn){history.replaceState(null,'',location.pathname);
    try{await online.ensureSeal()}catch(error){notify(sealError(error),true)}
    if(page!=='market')navigate('market');notify('Signed in. Your seal is pressed.')}
  else if(state.signedIn&&state.ledger&&state.user?.seal)online.ensureSeal().catch(()=>{});
  render();
});
// The practice market runs in this browser: one market hour per real minute, caught up on return.
const away=market.advance(game,Date.now());
if(away.hours)persist();
if(page==='market-sim'){ui.simPlaying=true;ui.simScenario=simScenario;startSim()}
render();
notify(warning,true);
if(game.started&&!game.active&&page!=='market-sim'&&away.hours>=15)openDialog(marketViews.awayDialog(away));
setInterval(()=>{
  const passed=market.advance(game,Date.now());
  if(!passed.hours)return;
  persist();
  if(page==='market'&&!dialog.open&&!combatBusy&&!root.querySelector('.price-tip:hover,.price-tip:focus'))render();
},15_000);
