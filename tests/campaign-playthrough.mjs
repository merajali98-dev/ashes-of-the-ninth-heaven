import assert from 'node:assert/strict';
import * as rules from '../js/progression.js';
import { endTurn, getCard, playCard, useConsumable, usePetAbility } from '../js/combat.js';

// Run explicitly with: node tests/campaign-playthrough.mjs [iron|ember|lotus]
const schools = process.argv[2] ? [process.argv[2]] : ['iron', 'ember', 'lotus'];
const teacher = { iron: 0, ember: 1, lotus: 2 };

function fork(state) {
  return {
    ...state,
    player: { ...state.player, statuses: { ...state.player.statuses } },
    enemy: { ...state.enemy, statuses: { ...state.enemy.statuses } },
    hand: [...state.hand],
    drawPile: [...state.drawPile],
    discard: [...state.discard],
    exhausted: [...state.exhausted],
    auras: (state.auras || []).map(aura => ({...aura})),
    rituals: (state.rituals || []).map(ritual => ({...ritual})),
    ...(state.pet ? {pet:structuredClone(state.pet)} : {}),
    resonance: { ...state.resonance },
    log: [],
  };
}

function positionValue(state) {
  const { player, enemy } = state;
  if (state.outcome === 'victory') return 10000 + player.hp;
  if (state.outcome === 'defeat') return -10000 - enemy.hp;
  const p = player.statuses;
  const e = enemy.statuses;
  const advantage = 3 * (p.strength ?? 0) + 2 * (p.focus ?? 0) + (p.regen ?? 0) + 0.6 * (p.ward ?? 0);
  const enemyAfflictions = 2 * (e.poison ?? 0) + 1.6 * (e.burn ?? 0) + (e.bleed ?? 0) + (e.vulnerable ?? 0);
  const playerAfflictions = 2 * (p.poison ?? 0) + 1.6 * (p.burn ?? 0) + (p.bleed ?? 0) + (p.vulnerable ?? 0);
  return 1.5 * player.hp - enemy.hp + advantage + enemyAfflictions - playerAfflictions - 0.3 * enemy.block;
}

function evaluateEnd(state, path) {
  const simulation = fork(state);
  endTurn(simulation);
  return { path, score: positionValue(simulation) - path.length * 0.02 };
}

export function planTurn(combat, supplies = []) {
  let best = evaluateEnd(combat, []);
  let frontier = [{ state: combat, path: [] }];
  for (let depth = 0; depth < 11 && frontier.length; depth++) {
    const candidates = [];
    for (const { state, path } of frontier) {
      const cardIds = new Set();
      for (let index = 0; index < state.hand.length; index++) {
        const card = getCard(state, index);
        if (cardIds.has(card.id) || card.cost > state.energy) continue;
        cardIds.add(card.id);
        const simulation = fork(state);
        if (!playCard(simulation, index).ok) continue;
        const evaluated = evaluateEnd(simulation, [...path, ['play', index]]);
        if (evaluated.score > best.score) best = evaluated;
        if (!simulation.outcome) candidates.push({ ...evaluated, state: simulation });
      }
      for(const ability of state.pet?.abilities || []) {
        const simulation=fork(state);
        if(!usePetAbility(simulation,ability.id).ok)continue;
        const evaluated=evaluateEnd(simulation,[...path,['pet',ability.id]]);
        if(evaluated.score>best.score)best=evaluated;
        if(!simulation.outcome)candidates.push({...evaluated,state:simulation});
      }
      if (path.some(([action]) => action === 'use')) continue;
      for (const item of supplies) {
        const simulation = fork(state);
        useConsumable(simulation, item.effects, item.name);
        const evaluated = evaluateEnd(simulation, [...path, ['use', item.id]]);
        if (evaluated.score > best.score) best = evaluated;
        if (!simulation.outcome) candidates.push({ ...evaluated, state: simulation });
      }
    }
    frontier = candidates.sort((left, right) => right.score - left.score).slice(0, 18);
  }
  return best;
}

function valueGear(item, school) {
  const b = item?.bonuses ?? {};
  const s = b.school?.[school] ?? {};
  return 14 * (b.energy ?? 0) + 7 * (b.draw ?? 0) + 3 * (b.strength ?? 0) +
    2.5 * (b.focus ?? 0) + 1.5 * (b.ward ?? 0) + 1.4 * (b.regen ?? 0) +
    0.24 * (b.maxHp ?? 0) + 0.2 * (b.block ?? 0) +
    2 * (s.damage ?? 0) + 1.8 * (s.block ?? 0) + 2 * (s.status ?? 0);
}

const effectValue = { damage: 1, block: 0.7, heal: 0.8, draw: 2, energy: 4, cleanse: 1.4, recover:2, dispel:1.5 };
const statusValue = { strength: 4, focus: 4, ward: 2, regen: 1, weak: 1.8, vulnerable: 1.8, burn: 1.5, poison: 2, bleed: 1 };

function valueCard(card, school) {
  const effects = card.effects.reduce((total, effect) => {
    const weight = effect.type === 'status' ? statusValue[effect.status] : effectValue[effect.type];
    return total + effect.amount * (effect.hits ?? 1) * weight;
  }, 0);
  const affiliation = card.school === school ? 2.5 : card.school === 'neutral' ? 0.4 : 0;
  return (effects * (card.exhaust ? 0.88 : 1)) / (0.6 + card.cost) + affiliation;
}

export function prepare(game, school) {
  while (rules.breakthrough(game).ok) {}
  for (const item of rules.items.filter(item => item.type === 'manual' && game.bag[item.id])) {
    assert.equal(rules.study(game, item.id).ok, true);
  }
  for (const slot of rules.SLOTS) {
    const owned = rules.items.filter(item => game.bag[item.id] && item.slot === slot);
    const stocked = rules.market(game).filter(item => item.slot === slot && item.bonuses && rules.price(item) <= game.jade);
    const current = rules.itemById[game.equipped[slot]];
    const options = [...owned, ...stocked].sort((left, right) => valueGear(right, school) - valueGear(left, school));
    const best = options[0];
    if (!best || best.id === current?.id || valueGear(best, school) <= valueGear(current, school)) continue;
    if (!game.bag[best.id]) {
      if (valueGear(best, school) - valueGear(current, school) < 2.5) continue;
      assert.equal(rules.trade(game, best.id, 'buy').ok, true);
    }
    assert.equal(rules.equip(game, best.id).ok, true);
  }
  const ownedCards = Object.entries(game.known).flatMap(([id, count]) => Array(count).fill(rules.cardById[id]));
  const ranked = ownedCards.sort((left, right) => valueCard(right, school) - valueCard(left, school));
  const selected = [];
  for (const key of ['damage', 'block']) {
    for (let count = 0; count < 3; count++) {
      const index = ranked.findIndex(card => card.effects.some(effect => effect.type === key));
      if (index >= 0) selected.push(...ranked.splice(index, 1));
    }
  }
  selected.push(...ranked.slice(0, 9 - selected.length));
  const copies = id => game.deck.filter(entry => entry === id).length;
  const desired = id => selected.filter(card => card.id === id).length;
  for (const card of selected) {
    if (copies(card.id) < desired(card.id)) assert.equal(rules.changeDeck(game, card.id, 1).ok, true);
  }
  for (const id of [...game.deck]) {
    if (copies(id) > desired(id)) assert.equal(rules.changeDeck(game, id, -1).ok, true);
  }
  for (const card of new Set(selected.sort((left, right) => valueCard(right, school) - valueCard(left, school)))) {
    const quote=rules.quoteUpgrade(game,card.id);
    if (!quote.result || quote.requiredLevel>rules.cultivationLevel(game)) continue;
    const materialCost=Object.entries(quote.missing||{}).reduce((sum,[id,n])=>sum+n*rules.materialPrice(id),0);
    if (quote.jade+materialCost+60>game.jade) continue;
    for (const [id,n] of Object.entries(quote.missing||{})) {
      assert.equal(rules.buyMaterial(game,id,n).ok,true,`Buy upgrade material ${id}`);
    }
    assert.equal(rules.refine(game,card.id).ok,true,`Temper ${card.id}`);
  }
  if (game.hp < rules.maxHp(game)) assert.equal(rules.rest(game).ok, true);
}

export function fightToVictory(game) {
  const combat = game.active.combat;
  const openingHp = combat.player.hp;
  let suppliesUsed = 0;
  let petCommands = 0;
  while (!combat.outcome && combat.turn <= 30) {
    let plan = planTurn(combat);
    if (plan.score < -9000 || combat.player.hp < combat.player.maxHp * 0.45) {
      const supplies = rules.items.filter(item => game.bag[item.id] && item.effects?.length);
      if (supplies.length) plan = planTurn(combat, supplies);
    }
    for (const [action, input] of plan.path) {
      assert.equal(rules.fight(game, action, input).ok, true, `${combat.enemy.name}: ${action}`);
      if (action === 'use') suppliesUsed++;
      if (action === 'pet') petCommands++;
    }
    if (!combat.outcome) assert.equal(rules.fight(game, 'end').ok, true);
  }
  assert.equal(combat.outcome, 'victory',
    `${combat.enemy.name}, turn ${combat.turn}, player ${combat.player.hp} HP, foe ${combat.enemy.hp} HP`);
  return { rounds: combat.turn, remaining: combat.player.hp / openingHp, suppliesUsed, petCommands };
}

export function runCampaign(school,difficulty='wayfarer',onChapter,{quiet=false,onStart,onPrepared,onMission}={}) {
  assert.ok(Object.hasOwn(teacher, school), 'Choose iron, ember or lotus.');
  const game = rules.freshGame(140 + teacher[school]);
  assert.equal(rules.begin(game, 'Campaign tester', difficulty).ok, true);
  onStart?.(game);
  const regions = [];
  let finale;
  for (const chapter of rules.chapters) {
    const report = { name: chapter.name, missions: 0, battles: 0, rounds: 0, tightest: 1, supplies: 0 };
    const missions = rules.missions.filter(mission => mission.chapter === chapter.id);
    for (let count = 0; count < missions.length; count++) {
      const mission = missions.find(entry => rules.missionStatus(game, entry) === 'Available');
      assert.ok(mission, chapter.id);
      prepare(game, school);
      onPrepared?.(game,mission);
      assert.equal(rules.encounter(game, mission.id).ok, true, mission.id);
      if (game.active.combat) {
        const result = fightToVictory(game);
        if (game.active.combat.enemy.id === 'ninth-heaven') {
          finale = result;
          if (process.env.PLAYTEST_TRACE) console.log(game.active.combat.log.join('\n'));
        }
        report.battles++;
        report.rounds += result.rounds;
        report.tightest = Math.min(report.tightest, result.remaining);
        report.supplies += result.suppliesUsed;
      }
      const choiceIndex = mission.id === 'three-tea-cups' ? teacher[school] :
        mission.choices ? teacher[school] % mission.choices.length : 0;
      assert.equal(rules.resolveEncounter(game, mission.choices?.[choiceIndex]?.id).ok, true, mission.id);
      onMission?.(game,mission);
      report.missions++;
    }
    regions.push(report);
    onChapter?.(game,chapter);
  }
  assert.equal(Object.keys(game.complete).length, rules.missions.length);
  assert.ok(game.complete[rules.missions.at(-1).id]);
  if(!quiet) {
    console.log(`\n${school} (${game.difficulty}): ${game.victories} battles, ${Object.keys(game.complete).length} missions, ${rules.REALMS[game.realm].name}`);
    console.table(regions.map(region => ({ ...region, tightest: Math.round(region.tightest * 100) + '%' })));
    console.log('Final boss', finale, 'Gear bonuses', rules.bonuses(game));
    console.log('Final deck', game.deck.map(id => `${id}+${game.upgrades[id] ?? 0}`).join(', '));
  }
  return game;
}
if (process.argv[1]?.replaceAll('\\','/').endsWith('/campaign-playthrough.mjs')) {
  for(const school of schools)runCampaign(school,process.env.PLAYTEST_DIFFICULTY || 'wayfarer');
}
