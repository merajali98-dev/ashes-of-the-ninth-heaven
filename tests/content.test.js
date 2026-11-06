import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { cards, chapters, characters, enemies, items, missions, recipes, schools, sects, starterDeck } from '../js/content.js';
import { STATUS_INFO, RESONANCE_INFO } from '../js/combat.js';
import { cardArt, enemyArt, portraits, regions } from '../js/art.js';
import { itemArt, itemIcon, illustratedItems } from '../js/item-art.js';
import {spiritPets,PET_MAP_ART} from '../js/pets.js';
import { catalogue, freshGame, learnCost, learningRequirement, cardRequirement, forgeRecipe, bountyRewards, REALMS, materials } from '../js/progression.js';

const ids = entries => new Set(entries.map(entry => entry.id));
const cardIds = ids(cards);
const chapterIds = ids(chapters);
const enemyIds = ids(enemies);
const factionIds = ids(sects);
const itemById = new Map(items.map(item => [item.id, item]));
const missionIds = ids(missions);
const schoolIds = ids(schools);
const rarities = new Set(['common', 'uncommon', 'rare', 'legendary']);
const itemTypes = new Set(['weapon', 'armor', 'accessory', 'relic', 'pill', 'talisman', 'manual', 'material']);
const slots = new Set(['weapon', 'armor', 'accessory', 'relic']);
const effectTypes = new Set(['damage', 'block', 'heal', 'draw', 'energy', 'cleanse', 'status','recover','dispel']);
const isPositive = n => Number.isSafeInteger(n) && n > 0;

function assertEffects(effects, label) {
  assert.ok(Array.isArray(effects) && effects.length, label);
  for (const effect of effects) {
    assert.ok(effectTypes.has(effect.type), `${label} has an unknown effect`);
    assert.ok(isPositive(effect.amount), `${label} has an invalid effect amount`);
    assert.ok(effect.target === undefined || ['self', 'opponent'].includes(effect.target), label);
    if (effect.type === 'status') assert.ok(Object.hasOwn(STATUS_INFO, effect.status), label);
    if (effect.hits !== undefined) assert.ok(effect.type === 'damage' && isPositive(effect.hits), label);
  }
}

test('authored content uses unique stable identifiers and supported schools', () => {
  const collections = { cards, chapters, characters, enemies, items, missions, schools, sects };
  for (const [name, entries] of Object.entries(collections)) {
    assert.equal(ids(entries).size, entries.length, `Duplicate ${name} ID`);
    for (const entry of entries) {
      assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      assert.ok(entry.name.trim(), entry.id);
      if (entry.school) assert.ok(schoolIds.has(entry.school), entry.id);
    }
  }
  for (const character of characters) {
    assert.ok(character.sect === null || factionIds.has(character.sect), character.id);
    assert.ok(character.description && character.quote, character.id);
  }
  for (const school of schools.filter(school => school.id !== 'neutral')) {
    assert.ok(Object.hasOwn(RESONANCE_INFO, school.id), school.id);
    assert.ok(cards.some(card => card.school === school.id), school.id);
  }
});

test('every expedition is reachable and references valid encounters and rewards', () => {
  const available = new Set();
  const usedEnemies = new Set();
  function assertReward(reward, label) {
    assert.ok(Number.isSafeInteger(reward.gold) && reward.gold >= 0, label);
    assert.ok(Number.isSafeInteger(reward.essence) && reward.essence >= 0, label);
    for (const id of reward.cards) assert.ok(cardIds.has(id), `${label} rewards unknown card ${id}`);
    for (const id of reward.items) assert.ok(itemById.has(id), `${label} rewards unknown item ${id}`);
  }
  for (const mission of missions) {
    assert.ok(chapterIds.has(mission.chapter), mission.id);
    assert.ok(mission.story && mission.victory && mission.description && mission.location, mission.id);
    for (const id of mission.requires) assert.ok(missionIds.has(id), `${mission.id} requires unknown mission ${id}`);
    if (mission.enemy) {
      assert.ok(enemyIds.has(mission.enemy), mission.id);
      usedEnemies.add(mission.enemy);
    }
    assertReward(mission.rewards, mission.id);
    const choices = mission.choices ?? [];
    assert.equal(ids(choices).size, choices.length, `Duplicate choices in ${mission.id}`);
    for (const choice of choices) {
      assert.ok(choice.text && choice.label && factionIds.has(choice.faction), choice.id);
      assert.ok(isPositive(choice.reputation), choice.id);
      assertReward(choice.rewards, choice.id);
    }
  }
  assert.deepEqual(usedEnemies, enemyIds);
  for (const chapter of chapters) {
    const pending = missions.filter(mission => mission.chapter === chapter.id);
    assert.ok(pending.length > 0, chapter.id);
    while (pending.length) {
      const index = pending.findIndex(mission => mission.requires.every(id => available.has(id)));
      assert.notEqual(index, -1, `Unreachable or circular prerequisite in ${chapter.id}`);
      available.add(pending.splice(index, 1)[0].id);
    }
  }
  assert.equal(available.size, missions.length);
  const endings = missions.find(mission => mission.enemy === 'ninth-heaven').choices;
  assert.equal(new Set(endings.map(choice => choice.epilogue)).size, endings.length);
  assert.ok(endings.every(choice => choice.epilogue && choice.epilogue !== choice.text));
});

test('all techniques, consumables and enemy phases use valid battle effects', () => {
  for (const card of cards) {
    assert.ok(['attack', 'skill'].includes(card.kind), card.id);
    assert.ok(Number.isInteger(card.cost) && card.cost >= 0 && card.cost <= 3, card.id);
    assert.ok(rarities.has(card.rarity) && card.description && card.flavor, card.id);
    assertEffects(card.effects, card.id);
  }
  for (const enemy of enemies) {
    assert.ok(isPositive(enemy.hp), enemy.id);
    let priorThreshold = 1;
    for (const phase of enemy.phases ?? []) {
      assert.ok(phase.at > 0 && phase.at < priorThreshold && phase.name, enemy.id);
      assert.ok(phase.intents.length > 0, enemy.id);
      priorThreshold = phase.at;
    }
    assert.ok(enemy.intents.length > 0, enemy.id);
    for (const intent of [enemy.intents, ...(enemy.phases ?? []).map(phase => phase.intents)].flat()) {
      assert.ok(intent.name, enemy.id);
      assertEffects(intent.effects, `${enemy.id}/${intent.name}`);
    }
  }
  for (const item of items) {
    assert.ok(itemTypes.has(item.type) && rarities.has(item.rarity) && isPositive(item.value), item.id);
    assert.ok(item.description.trim(), item.id);
    if (slots.has(item.type)) {
      assert.equal(item.slot, item.type);
      assert.ok(Object.keys(item.bonuses).length > 0, item.id);
      for (const [key, value] of Object.entries(item.bonuses)) {
        if (key === 'school') {
          for (const [school, modifiers] of Object.entries(value)) {
            assert.ok(schoolIds.has(school), item.id);
            for (const [modifier, amount] of Object.entries(modifiers)) {
              assert.ok(['damage', 'block', 'status'].includes(modifier) && isPositive(amount), item.id);
            }
          }
        } else {
          assert.ok(['maxHp', 'energy', 'block', 'strength', 'focus', 'draw', 'heal', 'ward', 'regen'].includes(key));
          assert.ok(isPositive(value), item.id);
        }
      }
    }
    if (['pill', 'talisman'].includes(item.type)) assertEffects(item.effects, item.id);
    if (item.type === 'manual') assert.ok(cardIds.has(item.card), item.id);
  }
});

test('all techniques have finite gated acquisition and targeted repeatable material sources', () => {
  const game = freshGame(3);
  game.started = true;
  game.realm = 6;
  game.essence = REALMS[7].essence - 1;
  game.jade = 1_000_000;
  for (const mission of missions) game.complete[mission.id] = { choice: mission.choices?.[0].id ?? null };
  const stockedItems = catalogue(game);
  assert.equal(stockedItems.length, items.length);
  for (const card of cards) {
    assert.equal(learningRequirement({...game,known:{}},card),'',card.id);
    assert.ok(cardRequirement(card).level<=63,card.id);
    assert.ok(Number.isSafeInteger(learnCost(card))&&learnCost(card)>0,card.id);
    const recipe=forgeRecipe(card);
    const rewards=bountyRewards(card.school,recipe.tier);
    for(const [id,quantity] of Object.entries(recipe.materials)) {
      assert.ok(rewards.materials[id]>0,`${card.id} has no targeted source for ${id}`);
      assert.ok(Number.isFinite(Math.ceil(quantity/rewards.materials[id])),card.id);
    }
  }
});

test('every forge recipe resolves and every material has a recipe', () => {
  const usedMaterials = new Set();
  assert.equal(new Set(recipes.map(recipe => recipe.item)).size, recipes.length);
  for (const recipe of recipes) {
    const output = itemById.get(recipe.item);
    assert.ok(output && output.type !== 'material', recipe.item);
    assert.ok(isPositive(recipe.gold), recipe.item);
    assert.ok(Object.keys(recipe.materials).length > 0, recipe.item);
    for (const [material, quantity] of Object.entries(recipe.materials)) {
      assert.equal(itemById.get(material)?.type, 'material', `${recipe.item} requires ${material}`);
      assert.ok(isPositive(quantity), material);
      usedMaterials.add(material);
    }
  }
  assert.deepEqual(usedMaterials, ids(items.filter(item => item.type === 'material')));
});

test('art paths used by all playable content resolve to bundled assets', () => {
  const petArt=[PET_MAP_ART,...spiritPets.flatMap(pet=>[pet.eggArt,pet.youngArt,pet.adultArt,pet.ascendedArt])];
  assert.equal(new Set(petArt).size,33,'The habitat and every pet state use distinct art');
  assert.equal(new Set(cards.map(cardArt)).size, cards.length, 'Every technique has distinct art');
  assert.equal(new Set(items.map(itemArt)).size, items.length, 'Every item has a distinct icon');
  assert.equal(new Set(items.map(itemIcon)).size, items.length, 'Every inventory icon is distinct');
  assert.equal(materials.length,45);
  assert.equal(REALMS.length,10);
  assert.equal(new Set([...materials.map(material=>material.art),...REALMS.slice(1).map(realm=>realm.avatar)]).size,54,
    'All 45 materials and nine new realm portraits have distinct art');
  const artPaths = new Set([
    ...petArt,
    ...cards.map(cardArt),
    ...items.map(itemArt),
    ...items.map(itemIcon),
    ...materials.map(material=>material.art),
    ...REALMS.map(realm=>realm.avatar),
    ...characters.map(character => `assets/art/portrait-${character.id}.webp`),
    ...enemies.map(enemy => `assets/art/portrait-${enemyArt[enemy.id]}.webp`),
    ...chapters.map(chapter => `assets/art/${regions[chapter.id]}.webp`),
    ...sects.map(sect => `assets/art/sect-${sect.id}.webp`),
  ]);
  assert.deepEqual(portraits, ids(characters));
  for (const id of illustratedItems) assert.ok(itemById.has(id), id);
  for (const path of artPaths) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
});
