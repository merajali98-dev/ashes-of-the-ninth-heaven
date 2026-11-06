import { enemies } from './content/adversaries.js';
import { chapters } from './content/campaign.js';
import { cards } from './content/techniques.js';
import { characters, schools } from './content/world.js';
import { expansionArtIds } from './expansion-art.js';

export const portraits = new Set(characters.map(character => character.id));
export const regions = Object.fromEntries(chapters.map(chapter => [chapter.id, 'region-' + chapter.id]));
export const enemyArt = Object.fromEntries(enemies.map(enemy => [enemy.id, enemy.id]));

const schoolArt = new Set(schools.map(school => school.id));
const illustratedCards = new Set(cards.map(card => card.id));

export function cardArt(card) {
  if (illustratedCards.has(card.id) || expansionArtIds.has(card.id)) return 'assets/art/card-' + card.id + '.webp';
  const school = schoolArt.has(card.school) ? card.school : 'neutral';
  return 'assets/art/school-' + school + '.webp';
}

export function relicArt(item) {
  if (item.type === 'weapon' && /\b(?:spear|pike|lance)\b/i.test(item.name)) return 'weapon-2';
  if (item.type === 'armor' && /\b(?:robe|silk|vestments?)\b/i.test(item.name)) return 'armor-2';
  if (item.type === 'pill' && /\b(?:draught|decoction|gourd|elixir)\b/i.test(item.name)) return 'pill-2';
  if (item.type === 'material' && /\b(?:herbs?|root|reeds?|leaf|mint)\b/i.test(item.name)) return 'material-2';
  return item.type;
}
