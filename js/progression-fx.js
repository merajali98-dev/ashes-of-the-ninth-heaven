import {REALMS,cultivationStatus} from './cultivation.js';
import {petById,petArt} from './pets.js';
import {esc} from './ui.js';
import {playSound,stopAudioScope} from './audio-engine.js';

/** Presentation snapshots contain no live state references and are safe in Node. */
export function captureProgression(game) {
  const describe=(state,extra)=>{
    const status=cultivationStatus({...game,...state,active:null});
    return {...extra,realm:status.realm,realmName:status.current.name,layer:status.layer,level:status.level,
      essence:status.essence,progress:status.progress,perfected:status.perfected};
  };
  return {
    hero:describe({realm:game.realm,essence:game.essence},{id:'hero',name:game.name||'Ash-Bearer',avatar:REALMS[game.realm].avatar,hp:game.hp,color:'#e9cb83'}),
    pets:Object.fromEntries(Object.entries(game.pets||{}).filter(([id])=>petById[id]).map(([id,pet])=>
      [id,describe(pet,{id,name:petById[id].name,avatar:petArt(id,pet.realm),color:petById[id].color})])),
  };
}

/** Only real advancement is celebrated: first capture, hatching, and reloads are quiet. */
export function progressionChanges(before,after) {
  if(!before?.hero||!after?.hero)return [];
  const result=[];
  const compare=(previous,next,subject)=>{
    if(!previous||!next)return;
    const kind=next.realm>previous.realm?'realm':next.perfected&&!previous.perfected?'perfection':next.level>previous.level?'layer':null;
    if(kind)result.push({kind,subject,id:next.id,name:next.name,before:{...previous},after:{...next},
      gainedLevels:Math.max(0,next.level-previous.level),gainedEssence:Math.max(0,next.essence-previous.essence)});
  };
  compare(before.hero,after.hero,'hero');
  for(const [id,next]of Object.entries(after.pets||{}))compare(before.pets?.[id],next,'pet');
  return result;
}

const roman=n=>['','I','II','III','IV','V','VI','VII','VIII','IX'][n]||String(n);
let active=null;
let soundSerial=0;

function createRun(duration,onComplete) {
  let resolve;
  const finished=new Promise(done=>{resolve=done});
  const run={duration,finished,nodes:new Set(),animations:new Set(),timer:null,closed:false,restore:null,audioScope:'cultivation-'+(++soundSerial),
    cancel(){finish(true)},finish(){finish(false)}};
  function finish(cancelled) {
    if(run.closed)return;
    run.closed=true;clearTimeout(run.timer);
    if(cancelled)stopAudioScope(run.audioScope);
    for(const animation of run.animations)animation.cancel();
    for(const node of run.nodes)node.remove();
    run.restore?.();
    if(active===run)active=null;
    resolve({cancelled});
    onComplete?.({cancelled});
  }
  return run;
}

export function clearProgressionEffects() {active?.cancel()}

function animate(run,node,frames,options) {
  if(node?.animate)run.animations.add(node.animate(frames,options));
}

function anchor(root,change) {
  if(!root)return null;
  if(change.subject==='hero')return root.querySelector('.cultivator-face')||root.querySelector('.hero-player .fighter-portrait');
  const selected=root.querySelector(`.pet-biome-node.selected[data-id="${change.id}"]`);
  return selected?root.querySelector('.pet-selected-art')||selected:root.querySelector(`.pet-biome-node[data-id="${change.id}"]`);
}

function pulseTarget(run,root,change,reduced) {
  const target=anchor(root,change);if(!target)return;
  animate(run,target,reduced?[{filter:'brightness(1)'},{filter:'brightness(1.16)'},{filter:'brightness(1)'}]:
    [{filter:'brightness(1)',transform:'scale(1)'},{filter:'brightness(1.45)',transform:'scale(1.045)'},{filter:'brightness(1)',transform:'scale(1)'}],
    {duration:reduced?650:1150,easing:'cubic-bezier(.16,.8,.24,1)'});
  const meter=change.subject==='hero'?root.querySelector('.plaque-progress .meter>i'):
    root.querySelector('.pet-biome-node.selected')?.dataset.id===change.id?root.querySelector('.pet-cultivation .meter>i'):null;
  if(meter&&!reduced)animate(run,meter,progressFrames(change),{duration:1150,easing:'ease-out'});
  const box=target.getBoundingClientRect();
  if(box.bottom<0||box.top>innerHeight||reduced)return;
  const seal=document.createElement('div');seal.className='progression-anchor-seal';
  seal.style.cssText=`left:${box.left+box.width/2}px;top:${box.top+box.height/2}px;--growth-color:${change.after.color}`;
  seal.innerHTML='<i></i><i></i><i></i>';
  document.body.append(seal);run.nodes.add(seal);
}

function progressFrames(change) {
  const start=`${Math.round(change.before.progress*100)}%`,end=`${Math.round(change.after.progress*100)}%`;
  return change.kind==='perfection'?[{width:start},{width:'100%'}]:
    [{width:start,offset:0},{width:'100%',offset:.42},{width:'0%',offset:.5},{width:end,offset:1}];
}

function layerMarkup(change) {
  const {before,after}=change;
  const title=change.kind==='perfection'?'IMMORTAL PERFECTION':change.subject==='pet'?'SPIRIT CULTIVATION':'CULTIVATION ADVANCED';
  const line=change.kind==='perfection'?'The final inner heaven is complete.':
    `Layer ${roman(before.layer)} → ${roman(after.layer)}${change.gainedLevels>1?` · +${change.gainedLevels} layers`:''}`;
  return `<article class="progression-layer-card progression-subject-${change.subject} ${change.kind}" data-progression-kind="${change.kind}" data-progression-subject="${change.subject}" data-progression-id="${change.id}" style="--growth-color:${after.color};--growth-from:${Math.round(before.progress*100)}%;--growth-to:${Math.round(after.progress*100)}%"><span class="growth-portrait"><img src="${esc(after.avatar)}" alt=""><i></i></span><div class="growth-copy"><div class="growth-eyebrow">${title}</div><h3>${esc(after.name)}</h3><p>${esc(after.realmName)} · ${line}</p><div class="growth-track"><i></i><b></b></div></div><div class="growth-level"><small>LEVEL</small><span class="growth-level-before">${before.level}</span><strong>${after.level}</strong><em>/ 90</em></div><span class="growth-ribbon"></span></article>`;
}

function realmMarkup(change) {
  const {before,after}=change;
  const vitality=REALMS[after.realm].hp-REALMS[before.realm].hp;
  return `<div class="realm-celestial-field"></div><div class="realm-growth-orbits">${Array.from({length:5},(_,index)=>`<i style="--orbit:${index}"></i>`).join('')}</div><div class="realm-growth-stars">${Array.from({length:20},(_,index)=>`<i style="--star:${index}"></i>`).join('')}</div><div class="realm-growth-content"><div class="growth-eyebrow">${change.subject==='pet'?'SPIRIT REALM AWAKENED':'THE HEAVENS RECOGNIZE YOUR ASCENT'}</div><div class="realm-growth-portrait"><img class="realm-avatar-before" src="${esc(before.avatar)}" alt=""><img class="realm-avatar-after" src="${esc(after.avatar)}" alt="${esc(after.name)} in ${esc(after.realmName)} armor"><span class="realm-growth-crest">${roman(after.realm+1)}</span></div><p class="realm-growth-name">${esc(after.name)}</p><div class="realm-growth-former">${esc(before.realmName)}</div><h1>${esc(after.realmName)}</h1><div class="realm-growth-level">LEVEL ${before.level} <span>→</span> ${after.level} <i>·</i> LAYER ${roman(after.layer)} / IX</div>${change.subject==='hero'?`<p class="realm-growth-benefit">+${vitality} maximum vitality <span>·</span> A new celestial form</p>`:'<p class="realm-growth-benefit">New instincts awaken within your companion</p>'}</div><button type="button" class="btn quiet realm-growth-skip">Continue</button>`;
}

/** Creates only disposable presentation; it never grants or persists progression. */
export function playProgressionEffects({before,after,root,action='',skipPetRealm=false,onComplete}={}) {
  const changes=progressionChanges(before,after).filter(change=>!(skipPetRealm&&change.subject==='pet'&&change.kind==='realm'));
  if(!changes.length||typeof document==='undefined') {
    onComplete?.({cancelled:false});
    return {duration:0,finished:Promise.resolve({cancelled:false}),cancel(){}};
  }
  clearProgressionEffects();
  const reduced=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const realm=changes.find(change=>change.kind==='realm');
  const run=createRun(realm?(reduced?1500:2800):(reduced?1100:1800),onComplete);active=run;
  if(realm)playSound(realm.subject==='hero'?'hero-realm':'pet-evolve',{scope:run.audioScope,priority:6});
  else {
    const sounded=new Set();
    for(const change of changes) {
      const cue=change.subject==='hero'?'hero-layer':'pet-layer';
      if(!sounded.has(cue)){sounded.add(cue);playSound(cue,{scope:run.audioScope,priority:5})}
    }
  }
  if(realm) {
    const overlay=document.createElement('section');overlay.className=`realm-growth-celebration progression-subject-${realm.subject}${reduced?' reduced-motion':''}`;
    overlay.id='progression-realm';overlay.dataset.progressionKind='realm';overlay.dataset.progressionSubject=realm.subject;
    overlay.style.setProperty('--growth-color',realm.after.color);
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',`${realm.after.name} reached ${realm.after.realmName}`);
    overlay.innerHTML=realmMarkup(realm);run.nodes.add(overlay);
    const app=document.querySelector('#app'),previousInert=app?.inert,previousFocus=document.activeElement;
    if(app)app.inert=true;
    run.restore=()=>{
      if(app)app.inert=previousInert;
      if(previousFocus?.isConnected&&!document.querySelector('dialog[open]')&&!previousInert)previousFocus.focus?.({preventScroll:true});
    };
    const button=overlay.querySelector('button');button.addEventListener('click',()=>run.cancel());
    overlay.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();run.cancel()}
      if(event.key==='Tab'){event.preventDefault();button.focus({preventScroll:true})}
    });
    document.body.append(overlay);if(!document.querySelector('dialog[open]'))button.focus({preventScroll:true});
  } else {
    const stack=document.createElement('section');stack.id='progression-layer-fx';stack.className=`progression-layer-stack${reduced?' reduced-motion':''}`;
    stack.setAttribute('role','status');stack.setAttribute('aria-live','polite');stack.setAttribute('aria-atomic','true');
    stack.innerHTML=changes.map(layerMarkup).join('');document.body.append(stack);run.nodes.add(stack);
    for(const change of changes)pulseTarget(run,root,change,reduced);
    [...stack.querySelectorAll('.growth-track>i')].forEach((bar,index)=>animate(run,bar,reduced?
      [{width:`${Math.round(changes[index].after.progress*100)}%`,opacity:.65},{width:`${Math.round(changes[index].after.progress*100)}%`,opacity:1}]:progressFrames(changes[index]),
      {duration:reduced?300:1000,easing:'cubic-bezier(.16,.8,.24,1)',fill:'forwards'}));
  }
  run.timer=setTimeout(()=>run.finish(),run.duration);
  return {duration:run.duration,finished:run.finished,cancel:()=>run.cancel()};
}
