import { cards as originalCards } from './content/techniques.js';
import { missions as originalMissions } from './content/campaign.js';
import { expansionCards, lineageRewards } from './content/expansion/index.js';
export { starterDeck } from './content/techniques.js';
export { expansionCards } from './content/expansion/index.js';
export const cards = [...originalCards,...expansionCards];
export { enemies } from './content/adversaries.js';
export { chapters } from './content/campaign.js';
export const missions = originalMissions.map(mission => ({
  ...mission,
  rewards:{...mission.rewards,cards:[...mission.rewards.cards,...lineageRewards(mission)]},
}));
export { items, recipes } from './content/treasury.js';
export { characters, schools, sects } from './content/world.js';
