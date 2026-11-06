import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as rules from '../js/progression.js';
import {cardForm,CARD_TYPES} from '../js/card-frame.js';
import {TYPE_EFFECTS} from '../js/battle-fx.js';
import {quoteBuyCard} from '../js/economy.js';

// Manual native-audio regression: start an isolated PORT=4181 server first.
const base='http://127.0.0.1:4181';
const output=new URL('../tmp/audio-browser/',import.meta.url);await mkdir(output,{recursive:true});
const preferences={master:.65,combat:.8,ui:.55,progression:.8,pets:.8};
function ready(seed=72) {
  const game=rules.freshGame(seed);rules.begin(game,'Sound Reviewer');
  game.tutorial={version:1,sanctuary:6,battle:4};return game;
}
function fixture(id,{pet=null}={}) {
  const game=ready(),card=rules.cardById[id];game.sound=true;game.audioSettings={...preferences};
  if(pet) {
    game.realm=pet.realm;game.essence=rules.REALMS[pet.realm].essence;game.hp=rules.maxHp(game);
    assert.equal(rules.hatchPet(game,pet.id).ok,true);game.pets[pet.id]={realm:pet.realm,essence:rules.REALMS[pet.realm].essence};
    assert.equal(rules.equipPet(game,pet.id).ok,true);
  }
  game.known[id]=(game.known[id]||0)+2;game.deck=[id,id,...game.deck.slice(0,6)];
  assert.equal(rules.encounter(game,'blank-writ').ok,true);
  const combat=game.active.combat,entries=[...combat.hand,...combat.drawPile];
  const index=entries.findIndex(entry=>entry.id===id);combat.hand=[entries.splice(index,1)[0]];
  combat.drawPile=entries;combat.discard=[];combat.exhausted=[];combat.energy=20;
  combat.player.hp=40;combat.player.block=5;combat.enemy.maxHp=900;combat.enemy.hp=900;
  combat.enemy.statuses={poison:1,strength:2};combat.resonance={element:card.school==='neutral'?'iron':card.school,count:2};
  assert.equal(rules.readSave(null,JSON.stringify(game)).warning,undefined,id);return game;
}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  await context.addInitScript(()=>{
    const Native=window.AudioContext||window.webkitAudioContext;
    window.__NativeAudioContext=Native;
    const probe=window.__audioProbe={contexts:[],starts:[],stops:[],ends:[],mixPeak:0,mixEnergy:0,mixSamples:0,mixMaxBlockRMS:0,lastContext:null};
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);probe.contexts.push(this);}
      createDynamicsCompressor(){
        const node=super.createDynamicsCompressor(),connect=node.connect.bind(node),context=this;
        node.connect=(destination,...args)=>{
          if(destination!==context.destination)return connect(destination,...args);
          const analyser=context.createAnalyser();analyser.fftSize=2048;connect(analyser);analyser.connect(destination);
          const samples=new Float32Array(analyser.fftSize),timer=setInterval(()=>{
            if(probe.lastContext!==context)return;
            analyser.getFloatTimeDomainData(samples);let energy=0;
            for(const value of samples){probe.mixPeak=Math.max(probe.mixPeak,Math.abs(value));energy+=value*value}
            probe.mixEnergy+=energy;probe.mixSamples+=samples.length;probe.mixMaxBlockRMS=Math.max(probe.mixMaxBlockRMS,Math.sqrt(energy/samples.length));
          },4);
          context.addEventListener('statechange',()=>{if(context.state==='closed')clearInterval(timer)});return destination;
        };return node;
      }
      createBufferSource(){
        const node=super.createBufferSource(),start=node.start.bind(node),stop=node.stop.bind(node),context=this;
        node.start=(when=0,...args)=>{
          probe.lastContext=context;
          const buffer=node.buffer;let peak=0,fingerprint=2166136261;
          if(buffer)for(let channel=0;channel<buffer.numberOfChannels;channel++) {
            let index=0;for(const value of buffer.getChannelData(channel)){peak=Math.max(peak,Math.abs(value));if(index++%64===0)fingerprint=Math.imul(fingerprint^Math.round(value*32767),16777619)}
          }
          probe.starts.push({when,clock:context.currentTime,wall:performance.now(),duration:buffer?.duration||0,peak,fingerprint:fingerprint>>>0,state:context.state});
          return start(when,...args);
        };
        node.stop=(...args)=>{probe.stops.push({wall:performance.now()});return stop(...args)};
        node.addEventListener('ended',()=>probe.ends.push({wall:performance.now()}));return node;
      }
    };
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],httpErrors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push(`${response.status()} ${response.url()}`)});
  await page.goto(base);
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),rules.SAVE_KEY);
  const diagnostics=()=>page.evaluate(async()=>{const audio=await import('/js/audio-engine.js');return audio.getAudioDiagnostics()});
  const load=async game=>{await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});await page.reload();await page.locator('#screen').waitFor();};
  const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:false});
  const settle=async()=>page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')!=='true',null,{timeout:4000});
  const warm=()=>page.evaluate(async()=>{const audio=await import('/js/audio-engine.js');await audio.unlockAudio();await audio.preloadSounds();audio.stopAllAudio()});

  // Initial and legacy-muted chronicles never create an audio context or start a source.
  assert.equal((await diagnostics()).enabled,false);
  await page.locator('[data-action="nav"][data-id="market"]').click();
  assert.deepEqual(await page.evaluate(()=>({contexts:__audioProbe.contexts.length,starts:__audioProbe.starts.length})),{contexts:0,starts:0});
  await page.locator('[data-action="settings"]').click();
  assert.equal(await page.locator('[data-audio-setting]').count(),5);
  await page.locator('#dialog [data-action="sound"]').click();
  await warm();
  assert.equal((await diagnostics()).enabled,true);assert.equal((await diagnostics()).unlocked,true);
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{__audioProbe.mixPeak=0;__audioProbe.mixEnergy=0;__audioProbe.mixSamples=0;__audioProbe.mixMaxBlockRMS=0});
  await page.locator('[data-action="audio-preview"]').click();
  await page.waitForFunction(()=>__audioProbe.starts.length>0);
  await page.waitForFunction(()=>__audioProbe.mixPeak>.00001);
  await page.waitForFunction(async()=>{const audio=await import('/js/audio-engine.js');return audio.getAudioDiagnostics().events.some(event=>event.cue==='sound-preview'&&event.status==='started')});
  const audible=await page.evaluate(()=>__audioProbe.starts.some(source=>source.peak>0&&source.duration>0&&source.state==='running'));
  assert.equal(audible,true,'the preview starts a native source with real nonzero PCM in a running context');
  assert.ok(await page.evaluate(()=>__audioProbe.mixPeak>0),'nonzero samples reach the actual native output graph');
  await page.waitForFunction(async()=>{const audio=await import('/js/audio-engine.js');return audio.getAudioDiagnostics().activeVoices===0});
  const previewMix=await page.evaluate(()=>({peak:__audioProbe.mixPeak,rms:Math.sqrt(__audioProbe.mixEnergy/Math.max(1,__audioProbe.mixSamples)),maxBlockRMS:__audioProbe.mixMaxBlockRMS}));
  for(const [key,value]of Object.entries({master:42,combat:66,ui:31,progression:72,pets:57})) {
    await page.locator(`[data-audio-setting="${key}"]`).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}))},value);
    assert.equal((await saved()).audioSettings[key],value/100,key);
  }
  await shot('audio-settings');
  await page.reload();assert.equal(await page.evaluate(()=>__audioProbe.starts.length),0,'enabled save does not autoplay after reload');
  assert.equal((await saved()).audioSettings.master,.42);

  // Decode the actual deployed asset bank, independently of the engine cache.
  const assets=await page.evaluate(async()=>{
    const response=await fetch('/assets/audio/manifest.json');if(!response.ok)throw new Error('Missing audio manifest');
    if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('Wrong manifest MIME');
    const manifest=await response.json(),entries=Object.entries(manifest.cues);
    const paths=[...new Set(entries.flatMap(([,cue])=>[cue.src,...(cue.variants||[])].filter(Boolean)))];
    const context=new __NativeAudioContext();
    try {
      const records=[];
      for(const src of paths) {
        const response=await fetch('/'+src);if(!response.ok)throw new Error(src);
        if(!response.headers.get('content-type')?.startsWith('audio/'))throw new Error('Wrong audio MIME: '+src);
        const buffer=await context.decodeAudioData(await response.arrayBuffer());let peak=0,energy=0,samples=0;
        for(let channel=0;channel<buffer.numberOfChannels;channel++)for(const value of buffer.getChannelData(channel)){if(!Number.isFinite(value))throw new Error('Invalid sample '+src);peak=Math.max(peak,Math.abs(value));energy+=value*value;samples++}
        if(buffer.duration<=0||peak<=.00001||peak>1||energy<=0)throw new Error('Silent or invalid audio '+src);
        records.push({src,duration:buffer.duration,peak,rms:Math.sqrt(energy/samples)});
      }
      return {version:manifest.version,entries,records};
    } finally {await context.close()}
  });
  assert.equal(assets.version,1);assert.ok(assets.records.length>=40);
  const cueMap=Object.fromEntries(assets.entries);
  for(const type of Object.keys(CARD_TYPES))assert.ok(cueMap['cast-'+type],type);
  const hashes=await Promise.all(Object.keys(CARD_TYPES).map(async type=>createHash('sha256').update(await readFile(new URL('../'+cueMap['cast-'+type].src,import.meta.url))).digest('hex')));
  assert.equal(new Set(hashes).size,12,'every card category has distinct audio content');

  const casts=[];
  for(const type of Object.keys(CARD_TYPES)) {
    const card=rules.cards.find(card=>cardForm(card)===type&&card.cost<=2),game=fixture(card.id);
    const expected=structuredClone(game);assert.equal(rules.fight(expected,'play',0).ok,true);
    await load(game);await page.locator('.duel-hand .battle-card').first().click();await warm();
    const before=await page.evaluate(()=>({starts:__audioProbe.starts.length,wall:performance.now()}));
    await page.locator('[data-action="cast-card"]:not([disabled])').first().click();await settle();
    const diag=await diagnostics(),started=diag.events.filter(event=>event.status==='started');
    assert.ok(started.some(event=>event.cue==='cast-'+type),`${type}: actual started identity cue`);
    const castEvent=started.find(event=>event.cue==='cast-'+type);
    for(const impact of started.filter(event=>['impact-light','impact-heavy','blocked','heal','status','shield-break'].includes(event.cue))) {
      assert.ok(impact.time-castEvent.time>=TYPE_EFFECTS[type].release-70,`${type}: impact follows visual release`);
    }
    const native=await page.evaluate(index=>__audioProbe.starts.slice(index),before.starts);
    assert.ok(native.some(source=>source.peak>0&&source.duration>0),type);
    assert.deepEqual((await saved()).active.combat,expected.active.combat,`${type}: exactly one unchanged engine result`);
    casts.push({type,profile:TYPE_EFFECTS[type],nativeStarts:native.length,cues:started.map(event=>event.cue)});
  }

  // Exercise real shop refresh, companion, and cultivation actions through the UI.
  const startedCue=async cue=>{
    for(let attempt=0;attempt<160;attempt++) {
      const found=(await diagnostics()).events.find(event=>event.cue===cue&&event.status==='started');
      if(found)return found;
      await page.waitForTimeout(25);
    }
    assert.fail(`No native started cue: ${cue}`);
  };
  const shopper=ready();shopper.sound=true;shopper.audioSettings={...preferences};shopper.jade=10000;
  await load(shopper);await page.locator('[data-action="nav"][data-id="market"]').click();
  const affordable=rules.cards.find(card=>quoteBuyCard(shopper,card.id).ok);
  await page.locator(`[data-action="shop-inspect"][data-id="${affordable.id}"]`).click();await warm();
  await page.locator('#dialog [data-action="purchase-card"]:not([disabled])').click();await startedCue('purchase');
  assert.equal(await page.locator('#dialog').evaluate(dialog=>dialog.open),true,'purchase dialog remains open');

  const petGame=fixture('palm-strike',{pet:{id:'azure-dragon',realm:3}});
  await load(petGame);await warm();await page.locator('[data-action="pet-ability"][data-id="cloudpiercer"]').click();await settle();
  await startedCue('pet-command');await startedCue('pet-azure-dragon');

  const hero=ready();hero.sound=true;hero.audioSettings={...preferences};hero.essence=10;
  rules.startBounty(hero,'neutral',1);hero.active.combat.enemy.hp=0;hero.active.combat.outcome='victory';
  await load(hero);await warm();await page.locator('[data-action="resolve"]').click();await startedCue('hero-layer');
  await page.reload();assert.equal(await page.evaluate(()=>__audioProbe.starts.length),0,'level feedback does not replay after reload');
  const ascender=ready();ascender.sound=true;ascender.audioSettings={...preferences};ascender.essence=110;ascender.jade=100;
  await load(ascender);await warm();await page.locator('[data-action="breakthrough"]').click();await startedCue('hero-realm');
  await page.keyboard.press('Escape');await page.waitForTimeout(1100);
  assert.equal((await diagnostics()).pending,0);assert.equal((await diagnostics()).activeVoices,0);

  const feeder=structuredClone(ascender);feeder.realm=1;rules.hatchPet(feeder,'vermilion-phoenix');
  const food='iron-black-wax-citation';feeder.known[food]=14;
  await load(feeder);await page.locator('[data-action="nav"][data-id="pets"]').click();
  await page.locator('[data-action="pet-select"][data-id="vermilion-phoenix"]').click();
  await page.locator('[data-action="pet-feed-picker"]').click();await page.locator('#dialog select[name="cardId"]').selectOption(food);
  await page.locator('#dialog input[name="quantity"]').fill('14');await page.locator('#dialog [data-pet-feed-submit]').click();await warm();
  await page.locator('#dialog [data-action="pet-feed-confirm"]').click();await startedCue('pet-layer');await startedCue('pet-feed');
  await page.locator('[data-action="pet-evolve-preview"]').click();await warm();await page.locator('#dialog [data-action="pet-evolve"]').click();await startedCue('pet-evolve');
  await page.keyboard.press('Escape');await page.waitForTimeout(1100);
  assert.equal((await diagnostics()).pending,0);assert.equal((await diagnostics()).activeVoices,0);

  const hatcher=ready();hatcher.sound=true;hatcher.audioSettings={...preferences};
  await load(hatcher);await page.locator('[data-action="nav"][data-id="pets"]').click();
  await page.locator('[data-action="pet-select"][data-id="azure-dragon"]').click();
  await page.locator('[data-action="pet-hatch-preview"]').click();await warm();
  await page.locator('#dialog [data-action="pet-hatch"]').click();await startedCue('pet-hatch');
  await startedCue('egg-crack');await startedCue('pet-azure-dragon');
  const hatchEvents=(await diagnostics()).events.filter(event=>event.status==='scheduled');
  const hatchStart=hatchEvents.find(event=>event.cue==='pet-hatch').startAt;
  assert.ok(hatchEvents.find(event=>event.cue==='egg-crack').startAt-hatchStart>=.78);
  assert.ok(hatchEvents.find(event=>event.cue==='pet-azure-dragon').startAt-hatchStart>=1.68);
  await page.keyboard.press('Escape');
  await load(fixture('palm-strike'));await page.locator('.duel-hand .battle-card').first().click();await warm();
  await page.evaluate(()=>{
    document.querySelector('[data-action="cast-card"]:not([disabled])').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    document.querySelector('[data-action="settings"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
  });await page.waitForTimeout(700);
  assert.equal((await diagnostics()).events.some(event=>event.cue==='impact-light'&&event.status==='started'),false);
  assert.equal((await diagnostics()).pending,0);

  await load(ascender);await page.setViewportSize({width:390,height:844});await page.locator('[data-action="settings"]').click();
  for(const key of Object.keys(preferences)) {
    const range=page.locator(`[data-audio-setting="${key}"]`);await range.scrollIntoViewIfNeeded();
    const box=await range.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,`${key}: mobile slider fits`);
    await range.focus();await page.keyboard.press('ArrowLeft');assert.equal((await saved()).audioSettings[key],preferences[key]-.01);
  }
  await shot('audio-mobile');await page.setViewportSize({width:1440,height:1000});
  await load(ascender);await warm();
  const finisherMix=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');
    __audioProbe.mixPeak=0;__audioProbe.mixEnergy=0;__audioProbe.mixSamples=0;__audioProbe.mixMaxBlockRMS=0;
    await Promise.all([audio.playSound('cast-finisher').ended,audio.playSound('impact-heavy',{delay:380}).ended]);
    return{peak:__audioProbe.mixPeak,rms:Math.sqrt(__audioProbe.mixEnergy/Math.max(1,__audioProbe.mixSamples)),maxBlockRMS:__audioProbe.mixMaxBlockRMS};
  });
  assert.ok(finisherMix.peak>.01&&finisherMix.peak<.99);

  // A scheduled native source is stopped, not merely hidden from diagnostics.
  const cancellation=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');audio.stopAllAudio();
    const before=audio.getAudioDiagnostics().counts.started,stops=__audioProbe.stops.length;
    const handle=audio.playSound('cast-finisher',{delay:450,scope:'qa-delayed'});
    await new Promise(resolve=>setTimeout(resolve,30));audio.stopAudioScope('qa-delayed');
    const ended=await handle.ended;await new Promise(resolve=>setTimeout(resolve,500));
    return {before,after:audio.getAudioDiagnostics(),ended,nativeStops:__audioProbe.stops.length-stops};
  });
  assert.equal(cancellation.ended.status,'cancelled');assert.equal(cancellation.after.counts.started,cancellation.before);
  assert.equal(cancellation.after.pending,0);assert.equal(cancellation.after.activeVoices,0);assert.ok(cancellation.nativeStops>0);

  const mute=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');audio.stopAllAudio();
    const before=audio.getAudioDiagnostics().counts.started;
    const handle=audio.playSound('hero-realm',{delay:400,scope:'qa-mute'});
    await new Promise(resolve=>setTimeout(resolve,25));audio.configureAudio({enabled:false});audio.configureAudio({enabled:true});
    const ended=await handle.ended;await new Promise(resolve=>setTimeout(resolve,450));
    return {before,after:audio.getAudioDiagnostics(),ended};
  });
  assert.equal(mute.ended.status,'cancelled');assert.equal(mute.after.counts.started,mute.before);
  assert.equal(mute.after.pending,0);assert.equal(mute.after.activeVoices,0);

  // The decode cancellation uses real native decoding with only the fetch completion held.
  const decodeRace=await page.evaluate(async()=>{
    const {createAudioEngine}=await import('/js/audio-engine.js');const nativeFetch=fetch.bind(window);
    let release,entered;const loading=new Promise(resolve=>{entered=resolve});
    const engine=createAudioEngine({fetch:async url=>{
      if(String(url).endsWith('manifest.json'))return nativeFetch(url);
      entered();return new Promise(resolve=>{release=()=>nativeFetch(url).then(resolve)});
    }});
    engine.configureAudio({enabled:true});await engine.unlockAudio();
    const nativeBefore=__audioProbe.starts.length,handle=engine.playSound('impact-heavy',{scope:'qa-decode'});
    await loading;engine.configureAudio({enabled:false});engine.configureAudio({enabled:true});release();
    const ended=await handle.ended;await new Promise(resolve=>setTimeout(resolve,250));
    return {ended,diag:engine.getAudioDiagnostics(),newNativeStarts:__audioProbe.starts.length-nativeBefore};
  });
  assert.equal(decodeRace.ended.status,'cancelled');assert.equal(decodeRace.newNativeStarts,0);
  assert.equal(decodeRace.diag.pending,0);assert.equal(decodeRace.diag.activeVoices,0);

  const volume=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');audio.stopAllAudio();
    audio.configureAudio({enabled:true,masterVolume:0});const master=await audio.playSound('sound-preview').ended;
    audio.configureAudio({masterVolume:.65,combatVolume:0,uiVolume:.55});const combat=await audio.playSound('cast-strike').ended;
    const before=audio.getAudioDiagnostics().counts.started,ui=audio.playSound('ui-select');
    await new Promise(resolve=>setTimeout(resolve,80));const uiStarted=audio.getAudioDiagnostics().counts.started>before;
    audio.stopAllAudio();await ui.ended;audio.configureAudio({combatVolume:.8});return{master,combat,uiStarted};
  });
  assert.equal(volume.master.status,'dropped');assert.equal(volume.combat.status,'dropped');assert.equal(volume.uiStarted,true);
  const groupIsolation=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js'),results=[];
    for(const [group,cues]of Object.entries({ui:['forge','upgrade','salvage','reward','rest'],combat:['victory','defeat','card-draw'],progression:['pet-layer','pet-evolve']})) {
      audio.configureAudio({[group+'Volume']:0});
      for(const cue of cues)results.push({cue,status:(await audio.playSound(cue).ended).status});
      audio.configureAudio({[group+'Volume']:group==='ui'?.55:.8});
    }
    return results;
  });
  for(const result of groupIsolation)assert.equal(result.status,'dropped',`${result.cue}: correct mixer mute`);

  const burst=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');audio.stopAllAudio();
    __audioProbe.mixPeak=0;__audioProbe.mixEnergy=0;__audioProbe.mixSamples=0;__audioProbe.mixMaxBlockRMS=0;
    const handles=Object.keys(audio.getAudioCatalog()).slice(0,26).map(cue=>audio.playSound(cue,{scope:'qa-burst',delay:100}));
    await new Promise(resolve=>setTimeout(resolve,350));const peak=audio.getAudioDiagnostics();
    const output={peak:__audioProbe.mixPeak,rms:Math.sqrt(__audioProbe.mixEnergy/Math.max(1,__audioProbe.mixSamples)),maxBlockRMS:__audioProbe.mixMaxBlockRMS};
    audio.stopAudioScope('qa-burst');await Promise.all(handles.map(handle=>handle.ended));
    return {peak,output,after:audio.getAudioDiagnostics()};
  });
  assert.ok(burst.peak.peakActiveVoices<=12);assert.ok(burst.peak.activeVoices<=12);
  assert.ok(burst.output.peak>.0001&&burst.output.peak<.99,'the rendered capped burst is nonzero and unclipped');
  assert.equal(burst.after.pending,0);assert.equal(burst.after.activeVoices,0);

  const variants=await page.evaluate(async()=>{
    const audio=await import('/js/audio-engine.js');audio.stopAllAudio();const start=__audioProbe.starts.length;
    await audio.playSound('ui-click',{scope:'qa-variants'}).ended;
    await audio.playSound('ui-click',{scope:'qa-variants'}).ended;
    return __audioProbe.starts.slice(start).map(source=>source.fingerprint);
  });
  assert.equal(variants.length,2);assert.equal(new Set(variants).size,2,'round-robin variants produce different native PCM');

  // Unavailable audio is a recoverable presentation failure, without creating a source.
  const unavailable=await page.evaluate(async()=>{
    const {createAudioEngine}=await import('/js/audio-engine.js');
    const engine=createAudioEngine({fetch:async()=>new Response('',{status:404})});engine.configureAudio({enabled:true});await engine.unlockAudio();
    const ended=await engine.playSound('ui-click').ended;return {ended,diag:engine.getAudioDiagnostics()};
  });
  assert.equal(unavailable.ended.status,'failed');assert.equal(unavailable.diag.pending,0);assert.equal(unavailable.diag.activeVoices,0);

  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({status:'passed',assets:assets.records.length,casts:casts.length,previewMix,finisherMix,burstMix:burst.output,checks:['default silence','gesture preview with native nonzero output','five persisted volume channels','no autoplay on reload','all assets HTTP/decode/MIME/nonzero samples','twelve distinct cast assets and actual source starts','purchase refresh preserves success sound','companion species and command','hero and pet growth and skip cancellation','hatch native-clock phase timing','menu cancels pending card impact','390px keyboard mixer','scheduled-scope native stop','mute/unmute prevents late starts','real decode cancellation','zero-volume and channel isolation including corrected workshop and growth groups','voice cap and unclipped rendered burst','real round-robin PCM variants','recoverable unavailable audio'],errors,httpErrors},null,2));
} finally {await browser.close()}
