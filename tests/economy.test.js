import test from 'node:test';
import assert from 'node:assert/strict';
import {cards,starterDeck,schools} from '../js/content.js';
import * as economy from '../js/economy.js';

const fixture=()=>economy.initializeEconomy({started:true,active:null,realm:9,essence:6500,jade:1_000_000,
  known:{},upgrades:{},deck:[],deckPresets:[],deckDraft:{cards:[]}});
const clone=value=>JSON.parse(JSON.stringify(value));
const recipeValue=recipe=>recipe.jade+Object.entries(recipe.materials).reduce((sum,[id,n])=>sum+n*economy.materialPrice(id),0);
const provide=(game,recipe)=>{for(const [id,n] of Object.entries(recipe.materials))game.materials[id]=(game.materials[id]||0)+n};
const first=cards[0];

test('the material registry has exactly five grades of every binding and school family',()=>{
  assert.equal(economy.materials.length,45);
  assert.equal(new Set(economy.materials.map(material=>material.id)).size,45);
  for(const school of schools){
    const entries=economy.materials.filter(material=>material.school===school.id);
    assert.deepEqual(entries.map(material=>material.tier),[1,2,3,4,5]);
  }
  assert.equal(economy.materials.filter(material=>material.school===null).length,5);
  for(const material of economy.materials){
    assert.ok(Number.isSafeInteger(material.price)&&material.price>0);
    assert.equal(economy.materialRequirement(material).level,material.requiredLevel);
    assert.match(economy.materialIcon(material),new RegExp('material-'+material.id+'\\.webp'));
  }
});

test('all 597 recipes and prices are deterministic, valid, gated, and more efficient than finished purchases',()=>{
  assert.equal(cards.length,597);
  for(const card of cards){
    const recipe=economy.forgeRecipe(card);
    assert.deepEqual(recipe,economy.forgeRecipe(card.id));
    assert.deepEqual(recipe,economy.forgeRecipe(card));
    const requirement=economy.cardRequirement(card);
    assert.ok(requirement.level>=1&&requirement.level<=63,card.id);
    assert.equal(recipe.tier,requirement.tier);
    assert.equal(recipe.requiredLevel,requirement.level);
    for(const [id,n] of Object.entries(recipe.materials)){
      const material=economy.materialById[id];
      assert.ok(material,card.id+': '+id);
      assert.ok(Number.isSafeInteger(n)&&n>0,card.id);
      assert.equal(material.tier,recipe.tier);
      assert.ok(material.requiredLevel<=requirement.level,card.id);
    }
    assert.ok(economy.cardPrice(card)>recipeValue(recipe),card.id);
    const output=economy.salvageYield(card);
    for(const [id,n] of Object.entries(output))assert.ok(n<recipe.materials[id],card.id);
  }
  for(const entry of starterDeck)assert.equal(economy.cardRequirement(typeof entry==='string'?entry:entry.id).level,1);
});

test('every card can be bought or forged through one canonical ownership model',()=>{
  for(const card of cards){
    const bought=fixture();
    const quoted=economy.quoteBuyCard(bought,card.id);
    assert.equal(quoted.ok,true,card.id);
    const before=bought.jade;
    assert.equal(economy.buyCard(bought,card.id).ok,true,card.id);
    assert.equal(bought.jade,before-economy.cardPrice(card));
    assert.equal(bought.known[card.id],1);
    const forged=fixture();
    const recipe=economy.forgeRecipe(card);
    provide(forged,recipe);
    const initial=forged.jade;
    assert.equal(economy.forgeCard(forged,card.id).ok,true,card.id);
    assert.equal(forged.jade,initial-recipe.jade);
    assert.equal(forged.known[card.id],1);
    assert.deepEqual(forged.materials,{});
  }
});

test('forge and salvage cannot generate positive resource cycles for any card',()=>{
  for(const card of cards){
    const game=fixture();
    const recipe=economy.forgeRecipe(card);
    provide(game,recipe);
    assert.equal(economy.forgeCard(game,card.id).ok,true);
    const before=game.jade;
    assert.equal(economy.salvageCard(game,card.id).ok,true);
    assert.equal(game.jade,before);
    assert.equal(game.known[card.id],undefined);
    for(const [id,n] of Object.entries(recipe.materials))assert.ok((game.materials[id]||0)<n);
    assert.equal(economy.quoteForge(game,card.id).ok,false);
    const salvagedValue=Object.entries(game.materials).reduce((sum,[id,n])=>sum+n*economy.materialPrice(id),0);
    assert.ok(salvagedValue<economy.cardPrice(card));
  }
});

test('all four paid card-level steps have valid recipes and preserve shared quality after dismantling',()=>{
  for(const card of cards){
    const game=fixture();game.known[card.id]=2;
    for(let level=2;level<=5;level++){
      const recipe=economy.upgradeRecipe(card,level);
      assert.ok(recipe&&recipe.jade>0);
      assert.ok(recipe.tier>=economy.forgeRecipe(card).tier);
      provide(game,recipe);
      const previousJade=game.jade;
      assert.equal(economy.upgradeCard(game,card.id).ok,true,card.id+' level '+level);
      assert.equal(economy.cardLevel(game,card.id),level);
      assert.equal(game.upgrades[card.id],Math.floor((level-1)/2));
      assert.equal(game.jade,previousJade-recipe.jade);
      assert.equal(game.known[card.id],2,'tempering consumes no owned copy');
    }
    const snapshot=clone(game);
    assert.equal(economy.upgradeCard(game,card.id).ok,false);
    assert.deepEqual(game,snapshot);
    assert.equal(economy.salvageCard(game,card.id,2).ok,true);
    assert.equal(economy.cardLevel(game,card.id),5);
    assert.equal(economy.buyCard(game,card.id).ok,true);
    assert.equal(economy.cardLevel(game,card.id),5);
  }
});

test('salvage reserves the maximum count in active, saved, and draft decks',()=>{
  const game=fixture();game.known[first.id]=4;
  game.deck=[first.id];
  game.deckPresets=[{id:'deck-2',name:'Other',cards:[first.id,first.id]}];
  game.deckDraft={name:'Draft',cards:[first.id,first.id,first.id]};
  let quote=economy.quoteSalvage(game,first.id,1);
  assert.equal(quote.reserved,3);
  assert.equal(quote.available,1);
  assert.equal(quote.ok,true);
  const before=clone(game);
  assert.equal(economy.salvageCard(game,first.id,2).ok,false);
  assert.deepEqual(game,before);
  assert.equal(economy.salvageCard(game,first.id,1).ok,true);
  assert.equal(game.known[first.id],3);
  assert.equal(economy.quoteSalvage(game,first.id).ok,false);
});

test('purchases and forging stop at four while earned excess remains intact',()=>{
  const game=fixture();game.known[first.id]=3;
  provide(game,economy.forgeRecipe(first));
  const before=clone(game);
  assert.equal(economy.buyCard(game,first.id,2).ok,false);
  assert.deepEqual(game,before);
  assert.equal(economy.forgeCard(game,first.id).ok,true);
  assert.equal(game.known[first.id],4);
  const four=clone(game);
  assert.equal(economy.buyCard(game,first.id).ok,false);
  assert.deepEqual(game,four);
  game.known[first.id]=9;
  assert.equal(economy.quoteBuyCard(game,first.id).ok,false);
  assert.equal(game.known[first.id],9);
});

test('cultivation, oath, encounter, money, and ingredients reject atomically',()=>{
  const legendary=cards.find(card=>card.rarity==='legendary');
  const cases=[
    [game=>{game.realm=0;game.essence=0},game=>economy.buyCard(game,legendary.id)],
    [game=>{game.started=false},game=>economy.buyMaterial(game,'seal-jade-1')],
    [game=>{game.active={kind:'mission'}},game=>economy.forgeCard(game,first.id)],
    [game=>{game.jade=0},game=>economy.buyCard(game,first.id)],
    [()=>{},game=>economy.forgeCard(game,first.id)],
    [game=>{game.known[first.id]=1},game=>economy.upgradeCard(game,first.id)],
  ];
  for(const [prepare,action] of cases){const game=fixture();prepare(game);const snapshot=clone(game);assert.equal(action(game).ok,false);assert.deepEqual(game,snapshot)}
  const earned=fixture();earned.realm=0;earned.essence=0;earned.known[legendary.id]=1;
  assert.equal(economy.cardLevel(earned,legendary.id),1,'owned high-rarity cards remain intact');
});

test('invalid quantities and identifiers never spend resources or throw',()=>{
  for(const quantity of [0,-1,1.5,100,NaN,Infinity,Number.MAX_SAFE_INTEGER,'1',null]){
    for(const action of [game=>economy.buyMaterial(game,'seal-jade-1',quantity),game=>economy.buyCard(game,first.id,quantity),
      game=>economy.forgeCard(game,first.id,quantity),game=>economy.salvageCard(game,first.id,quantity)]){
      const game=fixture();game.known[first.id]=4;const snapshot=clone(game);
      assert.equal(action(game).ok,false);assert.deepEqual(game,snapshot);
    }
  }
  for(const id of ['missing','__proto__','constructor',null,undefined]){
    const game=fixture();const snapshot=clone(game);
    for(const action of [economy.buyCard,economy.forgeCard,economy.upgradeCard,economy.salvageCard,economy.buyMaterial])assert.equal(action(game,id).ok,false);
    assert.deepEqual(game,snapshot);
  }
});

test('material purchasing charges exact quantities and rejects stack overflow',()=>{
  const game=fixture();
  assert.equal(economy.buyMaterial(game,'essence-star-5',99).ok,true);
  assert.equal(game.materials['essence-star-5'],99);
  assert.equal(game.jade,1_000_000-99*12);
  game.materials['seal-jade-1']=Number.MAX_SAFE_INTEGER;
  const before=clone(game);
  assert.equal(economy.buyMaterial(game,'seal-jade-1').ok,false);
  assert.deepEqual(game,before);
  game.known[first.id]=1;
  assert.equal(economy.salvageCard(game,first.id).ok,false);
});

test('legacy quality migration is repeatable and does not modify stored battle definitions',()=>{
  for(let rank=0;rank<=2;rank++){
    const game={upgrades:{[first.id]:rank},active:{combat:{cards:{[first.id]:{effects:[{type:'draw',amount:7}]}}}}};
    const battle=clone(game.active);
    economy.initializeEconomy(game);
    assert.equal(economy.cardLevel(game,first.id),1+rank*2);
    assert.equal(economy.validEconomy(game),true);
    assert.deepEqual(game.active,battle);
    const migrated=clone(game);economy.initializeEconomy(game);assert.deepEqual(game,migrated);
  }
  const corrupt={materials:{'unknown-material':2},cardLevels:{[first.id]:6},upgrades:{}};
  economy.initializeEconomy(corrupt);assert.equal(economy.validEconomy(corrupt),false);
});

test('targeted commissions have finite exact rewards for all forty school and grade selections',()=>{
  for(const school of schools)for(let tier=1;tier<=5;tier++){
    const reward=economy.bountyRewards(school.id,tier);
    assert.equal(reward.essence,6+3*tier);
    assert.equal(reward.gold,8+5*tier);
    assert.equal(reward.materials['seal-jade-'+tier],6+2*tier);
    assert.equal(reward.materials['essence-'+school.id+'-'+tier],3+Math.floor(tier/2));
    for(const id of Object.keys(reward.materials))assert.ok(economy.materialById[id]);
  }
  for(const [school,tier] of [[null,1],['iron',0],['iron',6],['iron',1.5],['unknown',2]])assert.equal(economy.bountyRewards(school,tier),null);
});
