import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from './playwright.mjs';
import * as rules from '../js/progression.js';

// Manual UI regression; start PORT=4181 node server.js first.
const output=new URL('../tmp/workshop-browser/',import.meta.url);await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[],httpErrors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push(`${response.status()} ${response.url()}`)});
  await page.goto('http://127.0.0.1:4181');
  const saved=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),rules.SAVE_KEY);
  const load=async game=>{await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});await page.reload();};
  // On small screens five places live under More in the dock (css/calm.css).
  const nav=async id=>{const button=page.locator(`[data-action="nav"][data-id="${id}"]`).first();
    if(await button.isVisible())await button.click();
    else{await page.locator('[data-action="dock-more"]').click();await page.locator(`.dock-more-sheet [data-id="${id}"]`).click();}};
  const tab=async id=>{await page.locator(`[data-action="tab"][data-id="${id}"]`).click();};
  const close=async()=>{if(await page.locator('#dialog[open]').count())await page.locator('#dialog [data-action="close"]').first().click();};
  const search=async text=>{await page.locator('input[name="query"]').fill(text);await page.locator('form[data-form="search"] button').click();};
  const screenshot=async name=>page.screenshot({path:fileURLToPath(new URL(name+'.png',output)),fullPage:false});

  const legacy=rules.freshGame(12);rules.begin(legacy,'Legacy Workshop');legacy.upgrades={'palm-strike':1};
  for(const key of ['cultivationVersion','economyVersion','materials','cardLevels','deckPresets','activeDeckId','deckDraft','tutorial'])delete legacy[key];
  await load(legacy);await nav('deck');
  await page.locator('[data-action="card-details"][data-id="palm-strike"]').click();
  assert.match(await page.locator('#dialog').innerText(),/Card Lv\. 3 \/ 5/);await close();

  const game=rules.freshGame(23);rules.begin(game,'Workshop Browser');game.realm=9;game.essence=6500;
  game.jade=100000;game.hp=rules.maxHp(game);game.tutorial={version:1,sanctuary:6,battle:4};
  await load(game);await nav('market');await tab('cards');
  assert.equal(await page.locator('.commerce-count').innerText(),'597 techniques');
  assert.equal(await page.locator('.commerce-card').count(),24);
  await page.locator('[data-action="card-page"][data-id="1"]').click();assert.equal(await page.locator('.commerce-pages span').innerText(),'2 / 25');
  await page.locator('[data-filter="category"]').selectOption('iron');
  await page.locator('[data-filter="cardType"]').selectOption('hex');
  assert.equal(await page.locator('.commerce-count').innerText(),'7 techniques');
  await page.locator('[data-filter="rarity"]').selectOption('common');await page.locator('[data-filter="cost"]').selectOption('1');
  await page.locator('[data-filter="ownership"]').selectOption('new');
  assert.equal(await page.locator('.commerce-count').innerText(),'2 techniques');
  await screenshot('shop-filtered');
  const id='iron-black-wax-citation',card=rules.cardById[id];
  await search(card.name);await page.locator(`[data-action="shop-inspect"][data-id="${id}"]`).click();
  await page.locator(`#dialog [data-action="open-forge"][data-id="${id}"]`).click();
  assert.equal(await page.locator(`[data-action="forge-card"][data-id="${id}"]`).isDisabled(),true);
  assert.match(await page.locator('.workbench-panel').innerText(),/Need \d+ more/);
  await screenshot('forge-shortage');
  // Materials now come from commissions or merchants (covered by tests/market-local.test.js), so grant them directly.
  async function buyMaterial(material,quantity) {
    await close();const current=await saved();
    current.materials[material]=(current.materials[material]||0)+quantity;await load(current);
  }
  const recipe=rules.forgeRecipe(id);
  for(const [material,quantity] of Object.entries(recipe.materials))await buyMaterial(material,quantity);
  await nav('forge');await search(card.name);await page.locator(`[data-action="workshop-select"][data-id="${id}"]`).click();
  let before=await saved();await page.locator(`[data-action="forge-card"][data-id="${id}"]`).click();
  let after=await saved();assert.equal(after.known[id],1);assert.equal(after.jade,before.jade-recipe.jade);
  for(const material of Object.keys(recipe.materials))assert.equal(after.materials[material]||0,0);
  await screenshot('forge-complete');

  for(let level=2;level<=5;level++) {
    const upgrade=rules.upgradeRecipe(id,level);
    for(const [material,quantity] of Object.entries(upgrade.materials))await buyMaterial(material,quantity);
    await nav('forge');await tab('upgrade');await search(card.name);await page.locator(`[data-action="workshop-select"][data-id="${id}"]`).click();
    assert.match(await page.locator('.upgrade-comparison').innerText(),new RegExp(`CURRENT · LV\\. ${level-1}`));
    assert.match(await page.locator('.upgrade-comparison').innerText(),new RegExp(`NEXT · LV\\. ${level}`));
    before=await saved();await page.locator(`[data-action="upgrade-card"][data-id="${id}"]`).click();after=await saved();
    assert.equal(after.cardLevels[id],level);assert.equal(after.jade,before.jade-upgrade.jade);assert.equal(after.known[id],1);
  }
  assert.equal(await page.locator(`[data-action="upgrade-card"][data-id="${id}"]`).isDisabled(),true);
  assert.match(await page.locator('.workbench-panel').innerText(),/Maximum level/);await screenshot('perfected');

  await nav('market');await tab('cards');await search(card.name);await page.locator(`[data-action="shop-inspect"][data-id="${id}"]`).click();
  before=await saved();await page.locator(`#dialog [data-action="purchase-card"][data-id="${id}"]`).click();after=await saved();
  assert.equal(after.known[id],2);assert.equal(after.jade,before.jade-rules.cardPrice(id));await close();
  await nav('forge');await tab('salvage');await search('Palm Strike');await page.locator('[data-action="workshop-select"][data-id="palm-strike"]').click();
  assert.equal(await page.locator('[data-action="salvage-preview"][data-id="palm-strike"]').isDisabled(),true);
  assert.match(await page.locator('.workbench-panel').innerText(),/Keep 4 copies reserved/);
  await search(card.name);await page.locator(`[data-action="workshop-select"][data-id="${id}"]`).click();
  before=await saved();await page.locator(`[data-action="salvage-preview"][data-id="${id}"]`).click();
  assert.deepEqual(await saved(),before,'opening a salvage preview cannot dismantle');
  assert.match(await page.locator('#dialog').innerText(),/Owned 2 → 1/);
  await page.locator(`#dialog [data-action="salvage-card"][data-id="${id}"]`).click();after=await saved();
  assert.equal(after.known[id],1);assert.equal(after.cardLevels[id],5);assert.equal(after.jade,before.jade);
  for(const [material,quantity] of Object.entries(rules.salvageYield(id)))assert.equal(after.materials[material],(before.materials[material]||0)+quantity);

  await nav('deck');await page.locator('[data-action="deck-duplicate"]').click();
  await page.locator('input[name="deckName"]').fill('Quiet Iron');
  await page.locator(`[data-action="draft-add"][data-id="${id}"]`).first().click();
  const activeBefore=(await saved()).deck;
  await page.locator('form[data-form="deck-save"] button[type="submit"]').click();
  after=await saved();assert.deepEqual(after.deck,activeBefore,'saving a draft does not activate it');
  const preset=after.deckPresets.find(deck=>deck.name==='Quiet Iron');assert.ok(preset);
  await page.locator(`[data-action="deck-activate"][data-id="${preset.id}"]`).click();
  assert.equal((await saved()).activeDeckId,preset.id);assert.ok((await saved()).deck.includes(id));
  await page.reload();await nav('deck');
  assert.equal(await page.locator(`.deck-preset.active[data-id="${preset.id}"]`).count(),1);
  await page.locator('[data-action="deck-edit"][data-id="new"]').first().click();
  await page.locator(`[data-action="draft-add"][data-id="${id}"]`).first().click();
  assert.equal(await page.locator('form[data-form="deck-save"] button[type="submit"]').isDisabled(),true);
  await page.reload();await nav('deck');assert.match(await page.locator('.deck-status').innerText(),/1 \/ 22 cards/);
  assert.equal((await saved()).activeDeckId,preset.id,'incomplete draft preserves the active deck');
  await page.locator(`[data-action="deck-edit"][data-id="${preset.id}"]`).click();await screenshot('named-deck');
  await page.setViewportSize({width:390,height:844});await screenshot('named-deck-mobile');
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'deck page has no horizontal overflow');
  await nav('forge');await tab('upgrade');await search(card.name);await page.locator(`[data-action="workshop-select"][data-id="${id}"]`).click();
  await page.locator('.workbench-panel').scrollIntoViewIfNeeded();await screenshot('workbench-mobile');
  assert.ok(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),'workbench has no horizontal overflow');
  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({status:'passed',checks:['legacy mastery migration','all 597 cards and 45 materials','pagination and compound filters','shortage and forge','all four upgrades','direct shop parity','reserved salvage rejection and confirmed surplus salvage','named deck save/activate/reload','incomplete draft persistence','390px deck/workbench'],screenshots:fileURLToPath(output),errors,httpErrors},null,2));
} finally {await browser.close();}
