// The server's own small database: players, sign-in identities, sessions, codes and the minter's queue.
// One JSON file in server/data/ (gitignored), written atomically; `memory` keeps everything in RAM (tests).
import {existsSync} from 'node:fs';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('./data/', import.meta.url));
const blank = () => ({version: 1, users: {}, identities: {}, sessions: {}, codes: {}, names: {}, mints: {queue: [], inflight: null}, relays: {}});

export const IN_MEMORY = (process.env.ASHES_STORE || (process.env.NODE_TEST_CONTEXT ? 'memory' : '')) === 'memory';

export async function openStore(file = IN_MEMORY ? 'memory' : process.env.ASHES_STORE || DATA_DIR + 'store.json') {
  const memory = file === 'memory';
  const data = !memory && existsSync(file) ? {...blank(), ...JSON.parse(await readFile(file, 'utf8'))} : blank();
  let pending = null, writing = Promise.resolve();
  const flush = async () => {
    pending = null;
    if (memory) return;
    await mkdir(dirname(file), {recursive: true});
    const tmp = file + '.tmp';
    await writeFile(tmp, JSON.stringify(data));
    await rename(tmp, file);
  };
  return {
    data,
    /** Saves soon (coalesced). `await store.save()` waits for the write. */
    save() {
      pending ??= new Promise(resolve => setTimeout(resolve, 25)).then(() => (writing = writing.then(flush)));
      return pending;
    },
  };
}
