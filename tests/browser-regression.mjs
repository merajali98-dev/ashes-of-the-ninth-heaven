import {spawn} from 'node:child_process';
import {once} from 'node:events';

process.env.PORT='4181';
const {server}=await import('../server.js');
if(!server.listening)await once(server,'listening');
try {
  const failures=[];
  const requested=process.argv.slice(2);
  const suites=['motion','workshop','pet','audio','expansion','tutorial'];
  for(const name of requested.length?requested:suites) {
    if(!suites.includes(name))throw new Error(`Unknown browser suite: ${name}`);
    console.log(`Running ${name} browser regression`);
    await new Promise((resolve,reject)=>{
      const child=spawn(process.execPath,[`tests/${name}-browser.mjs`],{stdio:'inherit',windowsHide:true});
      child.on('error',reject);
      child.on('exit',code=>code===0?resolve():reject(new Error(`${name} browser regression exited ${code}`)));
    }).catch(error=>{failures.push(error.message);console.error(error.message)});
  }
  if(failures.length)throw new Error(failures.join('\n'));
} finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
