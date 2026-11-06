// Regenerates the contract's inputs from the game, builds the wasm, and copies it to contracts/items/res/ with its
// SHA-256, so the exact deployed binary is committed and judges can deploy without a Rust toolchain.
// Run: npm run contract:build   (needs Rust and cargo-near; on Windows, ABI generation is skipped)
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root = new URL('../', import.meta.url), dir = new URL('contracts/items/', root);
execFileSync(process.execPath, [fileURLToPath(new URL('scripts/gen-contract-rules.mjs', root))], {stdio: 'inherit'});
execFileSync(process.execPath, [fileURLToPath(new URL('scripts/build-token-registry.mjs', root))], {stdio: 'inherit'});
execFileSync('cargo', ['near', 'build', 'non-reproducible-wasm', '--no-abi'], {cwd: fileURLToPath(dir), stdio: 'inherit'});
await mkdir(new URL('res/', dir), {recursive: true});
await copyFile(new URL('target/near/items.wasm', dir), new URL('res/items.wasm', dir));
const sha = createHash('sha256').update(await readFile(new URL('res/items.wasm', dir))).digest('hex');
await writeFile(new URL('res/items.wasm.sha256', dir), sha + '  items.wasm\n');
console.log('contracts/items/res/items.wasm', sha);
