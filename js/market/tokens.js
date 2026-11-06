// Every good a merchant can trade, with its usual (base) price in jade cents.
// Base prices come from the existing game: material prices in economy.js and item values in the content registry.
import {materials} from '../economy.js';
import {items, schools} from '../content.js';
import {CENTS} from './merchant-rules.js';

const schoolName = Object.fromEntries(schools.map(school => [school.id, school.name]));
const entry = token => [token.id, Object.freeze(token)];

export const MARKET_TOKENS = Object.freeze(Object.fromEntries([
  ...materials.map(material => entry({
    id: 'mat:' + material.id, name: material.name, kind: 'material', family: material.family, tier: material.tier,
    school: material.school, schoolName: schoolName[material.school] ?? null, base: material.price * CENTS,
  })),
  ...items.filter(item => item.type === 'pill' || item.type === 'talisman').map(item => entry({
    id: 'item:' + item.id, name: item.name, kind: 'consumable', family: item.type, tier: null,
    school: item.school, schoolName: schoolName[item.school] ?? null, base: item.value * CENTS,
  })),
]));
