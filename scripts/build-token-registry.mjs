// Builds contracts/items/tokens.json: every good in the game as a NEP-245 token, ready for register_tokens.
// Market goods come first, in exactly the order of js/market/tokens.js, because on-chain merchants list their goods
// in registry order (the same order the JavaScript rules use). Jade is registered by the contract itself (index 0).
// Run: node scripts/build-token-registry.mjs   (a test fails if the file is stale)
import {writeFile} from 'node:fs/promises';
import {MARKET_TOKENS} from '../js/market/tokens.js';
import {cards, items} from '../js/content.js';
import {materialById} from '../js/economy.js';
import {cardArt} from '../js/art.js';
import {itemIcon} from '../js/item-art.js';

const itemById = Object.fromEntries(items.map(item => [item.id, item]));

export function buildRegistry() {
  const market = Object.values(MARKET_TOKENS).map(t => ({
    id: t.id, title: t.name, kind: t.kind, family: t.family, school: t.school ?? null, tier: t.tier ?? 0, base: t.base,
    media: t.kind === 'material' ? materialById[t.id.slice(4)].art : itemIcon(itemById[t.id.slice(5)]), decimals: 0,
  }));
  const traded = new Set(market.map(t => t.id));
  const techniques = cards.map(card => ({
    id: 'card:' + card.id, title: card.name, kind: 'card', family: card.school || 'neutral', school: card.school || null,
    tier: 0, base: 0, media: cardArt(card), decimals: 0,
  }));
  const gear = items.filter(item => !traded.has('item:' + item.id)).map(item => ({
    id: 'item:' + item.id, title: item.name, kind: 'item', family: item.type, school: item.school || null,
    tier: 0, base: 0, media: itemIcon(item), decimals: 0,
  }));
  return [...market, ...techniques, ...gear];
}

if (process.argv[1]?.endsWith('build-token-registry.mjs')) {
  const registry = buildRegistry();
  await writeFile(new URL('../contracts/items/tokens.json', import.meta.url), JSON.stringify(registry, null, 1) + '\n');
  console.log(`Wrote ${registry.length} tokens (+ jade) to contracts/items/tokens.json`);
}
