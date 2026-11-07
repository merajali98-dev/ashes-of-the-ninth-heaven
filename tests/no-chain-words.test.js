// "Players never notice the chain": no text the game shows may mention wallets, recovery words, gas or the chain.
// Scans the quoted strings in every browser module (HTML tags and attributes removed, so a CSS class like
// `commerce-wallet` is fine). A line that must name the chain (the Ledger seal panel) carries `chain-words-ok`.
// API replies are checked in tests/api.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../js/', import.meta.url));
const BANNED = /\b(wallets?|seed ?phrases?|seed words|recovery (?:words|phrase)|mnemonic|private key|gas|gas fees?|yocto\w*|testnet|mainnet|blockchain|crypto(?:currency)?|smart contract|NEAR|sign (?:the |a )?transaction)\b/;
const QUOTED = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

async function files(dir) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await files(path));
    else if (entry.name.endsWith('.js')) out.push(path);
  }
  return out;
}

test('no player-facing string mentions wallets, recovery words, gas or the chain', async () => {
  const hits = [];
  for (const file of await files(ROOT)) {
    if (file.includes(join('js', 'online', 'signer.js'))) continue; // the signer has no UI text, only protocol names
    const lines = (await readFile(file, 'utf8')).split('\n');
    lines.forEach((line, i) => {
      if (line.includes('chain-words-ok') || /^\s*(\/\/|\*)/.test(line)) return;
      for (const [, , text] of line.matchAll(QUOTED)) {
        const shown = text.replace(/<[^>]*>/g, ' ');
        const match = BANNED.exec(shown);
        if (match) hits.push(`${file.slice(ROOT.length)}:${i + 1} "${match[0]}"`);
      }
    });
  }
  assert.deepEqual(hits, []);
});
