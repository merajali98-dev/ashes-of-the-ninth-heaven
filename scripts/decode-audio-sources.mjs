// Decode selected CC0 OGG using the same native browser decoder used by the game.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from 'file:///C:/Users/Arash%20Mohsin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const sources=JSON.parse(await readFile('tmp/audio-source/selected.json','utf8'));
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');
 await mkdir('tmp/audio-source/decoded',{recursive:true});
 for(const source of sources){
  const bytes=await page.evaluate(async src=>{
   const ctx=new AudioContext({sampleRate:22050}),response=await fetch('/'+src);
   if(!response.ok)throw new Error(src);
   const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
   const mono=new Float32Array(buffer.length);
   for(let ch=0;ch<buffer.numberOfChannels;ch++){const a=buffer.getChannelData(ch);for(let i=0;i<a.length;i++)mono[i]+=a[i]/buffer.numberOfChannels}
   const u8=new Uint8Array(mono.buffer);let binary='';for(let i=0;i<u8.length;i++)binary+=String.fromCharCode(u8[i]);await ctx.close();
   return btoa(binary);
  },source.src);
  await writeFile('tmp/audio-source/decoded/'+source.id.replace('/','--')+'.f32',Buffer.from(bytes,'base64'));
 }
 console.log(JSON.stringify({nativeDecoded:sources.length,sampleRate:22050}));
}finally{await browser.close()}
