// Proof of battle: a commission fought in the browser is replayed from its inputs, seed and recorded actions. The replay
// must reach the same outcome; a log that was cut short, reordered or fed a different seed must not prove a win.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../js/progression.js';

function fightToTheEnd(seed) {
  const game = rules.freshGame(42);
  rules.begin(game, 'Shen', 'wayfarer');
  const started = rules.startBounty(game, 'ember', 1, {seed, battleId: 'b-1'});
  assert.equal(started.ok, true, started.reason);
  const combat = game.active.combat;
  for (let guard = 0; guard < 600 && !combat.outcome; guard++) {
    let played = false;
    for (let i = 0; i < combat.hand.length && !played; i++) played = rules.fight(game, 'play', i).ok;
    if (!played) rules.fight(game, 'end');
  }
  return game;
}

test('a fought commission replays to the same outcome from its inputs, server seed and actions', () => {
  const game = fightToTheEnd(123_456);
  const active = game.active;
  assert.ok(active.combat.outcome, 'the autopilot finished the battle');
  assert.equal(active.seed, 123_456, 'the ledger seed was used');
  assert.equal(active.battleId, 'b-1');
  assert.ok(active.actions.length > 3);
  const proof = rules.replayCommission({school: 'ember', tier: 1, difficulty: game.difficulty, inputs: active.inputs, seed: active.seed, actions: active.actions});
  if (active.combat.outcome === 'victory') {
    assert.equal(proof.ok, true, proof.reason);
    assert.equal(proof.hp, active.combat.player.hp, 'the replay ends where the browser ended');
    assert.deepEqual(proof.rewards.materials, {'seal-jade-1': 8, 'essence-ember-1': 3});
  } else {
    assert.equal(proof.reason, 'DEFEATED');
  }
});

test('a tampered battle log proves nothing', () => {
  const game = fightToTheEnd(987_654);
  const {inputs, seed, actions, combat} = game.active;
  const base = {school: 'ember', tier: 1, difficulty: game.difficulty, inputs, seed};
  if (combat.outcome !== 'victory') return; // the autopilot lost: nothing to forge
  assert.equal(rules.replayCommission({...base, actions: actions.slice(0, -3)}).ok, false, 'cut short');
  assert.equal(rules.replayCommission({...base, actions: [...actions, ['end', null]]}).ok, false, 'acts after the end');
  assert.equal(rules.replayCommission({...base, actions: [['play', 99], ...actions]}).reason, 'ILLEGAL_ACTION', 'an impossible move');
  // The server replays with the seed it issued, never one the browser sends; the seed decides the draws.
  const deal = s => rules.commissionCombat({...base, seed: s}).hand.map(card => card.id).join(',') + '|' + rules.commissionCombat({...base, seed: s}).drawPile.map(card => card.id).join(',');
  assert.notEqual(deal(seed), deal(seed + 1), 'another seed deals other cards');
  assert.equal(rules.replayCommission({...base, tier: 9, actions}).reason, 'BAD_BATTLE');
});
