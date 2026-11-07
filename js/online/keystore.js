// Keeps the device key in this browser's IndexedDB. The private key is a non-extractable CryptoKey: the browser can
// sign with it, but it cannot be read, copied or shown. If IndexedDB is unavailable (some private windows) the key
// lives for this tab only; signing in again on reload simply adds a new one.
import {createDeviceKey, publicKeyOf} from './signer.js';

// The key id carries a version: when the market gains methods (listings, 2026-11-08) a fresh key is made, because a
// key's permissions cannot change. The server adds the new key; the old one simply stops being used.
const DB = 'ashes-ledger-seal', STORE = 'keys', ID = 'device-3'; // 3: Shop Deeds methods (2026-11-08)
let memory = null;

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function run(mode, action) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const request = action(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

/** The device key for this browser, made on first use: {keyPair, publicKey}. */
export async function deviceKey() {
  if (memory) return memory;
  let keyPair = null;
  try { keyPair = await run('readonly', store => store.get(ID)); } catch { /* no IndexedDB */ }
  if (!keyPair) {
    keyPair = await createDeviceKey();
    try { await run('readwrite', store => store.put(keyPair, ID)); } catch { /* tab-only key */ }
  }
  memory = {keyPair, publicKey: await publicKeyOf(keyPair)};
  return memory;
}

/** Forget this browser's key (signing out). The account stays; signing in again adds a fresh key. */
export async function forgetDeviceKey() {
  memory = null;
  try { await run('readwrite', store => store.delete(ID)); } catch { /* nothing stored */ }
}
