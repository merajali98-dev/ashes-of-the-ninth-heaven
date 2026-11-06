import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as rules from '../js/progression.js';
import {PURCHASE_PACKS} from '../js/payments.js';
process.env.PORT='4183';
await import('../server.js');
await mkdir(new URL('../tmp/treasury-browser/',import.meta.url),{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    window.__walletAccess=0;window.__walletRequests=[];
    Object.defineProperty(window,'ethereum',{get(){window.__walletAccess++;return {request(args){window.__walletRequests.push(args);return Promise.reject(new Error('Wallet must stay disconnected'))}}}});
  });
  const page=await context.newPage(),errors=[],httpErrors=[],apiRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push(response.status()+' '+response.url())});
  page.on('request',request=>{if(/\/api\/|wallet|checkout|rpc/i.test(new URL(request.url()).pathname))apiRequests.push(request.url())});
  const base='http://127.0.0.1:4183';await page.goto(base);
  const game=rules.freshGame(1842);rules.begin(game,'Treasury Reviewer');game.tutorial={version:1,sanctuary:6,battle:4};
  const fixture=JSON.stringify(game);await page.evaluate(({key,fixture})=>localStorage.setItem(key,fixture),{key:rules.SAVE_KEY,fixture});await page.reload();
  const saved=()=>page.evaluate(key=>localStorage.getItem(key),rules.SAVE_KEY);
  const nav=(id)=>page.locator(`[data-action="nav"][data-id="${id}"]`).first().click();
  await nav('market');await nav('treasury');
  assert.equal(await page.locator('.treasury-screen').count(),1);
  assert.match(await page.locator('.treasury-status').innerText(),/preview.*no charges/i);
  assert.equal(await page.locator('[data-pack]').count(),5);
  assert.equal(await page.locator('[data-action="treasury-connect"]').isDisabled(),true);
  for(const currency of ['jade','star-silk']) {
    await page.locator(`[data-action="treasury-tab"][data-id="${currency}"]`).click();
    const packs=PURCHASE_PACKS.filter(pack=>pack.currency===currency);
    assert.equal(await page.locator('[data-pack]').count(),packs.length);
    for(const pack of packs) {
      const card=page.locator(`[data-pack="${pack.id}"]`);assert.ok((await card.innerText()).includes(pack.usdLabel));
      assert.equal(pack.amount,pack.priceCents,'proposed unit exchange is explicit and constant');
      await card.locator('[data-action="treasury-review"]').click();
      assert.equal(await page.locator('#dialog-title').innerText(),pack.name);
      assert.match(await page.locator('.treasury-review').innerText(),/no order is created.*balances do not change/is);
      assert.equal(await page.locator('[data-action="treasury-checkout"]').isDisabled(),true);
      // Synthetic DOM events must not bypass the unavailable adapter.
      await page.locator('[data-action="treasury-checkout"]').evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
      assert.equal(await saved(),fixture,'offer review never alters the local economy');
      await page.locator('#dialog [data-action="close"]').click();
      assert.equal(await page.evaluate(()=>document.activeElement?.dataset.action),'treasury-review');
    }
  }
  await page.locator('[data-action="treasury-connect"]').evaluate(node=>node.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await page.locator('[data-action="treasury-tab"][data-id="economy"]').click();
  assert.match(await page.locator('.treasury-screen').innerText(),/500 Jade equals the cash reward of 39 tier-1 victories/);
  assert.match(await page.locator('.treasury-guide').innerText(),/13–33 Jade/);
  assert.match(await page.locator('.treasury-guide').innerText(),/does not grant hero essence/);
  assert.match(await page.locator('.treasury-guide').innerText(),/paid Jade may indirectly accelerate pet growth/);
  await page.locator('[data-action="treasury-history"]').click();
  assert.match(await page.locator('#dialog').innerText(),/no real purchase records/i);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog').evaluate(dialog=>dialog.open),false);
  await page.screenshot({path:'tmp/treasury-browser/treasury-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  for(const currency of ['jade','star-silk','economy']) {
    await page.locator(`[data-action="treasury-tab"][data-id="${currency}"]`).click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,currency+' mobile page fits');
  }
  await page.locator('[data-action="treasury-tab"][data-id="jade"]').click();
  await page.screenshot({path:'tmp/treasury-browser/treasury-mobile-catalog.png'});
  await page.locator('[data-action="treasury-review"]').first().click();
  const box=await page.locator('#dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,'mobile dialog fits');
  assert.equal(await page.locator('#dialog').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true);
  await page.screenshot({path:'tmp/treasury-browser/treasury-mobile.png'});
  await page.locator('#dialog [data-action="close"]').click();
  assert.equal(await saved(),fixture);
  await page.reload();assert.equal(await saved(),fixture,'reload retains existing game');
  await page.locator('[data-action="settings"]').click();
  const download=page.waitForEvent('download');await page.locator('[data-action="export"]').click();assert.equal((await download).suggestedFilename(),'ashes-chronicle.json');
  await page.locator('#import-save').setInputFiles({name:'chronicle.json',mimeType:'application/json',buffer:Buffer.from(fixture)});
  await page.waitForFunction(()=>document.querySelector('#screen')?.dataset.page==='home');
  assert.deepEqual(JSON.parse(await saved()),JSON.parse(fixture),'save import keeps local game unchanged');
  const battle=structuredClone(game);assert.equal(rules.encounter(battle,'blank-writ').ok,true);
  await page.evaluate(({key,battle})=>localStorage.setItem(key,JSON.stringify(battle)),{key:rules.SAVE_KEY,battle});await page.reload();
  assert.equal(await page.locator('#screen').getAttribute('data-page'),'battle');
  assert.equal(await page.locator('[data-action="nav"][data-id="treasury"]').count(),0,'commerce is absent during an active encounter');
  assert.deepEqual(await page.evaluate(()=>({access:__walletAccess,requests:__walletRequests})),{access:0,requests:[]});
  assert.deepEqual(apiRequests,[]);assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({status:'passed',packs:PURCHASE_PACKS.length,currencies:2,mobile:'390px',walletAccess:0,apiRequests,errors,httpErrors,checks:['fixed proposed prices','disabled checkout including synthetic events','no local balance mutation','focus restoration','history disclaimer','economy guide','save download/import','active encounter preservation']},null,2));
} catch(error) {console.error(error);process.exitCode=1}
finally {await browser.close();process.exit(process.exitCode||0)}
