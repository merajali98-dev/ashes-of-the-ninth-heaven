import assert from 'node:assert/strict';
import test from 'node:test';
import * as rules from '../js/progression.js';
import {captureProgression,progressionChanges,playProgressionEffects} from '../js/progression-fx.js';
import {TYPE_EFFECTS} from '../js/battle-fx.js';
import {CARD_TYPES} from '../js/card-frame.js';

test('every card category has a unique bounded casting signature and release timing',()=>{
  assert.deepEqual(Object.keys(TYPE_EFFECTS).sort(),Object.keys(CARD_TYPES).sort());
  assert.equal(new Set(Object.values(TYPE_EFFECTS).map(effect=>effect.shape)).size,12);
  for(const [type,effect]of Object.entries(TYPE_EFFECTS)) {
    assert.ok(effect.release>0&&effect.release<effect.duration,type);
    assert.ok(effect.duration<=1350&&effect.duration>=600,type);
    assert.ok(effect.shape.length>5&&effect.name.length>5,type);
  }
});

function game() {const value=rules.freshGame(42);rules.begin(value,'Motion Tester');return value;}

test('progression presentation snapshots are detached, DOM-independent, and never mutate saves',()=>{
  const value=game();rules.hatchPet(value,'azure-dragon');
  const original=structuredClone(value),snapshot=captureProgression(value);
  assert.deepEqual(value,original);
  value.essence=100;value.pets['azure-dragon'].essence=100;value.name='Changed';
  assert.equal(snapshot.hero.essence,0);assert.equal(snapshot.hero.name,'Motion Tester');
  assert.equal(snapshot.pets['azure-dragon'].essence,0);
});

test('reloads, empty snapshots, first hatches, and within-layer essence do not replay growth',()=>{
  const value=game(),before=captureProgression(value);
  assert.deepEqual(progressionChanges(null,before),[]);
  assert.deepEqual(progressionChanges(before,captureProgression(JSON.parse(JSON.stringify(value)))),[]);
  value.essence=1;rules.hatchPet(value,'vermilion-phoenix');
  assert.deepEqual(progressionChanges(before,captureProgression(value)),[]);
});

test('hero layer jumps produce one exact batched advancement rather than fabricated realms',()=>{
  const value=game(),before=captureProgression(value);
  value.essence=rules.layerThreshold(0,7);
  const changes=progressionChanges(before,captureProgression(value));
  assert.equal(changes.length,1);assert.equal(changes[0].kind,'layer');assert.equal(changes[0].subject,'hero');
  assert.equal(changes[0].gainedLevels,6);assert.equal(changes[0].before.layer,1);assert.equal(changes[0].after.layer,7);
  value.essence=6470;
  const banked=progressionChanges(before,captureProgression(value));
  assert.equal(banked[0].after.realm,0);assert.equal(banked[0].after.level,9);
});

test('actual hero breakthrough is distinguished from layer advancement and preserves state',()=>{
  const value=game();value.essence=110;value.jade=100;
  const before=captureProgression(value);assert.equal(rules.breakthrough(value).ok,true);
  const after=captureProgression(value),saved=structuredClone(value),changes=progressionChanges(before,after);
  assert.equal(changes.length,1);assert.equal(changes[0].kind,'realm');assert.equal(changes[0].after.realm,1);
  assert.equal(changes[0].gainedLevels,1);assert.equal(changes[0].after.avatar,rules.REALMS[1].avatar);
  assert.deepEqual(value,saved);
});

test('feeding and evolution report only the pet that actually advanced',()=>{
  const value=game();value.realm=1;value.essence=110;value.jade=100;
  rules.hatchPet(value,'vermilion-phoenix');
  const food='iron-black-wax-citation';value.known[food]=14;
  const before=captureProgression(value);
  assert.equal(rules.feedPet(value,'vermilion-phoenix',food,14).ok,true);
  const fed=captureProgression(value),changes=progressionChanges(before,fed);
  assert.equal(changes.length,1);assert.equal(changes[0].subject,'pet');assert.equal(changes[0].id,'vermilion-phoenix');
  assert.equal(changes[0].gainedLevels,8);assert.equal(changes[0].gainedEssence,112);
  assert.equal(rules.evolvePet(value,'vermilion-phoenix').ok,true);
  const evolved=progressionChanges(fed,captureProgression(value));
  assert.equal(evolved.length,1);assert.equal(evolved[0].kind,'realm');assert.equal(evolved[0].subject,'pet');
});

test('perfection is celebrated exactly once even when the final level was already reached',()=>{
  const value=game();value.realm=9;value.essence=6469;
  const before=captureProgression(value);value.essence=6470;
  const after=captureProgression(value),changes=progressionChanges(before,after);
  assert.equal(changes.length,1);assert.equal(changes[0].kind,'perfection');assert.equal(changes[0].gainedLevels,0);
  assert.deepEqual(progressionChanges(after,captureProgression(value)),[]);
});

test('presentation ignores regression and removed pets, and remains harmless without a DOM',async()=>{
  const value=game();value.essence=100;rules.hatchPet(value,'white-tiger');
  const before=captureProgression(value);value.essence=0;value.pets={};
  const after=captureProgression(value);assert.deepEqual(progressionChanges(before,after),[]);
  const handle=playProgressionEffects({before,after,root:null});
  assert.equal(handle.duration,0);assert.deepEqual(await handle.finished,{cancelled:false});handle.cancel();
});
