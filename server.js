import './server/env.js';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream';
import { openStore } from './server/store.js';
import { createChain } from './server/chain/service.js';
import { createApi } from './server/api.js';
import { createAgents } from './server/agents.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const localUrl = 'http://127.0.0.1:' + port;
const publicFiles = new Set(['/index.html', '/favicon.svg', '/judge.html', '/privacy.html', '/deed.html']);
const aliases = {'/judge': '/judge.html', '/privacy': '/privacy.html'};
const DEED_PAGE = /^\/deed(?:\/[a-z][a-z-]{1,30})?\/?$/; // /deed/lu-yan: one deed's history and its counting room
const publicDirs = ['/js/', '/css/', '/assets/'];
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

// The API (sign-in, ledger seal, relayer, status) is created on first use, so static play needs nothing else.
let api = null;
const apiHandler = () => api ??= (async () => {
  const store = await openStore();
  const chain = createChain({store});
  chain.flushMints().catch(() => {}); // finish any grants a previous run left queued
  if (!process.env.NODE_TEST_CONTEXT && process.env.ASHES_AGENTS !== 'off') createAgents({store, chain}).start(); // the merchants decide once a market day
  return createApi({store, chain});
})();

export const server = createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/') || req.url.startsWith('/deeds/')) {
      await (await apiHandler())(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const url = path === '/' ? '/index.html' : aliases[path] ?? (DEED_PAGE.test(path) ? '/deed.html' : path);
    const file = resolve(root, '.' + url);
    if ((!publicFiles.has(url) && !publicDirs.some(dir => url.startsWith(dir))) ||
        !file.startsWith(resolve(root) + sep) || url.split(/[\\/]/).includes('..')) {
      res.writeHead(404).end('Not found');
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    // Revalidate unversioned files, so reloads reuse bytes without hiding edits.
    const etag=`W/"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
    const headers={
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'X-Ashes-Game': '1',
      'Cache-Control': 'no-cache',
      ETag: etag,
      'Last-Modified': info.mtime.toUTCString(),
      Vary: 'Accept-Encoding',
    };
    const matches=req.headers['if-none-match'];
    const modifiedSince=Date.parse(req.headers['if-modified-since']);
    if(matches ? matches.split(',').some(value=>value.trim()==='*'||value.trim().replace(/^W\//,'')===etag.replace(/^W\//,'')) :
      Number.isFinite(modifiedSince)&&Math.floor(info.mtimeMs/1000)<=Math.floor(modifiedSince/1000)) {
      res.writeHead(304,headers).end();return;
    }
    const compressible=/\.(?:html|js|css|svg|json|txt)$/.test(file);
    const gzip=compressible&&info.size>=1024&&(req.headers['accept-encoding']||'').split(',').some(value=>{
      const [encoding,...parameters]=value.trim().split(';');
      return encoding==='gzip'&&!parameters.some(parameter=>/^q\s*=\s*0(?:\.0*)?$/.test(parameter.trim()));
    });
    if(gzip)headers['Content-Encoding']='gzip';
    else headers['Content-Length']=info.size;
    res.writeHead(200,headers);
    if (req.method === 'HEAD') res.end();
    else {
      const streams=gzip?[createReadStream(file),createGzip(),res]:[createReadStream(file),res];
      pipeline(...streams,error=>{if(error)res.destroy()});
    }
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
  }
});

const openOnStart = process.platform === 'win32' && process.argv.includes('--open');
const openGame = () => execFile('explorer.exe', [localUrl], {windowsHide:true}, () => {});

server.on('error', async error => {
  if (error.code === 'EADDRINUSE' && openOnStart) {
    try {
      const response = await fetch(localUrl, {method:'HEAD', signal:AbortSignal.timeout(2000), redirect:'error'});
      if (response.ok && response.headers.get('X-Ashes-Game') === '1') {
        openGame();
        return;
      }
    } catch {
      // The occupied port may belong to another program.
    }
  }
  console.error('Could not start the local game. ' + error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log('Ashes of the Ninth Heaven • http://127.0.0.1:' + server.address().port);
  if (!process.env.NODE_TEST_CONTEXT) apiHandler(); // start the minter queue and the merchant agents at once
  if (openOnStart) openGame();
});
