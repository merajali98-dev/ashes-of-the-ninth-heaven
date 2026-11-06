// Local sample playback only. Importing this module never opens an audio device.
export const AUDIO_DEFAULTS=Object.freeze({enabled:false,masterVolume:.65,combatVolume:.8,uiVolume:.55,progressionVolume:.8,petsVolume:.8});
export const AUDIO_GROUPS=Object.freeze(['combat','ui','progression','pets']);
export const CARD_SOUND_TYPES=Object.freeze(['strike','ward','mantra','remedy','hex','formation','stance','counter','pact','ritual','transmute','finisher']);
const clamp=(value,min,max,fallback)=>Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
const groupKey=group=>group+'Volume';
const copy=value=>value===null?null:JSON.parse(JSON.stringify(value));
export function inferAudioGroup(cue) {
  if(/^cast-|^impact-|^(blocked|shield-break|heal|status|tick|cleanse|dispel|recover|resonance|phase|ritual-resolve|pet-command|card-draw|turn-end|turn-start|victory|defeat)$/.test(cue))return 'combat';
  if(/^hero-|^pet-layer$|^pet-evolve$/.test(cue))return 'progression';
  if(/^pet-|^egg-crack$/.test(cue))return 'pets';
  return 'ui';
}
export function normalizeAudioSettings(values={},previous=AUDIO_DEFAULTS) {
  const result={...previous};
  if(typeof values.enabled==='boolean')result.enabled=values.enabled;
  for(const key of ['masterVolume',...AUDIO_GROUPS.map(groupKey)])if(key in values)result[key]=clamp(values[key],0,1,previous[key]);
  return result;
}
function normalizeCatalog(raw) {
  if(raw?.version!==1||!raw.cues||typeof raw.cues!=='object'||Array.isArray(raw.cues))throw new TypeError('Invalid sound catalogue');
  const result=Object.create(null);
  for(const [id,entry]of Object.entries(raw.cues).slice(0,256)) {
    if(!/^[a-z][a-z0-9-]{0,70}$/.test(id)||!entry||typeof entry!=='object')continue;
    const valid=src=>typeof src==='string'&&/^assets\/audio\/[a-zA-Z0-9_-]+\.(wav|ogg|mp3)$/.test(src);
    const variants=(Array.isArray(entry.variants)?entry.variants:[]).map(item=>typeof item==='string'?item:item?.src).filter(valid);
    if(!valid(entry.src)&&!variants.length)continue;
    result[id]={src:valid(entry.src)?entry.src:variants[0],variants,
      group:AUDIO_GROUPS.includes(entry.group)?entry.group:inferAudioGroup(id),
      gain:clamp(entry.gain,0,1,.8),cooldownMs:clamp(entry.cooldownMs,0,2000,80),
      priority:clamp(entry.priority,0,10,2),duration:clamp(entry.duration,0,30,0),maxLateMs:clamp(entry.maxLateMs,0,1000,150)};
  }
  if(!Object.keys(result).length)throw new TypeError('Empty sound catalogue');
  return result;
}

/** Dependency injection keeps scheduling/mute races verifiable without a sound device. */
export function createAudioEngine(dependencies={}) {
  const environment={AudioContext:dependencies.AudioContext??globalThis.AudioContext??globalThis.webkitAudioContext,
    fetch:dependencies.fetch??globalThis.fetch?.bind(globalThis),
    now:dependencies.now??(()=>globalThis.performance?.now?.()??Date.now()),
    setTimeout:dependencies.setTimeout??globalThis.setTimeout.bind(globalThis),
    clearTimeout:dependencies.clearTimeout??globalThis.clearTimeout.bind(globalThis),
    manifestUrl:dependencies.manifestUrl??new URL('../assets/audio/manifest.json',import.meta.url).href,
    baseUrl:dependencies.baseUrl??new URL('../',import.meta.url).href};
  const maxVoices=clamp(dependencies.maxVoices,1,32,12);
  let settings={...AUDIO_DEFAULTS},context=null,master=null,groups={},compressor=null,unlocked=false,unlocking=null;
  let catalog=null,catalogPromise=null,epoch=0,serial=0,peakActiveVoices=0,duckTimer=null;
  const buffers=new Map(),scopeEpochs=new Map(),requests=new Map(),voices=new Map(),recent=new Map(),cycles=new Map();
  const counts={requested:0,started:0,completed:0,cancelled:0,dropped:0,failed:0},events=[];
  function report(request,status,extra={}) {
    events.push({id:request?.id??0,cue:request?.cue??'',scope:request?.scope??'',group:request?.group??'',status,time:environment.now(),...extra});
    if(events.length>128)events.splice(0,events.length-128);
  }
  const audible=group=>settings.enabled&&settings.masterVolume>0&&settings[groupKey(group)]>0;
  function gain(node,value) {
    if(!node?.gain||!context)return;
    node.gain.cancelScheduledValues?.(context.currentTime);
    node.gain.setTargetAtTime?.(value,context.currentTime,.015);
    if(!node.gain.setTargetAtTime)node.gain.value=value;
  }
  function finish(request,status='completed',reason='') {
    if(request.done)return;
    request.done=true;
    for(const timer of request.timers)environment.clearTimeout(timer);
    request.timers.clear();
    if(request.source){request.source.onended=null;try{request.source.stop()}catch{}try{request.source.disconnect()}catch{}}
    for(const node of request.nodes)try{node.disconnect()}catch{}
    requests.delete(request.id);voices.delete(request.id);
    if(duckTimer!==null&&![...voices.values()].some(voice=>voice.priority>=4)) {
      environment.clearTimeout(duckTimer);duckTimer=null;gain(groups.ui,settings.uiVolume);
    }
    if(status in counts)counts[status]++;
    report(request,status,reason?{reason}:{});request.resolve({status,reason,cue:request.cue});
  }
  function timer(request,delay,callback) {
    const handle=environment.setTimeout(()=>{request.timers.delete(handle);if(!request.done)callback()},Math.max(0,delay));
    request.timers.add(handle);return handle;
  }
  const current=request=>!request.done&&request.epoch===epoch&&request.scopeEpoch===(scopeEpochs.get(request.scope)||0)&&audible(request.group);
  function stopAllAudio() {
    epoch++;
    for(const request of [...requests.values()])finish(request,'cancelled','stopped');
    if(duckTimer!==null)environment.clearTimeout(duckTimer);duckTimer=null;
    gain(groups.ui,settings.uiVolume);
  }
  function stopAudioScope(scope) {
    scope=String(scope||'default');scopeEpochs.set(scope,(scopeEpochs.get(scope)||0)+1);
    for(const request of [...requests.values()])if(request.scope===scope)finish(request,'cancelled','scope stopped');
    scopeEpochs.delete(scope);
  }
  function configureAudio(values={}) {
    settings=normalizeAudioSettings(values,settings);
    if(!settings.enabled||!settings.masterVolume)stopAllAudio();
    else for(const request of [...requests.values()])if(!audible(request.group))finish(request,'cancelled','group muted');
    gain(master,settings.masterVolume*.8);
    for(const group of AUDIO_GROUPS)gain(groups[group],settings[groupKey(group)]*(group==='ui'&&duckTimer!==null?.45:1));
    return {...settings};
  }
  async function unlockAudio() {
    if(!settings.enabled||!settings.masterVolume||!environment.AudioContext)return false;
    if(unlocking)return unlocking;
    try {
      if(!context||context.state==='closed') {
        context=new environment.AudioContext();master=context.createGain();compressor=context.createDynamicsCompressor();
        compressor.threshold.value=-12;compressor.knee.value=18;compressor.ratio.value=5;compressor.attack.value=.004;compressor.release.value=.16;
        master.gain.value=settings.masterVolume*.8;master.connect(compressor);compressor.connect(context.destination);
        groups=Object.fromEntries(AUDIO_GROUPS.map(group=>{const node=context.createGain();node.gain.value=settings[groupKey(group)];node.connect(master);return[group,node]}));
      }
      // resume is invoked synchronously inside the user gesture, before awaiting.
      const resumed=context.state==='suspended'?context.resume():Promise.resolve();
      unlocking=Promise.resolve(resumed).then(()=>{unlocked=context.state==='running';return unlocked},()=>false).finally(()=>{unlocking=null});
      return unlocking;
    }catch{return false}
  }
  async function ensureAudioCatalog() {
    if(catalog)return catalog;
    if(!catalogPromise)catalogPromise=(async()=>{
      if(!environment.fetch)throw new Error('Sound loading unavailable');
      const response=await environment.fetch(environment.manifestUrl);
      if(!response.ok)throw new Error('Sound catalogue unavailable');
      catalog=normalizeCatalog(await response.json());return catalog;
    })().catch(error=>{catalogPromise=null;throw error});
    return catalogPromise;
  }
  // Only external callers need a detached catalogue. Playback uses the private
  // cache directly instead of cloning every cue's metadata for every sound.
  async function loadAudioCatalog() {return copy(await ensureAudioCatalog())}
  async function buffer(src) {
    if(!buffers.has(src))buffers.set(src,(async()=>{
      const response=await environment.fetch(new URL(src,environment.baseUrl).href);
      if(!response.ok)throw new Error('Sound asset unavailable');
      const decoded=await context.decodeAudioData(await response.arrayBuffer());
      if(!decoded||!(decoded.duration>0)||decoded.duration>30)throw new Error('Invalid sound duration');
      return decoded;
    })().catch(error=>{buffers.delete(src);throw error}));
    return buffers.get(src);
  }
  function chooseVariant(cue,entry,seed) {
    const paths=entry.variants.length?entry.variants:[entry.src];
    let index;
    if(seed!==undefined){let hash=2166136261;for(const letter of String(seed))hash=Math.imul(hash^letter.charCodeAt(0),16777619);index=(hash>>>0)%paths.length}
    else{index=(cycles.get(cue)||0)%paths.length;cycles.set(cue,index+1)}
    return paths[index];
  }
  function playSound(cue,options={}) {
    cue=String(cue||'');const scope=String(options.scope||'default').slice(0,100);
    let resolve;const ended=new Promise(done=>{resolve=done});
    const request={id:++serial,cue,scope,group:catalog?.[cue]?.group||inferAudioGroup(cue),
      epoch,scopeEpoch:scopeEpochs.get(scope)||0,done:false,timers:new Set(),nodes:[],source:null,resolve,
      requestedAt:environment.now(),due:environment.now()+clamp(options.delay,0,10000,0)};
    counts.requested++;
    const handle={cancel:()=>finish(request,'cancelled','cancelled'),ended};
    if(!audible(request.group)||clamp(options.volume,0,1,1)===0){finish(request,'dropped','muted');return handle}
    if(!context||!unlocked&&!unlocking){finish(request,'dropped','audio not unlocked');return handle}
    if(requests.size>=48){finish(request,'dropped','queue limit');return handle}
    requests.set(request.id,request);report(request,'requested');
    (async()=>{
      try {
        if(unlocking)await unlocking;
        if(!current(request)){finish(request,'cancelled','stale request');return}
        await ensureAudioCatalog();const entry=catalog[cue];
        if(!entry){finish(request,'dropped','unknown cue');return}
        request.group=entry.group;
        if(!current(request)){finish(request,'cancelled','muted or stale');return}
        report(request,'loading');const decoded=await buffer(chooseVariant(cue,entry,options.seed));
        if(!current(request)){finish(request,'cancelled','muted or stale');return}
        if(context.state!=='running'){finish(request,'dropped','audio suspended');return}
        const now=environment.now();
        if(now-request.due>entry.maxLateMs){finish(request,'dropped','expired');return}
        const previous=(recent.get(cue)||[]).filter(at=>at>now-2000);
        if(previous.some(at=>Math.abs(request.due-at)<entry.cooldownMs)){finish(request,'dropped','cue cooldown');return}
        const priority=clamp(options.priority,0,10,entry.priority);
        if(voices.size>=maxVoices) {
          const quietest=[...voices.values()].sort((a,b)=>a.priority-b.priority||a.requestedAt-b.requestedAt)[0];
          if(quietest.priority>=priority){finish(request,'dropped','voice limit');return}
          finish(quietest,'cancelled','higher priority cue');
        }
        request.priority=priority;request.group=entry.group;
        const source=context.createBufferSource(),volume=context.createGain();request.source=source;request.nodes.push(volume);
        source.buffer=decoded;source.playbackRate.value=clamp(options.pitch,.75,1.35,1);
        volume.gain.value=entry.gain*clamp(options.volume,0,1,1)*.75;
        source.connect(volume);
        if(context.createStereoPanner&&Number.isFinite(options.pan)) {
          const panner=context.createStereoPanner();panner.pan.value=clamp(options.pan,-1,1,0);volume.connect(panner);panner.connect(groups[entry.group]);request.nodes.push(panner);
        }else volume.connect(groups[entry.group]);
        const wait=Math.max(0,request.due-now),startAt=context.currentTime+wait/1000;
        source.onended=()=>finish(request,'completed');voices.set(request.id,request);peakActiveVoices=Math.max(peakActiveVoices,voices.size);
        recent.set(cue,[...previous,request.due].slice(-16));
        source.start(startAt);report(request,'scheduled',{delay:wait,priority,startAt});
        timer(request,wait,()=>{
          if(!current(request)){finish(request,'cancelled','stale start');return}
          counts.started++;report(request,'started',{priority});
          if(priority>=4) {
            gain(groups.ui,settings.uiVolume*.45);
            if(duckTimer!==null)environment.clearTimeout(duckTimer);
            duckTimer=environment.setTimeout(()=>{duckTimer=null;gain(groups.ui,settings.uiVolume)},Math.min(2000,decoded.duration*1000));
          }
        });
        // Native onended is authoritative; the watchdog also cleans up interrupted devices.
        timer(request,wait+decoded.duration/source.playbackRate.value*1000+250,()=>finish(request,'completed'));
      }catch{if(!request.done)finish(request,'failed','unavailable sound')}
    })();
    return handle;
  }
  async function preloadSounds(ids) {
    if(!settings.enabled||!settings.masterVolume||!context||!unlocked)return {loaded:0,failed:0};
    const generation=epoch;let loaded=0,failed=0,index=0;
    try{await ensureAudioCatalog()}catch{return{loaded:0,failed:1}}
    const entries=(ids||Object.keys(catalog)).map(id=>catalog[id]).filter(Boolean);
    const paths=[...new Set(entries.flatMap(entry=>entry.variants.length?entry.variants:[entry.src]))];
    await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{
      while(index<paths.length&&generation===epoch&&settings.enabled){const src=paths[index++];try{await buffer(src);loaded++}catch{failed++}}
    }));
    return {loaded,failed};
  }
  function getAudioDiagnostics() {
    return {enabled:settings.enabled,unlocked,state:context?.state||'not-created',settings:{...settings},activeVoices:voices.size,
      pending:requests.size,cachedBuffers:buffers.size,manifestLoaded:Boolean(catalog),peakActiveVoices,
      counts:{...counts},events:copy(events)};
  }
  return {configureAudio,unlockAudio,playSound,stopAudioScope,stopAllAudio,preloadSounds,loadAudioCatalog,
    getAudioCatalog:()=>copy(catalog),getAudioDiagnostics};
}

const engine=createAudioEngine();
export const configureAudio=engine.configureAudio;
export const unlockAudio=engine.unlockAudio;
export const playSound=engine.playSound;
export const stopAudioScope=engine.stopAudioScope;
export const stopAllAudio=engine.stopAllAudio;
export const preloadSounds=engine.preloadSounds;
export const loadAudioCatalog=engine.loadAudioCatalog;
export const getAudioCatalog=engine.getAudioCatalog;
export const getAudioDiagnostics=engine.getAudioDiagnostics;
