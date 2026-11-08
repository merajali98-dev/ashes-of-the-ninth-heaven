// Everything that can be checked offline, in one command: npm run verify
//   • the node suite: rules, parity fixtures, generated contract inputs, the committed wasm checksum, the API, the
//     relayer's checks, battle replay, the agents and the haggling voice;
//   • the contract's Rust tests and the JS↔Rust parity replays (skipped with a note if Rust is not installed).
// The live deployment is checked separately, read-only: npm run chain:verify
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const results = [];
function run(name, command, args, cwd = root, shell = false) {
  console.log(`\n── ${name}: ${command} ${args.join(' ')}`);
  const started = Date.now();
  const r = spawnSync(command, args, {cwd, stdio: 'inherit', shell});
  results.push({name, ok: r.status === 0, skipped: false, seconds: ((Date.now() - started) / 1000).toFixed(1)});
}

run('node tests', process.execPath, ['--test']);
const cargo = spawnSync('cargo --version', {shell: true});
if (cargo.status === 0) run('contract tests and parity', 'cargo test', [], fileURLToPath(new URL('../contracts/items/', import.meta.url)), true);
else results.push({name: 'contract tests and parity', ok: true, skipped: true, seconds: '0'});

console.log('\n── summary');
for (const r of results) console.log(`${r.skipped ? '–' : r.ok ? '✓' : '✗'} ${r.name}${r.skipped ? ' (skipped: install Rust to run cargo test)' : ` (${r.seconds}s)`}`);
process.exitCode = results.every(r => r.ok) ? 0 : 1;
