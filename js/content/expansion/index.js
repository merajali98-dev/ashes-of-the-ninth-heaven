import { ironCards } from './iron.js';
import { emberCards } from './ember.js';
import { tideCards } from './tide.js';
import { shadeCards } from './shade.js';
import { lotusCards } from './lotus.js';
import { thunderCards } from './thunder.js';
import { starCards } from './star.js';
import { neutralCards } from './neutral.js';

export const expansionCards = [
  ...ironCards,...emberCards,...tideCards,...shadeCards,
  ...lotusCards,...thunderCards,...starCards,...neutralCards,
].map(card => ({
  ...card,
  expansion:true,
  kind:[...card.effects,...(card.bonusEffects || [])].some(effect => effect.type === 'damage') ? 'attack' : 'skill',
}));

const regionSchool = {
  'ashen-prefecture':'iron','salt-estuary':'tide','hollow-theatre':'shade','lotus-vault':'lotus',
  'thunder-span':'thunder','last-observatory':'star','ninth-gate':'ember',
};

export function lineageRewards(mission) {
  const school = mission.type === 'Contract' ? 'neutral' : regionSchool[mission.chapter];
  const ranks = ['ashen-prefecture','salt-estuary','hollow-theatre','lotus-vault','thunder-span','last-observatory','ninth-gate'];
  const chapter = ranks.indexOf(mission.chapter);
  const pool = expansionCards.filter(card => card.school === school &&
    (card.rarity === 'common' || chapter >= 1 && card.rarity === 'uncommon' || chapter >= 3 && card.rarity === 'rare'));
  let hash = 0;
  for (const letter of mission.id) hash = (Math.imul(hash,31) + letter.charCodeAt(0)) >>> 0;
  const first = hash % pool.length;
  return [pool[first].id,pool[(first + Math.ceil(pool.length / 2)) % pool.length].id];
}
