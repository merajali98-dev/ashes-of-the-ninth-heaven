import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REALMS, CULTIVATION_VERSION, PERFECTED_ESSENCE, cultivationStatus, cultivationLevel,
  materialTier, realmAvatar, layerThreshold, breakthroughRequirement, advanceCultivation, migrateCultivation,
} from '../js/cultivation.js';

const gameAt = (realm = 0, essence = REALMS[realm].essence) => ({
  started:true, active:null, realm, essence, jade:10000, cultivationVersion:CULTIVATION_VERSION,
});

test('all ninety layers have exact distinct thresholds and monotonic cultivation levels', () => {
  assert.equal(REALMS.length,10);
  let previousLevel = 0;
  let previousThreshold = -1;
  for (let realm = 0; realm < REALMS.length; realm++) {
    for (let layer = 1; layer <= 9; layer++) {
      const threshold = layerThreshold(realm,layer);
      assert.ok(threshold > previousThreshold);
      const status = cultivationStatus(gameAt(realm,threshold));
      assert.equal(status.layer,layer);
      assert.equal(status.level,previousLevel + 1);
      assert.equal(status.progress,0);
      assert.ok(status.xpToNext > 0);
      assert.equal(cultivationLevel(gameAt(realm,threshold)),status.level);
      if (layer > 1) assert.equal(cultivationStatus(gameAt(realm,threshold - 1)).layer,layer - 1);
      previousThreshold = threshold;
      previousLevel = status.level;
    }
  }
  assert.equal(previousLevel,90);
});

test('every integer experience value advances layers monotonically without implicit realm changes', () => {
  for (let realm = 0; realm < REALMS.length; realm++) {
    const game = gameAt(realm);
    let previousLayer = 1;
    for (let essence = REALMS[realm].essence; essence <= layerThreshold(realm,10) + 50; essence++) {
      game.essence = essence;
      const before = JSON.stringify(game);
      const status = cultivationStatus(game);
      assert.ok(status.layer >= previousLayer && status.layer <= 9);
      assert.ok(status.progress >= 0 && status.progress <= 1);
      assert.ok(status.xpToNext >= 0);
      assert.equal(game.realm,realm);
      assert.equal(JSON.stringify(game),before);
      previousLayer = status.layer;
    }
  }
});

test('all nine breakthroughs consume jade once, preserve lifetime essence and leave vitality to caller', () => {
  const game = {...gameAt(),essence:PERFECTED_ESSENCE,hp:12};
  let total = 0;
  for (let target = 1; target < REALMS.length; target++) {
    assert.equal(cultivationStatus(game).layer,9);
    assert.equal(breakthroughRequirement(game),'');
    assert.equal(advanceCultivation(game).ok,true);
    total += REALMS[target].jade;
    assert.equal(game.realm,target);
    assert.equal(game.jade,10000 - total);
    assert.equal(game.essence,PERFECTED_ESSENCE);
    assert.equal(game.hp,12);
  }
  const before = structuredClone(game);
  assert.equal(advanceCultivation(game).ok,false);
  assert.deepEqual(game,before);
  assert.equal(cultivationStatus(game).perfected,true);
});

test('unpayable and unavailable breakthroughs reject before mutating any field', () => {
  const cases = [
    {...gameAt(),started:false}, {...gameAt(),active:{kind:'mission'}},
    {...gameAt(),essence:109}, {...gameAt(),essence:110,jade:29},
    {...gameAt(),realm:-1}, {...gameAt(),realm:10}, {...gameAt(),realm:1.5},
    {...gameAt(),essence:NaN}, {...gameAt(),jade:Infinity}, gameAt(9),
  ];
  for (const game of cases) {
    const before = structuredClone(game);
    assert.ok(breakthroughRequirement(game));
    assert.equal(advanceCultivation(game).ok,false);
    assert.deepEqual(game,before);
  }
});

test('banked experience stays in the current ninth layer until a manual breakthrough', () => {
  const game = gameAt(0,200);
  const before = structuredClone(game);
  assert.equal(cultivationStatus(game).layer,9);
  assert.equal(cultivationStatus(game).progress,1);
  assert.equal(cultivationStatus(game).experienceReady,true);
  assert.deepEqual(game,before);
  assert.equal(advanceCultivation(game).ok,true);
  assert.equal(game.realm,1);
  assert.equal(game.essence,200);
  assert.equal(cultivationStatus(game).layer,5);
});

test('material potency gates are monotonic and every tier is available by Body Integration', () => {
  assert.deepEqual(REALMS.map((_,realm)=>materialTier(gameAt(realm))),[1,2,2,3,4,4,5,5,5,5]);
  assert.equal(new Set(REALMS.map((_,realm)=>realmAvatar(gameAt(realm)))).size,10);
  assert.equal(realmAvatar(gameAt()),'assets/art/portrait-shen-luo.webp');
  assert.equal(REALMS[7].hp,84);
});

test('legacy realm migration preserves attained power once and never rewrites active combat', () => {
  const mapping = [0,1,2,3,4,5,7];
  for (let realm = 0; realm < 7; realm++) {
    const old = {realm,essence:0,jade:8,known:{'gather-qi':1},deck:['gather-qi'],active:{combat:{player:{hp:12,maxHp:54}}}};
    const before = structuredClone(old);
    const migrated = migrateCultivation(old);
    assert.deepEqual(old,before);
    assert.notEqual(migrated,old);
    assert.equal(migrated.realm,mapping[realm]);
    assert.equal(migrated.essence,REALMS[mapping[realm]].essence);
    assert.equal(migrated.cultivationVersion,CULTIVATION_VERSION);
    assert.equal(migrated.active,old.active);
    assert.equal(migrated.known,old.known);
    assert.equal(migrated.jade,8);
    assert.deepEqual(migrateCultivation(migrated),migrated);
  }
  assert.equal(migrateCultivation({realm:0,essence:9000}).essence,9000);
});

test('migration rejects malformed realms and unsupported versions instead of clamping', () => {
  for (const game of [null,[],{}, {realm:-1,essence:0},{realm:7,essence:0},{realm:1.5,essence:0},
    {realm:0,essence:-1},{realm:0,essence:Infinity},{realm:0,essence:0,cultivationVersion:2},
    {realm:10,essence:0,cultivationVersion:1}]) {
    assert.throws(()=>migrateCultivation(game));
  }
  assert.throws(()=>cultivationStatus({realm:0,essence:-1}));
  assert.throws(()=>materialTier({realm:10}));
  assert.throws(()=>layerThreshold(0,0));
});

test('final realm keeps its last experience interval until perfected and never advances further', () => {
  const game = gameAt(9,PERFECTED_ESSENCE - 1);
  assert.equal(cultivationStatus(game).layer,9);
  assert.equal(cultivationStatus(game).xpToNext,1);
  assert.equal(cultivationStatus(game).perfected,false);
  game.essence++;
  assert.equal(cultivationStatus(game).level,90);
  assert.equal(cultivationStatus(game).xpToNext,0);
  assert.equal(cultivationStatus(game).progress,1);
  assert.equal(cultivationStatus(game).perfected,true);
  assert.equal(cultivationStatus(game).next,null);
});
