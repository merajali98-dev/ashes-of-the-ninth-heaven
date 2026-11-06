import assert from 'node:assert/strict';
import * as r from '../js/progression.js';
import {planTurn,fightToVictory,runCampaign} from './campaign-playthrough.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

// Run: node tests/pet-playthrough.mjs
// Every player state below is earned through ordinary public actions. No pet
// realm, card ownership, jade balance, reward or combat outcome is injected.
const examples={};
function winBounty(game,school,tier) {
  if(game.hp<r.maxHp(game))assert.equal(r.rest(game).ok,true);
  assert.equal(r.startBounty(game,school,tier).ok,true);
  const result=fightToVictory(game);
  assert.equal(r.resolveEncounter(game).ok,true);
  return result;
}

for(const difficulty of ['wayfarer','tribulation'])for(const pet of r.spiritPets) {
  const game=r.freshGame(922);
  assert.equal(r.begin(game,'First companion',difficulty).ok,true);
  const baseline=structuredClone(game);
  const originalJade=game.jade;
  assert.equal(r.hatchPet(game,pet.id).ok,true);
  assert.equal(game.jade,originalJade);
  assert.equal(r.equipPet(game,pet.id).ok,true);
  if(pet.id==='white-tiger'&&difficulty==='wayfarer')examples.young=structuredClone(game);
  const without=winBounty(baseline,pet.school,1);
  assert.equal(r.startBounty(game,pet.school,1).ok,true);
  const battle=game.active.combat;
  const before=structuredClone(battle);
  planTurn(battle);
  assert.deepEqual(battle,before,'Tactical forecasting must not mutate live pet cooldowns or effects');
  const qi=battle.energy,hand=structuredClone(battle.hand);
  assert.equal(r.fight(game,'pet',pet.abilities[0].id).ok,true);
  assert.equal(battle.energy,qi);
  assert.deepEqual(battle.hand,hand);
  const withPet=fightToVictory(game);
  assert.equal(r.resolveEncounter(game).ok,true);
  assert.equal(r.readSave(null,JSON.stringify(game)).warning,undefined);
  console.log(JSON.stringify({kind:'starter-pet',pet:pet.id,difficulty,
    withoutRounds:without.rounds,withRounds:withPet.rounds,
    withoutHpPercent:Math.round(without.remaining*100),withHpPercent:Math.round(withPet.remaining*100),
    commands:withPet.petCommands+1}));
}

const routes={iron:'white-tiger',ember:'vermilion-phoenix',lotus:'jade-qilin'};
let earnedExample;
for(const difficulty of ['wayfarer','tribulation'])for(const [school,petId]of Object.entries(routes)) {
  const feeding={copies:0,experience:0,rarities:{},evolutions:0,evolutionJade:0};
  const stages=[];
  function feedUnreserved(game) {
    // This policy explicitly sacrifices every card outside the current deck,
    // saved decks and editing draft. It is not a collector-preserving route.
    for(const [id,quantity]of Object.entries(game.known)) {
      const quote=r.quoteFeed(game,petId,id,quantity);
      if(!quote.available)continue;
      const result=r.feedPet(game,petId,id,quote.available);
      assert.equal(result.ok,true,`Feed actually unreserved ${id}`);
      feeding.copies+=quote.available;
      feeding.experience+=result.result.gained;
      const rarity=r.cardById[id].rarity;
      feeding.rarities[rarity]=(feeding.rarities[rarity]||0)+quote.available;
    }
    while(r.quoteEvolve(game,petId).ok) {
      feeding.evolutionJade+=r.quoteEvolve(game,petId).jade;
      assert.equal(r.evolvePet(game,petId).ok,true);feeding.evolutions++;
    }
  }
  const game=runCampaign(school,difficulty,(game,chapter)=>{
    stages.push({chapter:chapter.id,petRealm:game.pets[petId].realm,petXp:game.pets[petId].essence,
      heroRealm:game.realm,jade:game.jade});
    if(school==='iron'&&difficulty==='wayfarer'&&game.pets[petId].realm===3)examples.adult=structuredClone(game);
  },{quiet:true,onStart(game){
    assert.equal(r.hatchPet(game,petId).ok,true);assert.equal(r.equipPet(game,petId).ok,true);
  },onPrepared:feedUnreserved});
  assert.equal(game.victories,35);
  assert.ok(game.pets[petId].realm>=3,'A genuinely earned adult pet must accompany the story');
  assert.equal(Object.keys(game.complete).length,49);
  assert.equal(game.pets[petId].essence,feeding.experience);
  assert.equal(r.readSave(null,JSON.stringify(game)).warning,undefined);
  console.log(JSON.stringify({kind:'pet-campaign',school,difficulty,pet:petId,feeding,
    heroRealm:game.realm,petRealm:game.pets[petId].realm,petXp:game.pets[petId].essence,
    jade:game.jade,stages}));
  if(school==='iron'&&difficulty==='wayfarer')earnedExample=game;
}

// Post-story growth remains bounded by the hero's actual realm and costs jade.
const grown=earnedExample;
assert.equal(r.breakthrough(grown).ok,true);
assert.equal(r.evolvePet(grown,'white-tiger').ok,true);
assert.equal(grown.pets['white-tiger'].realm,6);
assert.equal(r.petArt('white-tiger',6),r.petById['white-tiger'].ascendedArt);
assert.equal(r.snapshotPet(grown).abilities.filter(a=>a.unlocked).length,4);
examples.ascended=structuredClone(grown);

// Earn a second hatch, then buy and destroy an additional common technique.
// These expenses are funded by real tier-five commissions with the grown pet.
const secondId='azure-dragon';
let grindWins=0;
while(true) {
  const quote=r.quoteHatch(grown,secondId);
  const total=quote.jade+Object.entries(quote.missing).reduce((n,[id,amount])=>n+amount*r.materialPrice(id),0);
  if(grown.jade>=total) {
    for(const [id,n]of Object.entries(quote.missing))assert.equal(r.buyMaterial(grown,id,n).ok,true);
    assert.equal(r.hatchPet(grown,secondId).ok,true);
    break;
  }
  assert.ok(grindWins<20);
  winBounty(grown,'star',5);grindWins++;
}
const feedCard='iron-black-wax-citation';
while(!r.quoteBuyCard(grown,feedCard).ok) {
  assert.ok(grindWins<25);
  winBounty(grown,'star',5);grindWins++;
}
const prior=grown.pets[secondId].essence;
assert.equal(r.buyCard(grown,feedCard).ok,true);
assert.equal(r.feedPet(grown,secondId,feedCard).ok,true);
assert.equal(grown.pets[secondId].essence-prior,8);
assert.equal(r.equipPet(grown,secondId).ok,true);
const newCompanionResult=winBounty(grown,'star',1);
console.log(JSON.stringify({kind:'earned-poststory',grindWins,petRealm:grown.pets['white-tiger'].realm,
  petXp:grown.pets['white-tiger'].essence,secondPet:secondId,secondPetXp:grown.pets[secondId].essence,
  secondPetCommands:newCompanionResult.petCommands,jade:grown.jade,heroEssence:grown.essence}));
assert.equal(r.readSave(null,JSON.stringify(grown)).warning,undefined);

const remaining=r.PET_MAX_ESSENCE-grown.pets['white-tiger'].essence;
const commonCopies=Math.ceil(remaining/r.feedExperience(feedCard));
const recipe=r.forgeRecipe(feedCard);
const buyAllMaterials=recipe.jade+Object.entries(recipe.materials).reduce((n,[id,q])=>n+q*r.materialPrice(id),0);
console.log(JSON.stringify({kind:'projection-not-executed',remainingPetXp:remaining,commonCopies,
  commonPurchaseJade:commonCopies*r.cardPrice(feedCard),forgeWithBoughtMaterialsJade:commonCopies*buyAllMaterials,
  freshPetCommonCopies:Math.ceil(r.PET_MAX_ESSENCE/8),freshPetLegendaryCopies:Math.ceil(r.PET_MAX_ESSENCE/140)}));

if(process.argv.includes('--save-examples')) {
  const directory=path.resolve('tmp/pet-playthrough');
  await mkdir(directory,{recursive:true});
  for(const [stage,game]of Object.entries(examples)) {
    assert.equal(r.readSave(null,JSON.stringify(game)).warning,undefined);
    await writeFile(path.join(directory,`earned-white-tiger-${stage}.json`),JSON.stringify(game,null,2));
  }
  console.log(JSON.stringify({kind:'earned-preview-saves',directory,stages:Object.keys(examples)}));
}
