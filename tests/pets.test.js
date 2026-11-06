import assert from 'node:assert/strict';
import test from 'node:test';
import {cards} from '../js/content.js';
import {REALMS} from '../js/cultivation.js';
import {freshGame,begin} from '../js/progression.js';
import * as pets from '../js/pets.js';

const ready=()=>{const game=pets.initializePets(freshGame(42));begin(game,'Spirit Keeper');return game};
const food=cards.find(card=>card.expansion&&card.rarity==='common');
const legendary=cards.find(card=>card.rarity==='legendary');
const snapshot=game=>structuredClone(game);
function rejected(game,action) {const before=snapshot(game);assert.equal(action().ok,false);assert.deepEqual(game,before)}
function paid(game) {game.jade=100000;for(const pet of pets.spiritPets){game.materials['seal-jade-1']=1000;game.materials[`essence-${pet.school}-1`]=1000}return game}

test('eight original spirit lineages have distinct habitats and complete bounded ability kits',()=>{
  assert.equal(pets.spiritPets.length,8);assert.equal(new Set(pets.spiritPets.map(pet=>pet.id)).size,8);
  assert.equal(new Set(pets.spiritPets.map(pet=>pet.biome)).size,8);
  const art=new Set();
  for(const pet of pets.spiritPets) {
    assert.equal(pet.abilities.length,4);assert.equal(pet.passives.length,3);
    assert.equal(new Set([...pet.abilities,...pet.passives].map(ability=>ability.id)).size,7);
    assert.deepEqual(pet.abilities.map(ability=>ability.unlockRealm),[0,1,3,6]);
    assert.deepEqual(pet.abilities.map(ability=>ability.cooldown),[2,3,4,5]);
    assert.deepEqual(pet.passives.map(passive=>passive.unlockRealm),[0,2,5]);
    assert.ok(pet.position.x>0&&pet.position.x<100&&pet.position.y>0&&pet.position.y<100);
    for(const key of ['eggArt','youngArt','adultArt','ascendedArt'])art.add(pet[key]);
    for(const realm of [0,1,3,6,9])for(const ability of [...pets.previewPet(pet.id,realm).abilities,...pets.previewPet(pet.id,realm).passives]) {
      for(const effect of ability.effects){assert.ok(['damage','block','heal','status','cleanse','dispel'].includes(effect.type));assert.ok(Number.isInteger(effect.amount)&&effect.amount>0&&effect.amount<=25);assert.equal(effect.growth,undefined)}
    }
  }
  assert.equal(art.size,32);
});

test('legacy sanctuary initialization is empty, idempotent, and rejects partial versionless records',()=>{
  const legacy={realm:0};pets.initializePets(legacy);
  assert.deepEqual(legacy,{realm:0,petVersion:1,pets:{},activePetId:null});assert.ok(pets.validPets(legacy));
  const before=snapshot(legacy);pets.initializePets(legacy);assert.deepEqual(legacy,before);
  assert.throws(()=>pets.initializePets({realm:0,pets:{}}));
  for(const mutate of [g=>g.petVersion=2,g=>g.pets={unknown:{realm:0,essence:0}},g=>g.activePetId='azure-dragon',g=>g.pets={'azure-dragon':{realm:1,essence:110}},g=>g.pets={'azure-dragon':{realm:0,essence:6471}}]){
    const game=ready();mutate(game);assert.equal(pets.validPets(game),false);
  }
});

test('the first deliberate hatch is free for any species and never silently equips it',()=>{
  for(const pet of pets.spiritPets) {
    const game=ready(),before=snapshot(game),quote=pets.quoteHatch(game,pet.id);
    assert.equal(quote.ok,true);assert.equal(quote.jade,0);assert.deepEqual(quote.materials,{});
    assert.equal(pets.hatchPet(game,pet.id).ok,true);assert.equal(game.jade,before.jade);assert.equal(game.activePetId,null);
    assert.deepEqual(game.pets[pet.id],{realm:0,essence:0});assert.ok(pets.validPets(game));
    rejected(game,()=>pets.hatchPet(game,pet.id));
  }
});

test('additional hatches spend exact quoted jade and lineage materials atomically',()=>{
  const game=ready();pets.hatchPet(game,pets.spiritPets[0].id);
  const id=pets.spiritPets[1].id;rejected(game,()=>pets.hatchPet(game,id));paid(game);
  const quote=pets.quoteHatch(game,id),before=snapshot(game);assert.equal(quote.jade,250);assert.equal(quote.ok,true);
  assert.equal(pets.hatchPet(game,id).ok,true);assert.equal(game.jade,before.jade-250);
  for(const[key,n]of Object.entries(quote.materials))assert.equal(game.materials[key],before.materials[key]-n);
  assert.equal(game.activePetId,null);
});

test('feeding destroys only available copies, grants exact rarity experience and preserves shared quality',()=>{
  const game=ready(),id=pets.spiritPets[0].id;pets.hatchPet(game,id);game.known[food.id]=7;game.cardLevels[food.id]=5;game.upgrades[food.id]=2;
  const quote=pets.quoteFeed(game,id,food.id,3);assert.equal(quote.available,7);assert.equal(quote.result.gained,24);
  assert.equal(pets.feedPet(game,id,food.id,3).ok,true);assert.equal(game.known[food.id],4);assert.equal(game.pets[id].essence,24);
  assert.equal(game.cardLevels[food.id],5);assert.equal(game.upgrades[food.id],2);
  for(const rarity of ['common','uncommon','rare','legendary'])assert.equal(pets.feedExperience(cards.find(card=>card.rarity===rarity)),{common:8,uncommon:20,rare:55,legendary:140}[rarity]);
  assert.equal(pets.feedPet(game,id,food.id,4).ok,true);assert.equal(game.known[food.id],undefined);assert.equal(game.cardLevels[food.id],5);
});

test('feeding reserves the maximum across active, saved and unsaved draft decks',()=>{
  const game=ready(),id=pets.spiritPets[0].id;pets.hatchPet(game,id);
  const cardId=game.deck[0];game.known[cardId]=8;
  const used=game.deck.filter(key=>key===cardId).length;
  game.deckPresets.push({id:'deck-2',name:'Second',cards:[...game.deck]});
  game.deckDraft.cards=[cardId,cardId,cardId,cardId,cardId];
  const quote=pets.quoteFeed(game,id,cardId,3);assert.equal(quote.reserved,Math.max(used,5));assert.equal(quote.available,3);
  assert.equal(pets.feedPet(game,id,cardId,3).ok,true);assert.equal(game.known[cardId],5);
  rejected(game,()=>pets.feedPet(game,id,cardId,1));
});

test('feeding safely caps lifetime pet essence and rejects zero-value overfeeding',()=>{
  const game=ready(),id=pets.spiritPets[0].id;pets.hatchPet(game,id);game.known[legendary.id]=99;
  const quote=pets.quoteFeed(game,id,legendary.id,47);assert.equal(quote.result.gained,6470);assert.equal(quote.result.wasted,110);
  assert.equal(pets.feedPet(game,id,legendary.id,47).ok,true);assert.equal(game.pets[id].essence,6470);assert.equal(pets.petStatus(game,id).layer,9);
  rejected(game,()=>pets.feedPet(game,id,legendary.id,1));
});

test('all pets traverse the same ten realms and ninety layers with hero-gated manual evolution',()=>{
  for(const pet of pets.spiritPets) {
    const game=paid(ready());pets.hatchPet(game,pet.id);game.known[legendary.id]=47;pets.feedPet(game,pet.id,legendary.id,47);
    assert.equal(game.pets[pet.id].realm,0);assert.equal(pets.petStatus(game,pet.id).level,9);
    rejected(game,()=>pets.evolvePet(game,pet.id));game.realm=9;game.essence=6470;
    for(let realm=1;realm<10;realm++){
      const before=snapshot(game),quote=pets.quoteEvolve(game,pet.id);
      assert.equal(quote.jade,Math.ceil(REALMS[realm].jade/2));assert.equal(pets.evolvePet(game,pet.id).ok,true);
      assert.equal(game.jade,before.jade-quote.jade);assert.equal(game.pets[pet.id].essence,6470);assert.equal(game.pets[pet.id].realm,realm);assert.ok(pets.validPets(game));
      assert.equal(pets.petStatus(game,pet.id).level,realm*9+9);
    }
    assert.equal(pets.petStatus(game,pet.id).perfected,true);rejected(game,()=>pets.evolvePet(game,pet.id));
  }
});

test('transactions reject invalid IDs, quantities, battle contexts and insufficient resources without mutation',()=>{
  const game=ready(),id=pets.spiritPets[0].id;pets.hatchPet(game,id);game.known[food.id]=5;
  for(const quantity of [0,-1,1.5,100,NaN,Infinity,'1',null])rejected(game,()=>pets.feedPet(game,id,food.id,quantity));
  for(const bad of ['unknown','toString','__proto__',null]){rejected(game,()=>pets.hatchPet(game,bad));if(bad!==null)rejected(game,()=>pets.equipPet(game,bad));rejected(game,()=>pets.feedPet(game,id,bad,1))}
  game.active={kind:'mission'};
  rejected(game,()=>pets.feedPet(game,id,food.id));rejected(game,()=>pets.hatchPet(game,pets.spiritPets[1].id));rejected(game,()=>pets.evolvePet(game,id));rejected(game,()=>pets.equipPet(game,id));
});

test('only a deliberate companion selection changes the battle choice',()=>{
  const game=paid(ready());for(const pet of pets.spiritPets)pets.hatchPet(game,pet.id);
  for(const pet of pets.spiritPets){assert.equal(pets.equipPet(game,pet.id).ok,true);assert.equal(game.activePetId,pet.id);assert.equal(pets.snapshotPet(game).id,pet.id)}
  assert.equal(pets.equipPet(game,null).ok,true);assert.equal(game.activePetId,null);assert.equal(pets.snapshotPet(game),null);
});

test('battle snapshots resolve effects independently and validate cooldown bounds and canonical definitions',()=>{
  const game=paid(ready());game.realm=9;game.essence=6470;
  for(const pet of pets.spiritPets) {
    pets.hatchPet(game,pet.id);game.pets[pet.id]={realm:9,essence:6470};pets.equipPet(game,pet.id);
    const combatPet={...pets.snapshotPet(game),readyAt:{},lastAbilityTurn:0};
    assert.ok(pets.validPetSnapshot(combatPet,1));assert.equal(combatPet.abilities.length,4);assert.equal(combatPet.passives.length,3);
    const before=JSON.stringify(combatPet);game.pets[pet.id].essence=6000;assert.equal(JSON.stringify(combatPet),before);
    const active=combatPet.abilities[0];combatPet.readyAt[active.id]=1+active.cooldown;combatPet.lastAbilityTurn=1;assert.ok(pets.validPetSnapshot(combatPet,1));
    for(const mutate of [p=>p.readyAt.fake=2,p=>p.readyAt[active.id]=100,p=>p.lastAbilityTurn=2,p=>p.abilities[0].effects[0].amount=999,p=>p.essence=1,p=>p.level=1]){
      const altered=structuredClone(combatPet);mutate(altered);assert.equal(pets.validPetSnapshot(altered,1),false);
    }
    game.pets[pet.id].essence=6470;
  }
  assert.ok(pets.validPetSnapshot(undefined,1));assert.ok(pets.validPetSnapshot(null,1));
});

test('visual growth follows egg, young, adult and ascended thresholds for every lineage',()=>{
  for(const pet of pets.spiritPets){assert.equal(pets.petArt(pet.id),pet.eggArt);for(let realm=0;realm<10;realm++)assert.equal(pets.petArt(pet.id,realm),realm<3?pet.youngArt:realm<6?pet.adultArt:pet.ascendedArt)}
});
