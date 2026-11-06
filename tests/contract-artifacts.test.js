// The contract is built from the game's own files. These checks fail if a generated input has gone stale.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {renderRules} from '../scripts/gen-contract-rules.mjs';
import {buildRegistry} from '../scripts/build-token-registry.mjs';
import {MARKET_TOKENS} from '../js/market/tokens.js';

const dir = new URL('../contracts/items/', import.meta.url);

test('the contract pricing parameters are generated from merchant-rules.js and up to date (node scripts/gen-contract-rules.mjs)', async () => {
  assert.equal(await readFile(new URL('src/rules_gen.rs', dir), 'utf8'), renderRules());
});

test('the token registry holds every good, market goods first in the rules order (node scripts/build-token-registry.mjs)', async () => {
  const committed = JSON.parse(await readFile(new URL('tokens.json', dir), 'utf8'));
  assert.deepEqual(committed, buildRegistry());
  assert.equal(committed.length + 1, 874, '873 goods plus jade');
  assert.equal(new Set(committed.map(t => t.id)).size, committed.length);
  const market = Object.keys(MARKET_TOKENS);
  assert.deepEqual(committed.slice(0, market.length).map(t => t.id), market);
  assert.ok(committed.slice(market.length).every(t => t.kind === 'card' || t.kind === 'item'));
});

test('the committed contract binary matches its checksum', async () => {
  const wasm = new URL('res/items.wasm', dir);
  assert.ok(existsSync(wasm), 'run npm run contract:build');
  const sha = createHash('sha256').update(await readFile(wasm)).digest('hex');
  assert.equal((await readFile(new URL('res/items.wasm.sha256', dir), 'utf8')).split(/\s+/)[0], sha);
});
