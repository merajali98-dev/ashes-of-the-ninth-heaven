import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import { getCard, getIntent, useConsumable } from '../js/combat.js';

function ready(seed = 42) {
  const game = rules.freshGame(seed);
  assert.equal(rules.begin(game, '  Lin  ').ok, true);
  assert.equal(game.name, 'Lin');
  return game;
}

const firstMission = 'blank-writ';
const choiceMission = 'three-tea-cups';

function memoryStorage() {
  const contents = new Map();
  return {
    getItem: key => contents.get(key) ?? null,
    setItem: (key, value) => contents.set(key, value),
  };
}

function finishBattle(game) {
  const combat = game.active.combat;
  if (!combat) return;
  for (let i = 0; i <= combat.phases.length && !combat.outcome; i++) {
    const result = useConsumable(combat, [{type:'block', amount:100000}, {type:'damage', amount:100000}], 'QA strike');
    assert.equal(result.ok, true);
    if (!combat.outcome) assert.equal(rules.fight(game,'end').ok, true);
  }
  assert.equal(combat.outcome, 'victory');
}

function completeMission(game, id, choice) {
  assert.equal(rules.encounter(game, id).ok, true, id);
  finishBattle(game);
  assert.equal(rules.resolveEncounter(game, choice).ok, true, id);
}

test('new chronicle, save failures and malformed saves have safe outcomes', () => {
  const store = memoryStorage();
  assert.equal(rules.readSave(store).game.started, false);
  assert.equal(rules.writeSave(store, ready()), true);
  const { game } = rules.readSave(store);
  assert.equal(game.started, true);
  assert.ok(rules.readSave(store,'').warning);
  assert.equal(rules.readSave(store).game.name,'Lin');
  assert.equal(game.name, 'Lin');
  assert.equal(rules.begin(game, 'New name').ok, false);
  store.setItem(rules.SAVE_KEY, '{broken');
  const invalid = rules.readSave(store);
  assert.equal(invalid.game.started, false);
  assert.ok(invalid.warning);
  assert.equal(rules.writeSave({ setItem() { throw new Error('quota'); } }, game), false);
});

test('a save with a nonexistent active expedition is rejected safely', () => {
  const store = memoryStorage();
  const game = ready();
  game.active = { kind: 'mission', id: 'nonexistent-encounter', combat: null };
  assert.equal(rules.writeSave(store, game), true);
  const loaded = rules.readSave(store);
  assert.ok(loaded.warning);
  assert.equal(loaded.game.active, null);
});

test('saving in a battle restores play, intent, supplies and RNG state', () => {
  const original = ready(493);
  assert.equal(rules.encounter(original, firstMission).ok, true);
  assert.equal(rules.fight(original, 'end').ok, true);
  const store = memoryStorage();
  assert.equal(rules.writeSave(store, original), true);
  const loaded = rules.readSave(store).game;
  assert.equal(loaded.active.id, firstMission);
  assert.deepEqual(loaded.bag, original.bag);
  assert.equal(getIntent(loaded.active.combat).name, getIntent(original.active.combat).name);
  for (const game of [original, loaded]) {
    assert.equal(rules.fight(game, 'play', 0).ok, true);
    assert.equal(rules.fight(game, 'end').ok, true);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(original)), loaded);
});

test('battle dispatch charges supplies, handles defeat, and permits a retry', () => {
  const game = ready();
  const supplies = Object.keys(game.bag).filter(id => rules.itemById[id]?.effects?.length);
  assert.ok(supplies.length > 0);
  const item = supplies[0];
  const stock = game.bag[item];
  const initialJade = game.jade;
  assert.equal(rules.fight(game, 'end').ok, false);
  assert.equal(rules.encounter(game, firstMission).ok, true);
  assert.equal(rules.encounter(game, firstMission).ok, false);
  assert.equal(rules.resolveEncounter(game).ok, false);
  assert.equal(rules.fight(game, 'use', 'missing').ok, false);
  assert.equal(rules.fight(game, 'use', item).ok, true);
  assert.equal(game.bag[item], stock - 1);
  for (let turn = 0; turn < 25 && !game.active.combat.outcome; turn++) {
    assert.equal(rules.fight(game, 'end').ok, true);
  }
  assert.equal(game.active.combat.outcome, 'defeat');
  assert.equal(rules.fight(game, 'end').ok, false);
  assert.equal(rules.resolveEncounter(game).ok, true);
  assert.equal(game.hp, rules.maxHp(game));
  assert.equal(game.jade, initialJade - 5);
  assert.equal(rules.missionStatus(game, rules.missionById[firstMission]), 'Available');
  assert.equal(rules.encounter(game, firstMission).ok, true);
  assert.equal(rules.retreat(game).ok, true);
  assert.equal(game.active, null);
});

test('teacher choices unlock different cards and record reputation exactly once', () => {
  const mission = rules.missionById[choiceMission];
  const recorded = [];
  for (const choice of mission.choices) {
    const game = ready();
    assert.equal(rules.missionStatus(game, mission), 'Sealed');
    assert.equal(rules.encounter(game, choiceMission).ok, false);
    completeMission(game, firstMission);
    assert.equal(rules.missionStatus(game, mission), 'Available');
    assert.equal(rules.encounter(game, choiceMission).ok, true);
    assert.equal(rules.resolveEncounter(game, 'wrong-choice').ok, false);
    assert.equal(rules.resolveEncounter(game, choice.id).ok, true);
    assert.equal(game.complete[choiceMission].choice, choice.id);
    assert.equal(game.reputation[choice.faction], choice.reputation);
    assert.ok(choice.rewards.cards.every(id => game.known[id] === 1));
    assert.ok(game.journal.some(entry => entry.detail === choice.text));
    assert.equal(rules.resolveEncounter(game, choice.id).ok, false);
    assert.equal(rules.encounter(game, choiceMission).ok, false);
    recorded.push(Object.keys(game.known).sort().join(','));
  }
  assert.equal(new Set(recorded).size, mission.choices.length);
});

test('campaign dependencies resolve through every chapter without orphaned missions', () => {
  const game = ready();
  assert.equal(rules.currentChapter(game).id, rules.chapters[0].id);
  for (const chapter of rules.chapters) {
    const chapterMissions = rules.missions.filter(mission => mission.chapter === chapter.id);
    assert.ok(chapterMissions.length > 0);
    assert.equal(rules.currentChapter(game).id, chapter.id);
    for (let count = 0; count < chapterMissions.length; count++) {
      const next = chapterMissions.find(mission => rules.missionStatus(game, mission) === 'Available');
      assert.ok(next, `No available mission in ${chapter.id} at position ${count}`);
      completeMission(game, next.id, next.choices?.[0]?.id);
    }
    assert.ok(chapterMissions.every(mission => rules.missionStatus(game, mission) === 'Complete'));
  }
  assert.equal(Object.keys(game.complete).length, rules.missions.length);
  assert.equal(game.victories, rules.missions.filter(mission => mission.enemy).length);
});

test('market trades update jade and stock, including equipped item protection', () => {
  const game = ready();
  game.jade = 1000;
  const stock = rules.market(game);
  assert.deepEqual(stock.map(item => item.id), rules.market(game).map(item => item.id));
  const gear = stock.find(item => rules.SLOTS.includes(item.slot ?? item.type) && item.bonuses);
  assert.ok(gear);
  const price = rules.price(gear);
  assert.equal(rules.trade(game, gear.id, 'buy').ok, true);
  assert.equal(game.jade, 1000 - price);
  assert.equal(game.bag[gear.id], 1);
  assert.equal(rules.equip(game, gear.id).ok, true);
  assert.equal(rules.trade(game, gear.id, 'sell').ok, false);
  assert.equal(rules.equip(game, gear.id).ok, true);
  assert.equal(rules.trade(game, gear.id, 'sell').ok, true);
  assert.equal(game.jade, 1000 - price + Math.max(1, Math.floor(price / 2)));
  assert.equal(game.bag[gear.id], undefined);
  const unlisted = rules.items.find(item => !stock.includes(item));
  assert.equal(rules.trade(game, unlisted.id, 'buy').ok, false);
});

test('forging atomically checks and spends the recipe inputs', () => {
  const game = ready();
  const recipe = rules.recipes[0];
  assert.ok(recipe);
  assert.ok(rules.itemById[recipe.item]);
  game.jade = recipe.gold - 1;
  game.bag = { ...recipe.materials };
  const before = structuredClone(game);
  assert.equal(rules.craft(game, recipe.item).ok, false);
  assert.deepEqual(game, before);
  game.jade++;
  assert.equal(rules.craft(game, recipe.item).ok, true);
  assert.equal(game.jade, 0);
  assert.equal(game.bag[recipe.item], 1);
  for (const id of Object.keys(recipe.materials)) assert.equal(game.bag[id], undefined);
  assert.equal(rules.craft(game, recipe.item).ok, false);
});

test('equipment and realms apply to the next battle; sanctuary restores vitality', () => {
  const game = ready();
  const gear = rules.items.find(item => item.bonuses?.maxHp > 0 && rules.SLOTS.includes(item.slot ?? item.type));
  assert.ok(gear);
  const initialHp = rules.maxHp(game);
  game.bag[gear.id] = 1;
  assert.equal(rules.equip(game, gear.id).ok, true);
  assert.equal(rules.maxHp(game), initialHp + gear.bonuses.maxHp);
  assert.equal(game.hp, rules.maxHp(game));
  assert.equal(rules.breakthrough(game).ok, false);
  game.essence = rules.REALMS[1].essence;
  game.jade = rules.REALMS[1].jade;
  assert.equal(rules.breakthrough(game).ok, true);
  assert.equal(game.jade, 0);
  assert.equal(rules.maxHp(game), initialHp + gear.bonuses.maxHp + rules.REALMS[1].hp);
  assert.equal(rules.encounter(game, firstMission).ok, true);
  assert.equal(game.active.combat.player.maxHp, rules.maxHp(game));
  assert.equal(rules.equip(game, gear.id).ok, false);
  assert.equal(rules.rest(game).ok, false);
  rules.fight(game, 'end');
  rules.retreat(game);
  assert.equal(rules.rest(game).ok, true);
  assert.equal(game.hp, rules.maxHp(game));
});

test('every equippable item applies the advertised encounter bonuses', () => {
  for (const item of rules.items.filter(item => item.bonuses)) {
    const game = ready();
    game.bag[item.id] = 1;
    const bonuses = item.bonuses;
    const school = Object.keys(bonuses.school ?? {})[0];
    if (school) {
      const modifiers = bonuses.school[school];
      const matching = rules.cards.find(card => card.school === school &&
        card.effects.some(effect => Object.hasOwn(modifiers, effect.type)));
      assert.ok(matching, item.id);
      game.known[matching.id] = (game.known[matching.id] ?? 0) + 1;
      assert.equal(rules.changeDeck(game, matching.id, 1).ok, true, item.id);
    }
    assert.equal(rules.equip(game, item.id).ok, true, item.id);
    assert.deepEqual(rules.bonuses(game), bonuses, item.id);
    assert.equal(rules.encounter(game, firstMission).ok, true, item.id);
    const state = game.active.combat;
    assert.equal(state.player.maxHp, 54 + (bonuses.maxHp ?? 0), item.id);
    assert.equal(state.player.block, bonuses.block ?? 0, item.id);
    assert.equal(state.energy, 3 + (bonuses.energy ?? 0), item.id);
    assert.equal(state.hand.length, 5 + (bonuses.draw ?? 0), item.id);
    for (const id of ['strength', 'focus', 'ward', 'regen']) {
      assert.equal(state.player.statuses[id] ?? 0, bonuses[id] ?? 0, item.id);
    }
    if (school) {
      const matching = [...state.hand, ...state.drawPile].find(entry => state.cards[entry.id].school === school);
      assert.ok(matching, item.id);
      const card = getCard({ ...state, hand: [matching] }, 0);
      const original = rules.cardById[matching.id];
      for (let index = 0; index < card.effects.length; index++) {
        const effect = original.effects[index];
        assert.equal(card.effects[index].amount, effect.amount + (bonuses.school[school][effect.type] ?? 0), item.id);
      }
    }
  }
});

test('deck limits, manual study and mastery preserve owned counts and update combat', () => {
  const game = ready();
  const manual = rules.items.find(item => item.type === 'manual' && item.card && !game.known[item.card]);
  assert.ok(manual);
  assert.equal(rules.changeDeck(game, manual.card, 1).ok, false);
  game.bag[manual.id] = 1;
  assert.equal(rules.study(game, manual.id).ok, true);
  assert.equal(game.known[manual.card], 1);
  assert.equal(game.bag[manual.id], undefined);
  assert.equal(rules.study(game, manual.id).ok, false);
  assert.equal(rules.changeDeck(game, manual.card, 1).ok, true);
  assert.equal(rules.changeDeck(game, manual.card, 1).ok, false);
  game.jade = 100000;
  game.realm = 9;game.essence = 6500;
  for(let level=2;level<=5;level++) {
    const recipe=rules.upgradeRecipe(manual.card,level);
    for(const [id,count] of Object.entries(recipe.materials)) game.materials[id]=(game.materials[id]||0)+count;
    assert.equal(rules.refine(game, manual.card).ok, true);
    assert.equal(game.cardLevels[manual.card],level);
  }
  assert.equal(rules.refine(game, manual.card).ok, false);
  assert.equal(game.upgrades[manual.card], 2);
  const removed = game.deck.find(id => id !== manual.card);
  while (game.deck.length > rules.MIN_DECK) assert.equal(rules.changeDeck(game, removed, -1).ok, true);
  assert.equal(rules.changeDeck(game, manual.card, -1).ok, false);
  assert.equal(rules.encounter(game, firstMission).ok, true);
  const combat = game.active.combat;
  const piles = [...combat.hand, ...combat.drawPile];
  assert.equal(piles.find(entry => entry.id === manual.card).upgrade, 2);
  assert.equal(piles.find(entry => entry.id === manual.card).level, 5);
  assert.equal(rules.changeDeck(game, manual.card, -1).ok, false);
  while (!combat.hand.some(card => card.id === manual.card)) assert.equal(rules.fight(game, 'end').ok, true);
  const upgraded = getCard(combat, combat.hand.findIndex(card => card.id === manual.card));
  assert.equal(upgraded.upgrade, 2);
});

test('pagoda gates entry, tracks highest clear, and scales later encounters', () => {
  const game = ready();
  assert.equal(rules.startTrial(game).ok, false);
  completeMission(game, firstMission);
  assert.equal(rules.startTrial(game).ok, true);
  assert.equal(game.active.floor, 1);
  assert.equal(game.active.combat.enemy.id, rules.enemies[0].id);
  const jade = game.jade;
  finishBattle(game);
  assert.equal(rules.resolveEncounter(game).ok, true);
  assert.deepEqual(game.trial, { floor: 1, best: 1 });
  assert.ok(game.jade > jade);
  assert.equal(rules.startTrial(game).ok, true);
  assert.equal(game.active.floor, 2);
  assert.equal(rules.retreat(game).ok, true);
  assert.deepEqual(game.trial, { floor: 0, best: 1 });
  assert.equal(rules.startTrial(game).ok, true);
  finishBattle(game);
  const retryJade = game.jade;
  assert.equal(rules.resolveEncounter(game).ok, true);
  assert.equal(game.jade, retryJade);
  game.trial.floor = rules.enemies.length;
  assert.equal(rules.startTrial(game).ok, true);
  assert.equal(game.active.combat.enemy.id, rules.enemies[0].id);
  assert.ok(game.active.combat.enemy.maxHp > rules.enemies[0].hp);
});
