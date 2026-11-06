import assert from 'node:assert/strict';
import * as rules from '../js/progression.js';
import { runCampaign, fightToVictory } from './campaign-playthrough.mjs';

// Explicit legal progression/encounter test: node tests/workshop-playthrough.mjs
// All states originate from freshGame and public player actions. Cloned campaign
// checkpoints explore alternate commissions without inventing rewards or gear.
const checkpoints={};
const finalGames={};
for(const difficulty of ['wayfarer','tribulation']) {
  checkpoints[difficulty]={};
  const fresh=rules.freshGame(140);
  assert.equal(rules.begin(fresh,'Workshop pilgrim',difficulty).ok,true);
  checkpoints[difficulty][1]=fresh;
  for(const school of ['iron','ember','lotus']) {
    const game=runCampaign(school,difficulty,state=>{
      if(school!=='iron')return;
      for(let tier=2;tier<=rules.materialTier(state);tier++) {
        checkpoints[difficulty][tier]??=structuredClone(state);
      }
    },{quiet:true});
    assert.equal(Object.keys(game.complete).length,49);
    assert.equal(game.victories,35);
    assert.ok(Object.keys(game.cardLevels).length>0,'Campaign preparation must actually purchase materials and temper cards');
    console.log(JSON.stringify({kind:'campaign',school,difficulty,missions:49,battles:game.victories,
      essence:game.essence,jade:game.jade,realm:rules.REALMS[game.realm].name,
      tempered:Object.keys(game.cardLevels).length,highestCardLevel:Math.max(...Object.values(game.cardLevels))}));
    if(school==='iron') {
      while(rules.breakthrough(game).ok) {}
      for(let tier=2;tier<=rules.materialTier(game);tier++)checkpoints[difficulty][tier]??=structuredClone(game);
      finalGames[difficulty]=game;
    }
  }
}

function commission(game,school,tier) {
  if(game.hp<rules.maxHp(game))assert.equal(rules.rest(game).ok,true);
  const before={jade:game.jade,essence:game.essence,materials:{...game.materials},victories:game.victories};
  const reward=rules.bountyRewards(school,tier);
  assert.equal(rules.startBounty(game,school,tier).ok,true,`${school}/${tier}: commission unlock`);
  const result=fightToVictory(game);
  assert.equal(rules.resolveEncounter(game).ok,true);
  assert.equal(game.jade-before.jade,reward.gold);
  assert.equal(game.essence-before.essence,reward.essence);
  assert.equal(game.victories-before.victories,1);
  for(const [id,n] of Object.entries(reward.materials))assert.equal(game.materials[id]-(before.materials[id]||0),n);
  return result;
}

for(const difficulty of ['wayfarer','tribulation'])for(let tier=1;tier<=5;tier++) {
  const source=checkpoints[difficulty][tier];
  assert.ok(source,`Legal ${difficulty} tier ${tier} checkpoint`);
  let worst=1,rounds=0;
  for(const {id:school} of rules.schools) {
    const game=structuredClone(source);
    const result=commission(game,school,tier);
    worst=Math.min(worst,result.remaining);rounds+=result.rounds;
  }
  console.log(JSON.stringify({kind:'bounty-matrix',difficulty,tier,schoolWins:rules.schools.length,
    cultivationLevel:rules.cultivationLevel(source),highestCardLevel:Math.max(1,...Object.values(source.cardLevels)),
    meanRounds:rounds/rules.schools.length,worstRemaining:Math.round(worst*100)}));
}

// A level-one common technique requires exactly two on-school commission rewards.
const common=rules.freshGame(881);
assert.equal(rules.begin(common,'Common smith').ok,true);
const commonId='iron-black-wax-citation';
assert.equal(rules.forgeRecipe(commonId).tier,1);
commission(common,'iron',1);
assert.equal(rules.quoteForge(common,commonId).ok,false,'One victory does not complete both material requirements');
commission(common,'iron',1);
assert.equal(rules.quoteForge(common,commonId).ok,true);
assert.equal(rules.forgeCard(common,commonId).ok,true);
console.log(JSON.stringify({kind:'common-forge',card:commonId,commissionWins:2,jade:common.jade}));
const purchasePrice=rules.cardPrice(commonId);
const cashBeforePurchase=common.jade;
assert.equal(rules.buyCard(common,commonId).ok,true,'Earned commission jade can buy a second common copy');
assert.equal(common.jade,cashBeforePurchase-purchasePrice);
assert.equal(common.known[commonId],2);
console.log(JSON.stringify({kind:'direct-purchase',card:commonId,price:purchasePrice,jade:common.jade}));

// Continue a real cleared Wayfarer chronicle. The baseline deck is kept so that
// the material grind itself, rather than an invented perfected build, is tested.
const grind=structuredClone(finalGames.wayfarer);
const startingEssence=grind.essence;
const legendary=rules.cards.find(card=>card.rarity==='legendary'&&card.school==='iron'&&
  rules.forgeRecipe(card).tier===5&&rules.cardRequirement(card).level<=rules.cultivationLevel(grind)&&
  (grind.known[card.id]||0)<4);
assert.ok(legendary,'An unlocked tier-five legendary formula exists');
let legendaryWins=0;
while(!rules.quoteForge(grind,legendary.id).ok&&legendaryWins<30) {
  commission(grind,'iron',5);legendaryWins++;
}
assert.ok(legendaryWins>=14&&legendaryWins<=15,'Legendary material pacing should be about fifteen high-tier wins');
assert.equal(rules.forgeCard(grind,legendary.id).ok,true);
console.log(JSON.stringify({kind:'legendary-forge',card:legendary.id,tier:5,commissionWins:legendaryWins,
  essence:grind.essence,jade:grind.jade}));

// Buy only the missing material quantities from earned jade, then legally temper
// an owned starter card all the way to level five; every operation is quoted.
const perfectCard='iron-vow';
while(rules.cardLevel(grind,perfectCard)<5) {
  let quote=rules.quoteUpgrade(grind,perfectCard);
  assert.ok(quote.requiredLevel<=rules.cultivationLevel(grind));
  const cost=quote.jade+Object.entries(quote.missing).reduce((sum,[id,n])=>sum+n*rules.materialPrice(id),0);
  while(grind.jade<cost)commission(grind,'iron',5);
  for(const [id,n] of Object.entries(quote.missing))assert.equal(rules.buyMaterial(grind,id,n).ok,true);
  assert.equal(rules.upgradeCard(grind,perfectCard).ok,true);
}
assert.equal(rules.cardLevel(grind,perfectCard),5);
console.log(JSON.stringify({kind:'perfected-technique',card:perfectCard,level:5,jade:grind.jade,essence:grind.essence}));

let extraWins=0;
while(!rules.cultivationStatus(grind).perfected&&extraWins<300) {
  while(rules.breakthrough(grind).ok) {}
  commission(grind,'iron',5);extraWins++;
  if(extraWins%50===0)console.log(JSON.stringify({kind:'grind-progress',extraWins,essence:grind.essence,realm:grind.realm}));
}
while(rules.breakthrough(grind).ok) {}
assert.equal(rules.cultivationStatus(grind).perfected,true);
assert.equal(rules.cultivationLevel(grind),90);
const totalWins=grind.victories-35;
assert.equal(grind.essence,startingEssence+21*totalWins);
assert.ok(totalWins>=200&&totalWins<=250);
assert.equal(rules.readSave(null,JSON.stringify(grind)).warning,undefined,'The fully earned progression saves and resumes');
console.log(JSON.stringify({kind:'perfected-cultivation',commissionWins:totalWins,startingEssence,
  essence:grind.essence,jade:grind.jade,realm:rules.REALMS[grind.realm].name,layer:rules.cultivationStatus(grind).layer}));
