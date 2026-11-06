import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import { createCombat, endTurn, getCard, getIntent, playCard, previewEndTurn } from '../js/combat.js';
import { cardDetails } from '../js/views.js';

test('sect standing discounts purchases without reducing sale proceeds', () => {
  const game = rules.freshGame(123);
  rules.begin(game, 'Tester');
  game.reputation['iron-court'] = 4;
  game.jade = 500;
  const item = rules.catalogue(game).find(candidate => candidate.school === 'iron');
  assert.ok(item);
  const base = rules.price(item);
  const discounted = rules.price(item, game);
  assert.equal(discounted, Math.round(base * 0.9));
  const starting = game.jade;
  assert.equal(rules.trade(game, item.id, 'order').ok, true);
  assert.equal(game.jade, starting - discounted);
  assert.equal(rules.trade(game, item.id, 'sell').ok, true);
  assert.equal(game.jade, starting - discounted + Math.floor(base / 2));
});

test('Tribulation scales health and attacks and survives a battle save', () => {
  const standard = rules.freshGame(89);
  const hard = rules.freshGame(89);
  rules.begin(standard, 'Tester');
  rules.begin(hard, 'Tester', 'tribulation');
  rules.encounter(standard, 'blank-writ');
  rules.encounter(hard, 'blank-writ');
  assert.equal(hard.active.combat.enemy.maxHp, Math.ceil(standard.active.combat.enemy.maxHp * 1.25));
  const standardAttack = getIntent(standard.active.combat).effects.find(effect => effect.type === 'damage');
  const hardAttack = getIntent(hard.active.combat).effects.find(effect => effect.type === 'damage');
  assert.equal(hardAttack.amount, Math.round(standardAttack.amount * 1.2));
  const restore = rules.readSave({ getItem:() => JSON.stringify(hard) });
  assert.equal(restore.warning, undefined);
  assert.equal(restore.game.difficulty, 'tribulation');
  assert.deepEqual(restore.game.active, hard.active);
  assert.deepEqual(previewEndTurn(restore.game.active.combat), previewEndTurn(hard.active.combat));
});

test('refinement details match the card played in combat', () => {
  const game = rules.freshGame(567);
  rules.begin(game, 'Tester');
  const cardId = 'palm-strike';
  game.realm=1;game.essence=rules.REALMS[1].essence;
  const recipe=rules.upgradeRecipe(cardId,2);
  game.materials={...recipe.materials};
  assert.equal(rules.refine(game, cardId).ok, true);
  assert.equal(rules.encounter(game, 'blank-writ').ok, true);
  const battle = game.active.combat;
  const handIndex = battle.hand.findIndex(entry => entry.id === cardId);
  assert.ok(handIndex >= 0);
  const attack = getCard(battle, handIndex).effects.find(effect => effect.type === 'damage').amount;
  assert.match(cardDetails(game, cardId).body, new RegExp(`Deal ${attack} damage`));
  const guard=getCard(battle,handIndex).effects.find(effect=>effect.type==='block').amount;
  assert.match(cardDetails(game,cardId).body,new RegExp(`Gain ${guard} Guard`));
  const enemyHp = battle.enemy.hp;
  assert.equal(playCard(battle, handIndex).ok, true);
  assert.equal(battle.enemy.hp, enemyHp - attack);
});

test('an empty import is rejected instead of replacing the active chronicle', () => {
  const result = rules.readSave({getItem:() => null}, '');
  assert.ok(result.warning);
  assert.equal(rules.readSave({getItem:() => null}).warning, undefined);
});

test('damage over time at a sealed phase boundary preserves the telegraphed action', () => {
  const boss = {
    id:'boss', name:'Boss', hp:100, sealPhases:true,
    intents:[{name:'Old intention', effects:[{type:'damage',amount:2}]}],
    phases:[{at:.5,name:'New phase',intents:[{name:'New intention',effects:[{type:'damage',amount:9}]}]}],
  };
  const state = createCombat({
    deck:rules.starterDeck || ['palm-strike'], cards:rules.cards, enemy:boss, hp:100, maxHp:100,
  });
  state.enemy.hp = 52;
  state.enemy.statuses.poison = 4;
  assert.equal(getIntent(state).name,'Old intention');
  assert.equal(previewEndTurn(state).hpChange,-2);
  endTurn(state);
  assert.equal(state.player.hp,98);
  assert.equal(getIntent(state).name,'New intention');
  assert.equal(state.enemyMove,0);
  endTurn(state);
  assert.equal(state.player.hp,89);
});
