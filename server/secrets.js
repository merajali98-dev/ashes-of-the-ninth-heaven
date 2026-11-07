// Server secrets: the master key that encrypts players' recovery keys (AES-256-GCM) and the HMAC key for
// private account names. Hosting sets ASHES_MASTER_KEY and ASHES_HMAC_KEY (base64, 32 bytes); in development they
// are generated once into server/data/secrets.json (gitignored). Losing the master key loses account recovery only.
import {createCipheriv, createDecipheriv, createHmac, randomBytes} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {DATA_DIR, IN_MEMORY} from './store.js';

let keys = null;
function load() {
  if (keys) return keys;
  if (process.env.ASHES_MASTER_KEY && process.env.ASHES_HMAC_KEY) {
    keys = {master: Buffer.from(process.env.ASHES_MASTER_KEY, 'base64'), hmac: Buffer.from(process.env.ASHES_HMAC_KEY, 'base64')};
  } else if (IN_MEMORY) {
    keys = {master: randomBytes(32), hmac: randomBytes(32)};
  } else {
    const file = DATA_DIR + 'secrets.json';
    if (!existsSync(file)) {
      mkdirSync(DATA_DIR, {recursive: true});
      writeFileSync(file, JSON.stringify({master: randomBytes(32).toString('base64'), hmac: randomBytes(32).toString('base64')}), {mode: 0o600});
    }
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    keys = {master: Buffer.from(saved.master, 'base64'), hmac: Buffer.from(saved.hmac, 'base64')};
  }
  if (keys.master.length !== 32 || keys.hmac.length !== 32) throw new Error('server secrets must be 32 bytes');
  return keys;
}

export function encryptSecret(text) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', load().master, iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}
export function decryptSecret(sealed) {
  const [version, iv, tag, body] = sealed.split(':');
  if (version !== 'v1') throw new Error('unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', load().master, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}
export const privateId = text => createHmac('sha256', load().hmac).update(text).digest('hex');
