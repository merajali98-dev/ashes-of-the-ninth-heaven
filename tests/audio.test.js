import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioEngine,AUDIO_DEFAULTS,normalizeAudioSettings,inferAudioGroup,CARD_SOUND_TYPES} from '../js/audio-engine.js';

const settle=async()=>{for(let step=0;step<18;step++)await Promise.resolve()};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function harness({decode,fetchFailure=false,maxVoices=12,catalog}={}) {
  let now=0,nextTimer=0,created=0;const timers=new Map(),starts=[],stops=[],fetched=[],nodes=[];
  const param=value=>({value,cancelScheduledValues(){},setTargetAtTime(value){this.value=value}});
  const node=()=>{const value={gain:param(1),pan:param(0),playbackRate:param(1),connect(){},disconnect(){this.disconnected=true}};nodes.push(value);return value};
  class Context {
    constructor(){created++;this.state='suspended';this.destination=node()}
    get currentTime(){return now/1000}
    resume(){this.state='running';return Promise.resolve()}
    createGain(){return node()}
    createDynamicsCompressor(){const value=node();for(const key of ['threshold','knee','ratio','attack','release'])value[key]=param(0);return value}
    createStereoPanner(){return node()}
    createBufferSource(){const value=node();value.start=at=>starts.push({at,source:value});value.stop=()=>stops.push(value);return value}
    decodeAudioData(bytes){return decode?decode(bytes):Promise.resolve({duration:.12})}
  }
  const cues=catalog||{
    'ui-click':{src:'assets/audio/ui-click.wav',group:'ui',gain:.7,cooldownMs:100,priority:1,duration:.12},
    'cast-strike':{src:'assets/audio/cast-strike.wav',group:'combat',gain:.8,cooldownMs:0,priority:3,duration:.12},
    'hero-realm':{src:'assets/audio/hero-realm.wav',group:'progression',gain:.8,cooldownMs:0,priority:6,duration:.12},
    'pet-azure-dragon':{src:'assets/audio/pet-azure-dragon.wav',group:'pets',gain:.7,cooldownMs:0,priority:3,duration:.12},
  };
  const engine=createAudioEngine({AudioContext:Context,maxVoices,manifestUrl:'https://game.test/assets/audio/manifest.json',baseUrl:'https://game.test/',now:()=>now,
    setTimeout:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,due:now+delay});return id},clearTimeout:id=>timers.delete(id),
    fetch:async url=>{fetched.push(url);if(fetchFailure)throw new Error('offline');return url.endsWith('manifest.json')?{ok:true,json:async()=>({version:1,cues})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}}});
  async function advance(ms) {
    const end=now+ms;
    while(true){const pending=[...timers.entries()].filter(([,timer])=>timer.due<=end).sort(([,a],[,b])=>a.due-b.due)[0];if(!pending)break;now=pending[1].due;timers.delete(pending[0]);pending[1].callback();await settle()}
    now=end;await settle();
  }
  return {engine,starts,stops,fetched,nodes,advance,settle,created:()=>created,ready:async()=>{engine.configureAudio({enabled:true});assert.equal(await engine.unlockAudio(),true)}};
}

test('sound import/defaults and muted actions do not create an audio device or load files',async()=>{
  const h=harness();assert.equal(AUDIO_DEFAULTS.enabled,false);
  const handle=h.engine.playSound('ui-click');assert.equal((await handle.ended).status,'dropped');
  assert.equal(await h.engine.unlockAudio(),false);assert.deepEqual(await h.engine.preloadSounds(),{loaded:0,failed:0});
  assert.equal(h.created(),0);assert.equal(h.fetched.length,0);assert.equal(h.engine.getAudioDiagnostics().activeVoices,0);
  h.engine.configureAudio({enabled:true});h.engine.playSound('ui-click');assert.equal(h.created(),0);assert.equal(h.fetched.length,0);
});

test('audio settings remain bounded and cue groups cover all twelve card categories',()=>{
  const result=normalizeAudioSettings({enabled:true,masterVolume:2,combatVolume:-1,uiVolume:NaN,petsVolume:.3,extra:9});
  assert.equal(result.masterVolume,1);assert.equal(result.combatVolume,0);assert.equal(result.uiVolume,AUDIO_DEFAULTS.uiVolume);assert.equal(result.petsVolume,.3);assert.equal(result.extra,undefined);
  assert.equal(CARD_SOUND_TYPES.length,12);for(const type of CARD_SOUND_TYPES)assert.equal(inferAudioGroup('cast-'+type),'combat');
  assert.equal(inferAudioGroup('hero-layer'),'progression');assert.equal(inferAudioGroup('pet-layer'),'progression');assert.equal(inferAudioGroup('pet-azure-dragon'),'pets');assert.equal(inferAudioGroup('ui-open'),'ui');
});

test('samples decode once, schedule at their requested impact time, and cleanly finish',async()=>{
  let decodes=0;const h=harness({decode:async()=>{decodes++;return{duration:.12}}});await h.ready();
  await h.engine.preloadSounds(['cast-strike']);
  const handle=h.engine.playSound('cast-strike',{delay:300,pan:.5,pitch:1.1,scope:'combat:1'});await settle();
  assert.equal(h.starts.length,1);assert.equal(h.starts[0].at,.3);assert.equal(h.engine.getAudioDiagnostics().counts.started,0);
  await h.advance(299);assert.equal(h.engine.getAudioDiagnostics().counts.started,0);
  await h.advance(1);assert.equal(h.engine.getAudioDiagnostics().counts.started,1);
  await h.advance(500);assert.equal((await handle.ended).status,'completed');assert.equal(h.engine.getAudioDiagnostics().activeVoices,0);
  const again=h.engine.playSound('cast-strike');await settle();await h.advance(500);await again.ended;
  assert.equal(decodes,1);assert.equal(h.fetched.filter(url=>url.endsWith('cast-strike.wav')).length,1);
});

test('muting during deferred decode prevents a late burst after enabling again',async()=>{
  const loading=deferred();const h=harness({decode:()=>loading.promise});await h.ready();
  const old=h.engine.playSound('cast-strike',{delay:100,scope:'combat:old'});await settle();
  h.engine.configureAudio({enabled:false});assert.equal((await old.ended).status,'cancelled');
  h.engine.configureAudio({enabled:true});loading.resolve({duration:.12});await settle();await h.advance(300);
  assert.equal(h.starts.length,0);assert.equal(h.engine.getAudioDiagnostics().pending,0);
  const fresh=h.engine.playSound('cast-strike',{scope:'combat:new'});await settle();await h.advance(500);await fresh.ended;
  assert.equal(h.starts.length,1);
});

test('scope cancellation stops scheduled voices and asynchronous loads without touching another scope',async()=>{
  const h=harness();await h.ready();await h.engine.preloadSounds();
  const cancelled=h.engine.playSound('cast-strike',{delay:500,scope:'combat:1'});
  const kept=h.engine.playSound('pet-azure-dragon',{scope:'pet'});await settle();
  h.engine.stopAudioScope('combat:1');assert.equal((await cancelled.ended).status,'cancelled');
  await h.advance(1000);assert.equal((await kept.ended).status,'completed');
  const started=h.engine.getAudioDiagnostics().events.filter(event=>event.status==='started');
  assert.deepEqual(started.map(event=>event.cue),['pet-azure-dragon']);assert.ok(h.stops.length>=1);
  const wait=deferred(),second=harness({decode:()=>wait.promise});await second.ready();
  const queued=second.engine.playSound('cast-strike',{scope:'combat:2'});await settle();second.engine.stopAudioScope('combat:2');wait.resolve({duration:.12});await settle();
  assert.equal((await queued.ended).status,'cancelled');assert.equal(second.starts.length,0);
});

test('expired samples are discarded instead of shifting impact timing after a slow decode',async()=>{
  const loading=deferred(),h=harness({decode:()=>loading.promise});await h.ready();
  const handle=h.engine.playSound('cast-strike');await settle();await h.advance(151);loading.resolve({duration:.12});await settle();
  assert.deepEqual(await handle.ended,{status:'dropped',reason:'expired',cue:'cast-strike'});assert.equal(h.starts.length,0);
});

test('category/master zero cancel active and pending audio, and zero-volume plays do not fetch',async()=>{
  const h=harness();await h.ready();await h.engine.preloadSounds();
  const ui=h.engine.playSound('ui-click'),combat=h.engine.playSound('cast-strike');await settle();
  h.engine.configureAudio({uiVolume:0});assert.equal((await ui.ended).status,'cancelled');assert.equal(h.engine.getAudioDiagnostics().activeVoices,1);
  h.engine.configureAudio({masterVolume:0});assert.equal((await combat.ended).status,'cancelled');assert.equal(h.engine.getAudioDiagnostics().pending,0);
  const count=h.fetched.length;await h.engine.playSound('hero-realm').ended;assert.equal(h.fetched.length,count);
  h.engine.configureAudio({masterVolume:.65,uiVolume:.55});await h.engine.playSound('ui-click',{volume:0}).ended;assert.equal(h.fetched.length,count);
});

test('voice budgets, priorities and per-cue cooldowns prevent loud unbounded stacks',async()=>{
  const h=harness({maxVoices:3});await h.ready();await h.engine.preloadSounds();
  const handles=Array.from({length:12},()=>h.engine.playSound('cast-strike',{delay:100}));await settle();
  assert.equal(h.engine.getAudioDiagnostics().activeVoices,3);assert.equal(h.engine.getAudioDiagnostics().peakActiveVoices,3);
  const major=h.engine.playSound('hero-realm');await settle();assert.equal(h.engine.getAudioDiagnostics().activeVoices,3);
  assert.ok(h.engine.getAudioDiagnostics().events.some(event=>event.reason==='higher priority cue'));
  h.engine.stopAllAudio();await Promise.all([...handles,major].map(handle=>handle.ended));
  const click=h.engine.playSound('ui-click'),repeat=h.engine.playSound('ui-click');await settle();
  assert.equal((await repeat.ended).reason,'cue cooldown');await h.advance(500);await click.ended;
});

test('catalogue/cache errors are nonfatal, metadata is detached and diagnostics are bounded copies',async()=>{
  const offline=harness({fetchFailure:true});await offline.ready();assert.equal((await offline.engine.playSound('cast-strike').ended).status,'failed');
  assert.equal(offline.engine.getAudioDiagnostics().activeVoices,0);
  const h=harness();await h.ready();const catalog=await h.engine.loadAudioCatalog();catalog['ui-click'].src='https://untrusted.test/audio.wav';
  assert.equal(h.engine.getAudioCatalog()['ui-click'].src,'assets/audio/ui-click.wav');
  await h.engine.playSound('toString').ended;assert.equal(h.engine.getAudioDiagnostics().events.at(-1).reason,'unknown cue');
  h.engine.configureAudio({enabled:false});for(let i=0;i<180;i++)await h.engine.playSound('ui-click').ended;
  const diagnostics=h.engine.getAudioDiagnostics();assert.equal(diagnostics.events.length,128);diagnostics.events[0].status='changed';
  assert.notEqual(h.engine.getAudioDiagnostics().events[0].status,'changed');
});
