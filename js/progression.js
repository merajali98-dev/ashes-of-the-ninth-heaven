import * as lore from './content.js';
import { createCombat, playCard, endTurn, useConsumable, usePetAbility } from './combat.js';
import * as petRules from './pets.js';
import {REALMS,cultivationStatus,cultivationLevel,materialTier,advanceCultivation,migrateCultivation} from './cultivation.js';
import * as economy from './economy.js';
import {initializeDecks,validDeckState,syncActiveDeck,deckRequirement} from './decks.js';
export * from './cultivation.js';
export * from './economy.js';
export * from './decks.js';
export * from './pets.js';

export const { cards, enemies, items, missions, chapters, characters, schools, sects } = lore;
const byId = list => Object.fromEntries(list.map(entry => [entry.id, entry]));
export const cardById = byId(cards);
export const itemById = byId(items);
export const missionById = byId(missions);
export const chapterById = byId(chapters);
export const enemyById = byId(enemies);
export const characterById = byId(characters);
export const schoolById = byId(schools);
export const recipes = lore.recipes || [];
export const SAVE_KEY = 'ashes-ninth-heaven-v1';
export const SLOTS = ['weapon', 'armor', 'accessory', 'relic'];
export const MIN_DECK = 8;
export const MAX_DECK = 22;
export const DEFAULT_AUDIO_SETTINGS=Object.freeze({master:.65,combat:.8,ui:.55,progression:.8,pets:.8});
export const DIFFICULTIES = {
  wayfarer:{name:'Wayfarer',description:'The full chronicle at its standard difficulty.'},
  tribulation:{name:'Tribulation',description:'Foes have 25% more vitality and deal 20% more base attack damage. Phased foes seal their transitions.'},
};

export function freshGame(seed = Date.now()) {
  const known = {};
  const deck = lore.starterDeck.map(entry => typeof entry === 'string' ? entry : entry.id);
  for (const id of deck) known[id] = (known[id] || 0) + 1;
  const supply = items.filter(item => ['pill', 'talisman', 'material'].includes(item.type) &&
    ['common', 'ordinary', 'mundane'].includes(item.rarity)).slice(0, 3);
  return petRules.initializePets(initializeDecks(economy.initializeEconomy({
    version:1, seed, started:false, name:'Ash-Bearer', difficulty:'wayfarer', jade:35, essence:0,
    cultivationVersion:1,tutorial:{version:1,sanctuary:0,battle:0},audioSettings:{...DEFAULT_AUDIO_SETTINGS},
    realm:0, hp:54, known, deck, upgrades:{}, bag:Object.fromEntries(supply.map(item => [item.id, 2])),
    equipped:{}, complete:{}, reputation:{}, attempt:0, victories:0,
    trial:{floor:0, best:0}, journal:[], active:null, sound:false,
  })));
}

export function stableHash(text) {
  let hash = 2166136261;
  for (const letter of String(text)) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function bonuses(game) {
  const total = {};
  for (const id of Object.values(game.equipped)) {
    for (const [key, value] of Object.entries(itemById[id]?.bonuses || {})) {
      if (key === 'school') {
        total.school ||= {};
        for (const [school, modifiers] of Object.entries(value)) {
          total.school[school] ||= {};
          for (const [modifier, amount] of Object.entries(modifiers)) {
            total.school[school][modifier] = (total.school[school][modifier] || 0) + amount;
          }
        }
      } else if (Number.isFinite(value)) total[key] = (total[key] || 0) + value;
    }
  }
  return total;
}

export function maxHp(game) {
  return 54 + REALMS[game.realm].hp + (bonuses(game).maxHp || 0);
}

export function readSave(storage, imported) {
  try {
    const raw = imported === undefined ? storage.getItem(SAVE_KEY) : imported;
    if (raw === null && imported === undefined) return { game:freshGame() };
    let game = migrateCultivation(JSON.parse(raw));
    if (game.economyVersion === undefined) {
      game = {...game};
      economy.initializeEconomy(game);
      initializeDecks(game);
      game.tutorial = {version:1,sanctuary:game.started?6:0,battle:game.started?4:0};
    }
    petRules.initializePets(game);
    if (!validSave(game)) throw new Error('Unsupported save');
    return { game:{difficulty:'wayfarer', ...game,audioSettings:{...DEFAULT_AUDIO_SETTINGS,...game.audioSettings}} };
  } catch {
    return { game:freshGame(), warning:'The local save could not be read. A new chronicle is ready.' };
  }
}

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const own = (object, key) => typeof key === 'string' && Object.hasOwn(object, key);
const text = (value, limit = 2000) => typeof value === 'string' && value.length <= limit;

function validSave(game) {
  if (!record(game) || game.version !== 1 || !text(game.name,24) || !count(game.seed) ||
      (game.difficulty !== undefined && !own(DIFFICULTIES,game.difficulty)) ||
      !['started','sound'].every(key => typeof game[key] === 'boolean') ||
      (game.audioSettings !== undefined && (!record(game.audioSettings) ||
        !Object.keys(DEFAULT_AUDIO_SETTINGS).every(key=>typeof game.audioSettings[key]==='number'&&Number.isFinite(game.audioSettings[key])&&game.audioSettings[key]>=0&&game.audioSettings[key]<=1))) ||
      !['realm','jade','essence','attempt','victories','hp'].every(key => count(game[key])) || !REALMS[game.realm] ||
      !['known','bag','equipped','complete','upgrades','reputation','trial'].every(key => record(game[key])) ||
      !count(game.trial.floor) || !count(game.trial.best) || game.trial.floor > game.trial.best ||
      !economy.validEconomy(game) || !validDeckState(game) || !petRules.validPets(game) ||
      Object.entries(game.upgrades).some(([id,rank])=>rank!==Math.floor(((game.cardLevels[id]||1)-1)/2)) || !record(game.tutorial) || game.tutorial.version !== 1 ||
      !count(game.tutorial.sanctuary) || game.tutorial.sanctuary > 6 || !count(game.tutorial.battle) || game.tutorial.battle > 4) return false;
  if (!Object.entries(game.known).every(([id,n]) => own(cardById,id) && count(n)) ||
      !Object.entries(game.upgrades).every(([id,n]) => own(cardById,id) && count(n) && n <= 2) ||
      !Object.entries(game.bag).every(([id,n]) => own(itemById,id) && count(n) && n > 0) ||
      !Object.entries(game.equipped).every(([slot,id]) => SLOTS.includes(slot) && own(itemById,id) &&
        (itemById[id].slot || itemById[id].type) === slot && !itemById[id].card && game.bag[id]) ||
      !Object.entries(game.complete).every(([id,entry]) => own(missionById,id) && record(entry) &&
        (missionById[id].choices?.length ? missionById[id].choices.some(choice => choice.id === entry.choice) : entry.choice === null)) ||
      !Object.entries(game.reputation).every(([id,n]) => sects.some(sect => sect.id === id) && Number.isSafeInteger(n))) return false;
  if (!Array.isArray(game.deck) || game.deck.length < MIN_DECK || game.deck.length > MAX_DECK ||
      !game.deck.every(id => own(cardById,id) && game.known[id] >= game.deck.filter(key => key === id).length) ||
      !game.hp || game.hp > maxHp(game) || !Array.isArray(game.journal) || game.journal.length > 100 ||
      !game.journal.every(entry => record(entry) && text(entry.title) && text(entry.detail))) return false;
  const active = game.active;
  if (active === null) return true;
  if (!game.started || !record(active)) return false;
  if (active.combat?.pet && (!game.pets[active.combat.pet.id] || game.activePetId !== active.combat.pet.id ||
    game.pets[active.combat.pet.id].realm !== active.combat.pet.realm || game.pets[active.combat.pet.id].essence !== active.combat.pet.essence)) return false;
  if (active.kind === 'mission') {
    if (!own(missionById,active.id) || missionStatus(game,missionById[active.id]) !== 'Available') return false;
    if (!missionById[active.id].enemy) return active.combat === null;
  } else if (active.kind === 'bounty') {
    if (!schools.some(school => school.id === active.school) || !Number.isInteger(active.tier) || active.tier < 1 || active.tier > materialTier(game) ||
      active.enemy !== bountyOffer(game,active.school,active.tier)?.enemy.id) return false;
  } else if (active.kind !== 'trial' || !count(active.floor) || active.floor !== game.trial.floor + 1 || !own(enemyById,active.enemy)) return false;
  return validBattle(active.combat, active.enemy || missionById[active.id].enemy);
}

function validBattle(combat, enemyId) {
  const fighter = entity => record(entity) && text(entity.name) && count(entity.hp) && count(entity.maxHp) &&
    entity.maxHp > 0 && entity.hp <= entity.maxHp && count(entity.block) && record(entity.statuses) &&
    Object.values(entity.statuses).every(count);
  return record(combat) && fighter(combat.player) && fighter(combat.enemy) && combat.enemy.id === enemyId &&
    validPendingArts(combat) && petRules.validPetSnapshot(combat.pet,combat.turn) &&
    count(combat.enemy.phase) && record(combat.cards) && record(combat.bonuses) && record(combat.resonance) &&
    count(combat.resonance.count) && ['rng','turn','enemyMove','energy','maxEnergy','draw'].every(key => count(combat[key])) &&
    [null,'victory','defeat'].includes(combat.outcome) && Array.isArray(combat.log) && combat.log.every(entry => text(entry)) &&
    Array.isArray(combat.phases) && combat.phases.length > combat.enemy.phase &&
    combat.phases.every(phase => record(phase) && Number.isFinite(phase.at) && Array.isArray(phase.intents) && phase.intents.length &&
      phase.intents.every(intent => record(intent) && text(intent.name) && Array.isArray(intent.effects) && intent.effects.every(record))) &&
    ['hand','drawPile','discard','exhausted'].every(key => Array.isArray(combat[key]) && combat[key].every(card =>
      record(card) && own(cardById,card.id) && count(card.upgrade) && (card.level === undefined || Number.isInteger(card.level) && card.level >= 1 && card.level <= 5) && record(combat.cards[card.id]) &&
      text(combat.cards[card.id].name) && count(combat.cards[card.id].cost) &&
      Array.isArray(combat.cards[card.id].effects) && combat.cards[card.id].effects.every(record)));
}

function validPendingArts(combat) {
  const validEffects = effects => Array.isArray(effects) && effects.length > 0 &&
    effects.every(effect => record(effect) && typeof effect.type === 'string' &&
      count(effect.amount ?? effect.value) && (effect.hits === undefined || count(effect.hits) && effect.hits > 0));
  const sourceExists = art => record(art) && own(cardById,art.source) && own(combat.cards || {},art.source) && text(art.name);
  const auras = combat.auras;
  const rituals = combat.rituals;
  return (auras === undefined || Array.isArray(auras) && auras.length <= 3 &&
    new Set(auras.map(aura => aura?.source)).size === auras.length &&
    auras.every(aura => sourceExists(aura) && count(aura.created) && count(aura.expires) &&
      aura.expires >= aura.created && ['turn-start','turn-end','on-attack','on-guard','on-status'].includes(aura.trigger) &&
      [2,3].includes(aura.duration) && validEffects(aura.effects))) &&
    (rituals === undefined || Array.isArray(rituals) && rituals.length <= 6 &&
      rituals.every(ritual => sourceExists(ritual) && count(ritual.due) && validEffects(ritual.effects)));
}

export function writeSave(storage, game) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(game));
    return true;
  } catch {
    return false;
  }
}

const fail = reason => ({ok:false, reason});
const ok = message => ({ok:true, message});

function remember(game, title, detail) {
  game.journal.unshift({title, detail});
  if (game.journal.length > 100) game.journal.pop();
}

export function begin(game, name, difficulty = 'wayfarer') {
  if (game.started) return fail('Your chronicle is already written.');
  if (!own(DIFFICULTIES,difficulty)) return fail('Choose a valid path.');
  game.name = name.trim().slice(0, 24) || 'Ash-Bearer';
  game.difficulty = difficulty;
  game.started = true;
  remember(game, 'A name in the ash', 'The Ninth Heaven fell. You woke beneath it.');
  return ok();
}

export function missionStatus(game, mission) {
  if (game.complete[mission.id]) return 'Complete';
  return (mission.requires || []).every(id => game.complete[id]) ? 'Available' : 'Sealed';
}

export function currentChapter(game) {
  return chapters.findLast(chapter => missions.some(m => m.chapter === chapter.id && missionStatus(game, m) !== 'Sealed')) || chapters[0];
}

export function encounter(game, id) {
  if (game.active) return fail('Resolve the current encounter first.');
  const mission = missionById[id];
  if (!game.started || !mission || missionStatus(game, mission) !== 'Available') return fail('This expedition is sealed.');
  if (mission.enemy) {
    const chapterIndex = chapters.findIndex(chapter => chapter.id === mission.chapter);
    const enemy = enemyById[mission.enemy];
    return startBattle(game, enemy, { kind:'mission', id }, 1 + Math.max(0,chapterIndex - 1) * .045);
  }
  game.active = { kind:'mission', id, combat:null };
  return ok();
}

/** The player's side of a battle: deck with card levels, health, bonuses and companion. */
export function battleInputs(game) {
  return {
    deck:game.deck.map(id => ({id, upgrade:Math.floor((economy.cardLevel(game,id) - 1) / 2),level:economy.cardLevel(game,id)})),
    hp:game.hp, maxHp:maxHp(game), bonuses:bonuses(game), pet:petRules.snapshotPet(game),
  };
}

function startBattle(game, enemy, context, scale = 1) {
  if (!enemy) return fail('This opponent is missing.');
  const deckReason=deckRequirement(game,game.deck,{allowLegacyCopies:true});
  if (deckReason) return fail(deckReason);
  if (game.hp <= 0) return fail('Rest at the sanctuary to recover.');
  // The player's side of the battle, kept with it so the server can replay a commission (proof of battle).
  const inputs = battleInputs(game);
  const seed = Number.isSafeInteger(context.seed) ? context.seed : stableHash([game.seed, context.id, game.attempt]);
  const combat = createCombat({cards:cardById, ...inputs, enemy:scaledEnemy(enemy, scale, game.difficulty === 'tribulation'), seed});
  game.attempt++;
  game.active = { ...context, combat, inputs, actions:[] };
  return ok();
}

export function startTrial(game) {
  if (!game.started || !game.victories) return fail('Win a campaign battle to open the pagoda.');
  if (game.active) return fail('Resolve the current encounter first.');
  const floor = game.trial.floor + 1;
  const enemy = enemies[(floor - 1) % enemies.length];
  const level = Math.min(50, Math.floor((floor - 1) / enemies.length));
  return startBattle(game, enemy, {kind:'trial', id:'floor-' + floor, floor, enemy:enemy.id}, 1 + level * .22);
}

export function bountyOffer(game,school='neutral',tier=1) {
  if (!schools.some(entry=>entry.id===school) || !Number.isInteger(tier) || tier<1 || tier>5) return null;
  const enemy=enemies[Math.min(enemies.length-1,(tier-1)*7+stableHash(school)%5)];
  const rewards=economy.bountyRewards(school,tier);
  const reason=!game.started?'Swear your oath first.':game.active?'Resolve your current encounter.':tier>materialTier(game)?`Unlock material tier ${tier} through cultivation.`:'';
  return {school,tier,enemy,rewards,scale:1+(tier-1)*.13,ok:!reason,reason};
}

export function startBounty(game,school='neutral',tier=1,ledger=null) {
  const offer=bountyOffer(game,school,tier);
  if (!offer) return fail('Choose a valid school and material tier.');
  if (!offer.ok) return fail(offer.reason);
  // On the Honest Ledger the seed comes from the server, so the battle can be replayed there before rewards are minted.
  const context={kind:'bounty',id:`bounty-${school}-${tier}`,school,tier,enemy:offer.enemy.id,...(ledger&&{seed:ledger.seed,battleId:ledger.battleId})};
  return startBattle(game,offer.enemy,context,offer.scale);
}

/** The battle a commission starts, rebuilt from its inputs (the server's proof-of-battle replay uses this). */
export function commissionCombat({school,tier,difficulty,inputs,seed}) {
  if (!schools.some(entry=>entry.id===school) || !Number.isInteger(tier) || tier<1 || tier>5) return null;
  const enemy=enemies[Math.min(enemies.length-1,(tier-1)*7+stableHash(school)%5)];
  return createCombat({cards:cardById, ...inputs, enemy:scaledEnemy(enemy, 1+(tier-1)*.13, difficulty === 'tribulation'), seed});
}

/** Replays a commission's recorded actions. A win is proven only if every action was legal and the enemy fell. */
export function replayCommission({school,tier,difficulty,inputs,seed,actions}) {
  const combat=commissionCombat({school,tier,difficulty,inputs,seed});
  if (!combat || !Array.isArray(actions) || actions.length>2000) return {ok:false,reason:'BAD_BATTLE'};
  for (const entry of actions) {
    if (!Array.isArray(entry) || combat.outcome) return {ok:false,reason:'BAD_BATTLE'};
    const [action,input]=entry;
    const item=action==='use'?itemById[input]:null;
    const result=action==='play'?playCard(combat,input):action==='end'?endTurn(combat):action==='pet'?usePetAbility(combat,input)
      :action==='use'&&['pill','talisman'].includes(item?.type)&&item.effects?.length?useConsumable(combat,item.effects,item.name):fail('Unknown battle action.');
    if (!result?.ok) return {ok:false,reason:'ILLEGAL_ACTION'};
  }
  return combat.outcome==='victory'?{ok:true,rewards:economy.bountyRewards(school,tier),hp:combat.player.hp}:{ok:false,reason:combat.outcome==='defeat'?'DEFEATED':'UNFINISHED'};
}

function scaledEnemy(enemy, scale, tribulation) {
  if (scale === 1 && !tribulation) return enemy;
  const scaleIntents = intents => intents.map(intent => ({
    ...intent,
    effects:intent.effects.map(effect => {
      if (!['damage','block','heal'].includes(effect.type)) return effect;
      const modifier = tribulation && effect.type === 'damage' ? 1.2 : 1;
      const amount = Math.round((effect.amount ?? effect.value) * scale * modifier);
      return {...effect, amount, value:amount};
    }),
  }));
  return {
    ...enemy, hp:Math.ceil(enemy.hp * scale * (tribulation ? 1.25 : 1)), intents:scaleIntents(enemy.intents),
    phases:enemy.phases?.map(phase => ({...phase, intents:scaleIntents(phase.intents)})),
    sealPhases:enemy.sealPhases || tribulation && Boolean(enemy.phases?.length),
  };
}

export function fight(game, action, input) {
  const combat = game.active?.combat;
  if (!combat || combat.outcome) return fail('There is no active battle.');
  const result = battleStep(game, combat, action, input);
  if (result.ok && Array.isArray(game.active.actions)) game.active.actions.push([action, input ?? null]); // for replay
  return result;
}

function battleStep(game, combat, action, input) {
  if (action === 'play') return playCard(combat, input);
  if (action === 'end') return endTurn(combat);
  if (action === 'pet') return usePetAbility(combat,input);
  if (action === 'use') {
    const item = itemById[input];
    if (!game.bag[input] || !['pill','talisman'].includes(item?.type) || !item.effects?.length) {
      return fail('This item is unavailable in battle.');
    }
    const result = useConsumable(combat, item.effects, item.name);
    if (result.ok) takeItem(game, input, 1);
    return result;
  }
  return fail('Unknown battle action.');
}

function takeItem(game, id, amount) {
  const left = game.bag[id] - amount;
  if (left > 0) game.bag[id] = left;
  else delete game.bag[id];
}

function gainItem(game, id, count = 1) {
  if (itemById[id]) game.bag[id] = (game.bag[id] || 0) + count;
}

function gainRewards(game, reward = {}) {
  game.jade += reward.gold || 0;
  game.essence += reward.essence || 0;
  for (const id of reward.items || []) gainItem(game, id);
  for (const id of reward.cards || []) if (cardById[id]) game.known[id] = (game.known[id] || 0) + 1;
  for (const [id,n] of Object.entries(reward.materials || {})) if (economy.materialById[id]) game.materials[id]=(game.materials[id]||0)+n;
}

export function resolveEncounter(game, choiceId) {
  const active = game.active;
  if (!active || (active.combat && !active.combat.outcome)) return fail('The encounter is still in progress.');
  if (active.combat?.outcome === 'defeat') {
    game.jade -= Math.min(game.jade, 5);
    game.hp = maxHp(game);
    if (active.kind === 'trial') game.trial.floor = 0;
    remember(game, 'Returned through ash', 'The sanctuary reclaimed your spirit after defeat.');
    game.active = null;
    return ok('Recovered at the sanctuary. The encounter can be attempted again.');
  }
  if (active.kind === 'trial') {
    game.hp = active.combat.player.hp;
    game.victories++;
    game.trial.floor = active.floor;
    const firstClear = active.floor > game.trial.best;
    game.trial.best = Math.max(game.trial.best, active.floor);
    if (firstClear) gainRewards(game, { gold:8 + Math.min(active.floor, 25), essence:6 + Math.min(active.floor, 18) });
    remember(game, 'Pagoda floor ' + active.floor, active.combat.enemy.name + ' fell.');
    game.active = null;
    return ok(firstClear ? 'A new floor record. Jade and essence earned.' : 'Floor cleared.');
  }
  if (active.kind === 'bounty') {
    game.hp=active.combat.player.hp;
    game.victories++;
    gainRewards(game,economy.bountyRewards(active.school,active.tier));
    remember(game,'Material commission',`${schoolById[active.school].name} · tier ${active.tier}. Guaranteed materials and cultivation essence claimed.`);
    game.active=null;
    return ok('Commission complete. Materials, jade and cultivation essence earned.');
  }
  const mission = missionById[active.id];
  const choice = mission.choices?.find(entry => entry.id === choiceId);
  if (mission.choices?.length && !choice) return fail('Choose how to conclude the expedition.');
  if (active.combat) {
    game.hp = active.combat.player.hp;
    game.victories++;
  }
  gainRewards(game, mission.rewards);
  if (choice) {
    gainRewards(game, choice.rewards);
    if (choice.faction) game.reputation[choice.faction] = (game.reputation[choice.faction] || 0) + (choice.reputation || 0);
  }
  game.complete[mission.id] = { choice:choice?.id || null };
  remember(game, mission.name, choice?.epilogue || choice?.text || mission.victory || mission.description);
  game.active = null;
  return {...ok('Expedition complete. Rewards inscribed.'), ...(choice?.epilogue && {epilogue:choice.epilogue, ending:choice.label})};
}

export function retreat(game) {
  if (!game.active) return fail('You are already at the sanctuary.');
  if (game.active.combat?.outcome) return fail('Resolve the outcome first.');
  if (game.active.combat) game.hp = game.active.combat.player.hp;
  if (game.active.kind === 'trial') game.trial.floor = 0;
  game.active = null;
  return ok('Returned to the sanctuary.');
}

export function rest(game) {
  if (game.active) return fail('Rest is unavailable during an expedition.');
  if (game.hp >= maxHp(game)) return fail('Your vitality is already full.');
  game.hp = maxHp(game);
  return ok('Vitality restored at the sanctuary.');
}

export function breakthrough(game) {
  const result=advanceCultivation(game);
  if (!result.ok) return result;
  game.hp = maxHp(game);
  remember(game, 'Breakthrough', result.message);
  return result;
}

export function changeDeck(game, id, delta) {
  if (game.active) return fail('The deck is sealed during an expedition.');
  const count = game.deck.filter(entry => entry === id).length;
  if (delta === 1 && count < (game.known[id] || 0) && game.deck.length < MAX_DECK) {
    game.deck.push(id);
    syncActiveDeck(game);
    return ok();
  }
  if (delta === -1 && count && game.deck.length > MIN_DECK) {
    game.deck.splice(game.deck.indexOf(id), 1);
    syncActiveDeck(game);
    return ok();
  }
  return fail('The deck must hold ' + MIN_DECK + '–' + MAX_DECK + ' learned techniques.');
}

export function refine(game, id) {
  return economy.upgradeCard(game,id);
}

export function learnCost(card) {
  return economy.cardPrice(card);
}

export function learningRequirement(game, card) {
  return economy.quoteBuyCard(game,card?.id).reason;
}

export function learn(game, id) {
  return economy.buyCard(game,id);
}

export function equip(game, id) {
  const item = itemById[id];
  const slot = item?.slot || item?.type;
  if (game.active || !game.bag[id] || item?.card || !SLOTS.includes(slot)) return fail('This item cannot be equipped.');
  const before = maxHp(game);
  if (game.equipped[slot] === id) delete game.equipped[slot];
  else game.equipped[slot] = id;
  const after = maxHp(game);
  game.hp = Math.max(1, Math.min(after, game.hp + Math.max(0, after - before)));
  return ok(game.equipped[slot] === id ? 'Equipped ' + item.name + '.' : 'Returned to inventory.');
}

export function study(game, id) {
  const item = itemById[id];
  if (game.active || !game.bag[id] || !own(cardById,item?.card)) return fail('This manual cannot be studied.');
  takeItem(game,id,1);
  gainRewards(game,{cards:[item.card]});
  return ok('Learned ' + cardById[item.card].name + '.');
}

export function market(game) {
  const key = Object.keys(game.complete).length + game.realm;
  const groups = ['weapon','armor','accessory','relic','pill','talisman','material','manual'];
  return groups.flatMap(type => {
    const stock = items.filter(item => item.type === type)
      .sort((a,b) => stableHash(key + ':' + a.id) - stableHash(key + ':' + b.id));
    return stock.slice(0, 3);
  });
}

export function catalogue(game) {
  const chapter = chapters.indexOf(currentChapter(game));
  const ranks = {common:0,uncommon:1,rare:2,legendary:4};
  return items.filter(item => (ranks[item.rarity] ?? 0) <= chapter);
}

export function price(item, game) {
  if (item.card && cardById[item.card]) return economy.cardPrice(cardById[item.card]);
  const faction = sects.find(sect => sect.school === item.school);
  const standing = game?.reputation[faction?.id] || 0;
  const discount = Math.min(15, Math.max(0, Math.floor(standing / 2) * 5));
  return Math.max(1, Math.round((item.value || 10) * (1 - discount / 100)));
}

export function trade(game, id, action) {
  const item = itemById[id];
  if (game.active || !item) return fail('The exchange is unavailable.');
  if (item.card && ['buy','order'].includes(action)) {
    const required=economy.cardRequirement(item.card);
    if (cultivationLevel(game)<required.level) return fail(`Reach cultivation level ${required.level} to purchase this manual.`);
    if ((game.known[item.card]||0)+(game.bag[id]||0)>=4) return fail('Four copies are already owned or held in manuals.');
  }
  const amount = price(item, game);
  const listed = action === 'order' ? catalogue(game) : market(game);
  if (['buy','order'].includes(action) && game.jade >= amount && listed.some(entry => entry.id === id)) {
    game.jade -= amount;
    gainItem(game, id);
    return ok('Acquired ' + item.name + '.');
  }
  if (action === 'sell' && game.bag[id] > Number(Object.values(game.equipped).includes(id))) {
    game.jade += Math.max(1, Math.floor(price(item) / 2));
    takeItem(game, id, 1);
    return ok('Sold ' + item.name + '.');
  }
  return fail(action === 'sell' ? 'Keep one copy of each equipped item.' : 'This purchase requires more jade or current stock.');
}

export function craft(game, id) {
  const recipe = recipes.find(entry => entry.item === id);
  if (game.active || !recipe || game.jade < recipe.gold ||
      !Object.entries(recipe.materials).every(([material, quantity]) => game.bag[material] >= quantity)) {
    return fail('The forge requires the listed materials and jade.');
  }
  game.jade -= recipe.gold;
  for (const [material, quantity] of Object.entries(recipe.materials)) takeItem(game, material, quantity);
  gainItem(game, id);
  return ok('Forged ' + itemById[id].name + '.');
}
