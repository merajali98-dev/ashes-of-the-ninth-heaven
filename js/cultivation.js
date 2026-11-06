// Cultivation uses lifetime essence. Layers are derived; only a breakthrough
// changes the saved realm. This module has no browser or progression imports.
export const CULTIVATION_VERSION = 1;
export const LAYERS_PER_REALM = 9;
export const PERFECTED_ESSENCE = 6470;
const definition = (id, name, essence, jade, hp, description) => Object.freeze({
  id, name, essence, jade, hp, description,
  avatar: id === 'qi-condensation' ? 'assets/art/portrait-shen-luo.webp' : `assets/art/cultivation-${id}.webp`,
});
export const REALMS = Object.freeze([
  definition('qi-condensation','Qi Condensation',0,0,0,'Gather the first breath of qi into the meridians.'),
  definition('foundation-establishment','Foundation Establishment',110,30,8,'Set a foundation that can bear the weight of heaven.'),
  definition('core-formation','Core Formation',280,55,17,'Condense the wandering breath into a luminous core.'),
  definition('nascent-soul','Nascent Soul',520,90,29,'Awaken a soul that can remember beyond the flesh.'),
  definition('soul-transformation','Soul Transformation',850,140,44,'Temper the soul until its light reshapes the body.'),
  definition('void-refinement','Void Refinement',1290,210,61,'Refine the stillness between the stars.'),
  definition('body-integration','Body Integration',1870,300,73,'Unite body, soul and celestial law.'),
  definition('mahayana','Mahayana',2640,420,84,'Carry a complete inner heaven through the mortal world.'),
  definition('tribulation-transcendence','Tribulation Transcendence',3640,580,96,'Endure the storm that unmakes lesser heavens.'),
  definition('true-immortal','True Immortal',4940,780,108,'Walk beyond the ledger beneath a ninefold immortal halo.'),
]);
const LEGACY_REALMS = Object.freeze([0,1,2,3,4,5,7]);
const MATERIAL_REALMS = Object.freeze([0,1,3,4,6]);
const count = value => Number.isSafeInteger(value) && value >= 0;

function indexOf(game) {
  if (!Number.isInteger(game?.realm) || game.realm < 0 || game.realm >= REALMS.length) {
    throw new RangeError('Unsupported cultivation realm.');
  }
  return game.realm;
}

function essenceOf(game) {
  if (!count(game?.essence)) throw new RangeError('Cultivation essence must be a non-negative safe integer.');
  return game.essence;
}

/** Exact lifetime essence needed to enter a layer (1–9) of a realm (0–9). */
export function layerThreshold(realm, layer) {
  if (!Number.isInteger(realm) || !REALMS[realm] || !Number.isInteger(layer) || layer < 1 || layer > 10) {
    throw new RangeError('Unsupported cultivation layer.');
  }
  const start = REALMS[realm].essence;
  const end = REALMS[realm + 1]?.essence ?? PERFECTED_ESSENCE;
  return start + Math.ceil((end - start) * (layer - 1) / LAYERS_PER_REALM);
}

export function cultivationStatus(game) {
  const realm = indexOf(game);
  const essence = essenceOf(game);
  const current = REALMS[realm];
  const next = REALMS[realm + 1] || null;
  let layer = 1;
  for (let candidate = 2; candidate <= LAYERS_PER_REALM; candidate++) {
    if (essence >= layerThreshold(realm,candidate)) layer = candidate;
  }
  const layerStart = layerThreshold(realm,layer);
  const layerEnd = layerThreshold(realm,layer + 1);
  const perfected = realm === REALMS.length - 1 && essence >= PERFECTED_ESSENCE;
  return {
    realm, layer, level:realm * LAYERS_PER_REALM + layer, essence, current, next,
    layerStart, layerEnd, progress:Math.max(0,Math.min(1,(essence - layerStart) / (layerEnd - layerStart))),
    xpToNext:Math.max(0,layerEnd - essence),
    nextRequiredEssence:next?.essence ?? PERFECTED_ESSENCE,
    experienceReady:Boolean(next && essence >= next.essence),
    breakthroughReady:!breakthroughRequirement(game),
    perfected, isFinal:!next,
  };
}

export function cultivationLevel(game) {
  return cultivationStatus(game).level;
}

/** Highest unlocked raw-material potency tier; rarity is a separate property. */
export function materialTier(game) {
  const realm = indexOf(game);
  return MATERIAL_REALMS.filter(required => realm >= required).length;
}

export function realmAvatar(game) {
  return REALMS[indexOf(game)].avatar;
}

export function breakthroughRequirement(game) {
  if (!game?.started) return 'Swear your oath before attempting a breakthrough.';
  if (game.active) return 'Resolve the current encounter before attempting a breakthrough.';
  if (!Number.isInteger(game.realm) || !REALMS[game.realm] || !count(game.essence) || !count(game.jade)) {
    return 'Your cultivation record is invalid.';
  }
  const next = REALMS[game.realm + 1];
  if (!next) return 'You have reached the final realm.';
  if (game.essence < next.essence) return `Requires ${next.essence - game.essence} more essence to enter ${next.name}.`;
  if (game.jade < next.jade) return `Requires ${next.jade - game.jade} more jade (${next.jade} total).`;
  return '';
}

/** Mutates realm/jade only. Caller owns equipment-aware vitality and journal. */
export function advanceCultivation(game) {
  const reason = breakthroughRequirement(game);
  if (reason) return {ok:false, reason};
  const next = REALMS[game.realm + 1];
  game.jade -= next.jade;
  game.realm++;
  return {ok:true, message:`You entered ${next.name}.`};
}

/**
 * Return a shallow clone without changing input, known cards or combat snapshots.
 * Throws for unsupported cultivation versions or malformed legacy realm/essence.
 * Root save validation is still responsible for the remaining save structure.
 */
export function migrateCultivation(game) {
  if (!game || typeof game !== 'object' || Array.isArray(game)) throw new TypeError('Unsupported cultivation record.');
  if (game.cultivationVersion !== undefined) {
    if (game.cultivationVersion !== CULTIVATION_VERSION) throw new RangeError('Unsupported cultivation version.');
    indexOf(game);
    essenceOf(game);
    return {...game};
  }
  if (!Number.isInteger(game.realm) || game.realm < 0 || game.realm >= LEGACY_REALMS.length || !count(game.essence)) {
    throw new RangeError('Unsupported legacy cultivation record.');
  }
  const realm = LEGACY_REALMS[game.realm];
  return {...game, cultivationVersion:CULTIVATION_VERSION, realm, essence:Math.max(game.essence,REALMS[realm].essence)};
}
