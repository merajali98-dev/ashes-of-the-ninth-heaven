import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile,writeFile,unlink} from 'node:fs/promises';

test('static delivery compresses text, revalidates cached bytes and exposes edits immediately',async()=>{
  process.env.PORT='0';
  const {server}=await import('../server.js');
  if(!server.listening)await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  const fixture=new URL('../assets/cache-test.txt',import.meta.url);
  try {
    const plain=await fetch(base+'/js/app.js',{headers:{'Accept-Encoding':'identity'}});
    const original=await plain.text(),etag=plain.headers.get('etag');
    assert.equal(original,await readFile(new URL('../js/app.js',import.meta.url),'utf8'));
    assert.equal(plain.headers.get('cache-control'),'no-cache');
    const compressed=await fetch(base+'/js/app.js',{headers:{'Accept-Encoding':'gzip'}});
    assert.equal(compressed.headers.get('content-encoding'),'gzip');
    assert.equal(compressed.headers.get('content-length'),null);
    assert.equal(await compressed.text(),original);
    const cached=await fetch(base+'/js/app.js',{headers:{'If-None-Match':etag}});
    assert.equal(cached.status,304);assert.equal(await cached.text(),'');
    const dated=await fetch(base+'/js/app.js',{headers:{'If-Modified-Since':plain.headers.get('last-modified')}});
    assert.equal(dated.status,304);
    const stale=await fetch(base+'/js/app.js',{headers:{'If-None-Match':'"stale"','If-Modified-Since':plain.headers.get('last-modified')}});
    assert.equal(stale.status,200);await stale.text();
    const head=await fetch(base+'/js/app.js',{method:'HEAD',headers:{'Accept-Encoding':'identity'}});
    assert.equal(Number(head.headers.get('content-length')),Buffer.byteLength(original));
    assert.equal(await head.text(),'');
    const noGzip=await fetch(base+'/js/app.js',{headers:{'Accept-Encoding':'gzip;q=0'}});
    assert.equal(noGzip.headers.get('content-encoding'),null);await noGzip.text();
    await writeFile(fixture,'first');
    const first=await fetch(base+'/assets/cache-test.txt');await first.text();
    await writeFile(fixture,'second, changed');
    const edited=await fetch(base+'/assets/cache-test.txt',{headers:{'If-None-Match':first.headers.get('etag')}});
    assert.equal(edited.status,200);assert.equal(await edited.text(),'second, changed');
    const privateFile=await fetch(base+'/package.json');assert.equal(privateFile.status,404);await privateFile.text();
  } finally {
    await unlink(fixture).catch(()=>{});
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});
