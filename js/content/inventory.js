export const slug = text => text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-');
export const damage = (amount, hits) => ({ type: 'damage', amount, ...(hits && { hits }) });
export const block = amount => ({ type: 'block', amount });
export const draw = amount => ({ type: 'draw', amount });
export const energy = amount => ({ type: 'energy', amount });
export const heal = amount => ({ type: 'heal', amount });
export const cleanse = amount => ({ type: 'cleanse', amount });
export const status = (status, amount, target) => ({ type: 'status', status, amount, ...(target && { target }) });
export const buff = (name, amount) => status(name, amount, 'self');

const values = { common: 20, uncommon: 45, rare: 90, legendary: 175 };
const item = (name, type, rarity, description, properties = {}) => ({
  id: slug(name), name, type, rarity, value: values[rarity], description, ...properties,
});
const gear = (type, school, [name, rarity, description, bonuses]) => item(name, type, rarity, description, {
  school, slot: type, bonuses,
});
const consumable = (type, school, [name, rarity, description, effects]) => item(name, type, rarity, description, {
  school, effects, value: Math.round(values[rarity] * 0.7),
});
const material = (school, [name, rarity, description]) => item(name, 'material', rarity, description, {
  school, value: Math.round(values[rarity] * 0.55),
});
export const manual = (school, [name, rarity, description, card]) => item(name, 'manual', rarity, description, {
  school, card,
});

export function schoolInventory(school, groups) {
  const equipment = ['weapon', 'armor', 'accessory', 'relic'].flatMap(type => groups[type].map(row => gear(type, school, row)));
  const supplies = ['talisman', 'pill'].flatMap(type => groups[type].map(row => consumable(type, school, row)));
  const materials = groups.material.map(row => material(school, row));
  const manuals = (groups.manual ?? []).map(row => manual(school, row));
  return [...equipment, ...supplies, ...materials, ...manuals];
}

export const roadside = [
  gear('weapon', 'neutral', ['Pilgrim’s Staff', 'common', 'The wood is smooth where the last owner rested both hands between steps.', { strength: 1 }]),
  gear('armor', 'neutral', ['Sootcloth Coat', 'common', 'The coating darkens when a cold draft crosses the ribs.', { maxHp: 5 }]),
  gear('armor', 'neutral', ['Walkers’ Shoes', 'rare', 'Auntie Shi saved these soles for someone with a century to walk back to.', { maxHp: 10, block: 5 }]),
  gear('accessory', 'neutral', ['Jade Prayer Beads', 'common', 'The first bead is worn to the shape of a thumbprint.', { focus: 1 }]),
  gear('accessory', 'neutral', ['Threshold Key', 'rare', 'A plain key cut for the gate of a house with no official address.', { ward: 2, block: 5 }]),
  gear('relic', 'neutral', ['Windproof Wick', 'uncommon', 'It burns in the direction the bearer needs to go.', { ward: 2 }]),
  gear('relic', 'neutral', ['Charcoal Scrip', 'common', 'These market notes carry the names Duan left in the margins.', { block: 4 }]),
  gear('relic', 'neutral', ['First Sky Reliquary', 'legendary', 'It holds the first person’s words after the sky struck the earth.', { maxHp: 12, regen: 2, ward: 2 }]),
  gear('relic', 'neutral', ['Ninth Heaven Fragment', 'legendary', 'The gold only shines when the sun is up.', { energy: 1, strength: 2, ward: 1 }]),
  consumable('pill', 'neutral', ['Roadside Bitter Pill', 'common', 'A sharp root rolled in honey and wrapped in oiled paper.', [heal(9), cleanse(1)]]),
  consumable('pill', 'neutral', ['Untaxed Breath', 'legendary', 'A breath the ministry never managed to enter in its books.', [heal(24), energy(2), cleanse(3)]]),
  consumable('talisman', 'neutral', ['Paper Talisman', 'common', 'The market writes simple wards on the blank backs of old warrants.', [block(11)]]),
  consumable('talisman', 'neutral', ['Dawn Seal', 'rare', 'A seal impressed by the first slant of morning light.', [block(12), buff('ward', 3), draw(2)]]),
  material('neutral', ['Roadside Hemp', 'common', 'Threads gathered from the sandals of a hundred pilgrims.']),
];
