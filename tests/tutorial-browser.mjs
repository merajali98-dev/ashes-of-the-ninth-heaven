import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as rules from '../js/progression.js';
process.env.PORT='4182';
await import('../server.js');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[],httpErrors=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)httpErrors.push(response.url())});
  await page.goto('http://127.0.0.1:4182');
  await page.locator('[data-action="begin"]').click();
  await page.locator('input[name="name"]').fill('Jade Pilgrim');
  await page.locator('form[data-form="begin"] button[type="submit"]').click();
  assert.equal(await page.locator('.tutorial-card').count(),1);
  await page.screenshot({path:'docs/preview-tutorial.jpg',type:'jpeg',quality:90});
  for(let step=0;step<6;step++) {
    assert.match(await page.locator('.tutorial-card .eyebrow').innerText(),new RegExp(`${step+1} / 6`));
    await page.locator('[data-tutorial-action="next"]').click();
  }
  assert.equal(await page.locator('.tutorial-card').count(),0);
  await page.locator('[data-action="mission"][data-id="blank-writ"]').click();
  await page.locator('[data-action="encounter"]').click();
  for(let step=0;step<4;step++) {
    assert.match(await page.locator('.tutorial-card .eyebrow').innerText(),new RegExp(`${step+1} / 4`));
    await page.locator('[data-tutorial-action="next"]').click();
  }
  assert.equal(await page.locator('.tutorial-card').count(),0);
  await page.reload();assert.equal(await page.locator('.tutorial-card').count(),0);
  const game=rules.freshGame(42);rules.begin(game,'Jade Pilgrim');
  game.realm=3;game.essence=700;game.jade=1200;game.hp=rules.maxHp(game);game.tutorial={version:1,sanctuary:6,battle:4};
  await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});
  await page.reload();await page.locator('.cultivator-face').evaluate(img=>img.decode());
  assert.match(await page.locator('.cultivator-name').innerText(),/Nascent Soul/);
  await page.screenshot({path:'docs/preview-cultivation-home.jpg',type:'jpeg',quality:92});
  await page.locator('[data-action="realm-path"]').click();
  assert.equal(await page.locator('.cultivation-realm').count(),10);
  await page.locator('#dialog [data-action="close"]').click();
  await page.locator('[data-action="open-bounties"]').click();
  assert.equal(await page.locator('.bounty-card').count(),8);
  await page.locator('.bounty-card img').first().evaluate(img=>img.decode());
  await page.screenshot({path:'docs/preview-commissions.jpg',type:'jpeg',quality:92});
  await page.setViewportSize({width:390,height:844});
  for(const name of ['bounties','home']) {
    if(name==='home')await page.locator('[data-action="nav"][data-id="home"]').first().click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390,`${name} mobile overflow`);
    await page.screenshot({path:`tmp/${name}-mobile.png`,fullPage:true});
  }
  const mobile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const phone=await mobile.newPage();phone.on('pageerror',error=>errors.push(error.message));phone.on('response',response=>{if(response.status()>=400)httpErrors.push(response.url())});
  await phone.goto('http://127.0.0.1:4182');
  await phone.locator('[data-action="begin"]').click();await phone.locator('input[name="name"]').fill('Mobile Pilgrim');await phone.locator('form[data-form="begin"] button[type="submit"]').click();
  async function mobileSteps(length) {
    for(let step=0;step<length;step++) {
      const box=await phone.locator('.tutorial-card').boundingBox();
      assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,'Tutorial controls fit mobile viewport');
      assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth),390);
      await phone.locator('[data-tutorial-action="next"]').click();
    }
  }
  await mobileSteps(6);
  await phone.locator('[data-action="mission"][data-id="blank-writ"]').click();await phone.locator('[data-action="encounter"]').click();
  await mobileSteps(4);
  assert.deepEqual(errors,[]);assert.deepEqual(httpErrors,[]);
  console.log(JSON.stringify({tutorial:'six sanctuary steps + four battle steps + persistence passed on desktop and mobile',realms:10,bounties:8,mobile:'390px no overflow',errors,httpErrors}));
}catch(error){console.error(error);process.exitCode=1}finally{await browser.close();process.exit(process.exitCode||0)}
