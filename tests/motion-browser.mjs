import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright.mjs';
import * as rules from '../js/progression.js';
import {cardForm,CARD_TYPES} from '../js/card-frame.js';
import {captureCombatEvents} from '../js/combat.js';
import {TYPE_EFFECTS} from '../js/battle-fx.js';

// Run against an isolated server: PORT=4181 node server.js.
const base='http://127.0.0.1:4181';
const output=new URL('../tmp/motion-browser/',import.meta.url);await mkdir(output,{recursive:true});
const clone=value=>structuredClone(value);
function ready(seed=72) {
  const game=rules.freshGame(seed);rules.begin(game,'Motion Reviewer');
  game.tutorial={version:1,sanctuary:6,battle:4};return game;
}
function battleFixture(id,{lethal=false,absorbed=false,pet=null}={}) {
  const game=ready(),card=rules.cardById[id];
  if(pet) {
    game.realm=pet.realm;game.essence=rules.REALMS[pet.realm].essence;game.hp=rules.maxHp(game);
    assert.equal(rules.hatchPet(game,pet.id).ok,true);
    game.pets[pet.id]={realm:pet.realm,essence:rules.REALMS[pet.realm].essence};
    assert.equal(rules.equipPet(game,pet.id).ok,true);
  }
  game.known[id]=(game.known[id]||0)+2;
  game.deck=[id,id,...game.deck.slice(0,6)];
  assert.equal(rules.encounter(game,'blank-writ').ok,true);
  const combat=game.active.combat,entries=[...combat.hand,...combat.drawPile];
  const index=entries.findIndex(entry=>entry.id===id),entry=entries.splice(index,1)[0];
  combat.hand=[entry];combat.drawPile=entries;combat.discard=[];combat.exhausted=[];
  combat.energy=20;combat.player.hp=40;combat.player.block=5;
  combat.enemy.maxHp=900;combat.enemy.hp=lethal?1:900;
  combat.enemy.block=typeof absorbed==='number'?absorbed:absorbed?100:0;combat.enemy.statuses={poison:1,strength:2};
  combat.resonance={element:card.school==='neutral'?'iron':card.school,count:2};
  assert.equal(rules.readSave(null,JSON.stringify(game)).warning,undefined,id);
  return game;
}
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],httpErrors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push(`${response.status()} ${response.url()}`)});
  await page.goto(base);
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),rules.SAVE_KEY);
  const load=async game=>{await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});await page.reload();await page.locator('#screen').waitFor();};
  const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:false});
  const settle=async()=>{await page.waitForFunction(()=>document.querySelector('#app')?.getAttribute('aria-busy')!=='true'&&!document.querySelector('#battle-fx')?.children.length,null,{timeout:4000});};
  async function castFirst() {
    await page.locator('.duel-hand .battle-card').first().click();
    await page.locator('[data-action="cast-card"].target-ready').count();
    await page.locator('[data-action="cast-card"]:not([disabled])').first().click();
  }
  const records=[];
  if(!process.argv.includes('--progress-only'))for(const type of Object.keys(CARD_TYPES)) {
    const card=rules.cards.find(card=>cardForm(card)===type&&card.cost<=2);
    const game=battleFixture(card.id);
    if(type==='strike')game.active.combat.hand.push(game.active.combat.drawPile.shift());
    const expected=clone(game);
    const {events,result}=captureCombatEvents(expected.active.combat,()=>rules.fight(expected,'play',0));assert.equal(result.ok,true);
    await load(game);await castFirst();
    await page.locator(`.fx-signature[data-effect-type="${type}"]`).waitFor();
    const signature=await page.locator('.fx-signature').first().evaluate(node=>({shape:node.dataset.effectShape,svg:node.querySelector('svg')?.innerHTML||node.innerHTML}));
    assert.ok(signature.shape&&signature.svg.length>20,type);
    assert.deepEqual((await saved()).active.combat,expected.active.combat,`${type}: exactly one engine action`);
    if(type==='strike') {
      const afterCast=await saved();
      const race=await page.evaluate(()=>{
        const busy=document.querySelector('#app').getAttribute('aria-busy')==='true';
        for(const key of ['2','Enter','e'])document.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
        document.querySelector('[data-action="end"]')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        const drag=new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()});
        document.querySelector('.duel-hand .battle-card')?.dispatchEvent(drag);
        document.querySelector('.duel-arena')?.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:new DataTransfer()}));
        return {busy,dragPrevented:drag.defaultPrevented};
      });
      assert.equal(race.busy,true,'race is attempted while presentation is still busy');
      assert.equal(race.dragPrevented,true,'dragging is cancelled during the timeline');
      assert.deepEqual(await saved(),afterCast,'busy keyboard and click cannot commit a second combat action');
    }
    if(['strike','ritual','finisher'].includes(type)) {await page.waitForTimeout(TYPE_EFFECTS[type].release-70);await shot('cast-'+type);}
    await settle();
    assert.equal(await page.locator('#battle-fx > *').count(),0,type+' cleanup');
    records.push({type,id:card.id,shape:signature.shape,svg:signature.svg,events:events.length});
  }
  if(records.length) {
    assert.equal(new Set(records.map(record=>record.shape)).size,12,'all twelve card forms have distinct geometry');
    assert.equal(new Set(records.map(record=>record.svg)).size,12,'the signatures differ in rendered content');
  }

  if(!process.argv.includes('--progress-only')) {
    for(const [id,options]of [['palm-strike',{absorbed:true}],['sweep-the-threshold',{}]]) {
      const game=battleFixture(id,options),expected=clone(game);
      const {events}=captureCombatEvents(expected.active.combat,()=>rules.fight(expected,'play',0));
      const strike=events.find(event=>event.type==='strike');
      await load(game);await castFirst();
      await page.locator('.fx-result.result-strike').waitFor();
      const receipt=await page.locator('.fx-result.result-strike').first().innerText();
      if(options.absorbed) {assert.equal(strike.amount,0);assert.match(receipt,new RegExp(String(strike.blocked)));assert.match(receipt,/absorb/i);await shot('damage-absorbed');}
      else {assert.ok(strike.hits>1);assert.match(receipt,new RegExp(String(strike.amount)));assert.match(receipt,/hits/i);await shot('damage-multihit');}
      assert.deepEqual((await saved()).active.combat,expected.active.combat);
      await settle();
    }

    // Cancellation must preserve the committed action and release every input lock.
    await load(battleFixture('palm-strike'));await castFirst();
    const committed=await saved();
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#battle-fx > *').count(),0);
    assert.equal(await page.locator('#app').getAttribute('aria-busy'),null);
    await page.locator('#dialog [data-action="close"]').click();
    assert.deepEqual(await saved(),committed);
    await page.keyboard.press('e');await settle();assert.equal((await saved()).active.combat.turn,2);

    await load(battleFixture('palm-strike',{lethal:true}));await castFirst();
    assert.equal((await saved()).active.combat.outcome,'victory');
    assert.equal(await page.locator('.outcome').count(),0,'lethal outcome waits for impact');
    await page.locator('[data-action="settings"]').click();
    assert.equal(await page.locator('#dialog[open]').count(),1);
    await page.waitForTimeout(1450);
    assert.equal(await page.locator('#dialog[open]').count(),1,'stale lethal callback does not dismiss Settings');
    await page.locator('#dialog [data-action="close"]').click();
    assert.equal(await page.locator('.outcome').count(),1,'cancelled lethal presentation reveals its committed outcome');

    await load(battleFixture('iron-heat-the-judgment-brand'));await castFirst();await page.reload();
    assert.equal(await page.locator('#battle-fx > *').count(),0);assert.equal(await page.locator('#app').getAttribute('aria-busy'),null);

    await page.emulateMedia({reducedMotion:'reduce'});
    await load(battleFixture('palm-strike'));
    // Observe the 240ms presentation in the page, so protocol latency cannot
    // consume the entire interval before the assertion starts polling.
    const reducedReceipt=await page.evaluate(()=>new Promise((resolve,reject)=>{
      let signature=false,result=false;
      const timeout=setTimeout(()=>{observer.disconnect();reject(new Error('Reduced-motion receipt was not presented'))},4000);
      const observer=new MutationObserver(()=>{
        signature ||= Boolean(document.querySelector('.fx-signature.fx-reduced'));
        result ||= Boolean(document.querySelector('.fx-result.result-strike'));
        if(signature&&result){clearTimeout(timeout);observer.disconnect();resolve({signature,result})}
      });
      observer.observe(document.querySelector('#battle-fx'),{childList:true,subtree:true});
      document.querySelector('.duel-hand .battle-card').click();
      document.querySelector('[data-action="cast-card"]:not([disabled])').click();
    }));
    assert.deepEqual(reducedReceipt,{signature:true,result:true},'reduced motion retains a compact signature and result');
    await settle();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:390,height:844});
    await load(battleFixture('iron-heat-the-judgment-brand'));await castFirst();await page.locator('.fx-signature').waitFor();await shot('mobile-ritual');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
    await settle();await page.setViewportSize({width:1440,height:1000});

    // Depleting Guard without losing vitality still fractures the shield.
    const blocked=battleFixture('palm-strike',{absorbed:6});
    await load(blocked);await castFirst();await page.locator('.fx-shield-break').waitFor({state:'attached'});
    assert.ok(await page.locator('.fx-shield-break i').count()>=3,'the depleted shield emits visible fragments');
    const blockedState=await saved();assert.equal(blockedState.active.combat.enemy.hp,900);assert.equal(blockedState.active.combat.enemy.block,0);
    await settle();

    // A companion command travels from the companion, not the hero portrait.
    const petGame=battleFixture('palm-strike',{pet:{id:'azure-dragon',realm:3}}),petExpected=clone(petGame);
    rules.fight(petExpected,'pet','cloudpiercer');await load(petGame);
    const petPoint=await page.locator('.battle-companion').boundingBox();
    await page.locator('[data-action="pet-ability"][data-id="cloudpiercer"]').click();
    await page.locator('.fx-spirit-bolt').first().waitFor();
    const bolt=await page.locator('.fx-spirit-bolt').first().evaluate(node=>({x:parseFloat(node.style.left),y:parseFloat(node.style.top)}));
    assert.ok(Math.abs(bolt.x-(petPoint.x+petPoint.width/2))<2&&Math.abs(bolt.y-(petPoint.y+petPoint.height/2))<2,'pet projectile starts beside the companion');
    assert.deepEqual((await saved()).active.combat,petExpected.active.combat);await settle();

    // A delayed authored ritual receives its own resolution signature.
    const ritual=battleFixture('iron-heat-the-judgment-brand');rules.fight(ritual,'play',0);
    const ritualExpected=clone(ritual);rules.fight(ritualExpected,'end');await load(ritual);
    await page.locator('[data-action="end"]').click();await page.locator('.fx-signature.type-ritual').first().waitFor();
    assert.deepEqual((await saved()).active.combat,ritualExpected.active.combat);await settle();

    // Boss transition presentation cannot bypass the phase seal or swap the announced move.
    const phase=battleFixture('palm-strike');phase.active.combat.enemy.sealPhases=true;phase.active.combat.enemy.hp=454;
    phase.active.combat.phases.push({at:.5,name:'QA second seal',intents:[{name:'New sealed move',effects:[{type:'damage',amount:20}]}]});
    const phaseExpected=clone(phase);rules.fight(phaseExpected,'play',0);await load(phase);await castFirst();
    await page.locator('.notice-phase').waitFor();assert.equal((await saved()).active.combat.enemy.hp,450);
    assert.deepEqual((await saved()).active.combat,phaseExpected.active.combat);await settle();

    await load(battleFixture('palm-strike'));await castFirst();await page.locator('[data-action="settings"]').click();
    const imported=ready(93);imported.name='Imported Quietly';
    await page.locator('#import-save').setInputFiles({name:'quiet-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
    await page.waitForFunction(()=>document.querySelector('#screen')?.dataset.page==='home');
    assert.equal((await saved()).name,'Imported Quietly');assert.equal(await page.locator('#battle-fx > *,#progression-realm,#progression-layer-fx').count(),0);
    await page.locator('[data-action="settings"]').click();await page.locator('#dialog [data-action="reset"]').click();await page.locator('#dialog [data-action="reset-confirm"]').click();
    assert.equal((await saved()).started,false);assert.equal(await page.locator('#app').evaluate(node=>node.inert),false);
    await page.waitForTimeout(1400);assert.equal(await page.locator('#battle-fx > *,#progression-realm,#progression-layer-fx').count(),0);
  }

  // A real reward claim crosses a hero layer without replaying on reload.
  const hero=ready();hero.essence=10;assert.equal(rules.startBounty(hero,'neutral',1).ok,true);
  hero.active.combat.enemy.hp=0;hero.active.combat.outcome='victory';
  await load(hero);await page.locator('[data-action="resolve"]').click();
  await page.locator('[data-progression-subject="hero"][data-progression-kind="layer"]').waitFor();
  assert.equal((await saved()).essence,19);assert.equal((await saved()).jade,48);
  assert.equal(await page.locator('#app').evaluate(node=>node.inert),false,'layer feedback does not block play');
  await page.waitForTimeout(550);await shot('hero-layer');
  await page.locator('#progression-layer-fx').waitFor({state:'detached',timeout:3000});
  await page.reload();assert.equal(await page.locator('#progression-layer-fx,#progression-realm').count(),0);

  const perfected=ready();perfected.realm=9;perfected.essence=6469;perfected.hp=rules.maxHp(perfected);
  rules.startBounty(perfected,'neutral',5);perfected.active.combat.enemy.hp=0;perfected.active.combat.outcome='victory';
  await load(perfected);await page.locator('[data-action="resolve"]').click();
  await page.locator('[data-progression-kind="perfection"]').waitFor();
  assert.match(await page.locator('#progression-layer-fx').innerText(),/IMMORTAL PERFECTION/);
  assert.equal(rules.cultivationStatus(await saved()).level,90);
  await page.locator('#progression-layer-fx').waitFor({state:'detached',timeout:3000});

  const ascender=ready();ascender.essence=110;ascender.jade=100;
  await load(ascender);await page.locator('[data-action="breakthrough"]').click();
  await page.locator('#progression-realm').waitFor();assert.equal((await saved()).realm,1);assert.equal((await saved()).jade,70);
  assert.equal(await page.locator('#app').evaluate(node=>node.inert),true);
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.realm-growth-skip').evaluate(node=>node===document.activeElement),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#progression-realm').count(),0);assert.equal(await page.locator('#app').evaluate(node=>node.inert),false);
  await page.reload();assert.equal(await page.locator('#progression-realm').count(),0);
  // Capture separately from keyboard dismissal; screenshot encoding can outlast
  // the ceremony on a busy host.
  await load(ascender);await page.locator('[data-action="breakthrough"]').click();
  await page.locator('.realm-avatar-after').evaluate(image=>image.decode());await page.waitForTimeout(650);await shot('hero-realm');
  await page.locator('#progression-realm').waitFor({state:'detached',timeout:4000});

  const feeder=ready();feeder.realm=1;feeder.essence=110;feeder.jade=100;
  rules.hatchPet(feeder,'vermilion-phoenix');const food='iron-black-wax-citation';feeder.known[food]=14;
  await load(feeder);await page.locator('[data-action="nav"][data-id="pets"]').click();
  await page.locator('[data-action="pet-select"][data-id="vermilion-phoenix"]').click();
  await page.locator('[data-action="pet-feed-picker"]').click();await page.locator('#dialog select[name="cardId"]').selectOption(food);
  await page.locator('#dialog input[name="quantity"]').fill('14');await page.locator('#dialog [data-pet-feed-submit]').click();
  await page.locator('#dialog [data-action="pet-feed-confirm"]').click();
  await page.locator('[data-progression-subject="pet"][data-progression-kind="layer"]').waitFor();
  assert.match(await page.locator('#progression-layer-fx').innerText(),/\+8 layers/);assert.equal((await saved()).pets['vermilion-phoenix'].essence,112);
  assert.equal((await saved()).known[food],undefined);assert.equal(await page.locator('#pet-celebration').count(),0);
  await page.waitForTimeout(550);await shot('pet-layer');
  await page.locator('[data-action="pet-evolve-preview"]').click();await page.locator('#dialog [data-action="pet-evolve"]').click();
  await page.locator('#pet-celebration').waitFor();assert.equal(await page.locator('#progression-realm').count(),0,'one pet realm ceremony');
  assert.equal((await saved()).pets['vermilion-phoenix'].realm,1);assert.equal((await saved()).jade,85);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#app').evaluate(node=>node.inert),false);

  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  await load(ascender);await page.locator('[data-action="breakthrough"]').click();await page.locator('#progression-realm.reduced-motion').waitFor();
  await page.locator('.realm-avatar-after').evaluate(image=>image.decode());
  assert.equal(await page.locator('.realm-avatar-after').evaluate(image=>Number(getComputedStyle(image).opacity)>0&&getComputedStyle(image).display!=='none'),true,'reduced-motion realm retains the new portrait');
  const mobileRealm=await page.locator('.realm-growth-content').boundingBox();
  assert.ok(mobileRealm.x>=0&&mobileRealm.x+mobileRealm.width<=390&&mobileRealm.y>=0&&mobileRealm.y+mobileRealm.height<=844,'mobile realm content stays inside viewport');
  await page.locator('.realm-growth-skip').click();
  assert.equal(await page.locator('#app').evaluate(node=>node.inert),false);
  await load(ascender);await page.locator('[data-action="breakthrough"]').click();
  await page.locator('#progression-realm.reduced-motion').waitFor();await shot('mobile-realm-reduced');
  await page.locator('#progression-realm').waitFor({state:'detached',timeout:4000});
  await page.waitForTimeout(1650);assert.equal(await page.locator('#progression-realm,#progression-layer-fx').count(),0);

  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({status:'passed',cardTypes:records.map(({type,shape})=>({type,shape})),errors,httpErrors,screenshots:fileURLToPath(output)},null,2));
} finally {await browser.close()}
