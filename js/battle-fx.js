import {STATUS_INFO} from './combat.js';
import {cardForm} from './card-frame.js';
import {playSound,stopAudioScope} from './audio-engine.js';

const motion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')||{matches:false,addEventListener(){}};
const subjects={player:'.disciple',enemy:'.opponent'};
const impacts=new Set(['strike','tick','guard','heal','status','ward','cleanse','seal','sacrifice','dispel','recover']);
export const TYPE_EFFECTS=Object.freeze({
  strike:{name:'Severing blades',release:300,duration:900,shape:'crossed-slashes'},
  ward:{name:'Jade bastion',release:340,duration:980,shape:'assembled-shield'},
  mantra:{name:'Orbiting scripture',release:360,duration:1000,shape:'orbital-scripture'},
  remedy:{name:'Lotus renewal',release:320,duration:1000,shape:'blooming-lotus'},
  hex:{name:'Forbidden eye',release:350,duration:1030,shape:'eye-and-tendrils'},
  formation:{name:'Heavenly ground array',release:390,duration:1100,shape:'ground-array-pillars'},
  stance:{name:'Coiling sword intent',release:320,duration:1000,shape:'spiral-swords'},
  counter:{name:'Returning judgment',release:300,duration:930,shape:'intercept-rebound'},
  pact:{name:'Crimson covenant',release:370,duration:1060,shape:'covenant-tethers'},
  ritual:{name:'Appointed hour',release:410,duration:1100,shape:'hourglass-chronoring'},
  transmute:{name:'Changing law',release:370,duration:1070,shape:'dissolve-reform'},
  finisher:{name:'Heavenfall verdict',release:470,duration:1250,shape:'celestial-sword-impact'},
});
let current=null;
let soundSerial=0;
const layer=()=>globalThis.document?.querySelector('#battle-fx');
export const reducedMotion=()=>motion.matches;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const n=value=>Number(value)||0;
function center(node) {
  const box=node?.getBoundingClientRect();
  return !box||box.bottom<0||box.top>innerHeight||!box.width?null:{x:box.x+box.width/2,y:box.y+box.height/2};
}
export function snapshotBattle(root,hand,index) {
  const buttons=[...root.querySelectorAll('.battle-card')],source=buttons[index];
  return {
    hand:new Map(hand.map((entry,i)=>[entry,buttons[i]?.getBoundingClientRect()])),
    cast:source?{origin:center(source),tablet:source.cloneNode(true),box:source.getBoundingClientRect()}:null,
    points:Object.fromEntries(Object.entries(subjects).map(([key,s])=>[key,center(root.querySelector(s+' .fighter-portrait'))])),
    health:Object.fromEntries(Object.entries(subjects).map(([key,s])=>[key,n(root.querySelector(s+' .meter')?.getAttribute('aria-valuenow'))])),
    guard:Object.fromEntries(Object.entries(subjects).map(([key,s])=>[key,n(root.querySelector(s+' .hero-guard b')?.textContent)])),
    pet:center(root.querySelector('.battle-companion')),
  };
}
function eventLabel(e) {
  const label=STATUS_INFO[e.status]?.name||e.status;
  switch(e.type) {
    case 'strike':return [e.amount?`−${e.amount} vitality`:'',e.blocked?`${e.blocked} absorbed`:'',e.hits>1?`${e.hits} hits`:''].filter(Boolean).join(' · ')||'No damage';
    case 'tick':return `−${e.amount} ${label}`;
    case 'guard':return `+${e.amount} Guard`;
    case 'heal':return e.amount?`+${e.amount} vitality`:'Vitality full';
    case 'status':return `+${e.amount} ${label}`;
    case 'ward':return `Ward stops ${label}`;
    case 'cleanse':return `Cleansed ${label}`;
    case 'phase':return e.name+(e.sealed?' · Seal raised':'');
    case 'seal':return 'Phase seal holds';
    case 'resonance':case 'aura':return e.name;
    case 'draw':return e.amount?`Draw ${e.amount}`:'';
    case 'qi':return `+${e.amount} Qi`;
    case 'recover':return `${e.amount} recovered to discard`;
    case 'dispel':return `${e.amount} stacks dispelled`;
    case 'sacrifice':return `−${e.amount} vitality paid`;
    case 'ritual':return e.turns?`${e.name} in ${e.turns} turns`:`${e.name} resolves`;
    case 'condition':return `${e.name} bonus`;
    case 'pet-ability':return `${e.pet} · ${e.name}`;
    case 'pet-passive':return `${e.name} awakens`;
    default:return '';
  }
}
export function battleFeedback(name,events,outcome) {
  const title=events.find(e=>e.type==='intent')?.name||name||'Round resolved';
  const details=events.map(e=>{const label=eventLabel(e);return label&&`${e.target==='enemy'&&e.type!=='phase'?'Foe ':''}${label}`}).filter(Boolean);
  const announcer=globalThis.document?.querySelector('#battle-announcer');if(announcer)announcer.textContent=[title,...details,outcome].filter(Boolean).join('. ');
  return {title,details};
}
function finish(run,cancelled=false) {
  if(run.done)return;run.done=true;
  if(cancelled)stopAudioScope(run.audioScope);
  for(const timer of run.timers)clearTimeout(timer);
  for(const restore of run.restorers)restore();
  for(const animation of run.animations)animation.cancel();
  for(const node of run.nodes)node.remove();
  run.timers.clear();run.animations.clear();run.nodes.clear();
  if(current===run)current=null;
  layer()?.removeAttribute('data-motion-type');run.resolve();
}
export function clearBattleEffects() {if(current)finish(current,true);layer()?.replaceChildren()}
function sound(run,cue,options={}) {if(!run.done)playSound(cue,{scope:run.audioScope,...options})}
function later(run,delay,callback) {
  const timer=setTimeout(()=>{run.timers.delete(timer);if(!run.done)callback()},delay);run.timers.add(timer);return timer;
}
function animate(run,node,frames,options) {
  if(!node||run.done)return;
  const animation=node.animate(frames,options);run.animations.add(animation);
  // Retain finished animations too: fill-forwards effects must be cancelled on cleanup.
  animation.finished.catch(()=>{});return animation;
}
function effect(run,className,point,school) {
  if(run.done||!point||run.nodes.size>=72)return null;
  const node=document.createElement('div');node.className=`fx ${className} school-${school}`;
  node.setAttribute('aria-hidden','true');node.inert=true;
  node.style.left=`${clamp(point.x,12,innerWidth-12)}px`;node.style.top=`${clamp(point.y,12,innerHeight-12)}px`;
  layer()?.append(node);run.nodes.add(node);return node;
}
const path=(d,c='')=>`<path class="${c}" d="${d}"/>`;
const ring=(r,c='')=>`<circle class="${c}" cx="128" cy="128" r="${r}"/>`;
const rays=(count,outer=112,inner=90)=>Array.from({length:count},(_,i)=>{const a=i*2*Math.PI/count;return path(`M${128+Math.sin(a)*inner} ${128+Math.cos(a)*inner}L${128+Math.sin(a)*outer} ${128+Math.cos(a)*outer}`)}).join('');
function signatureMarkup(type) {
  switch(type) {
    case 'strike':return path('M25 204Q116 63 227 40','slash slash-one')+path('M35 44Q126 174 223 205','slash slash-two')+path('M57 229 204 28','slash slash-three');
    case 'ward':return path('M128 23 216 59 205 151Q195 205 128 235 61 205 51 151L40 59 128 23Z','shield-shell')+path('M128 46v162M63 78h130M62 127h132M88 55 73 159M168 55 183 159','shield-seams')+path('M128 85 153 128 128 171 103 128Z','shield-core');
    case 'mantra':return `<g class="orbit orbit-one">${ring(102)}${rays(12)}</g><g class="orbit orbit-two">${ring(73)}${path('M128 55 191 164 65 164 128 55Z')}</g>${path('M128 91 158 128 128 165 98 128Z','mantra-core')}`;
    case 'remedy':return Array.from({length:8},(_,i)=>`<path class="lotus-petal" style="--petal:${i}" transform="rotate(${i*45} 128 143)" d="M128 143Q78 89 128 33 178 89 128 143Z"/>`).join('')+ring(31,'lotus-heart')+path('M65 193Q128 222 191 193','lotus-water');
    case 'hex':return path('M19 128Q128 3 237 128 128 253 19 128Z','hex-eye')+path('M128 83 158 128 128 173 98 128Z','hex-pupil')+Array.from({length:6},(_,i)=>`<path class="hex-tendril" transform="rotate(${i*60} 128 128)" d="M128 39Q172 4 188 41T219 53"/>`).join('');
    case 'formation':return `<g class="array-ground">${ring(112)}${ring(80)}${path('M128 16 225 184 31 184 128 16ZM128 240 31 72 225 72 128 240Z')}${rays(18)}</g>`+Array.from({length:6},(_,i)=>{const a=i*Math.PI/3,x=128+Math.sin(a)*91,y=128+Math.cos(a)*52;return path(`M${x} ${y}v-91m-7 15 7-15 7 15`,`array-pillar pillar-${i}`)}).join('');
    case 'stance':return `<g class="stance-coil">${path('M174 24C55 8 5 162 102 219 183 267 251 140 174 91 122 59 75 128 122 159 151 178 178 139 153 122','stance-spiral')}${[0,120,240].map(a=>`<path transform="rotate(${a} 128 128)" d="M128 18 138 81 128 98 118 81 128 18ZM112 81h32"/>`).join('')}</g>`;
    case 'counter':return path('M35 166Q14 68 116 47L91 25m25 22L87 70','counter-in')+path('M221 90Q242 188 140 209l25 22m-25-22 29-23','counter-out')+path('M128 75 166 97 161 146 128 175 95 146 90 97 128 75Z','counter-stop');
    case 'pact':return ring(88,'pact-seal')+path('M128 42C106 85 76 108 76 151a52 52 0 0 0 104 0c0-43-30-66-52-109Z','pact-flame')+path('M22 91Q128 169 234 91M21 169Q128 91 235 169','pact-tether')+rays(8,118,102);
    case 'ritual':return `<g class="chrono-ring">${ring(107)}${rays(24)}</g>`+path('M81 47h94M81 209h94M90 47v37l76 88v37M166 47v37l-76 88v37','ritual-glass')+path('M106 75h44l-22 31-22-31ZM107 185l21-31 21 31h-42Z','ritual-sand');
    case 'transmute':return `<g class="transmute-matter">${Array.from({length:12},(_,i)=>`<rect class="matter-shard" style="--shard:${i}" x="${50+i%4*45}" y="${54+Math.floor(i/4)*60}" width="18" height="18" rx="3"/>`).join('')}</g>`+path('M79 45h98M99 45v56l-39 82q-8 27 21 27h94q29 0 21-27l-39-82V45','crucible')+ring(105,'transmute-wheel');
    case 'finisher':return `<g class="finisher-heaven">${ring(117)}${rays(16,126,105)}${ring(91)}</g>`+path('M128 6 148 61 139 167 128 216 117 167 108 61 128 6Z','heaven-core')+path('M128 6 148 61 139 167 128 216 117 167 108 61 128 6ZM84 162h88M112 218h32','heaven-sword')+path('M5 229 83 214 128 244 173 214 251 229M26 248 86 231M230 248 170 231','finisher-fracture');
    default:return ring(88)+rays(12);
  }
}
function signature(run,type,point,school,rarity='common',reduced=false) {
  const node=effect(run,`fx-signature type-${type} grade-${rarity}${reduced?' fx-reduced':''}`,point,school);if(!node)return;
  node.dataset.effectType=type;node.dataset.effectShape=TYPE_EFFECTS[type].shape;
  node.innerHTML=`<svg viewBox="0 0 256 256" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${signatureMarkup(type)}</svg>`;
  if(rarity==='legendary'&&!reduced)node.insertAdjacentHTML('beforeend',`<svg class="legendary-corona" viewBox="0 0 256 256">${ring(123)}${rays(8,127,114)}</svg>`);
}
function particles(run,point,school,severity=1,kind='sparks') {
  const node=effect(run,`fx-particles ${kind}`,point,school);if(!node)return;
  for(let i=0;i<Math.min(16,8+Math.round(severity*4));i++) {
    const p=document.createElement('i');p.style.setProperty('--angle',`${i*137.5}deg`);p.style.setProperty('--travel',`${(29+i%4*12)*severity}px`);p.style.setProperty('--stagger',`${i%3*20}ms`);node.append(p);
  }
}
function resultNumber(run,e,point,school,index,reduced) {
  const node=effect(run,`fx-result result-${e.type}${reduced?' fx-reduced':''}`,point,school);if(!node)return;
  node.style.setProperty('--result-row',index);const big=document.createElement('b'),small=document.createElement('small');
  if(e.type==='strike'){big.textContent=e.amount?`−${e.amount}`:e.blocked?'BLOCKED':'0';if(!e.amount&&e.blocked)node.classList.add('result-blocked');small.textContent=[e.blocked?`${e.blocked} Guard absorbed`:'',e.hits>1?`${e.hits} hits`:''].filter(Boolean).join(' · ')}
  else if(e.type==='heal'){big.textContent=`+${e.amount}`;small.textContent=e.amount?'VITALITY':'Vitality full'}
  else if(e.type==='guard'){big.textContent=`+${e.amount}`;small.textContent='GUARD'}
  else if(e.type==='tick'){big.textContent=`−${e.amount}`;small.textContent=STATUS_INFO[e.status]?.name||'Damage'}
  else if(e.type==='sacrifice'){big.textContent=`−${e.amount}`;small.textContent='VITALITY OFFERED'}
  else {big.textContent=eventLabel(e);node.classList.add('result-caption')}
  node.append(big);if(small.textContent)node.append(small);
}
function sanitizeTablet(tablet) {
  for(const node of [tablet,...tablet.querySelectorAll('*')]) {
    for(const a of [...node.attributes])if(a.name==='id'||a.name.startsWith('data-')||['draggable','aria-pressed','aria-controls'].includes(a.name))node.removeAttribute(a.name);
    if(node.matches('button,a,input,select,textarea,[tabindex]'))node.tabIndex=-1;
  }
  tablet.classList.remove('card-selected');tablet.classList.add('cast-tablet');tablet.inert=true;tablet.setAttribute('aria-hidden','true');return tablet;
}
function moveHand(run,root,before,hand,reduced) {
  if(reduced)return;
  root.querySelectorAll('.battle-card').forEach((node,index)=>{
    const old=before.hand?.get(hand[index]),box=node.getBoundingClientRect();
    animate(run,node,[{translate:`${old?old.x-box.x:0}px ${old?old.y-box.y:32}px`,opacity:old?1:0},{translate:'0px 0px',opacity:1}],{duration:old?240:390,delay:old?0:index*28,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
}
function castTablet(run,before,arena,type,school,release) {
  if(!before.cast?.tablet)return;
  const origin=before.cast.origin||{x:arena.x,y:arena.y+150},node=effect(run,`fx-tablet type-${type}`,origin,school);if(!node)return;
  node.style.width=`${clamp(before.cast.box?.width||140,95,175)}px`;node.append(sanitizeTablet(before.cast.tablet));
  animate(run,node,[{translate:'-50% -50%',transform:'scale(1) rotate(0deg)',opacity:1},{translate:`${arena.x-origin.x-70}px ${arena.y-origin.y-120}px`,transform:'scale(1.08) rotate(-5deg)',opacity:1,offset:.38},{translate:`${arena.x-origin.x-70}px ${arena.y-origin.y-130}px`,transform:'scale(1.12) rotate(1deg)',opacity:1,offset:.73},{translate:`${arena.x-origin.x-70}px ${arena.y-origin.y-170}px`,transform:'scale(.55) rotate(6deg)',opacity:0}],{duration:release+180,easing:'cubic-bezier(.16,.75,.18,1)',fill:'forwards'});
}
function bolt(run,origin,target,school,delay) {
  if(!origin||!target)return;
  later(run,delay,()=>{
    const node=effect(run,'fx-spirit-bolt',origin,school);if(!node)return;node.style.rotate=`${Math.atan2(target.y-origin.y,target.x-origin.x)}rad`;
    animate(run,node,[{translate:'-50% -50%',opacity:0,scale:'.5 1'},{opacity:1,offset:.2},{translate:`${target.x-origin.x}px ${target.y-origin.y}px`,opacity:.8,scale:'1.4 1'}],{duration:220,easing:'ease-in',fill:'forwards'});
  });
}
function targetImpact(run,root,before,events,target,school,release,reduced,action) {
  const fighter=root.querySelector(subjects[target]),portrait=fighter?.querySelector('.fighter-portrait'),point=center(portrait)||before.points?.[target];if(!point)return;
  const hits=events.filter(e=>e.target===target&&impacts.has(e.type)),meter=fighter?.querySelector('.meter'),hp=n(meter?.getAttribute('aria-valuenow')),max=n(meter?.getAttribute('aria-valuemax'))||100;
  // Rules commit before rendering; hold only the presentation readouts until impact.
  const life=fighter?.querySelector('.hero-life b');
  if(life&&before.health?.[target]!==undefined&&before.health[target]!==hp) {
    const committed=life.textContent;life.textContent=String(before.health[target]);
    const restore=()=>{life.textContent=committed};run.restorers.add(restore);later(run,release,restore);
  }
  const guardNode=fighter?.querySelector('.hero-guard'),guardValue=guardNode?.querySelector('b'),oldGuard=before.guard?.[target]||0;
  if(guardValue&&oldGuard!==n(guardValue.textContent)) {
    const committed=guardValue.textContent,visibility=guardNode.style.visibility;
    if(oldGuard)guardValue.textContent=String(oldGuard);else guardNode.style.visibility='hidden';
    const restore=()=>{guardValue.textContent=committed;guardNode.style.visibility=visibility};run.restorers.add(restore);later(run,release,restore);
  } else if(!guardNode&&oldGuard) {
    const ghost=document.createElement('span');ghost.className='hero-guard fx-guard-ghost';ghost.setAttribute('aria-hidden','true');ghost.innerHTML=`<b>${oldGuard}</b>`;fighter?.querySelector('.hero-medallion')?.append(ghost);
    const restore=()=>ghost.remove();run.restorers.add(restore);later(run,release,restore);
  }
  if(meter&&Number.isFinite(before.health?.[target])&&before.health[target]!==hp)animate(run,meter.firstElementChild,[{width:`${100*before.health[target]/max}%`},{width:`${100*hp/max}%`}],{duration:reduced?170:390,delay:release,fill:'backwards',easing:'ease-out'});
  const damage=hits.reduce((sum,e)=>sum+(['strike','tick'].includes(e.type)?e.amount||0:0),0),severity=clamp(.65+damage/max*2,.7,1.45);
  hits.slice(0,6).forEach((e,index)=>later(run,release+Math.min(index,3)*(reduced?0:48),()=>{
    const pan=target==='enemy'?0.18:-0.12;
    const cue=e.type==='strike'?(e.amount>0?(e.amount>=12?'impact-heavy':'impact-light'):e.blocked?'blocked':null):
      e.type==='tick'&&e.amount?'tick':e.type==='heal'&&e.amount?'heal':
      ['guard','ward','seal'].includes(e.type)?'blocked':e.type==='sacrifice'?'impact-light':
      ['status','cleanse','dispel','recover'].includes(e.type)?e.type:null;
    if(cue)sound(run,cue,{pan,volume:e.type==='guard'?0.4:e.type==='status'?0.55:1,priority:e.type==='strike'&&e.amount>=12?4:2});
    if(cue&&e.type==='strike'&&e.hits>1)for(let hit=1;hit<Math.min(e.hits,3);hit++)later(run,hit*110,()=>sound(run,cue,{pan,volume:.55,pitch:hit%2?1.035:.97}));
    const color=target==='player'&&e.type==='strike'?'enemy':e.type==='tick'?(e.status==='burn'?'ember':'shade'):school;resultNumber(run,e,{x:point.x,y:point.y-15},color,index,reduced);if(reduced)return;
    const hostile=e.type==='strike'&&e.amount||e.type==='tick'||e.type==='sacrifice';
    const guarded=e.type==='strike'&&e.blocked>0||['guard','ward','seal'].includes(e.type);
    const kind=hostile?'hit':guarded?'guard':['heal','cleanse'].includes(e.type)?'restore':e.hostile||e.type==='dispel'?'curse':'aura';
    const node=effect(run,`fx-impact impact-${kind}`,point,color);if(node)node.style.setProperty('--impact-scale',severity);
    particles(run,point,color,severity,kind==='restore'?'petals':'sparks');
    if(hostile)animate(run,portrait,[{translate:'0px 0px',filter:'brightness(1)'},{translate:`0px ${-4*severity}px`,filter:'brightness(1.65)',offset:.15},{translate:`${-5*severity}px 0px`,offset:.4},{translate:`${3*severity}px 0px`,offset:.65},{translate:'0px 0px',filter:'brightness(1)'}],{duration:280,easing:'ease-out'});
    if(e.type==='strike'&&e.hits>1)for(let hit=1;hit<Math.min(e.hits,4);hit++)later(run,hit*48,()=>effect(run,`fx-hit-streak streak-${hit}`,point,color));
  }));
  if(hits.some(e=>e.type==='strike'&&e.blocked>0)&&before.guard?.[target]>0&&!guardNode)later(run,release,()=>{
    sound(run,'shield-break',{pan:target==='enemy'?0.18:-0.12,priority:4});
    if(!reduced){const broken=effect(run,'fx-shield-break',point,'iron');if(broken)broken.innerHTML='<i></i><i></i><i></i><i></i>'}
  });
}

/** Presentation only: rules have resolved already. Every owned animation has a cancellation path. */
export function playBattleEffects(root,before={},hand=[],events=[],school='neutral',action='play',context={}) {
  clearBattleEffects();const reduced=reducedMotion(),card=context?.card;
  const inferred=context?.petAbility?.effects?.some(e=>e.type==='damage')?'strike':'mantra';
  const type=card?cardForm(card):action==='pet-ability'?inferred:events.some(e=>e.type==='ritual'&&!e.turns)?'ritual':'mantra';
  const profile=TYPE_EFFECTS[type]||TYPE_EFFECTS.mantra,duration=reduced?240:profile.duration,release=reduced?0:card||action==='pet-ability'?profile.release:90;
  let resolve;const finished=new Promise(done=>{resolve=done}),run={done:false,resolve,timers:new Set(),animations:new Set(),nodes:new Set(),restorers:new Set(),audioScope:'battle-'+(++soundSerial)};current=run;
  const handle={duration,finished,cancel:()=>finish(run,true)};if(!layer()){finish(run);return handle}
  if(card)sound(run,'cast-'+type,{priority:card.rarity==='legendary'?4:2});
  else if(action==='pet-ability') {
    sound(run,'pet-command',{volume:.65});
    if(context.petId)sound(run,'pet-'+context.petId,{volume:.6});
  } else if(action==='end') {
    sound(run,'turn-end',{volume:.7});
    if(!context.outcome)later(run,release+180,()=>sound(run,'turn-start',{volume:.55}));
  }
  layer().dataset.motionType=type;
  const arena=center(root.querySelector('.arena'))||{x:innerWidth/2,y:innerHeight*.4};moveHand(run,root,before,hand,reduced);
  if(!reduced&&card)castTablet(run,before,arena,type,school,release);
  const hostile=events.some(e=>e.target==='enemy'&&['strike','status','dispel','tick'].includes(e.type)),target=hostile?'enemy':'player';
  const signatureTarget=['ward','remedy','stance','pact'].includes(type)?'player':target;
  const point=center(root.querySelector(subjects[signatureTarget]+' .fighter-portrait'))||before.points?.[signatureTarget]||arena;
  if(card||action==='pet-ability')later(run,reduced?0:90,()=>signature(run,type,['formation','mantra','ritual','transmute','finisher'].includes(type)?arena:point,school,card?.rarity||'common',reduced));
  if(type==='finisher'&&!reduced)later(run,release,()=>{
    effect(run,'fx-verdict-wave',{x:arena.x,y:arena.y+55},school);
    if(events.some(e=>e.type==='strike'&&e.amount>0))animate(run,root.querySelector('.arena'),[{translate:'0px 0px'},{translate:'0px 2px',offset:.2},{translate:'-2px -1px',offset:.45},{translate:'1px 0px',offset:.7},{translate:'0px 0px'}],{duration:220,easing:'ease-out'});
  });
  if(!reduced) {
    let source=action==='pet-ability'?'pet':'player',count=0;
    for(const event of events) {
      if(event.type==='intent')source='enemy';
      else if(event.type==='pet-ability'||event.type==='pet-passive')source='pet';
      else if(event.type==='ritual'||event.type==='aura')source='player';
      if(event.type!=='strike'||!subjects[event.target]||count>=4)continue;
      // An end-turn action can contain friendly triggered damage before the announced enemy action.
      const origin=event.target==='player'?before.points?.enemy:source==='pet'?(center(root.querySelector('.battle-companion'))||before.pet):before.points?.player;
      bolt(run,origin,center(root.querySelector(subjects[event.target]+' .fighter-portrait')),event.target==='player'?'enemy':school,Math.max(0,release-180)+count++*35);
    }
  }
  for(const target of ['player','enemy'])targetImpact(run,root,before,events,target,school,release,reduced,action);
  const semanticCues=new Set();
  for(const e of events) {
    const cue=e.type==='phase'?'phase':e.type==='resonance'?'resonance':e.type==='ritual'&&!e.turns?'ritual-resolve':e.type==='draw'&&e.amount?'card-draw':null;
    if(cue&&!semanticCues.has(cue)){semanticCues.add(cue);later(run,release,()=>sound(run,cue,{priority:e.type==='phase'?4:3,volume:e.type==='draw'?0.6:1}))}
  }
  events.filter(e=>['phase','resonance','aura','ritual','condition','pet-ability','pet-passive','qi','draw','recover'].includes(e.type)&&eventLabel(e)).slice(0,5).forEach((e,index)=>later(run,release,()=>{
    const banner=effect(run,`fx-notice notice-${e.type}${reduced?' fx-reduced':''}`,{x:arena.x,y:arena.y-65+index*25},school);if(banner)banner.textContent=eventLabel(e);
    if(!reduced&&e.type==='ritual'&&!e.turns)signature(run,'ritual',arena,school);
    if(!reduced&&e.type==='resonance')signature(run,'mantra',arena,school,'rare');
  }));
  if(action==='pet-ability'&&!reduced)animate(run,root.querySelector('.battle-companion'),[{translate:'0px 0px',scale:1},{translate:'0px -17px',scale:1.14,offset:.45},{translate:'0px 0px',scale:1}],{duration:650,easing:'ease-out'});
  if(action==='end'&&!reduced)animate(run,root.querySelector('.enemy-intent-token'),[{filter:'brightness(1)'},{filter:'brightness(1.8)',offset:.3},{filter:'brightness(1)'}],{duration:430});
  later(run,duration,()=>finish(run));return handle;
}
motion.addEventListener('change',clearBattleEffects);
