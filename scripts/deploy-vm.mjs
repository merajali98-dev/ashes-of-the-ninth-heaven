// Deploys the committed game (git HEAD) to the Google Cloud VM behind https://ashes-ninth.duckdns.org.
//   npm run deploy            → ship the code; keep the settings already on the VM
//   npm run deploy -- --env   → also send settings: GOOGLE_CLIENT_ID, NEAR_AI_API_KEY, RESEND_API_KEY from .env, and the
//                               testnet keys of the parent, relayer and minter from the local keychain
// Uses only the `ashes` gcloud configuration (never the default one). Secrets are written to a private temp file,
// copied, and removed; they are never printed. The VM makes its own server secrets once (deploy/setup.sh).
import {spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MINTER, PARENT, RELAYER, agentEnvName, loadAgentKey, loadKey, merchantAccount} from '../server/chain/near.js';
import {MERCHANTS} from '../js/market/merchant-rules.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DOMAIN = process.env.ASHES_DOMAIN || 'ashes-ninth.duckdns.org';
const VM = process.env.ASHES_VM || 'ashes-server', ZONE = process.env.ASHES_ZONE || 'us-central1-a';
const sendEnv = process.argv.includes('--env');
const env = {...process.env, CLOUDSDK_ACTIVE_CONFIG_NAME: 'ashes'};

function run(command, args, options = {}) {
  const shown = [command, ...args].join(' ');
  console.log('$ ' + shown.replace(/ashes-env-[^ ]+/g, '<settings>'));
  const result = spawnSync(command, args, {cwd: ROOT, env, stdio: 'inherit', shell: process.platform === 'win32', ...options});
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
const quote = text => process.platform === 'win32' ? `"${text}"` : text;

const dirty = spawnSync('git', ['status', '--porcelain'], {cwd: ROOT, encoding: 'utf8'}).stdout.trim();
if (dirty) console.warn('! uncommitted changes are NOT deployed (the release is git HEAD)');

const dir = mkdtempSync(join(tmpdir(), 'ashes-deploy-'));
const tarball = join(dir, 'release.tgz');
const files = [tarball, join(ROOT, 'deploy', 'setup.sh')];
try {
  run('git', ['archive', '--format=tar.gz', '-o', tarball, 'HEAD'], {shell: false});
  let envFile = '';
  if (sendEnv) {
    const local = existsSync(join(ROOT, '.env')) ? Object.fromEntries(readFileSync(join(ROOT, '.env'), 'utf8').split(/\r?\n/)
      .filter(line => /^[A-Z0-9_]+=/.test(line)).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)])) : {};
    const settings = {ASHES_PUBLIC_URL: `https://${DOMAIN}`};
    for (const name of ['GOOGLE_CLIENT_ID', 'NEAR_AI_API_KEY', 'NEAR_AI_MODEL', 'RESEND_API_KEY', 'ASHES_MAIL_FROM']) if (local[name]) settings[name] = local[name];
    for (const id of [PARENT, RELAYER, MINTER]) {
      const key = await loadKey(id);
      if (!key) throw new Error('No local key for ' + id);
      settings['NEAR_KEY_' + id.toUpperCase().replace(/[^A-Z0-9]/g, '_')] = key;
    }
    for (const m of MERCHANTS) {
      const id = merchantAccount(m.id), key = await loadAgentKey(id);
      if (key) settings[agentEnvName(id)] = key; // function-call only: merchant_set_strategy
    }
    envFile = join(dir, 'ashes-env-' + Date.now());
    writeFileSync(envFile, Object.entries(settings).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', {mode: 0o600});
    files.push(envFile);
    const secret = k => k.startsWith('NEAR_KEY_') || k.startsWith('NEAR_AGENT_KEY_');
    console.log(`  settings: ${Object.keys(settings).filter(k => !secret(k)).join(', ')} + ${Object.keys(settings).filter(secret).length} testnet keys`);
  }
  run('gcloud', ['compute', 'scp', ...files.map(quote), `${VM}:.`, `--zone=${ZONE}`, '--quiet', '--strict-host-key-checking=no']);
  const remoteEnv = envFile ? ' ~/' + envFile.split(/[\\/]/).pop() : '';
  run('gcloud', ['compute', 'ssh', VM, `--zone=${ZONE}`, '--quiet', '--strict-host-key-checking=no',
    `--command=${quote(`sudo bash ~/setup.sh ${DOMAIN} ~/release.tgz${remoteEnv} && rm -f ~/setup.sh`)}`]);
  const res = await fetch(`https://${DOMAIN}/api/status`, {signal: AbortSignal.timeout(20_000)}).catch(error => ({ok: false, error}));
  console.log(res.ok ? `+ live: https://${DOMAIN}  (status ${JSON.stringify(await res.json()).slice(0, 160)}…)` : `? https://${DOMAIN} not answering yet (${res.error?.message ?? res.status}); certificates can take a minute`);
} finally {
  rmSync(dir, {recursive: true, force: true});
}
