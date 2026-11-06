import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import * as rules from '../js/progression.js';

// Starts an isolated server. --baseline records the original implementation.
process.env.PORT='4184';
const {server}=await import('../server.js');
const baseline=process.argv.includes('--baseline');
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];
try {
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4184');
    const game=rules.freshGame(72);rules.begin(game,'Performance Reviewer');
    game.tutorial={version:1,sanctuary:6,battle:4};
    rules.encounter(game,'blank-writ');game.active.combat.energy=20;
    await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game});
    await page.reload();await page.locator('.duel-hand').waitFor();
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode().catch(()=>{}))));
    const session=await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate',{rate:4});
    const measured=await page.evaluate(async key=>{
      const hand=document.querySelector('.duel-hand'),hero=document.querySelector('.hero-enemy'),screen=document.querySelector('#screen');
      const save=localStorage.getItem(key),durations=[];
      let added=0,removed=0;
      const observer=new MutationObserver(records=>{for(const r of records){added+=r.addedNodes.length;removed+=r.removedNodes.length}});
      observer.observe(document.querySelector('#app'),{subtree:true,childList:true});
      for(let i=0;i<60;i++) {
        await new Promise(requestAnimationFrame);
        const start=performance.now();
        document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));
        document.querySelector('.duel-hand').getBoundingClientRect();
        durations.push(performance.now()-start);
      }
      await Promise.resolve();observer.disconnect();durations.sort((a,b)=>a-b);
      return {median:durations[30],p95:durations[57],added,removed,
        preservedHand:hand===document.querySelector('.duel-hand'),preservedHero:hero===document.querySelector('.hero-enemy'),
        preservedScreen:screen===document.querySelector('#screen'),unchangedSave:save===localStorage.getItem(key),
        deselected:!document.querySelector('.card-selected')&&!document.querySelector('.target-ready')};
    },rules.SAVE_KEY);
    assert.equal(measured.unchangedSave,true);assert.equal(measured.deselected,true);
    if(!baseline)for(const key of ['preservedHand','preservedHero','preservedScreen'])assert.equal(measured[key],true,key);
    // Selection remains equivalent to the authoritative renderer, including target and ARIA state.
    for(const key of ['1','2','Escape']) {
      await page.keyboard.press(key);
      const equivalent=await page.evaluate(async()=>{
        const rules=await import('/js/progression.js'),hub=await import('/js/game-hub.js');
        const game=JSON.parse(localStorage.getItem(rules.SAVE_KEY));
        const selected=document.querySelector('.card-selected');
        const template=document.createElement('template');
        template.innerHTML=hub.battle(game,{selectedCard:selected?Number(selected.dataset.id):null});
        const selectors=['.cast-zone','.cast-trajectory','.duel-hand','[data-action="cast-card"][data-id="enemy"].hero-medallion','[data-action="cast-card"][data-id="player"].hero-medallion'];
        const canonical=node=>!node?null:node.nodeType===3?node.textContent.trim():{
          tag:node.nodeName,
          attributes:[...node.attributes].map(({name,value})=>[name,name==='class'?value.trim().split(/\s+/).sort().join(' '):value]).sort(([a],[b])=>a.localeCompare(b)),
          children:[...node.childNodes].filter(child=>child.nodeType!==3||child.textContent.trim()).map(canonical),
        };
        return selectors.every(selector=>JSON.stringify(canonical(document.querySelector(selector)))===JSON.stringify(canonical(template.content.querySelector(selector))));
      });
      assert.equal(equivalent,true,'selection matches full renderer: '+key);
    }
    await session.send('Emulation.setCPUThrottlingRate',{rate:1});
    await page.reload();
    const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/\/(assets|js|css)\//.test(r.name)).reduce((s,r)=>({requests:s.requests+1,bytes:s.bytes+r.transferSize}),{requests:0,bytes:0}));
    if(!baseline) {
      const sanctuary=rules.freshGame(72);rules.begin(sanctuary,'Performance Reviewer');
      sanctuary.tutorial={version:1,sanctuary:6,battle:4};
      await page.evaluate(({key,game})=>localStorage.setItem(key,JSON.stringify(game)),{key:rules.SAVE_KEY,game:sanctuary});
      await page.reload();
      await page.locator('[data-action="nav"][data-id="market"]').click();
      await page.evaluate(()=>{window.shellNodes=['.game-shell','.game-topbar','.game-dock','#screen'].map(selector=>document.querySelector(selector))});
      await page.locator('[data-filter="category"]').selectOption('iron');
      assert.equal(await page.evaluate(()=>['.game-shell','.game-topbar','.game-dock','#screen'].every((selector,i)=>document.querySelector(selector)===window.shellNodes[i])),true,'filter changes preserve shell');
      await page.screenshot({path:fileURLToPath(new URL(`../tmp/performance-${viewport.width}.png`,import.meta.url)),fullPage:false});
    }
    assert.deepEqual(errors,[]);
    results.push({viewport,cpuSlowdown:4,selection:measured,warmReload:resources});
    await context.close();
  }
  const output=new URL(`../tmp/performance-${baseline?'before':'after'}.json`,import.meta.url);
  await writeFile(output,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}

