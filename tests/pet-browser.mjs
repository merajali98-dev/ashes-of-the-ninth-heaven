import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as rules from '../js/progression.js';

// Manual UI regression: start the isolated server on PORT=4181 first.
const output=new URL('../tmp/pet-browser/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],httpErrors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push(`${response.status()} ${response.url()}`)});
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),rules.SAVE_KEY);
  const settleCombat=()=>page.waitForFunction(()=>document.querySelector('#app').getAttribute('aria-busy')!=='true');
  const nav=async id=>page.locator(`[data-action="nav"][data-id="${id}"]`).first().click();
  const close=async()=>{if(await page.locator('#dialog[open]').count())await page.locator('#dialog [data-action="close"]').first().click();};
  const shot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:false});
  const load=async game=>{await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});await page.reload();};
  await page.goto('http://127.0.0.1:4181');
  const legacy=rules.freshGame(1);rules.begin(legacy,'Legacy Keeper');
  delete legacy.petVersion;delete legacy.pets;delete legacy.activePetId;legacy.tutorial={version:1,sanctuary:6,battle:4};
  await load(legacy);await nav('pets');assert.equal(await page.locator('.pet-biome-node.unhatched').count(),8);
  assert.equal(await page.locator('.pet-biome-node.equipped').count(),0);

  const game=rules.freshGame(64);rules.begin(game,'Spirit Keeper');game.realm=1;game.essence=110;
  game.hp=rules.maxHp(game);game.jade=10000;game.tutorial={version:1,sanctuary:6,battle:4};
  for(const material of rules.materials.filter(material=>material.tier===1))game.materials[material.id]=1000;
  const food='iron-black-wax-citation';game.known[food]=20;game.cardLevels[food]=5;game.upgrades[food]=2;
  game.deckPresets.push({id:'deck-2',name:'Food reserve',cards:[...game.deck.slice(0,7),food]});
  game.deckDraft={name:'Growing draft',sourceId:null,cards:[food,food,food]};
  await load(game);await nav('pets');
  assert.equal(await page.locator('.pet-biome-node').count(),8);await shot('eight-eggs');
  const pet='vermilion-phoenix';
  await page.locator(`.pet-biome-node[data-id="${pet}"]`).click();
  let before=await saved();await page.locator(`[data-action="pet-hatch-preview"][data-id="${pet}"]`).click();
  assert.deepEqual(await saved(),before,'hatch preview is read-only');
  assert.match(await page.locator('#dialog').innerText(),/first hatch is a gift/);
  await page.locator(`#dialog [data-action="pet-hatch"][data-id="${pet}"]`).click();
  await page.locator('#pet-celebration').waitFor();
  assert.equal(await page.locator('#pet-celebration.reduced-motion').count(),0);
  assert.equal(await page.locator('#app').evaluate(element=>element.inert),true);
  await page.locator('.pet-cinematic-reveal img').evaluate(image=>image.decode());
  await page.waitForFunction(()=>{
    const creature=document.querySelector('.pet-cinematic-reveal'),title=document.querySelector('.pet-cinematic-title');
    return creature&&title&&Number(getComputedStyle(creature).opacity)>.95&&Number(getComputedStyle(title).opacity)>.95;
  },null,{timeout:4000});
  await shot('hatch-cinematic');
  await page.locator('#pet-celebration').waitFor({state:'detached',timeout:6000});
  assert.equal(await page.locator('#app').evaluate(element=>element.inert),false);
  let after=await saved();assert.deepEqual(after.pets[pet],{realm:0,essence:0});assert.equal(after.activePetId,null);
  assert.equal(after.jade,before.jade);assert.deepEqual(after.materials,before.materials);

  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator(`[data-action="pet-feed-picker"][data-id="${pet}"]`).click();
  const protectedOption=await page.locator('#dialog option[value="palm-strike"]').evaluate(element=>({disabled:element.disabled,html:element.outerHTML}));
  assert.equal(protectedOption.disabled,true,protectedOption.html);
  await page.locator('#dialog input[name="petFoodSearch"]').fill('Black Wax');
  assert.equal(await page.locator('#dialog select[name="cardId"]').inputValue(),food);
  await page.locator('#dialog input[name="petFoodSearch"]').fill('no such spirit food');
  assert.equal(await page.locator('[data-pet-feed-empty]').isVisible(),true);
  assert.equal(await page.locator('[data-pet-feed-submit]').isDisabled(),true);
  await page.locator('#dialog input[name="petFoodSearch"]').fill('');
  assert.equal(await page.locator('[data-pet-feed-empty]').isVisible(),false);
  assert.equal(await page.locator('[data-pet-feed-submit]').isDisabled(),false);
  await page.locator('#dialog select[name="cardId"]').selectOption(food);
  assert.match(await page.locator('[data-pet-feed-card]').innerText(),/Owned 20 · Reserved 3 · Spare 17/);
  before=await saved();
  for(const quantity of ['0','1.5','18']) {
    await page.locator('#dialog input[name="quantity"]').fill(quantity);
    assert.equal(await page.locator('[data-pet-feed-submit]').isDisabled(),true,quantity);
    assert.deepEqual(await saved(),before,'invalid quantity cannot consume a card');
  }
  await page.locator('#dialog input[name="quantity"]').fill('14');
  assert.match(await page.locator('[data-pet-feed-quote]').innerText(),/\+112/);
  await page.locator('[data-pet-feed-submit]').click();
  assert.deepEqual(await saved(),before,'feeding preview cannot consume cards');
  assert.match(await page.locator('#dialog').innerText(),/Destroy 14 Black Wax Citation/);
  await shot('feed-preview');
  await page.locator(`#dialog [data-action="pet-feed-confirm"][data-id="${pet}:${food}:14"]`).click();
  after=await saved();assert.equal(after.known[food],6);assert.equal(after.cardLevels[food],5);assert.equal(after.upgrades[food],2);
  assert.equal(after.pets[pet].essence,112);assert.equal(after.pets[pet].realm,0);assert.equal(after.jade,before.jade);
  assert.deepEqual(after.materials,before.materials);

  await page.locator(`[data-action="pet-evolve-preview"][data-id="${pet}"]`).click();
  before=await saved();await page.locator(`#dialog [data-action="pet-evolve"][data-id="${pet}"]`).click();
  await page.locator('#pet-celebration.reduced-motion').waitFor();
  assert.equal(await page.locator('.pet-cinematic-skip').innerText(),'Continue');await shot('evolution-reduced-motion');
  await page.locator('.pet-cinematic-skip').click();after=await saved();
  assert.equal(after.pets[pet].realm,1);assert.equal(after.pets[pet].essence,112);assert.equal(after.jade,before.jade-15);
  assert.equal(await page.locator(`[data-action="pet-evolve-preview"][data-id="${pet}"]`).isDisabled(),true);

  for(const definition of rules.spiritPets.filter(entry=>entry.id!==pet)) {
    await page.locator(`.pet-biome-node[data-id="${definition.id}"]`).click();
    await page.locator(`[data-action="pet-hatch-preview"][data-id="${definition.id}"]`).click();before=await saved();
    const quote=rules.quoteHatch(before,definition.id);
    await page.locator(`#dialog [data-action="pet-hatch"][data-id="${definition.id}"]`).click();
    await page.locator('#pet-celebration.reduced-motion').waitFor();
    assert.equal(await page.locator('.pet-cinematic-skip').innerText(),'Continue');await page.locator('.pet-cinematic-skip').click();
    after=await saved();assert.equal(after.jade,before.jade-quote.jade);assert.equal(after.activePetId,null);
    for(const [id,quantity] of Object.entries(quote.materials))assert.equal(after.materials[id],before.materials[id]-quantity);
  }
  assert.equal(await page.locator('.pet-biome-node.hatched').count(),8);
  assert.equal(await page.locator('.pet-biome-node.unhatched').count(),0);
  const mapHeight=(await page.locator('.pet-map-viewport').boundingBox()).height;
  await page.locator('[data-action="pet-map-zoom"][data-id="+"]').click();assert.match(await page.locator('.pet-map-controls').innerText(),/120%/);
  await page.locator('.pet-map-viewport').scrollIntoViewIfNeeded();
  const mapBox=await page.locator('.pet-map-viewport').boundingBox();
  assert.ok(Math.abs(mapBox.height-mapHeight)<1,'zoom preserves the map viewport height');
  await page.mouse.move(mapBox.x+85,mapBox.y+85);await page.mouse.down();
  await page.mouse.move(mapBox.x+25,mapBox.y+25,{steps:5});await page.mouse.up();
  const pan=await page.locator('.pet-map-viewport').evaluate(element=>({x:element.scrollLeft,y:element.scrollTop}));
  assert.ok(pan.x>0&&pan.y>0,'mouse dragging pans the enlarged map on both axes');
  await page.locator('[data-action="pet-map-zoom"][data-id="-"]').click();
  await page.locator('[data-action="pet-view"][data-id="list"]').click();assert.equal(await page.locator('.pet-ledger-entry').count(),8);
  await page.locator('[data-action="pet-view"][data-id="map"]').click();
  for(const id of ['azure-dragon',pet]) {
    await page.locator(`.pet-biome-node[data-id="${id}"]`).click();await page.locator(`[data-action="pet-equip"][data-id="${id}"]`).click();
    assert.equal((await saved()).activePetId,id);assert.equal(await page.locator('.pet-biome-node.equipped').count(),1);
  }
  await shot('hatched-habitat');await page.reload();await nav('pets');
  assert.equal(await page.locator(`.pet-biome-node.equipped[data-id="${pet}"]`).count(),1);
  await page.setViewportSize({width:390,height:844});await shot('habitat-mobile');
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'habitat has no horizontal overflow');
  await page.locator('.pet-detail-panel').scrollIntoViewIfNeeded();await shot('pet-details-mobile');
  await page.setViewportSize({width:1440,height:1000});
  await nav('campaign');await page.locator('[data-action="mission"][data-id="blank-writ"]').click();
  await page.locator('#dialog [data-action="encounter"][data-id="blank-writ"]').click();
  assert.equal(await page.locator('.duel-hero').count(),2);assert.equal(await page.locator('.battle-companion').count(),1);
  assert.equal(await page.locator('.pet-command').count(),4);assert.equal(await page.locator('.pet-command.locked').count(),2);
  before=await saved();await page.locator('[data-action="pet-ability"][data-id="cinder-feather"]').click();after=await saved();
  assert.equal(after.active.combat.energy,before.active.combat.energy);assert.deepEqual(after.active.combat.resonance,before.active.combat.resonance);
  assert.equal(after.active.combat.pet.readyAt['cinder-feather'],3);assert.equal(after.active.combat.pet.lastAbilityTurn,1);
  assert.equal(await page.locator('[data-action="pet-ability"][data-id="warmth-of-return"]').isDisabled(),true);
  await page.reload();assert.equal(await page.locator('[data-action="pet-ability"][data-id="cinder-feather"]').isDisabled(),true);
  await page.locator('[data-action="end"]').click();
  await settleCombat();
  assert.match(await page.locator('[data-action="pet-ability"][data-id="cinder-feather"]').innerText(),/1 turns?/);
  assert.equal(await page.locator('[data-action="pet-ability"][data-id="warmth-of-return"]').isDisabled(),false);
  await page.locator('[data-action="pet-ability"][data-id="warmth-of-return"]').click();
  await page.reload();assert.equal((await saved()).active.combat.pet.lastAbilityTurn,2);
  await page.locator('[data-action="end"]').click();await settleCombat();assert.equal(await page.locator('[data-action="pet-ability"][data-id="cinder-feather"]').isDisabled(),false);
  await shot('battle-commands');await page.setViewportSize({width:390,height:844});
  await page.locator('.battle-spirit').scrollIntoViewIfNeeded();await shot('battle-commands-mobile');
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'battle has no horizontal overflow');

  const paths=[rules.PET_MAP_ART,...rules.spiritPets.flatMap(definition=>[definition.eggArt,definition.youngArt,definition.adultArt,definition.ascendedArt])];
  assert.equal(new Set(paths).size,33);
  const decoded=await page.evaluate(async paths=>Promise.all(paths.map(async path=>{
    const image=new Image();image.src=new URL(path,location.href).href;
    try {await image.decode();return {path,width:image.naturalWidth,height:image.naturalHeight};}
    catch {return {path,error:true};}
  })),paths);
  assert.ok(decoded.every(result=>result.width>0&&result.height>0),JSON.stringify(decoded.filter(result=>result.error)));
  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({status:'passed',checks:['legacy empty sanctuary','8 chosen eggs and all paid hatch transactions','normal hatch reveal and reduced-motion Continue','protected feed options and invalid quantities','concrete feed preview and exact consumption','quality retention','hero-gated evolution','map/list/zoom and one equipped companion','real battle command global limit and cooldown reload','two combatants plus one untargeted companion','390px layout','all 33 pet assets decoded'],screenshots:fileURLToPath(output),errors,httpErrors},null,2));
} finally {await browser.close();}
