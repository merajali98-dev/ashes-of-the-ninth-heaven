import assert from 'node:assert/strict';
import * as rules from '../js/progression.js';

// Deterministic formula/quote audit, not a simulated battle or measured play time.
// Run with Node 22+: node scripts/economy-audit.mjs
const range=values=>({min:Math.min(...values),max:Math.max(...values)});
const value=recipe=>recipe.jade+Object.entries(recipe.materials).reduce((sum,[id,n])=>sum+n*rules.materialPrice(id),0);
const centsPerJade=1; // Illustrative 100 jade / USD 1, not a live exchange rate.
const rarity={};
for(const card of rules.cards) {
  const recipe=rules.forgeRecipe(card),price=rules.cardPrice(card),forge=value(recipe);
  const upgrades=[2,3,4,5].map(level=>rules.upgradeRecipe(card,level));
  const commission=rules.bountyRewards(card.school||'neutral',recipe.tier);
  const materialWins=Math.max(...Object.entries(recipe.materials).map(([id,n])=>Math.ceil(n/commission.materials[id])));
  const salvage=Object.entries(rules.salvageYield(card)).reduce((sum,[id,n])=>sum+n*rules.materialPrice(id),0);
  assert.ok(price>forge,card.id+': direct convenience price exceeds all-retail forging cost');
  assert.ok(salvage<forge,card.id+': buy/forge/salvage cannot profit');
  const record={id:card.id,gate:recipe.requiredLevel,tier:recipe.tier,price,forge,materialWins,
    fullUpgradeRetail:upgrades.reduce((sum,upgrade)=>sum+value(upgrade),0)};
  (rarity[card.rarity]??=[]).push(record);
}
const cardsByRarity=Object.fromEntries(Object.entries(rarity).map(([key,list])=>[key,{
  count:list.length,levelGate:range(list.map(x=>x.gate)),directJade:range(list.map(x=>x.price)),
  forgeRetailJade:range(list.map(x=>x.forge)),forgeTargetedWins:range(list.map(x=>x.materialWins)),
  allFourUpgradeRetailJade:range(list.map(x=>x.fullUpgradeRetail)),
  directIllustrativeUsd:range(list.map(x=>x.price*centsPerJade/100)),
}]));
const commissions=rules.MATERIAL_TIERS.map(tier=>{
  const reward=rules.bountyRewards('iron',tier.tier);
  return{tier:tier.tier,materialLevelGate:tier.level,jade:reward.gold,heroEssence:reward.essence,
    seal:reward.materials['seal-jade-'+tier.tier],schoolEssence:reward.materials['essence-iron-'+tier.tier],
    materialRetailValue:Object.entries(reward.materials).reduce((sum,[id,n])=>sum+n*rules.materialPrice(id),0),
    winsEquivalentTo500Jade:Math.ceil(500/reward.gold)};
});
const sample=rules.freshGame(871);rules.begin(sample,'Economy audit');sample.jade=1000000;
const locked=rules.cards.filter(card=>rules.cardRequirement(card).level>rules.cultivationLevel(sample));
for(const card of locked)assert.equal(rules.quoteBuyCard(sample,card.id).ok,false,card.id+': money cannot skip gate');
assert.equal(rules.breakthrough(sample).ok,false,'jade cannot buy missing hero cultivation essence');
assert.equal(rules.hatchPet(sample,'azure-dragon').ok,true);
sample.pets['azure-dragon'].essence=6470;
assert.equal(rules.quoteEvolve(sample,'azure-dragon').ok,false,'paid feeding cannot bypass hero realm');
const repeatableSource=rules.bountyRewards('iron',5);
const heroBreakthroughJade=rules.REALMS.reduce((sum,realm)=>sum+realm.jade,0);
const petEvolutionJade=rules.REALMS.slice(1).reduce((sum,realm)=>sum+Math.ceil(realm.jade/2),0);
const legacyCrafts=rules.recipes.map(recipe=>{
  // Maximum 15% input discount and undiscounted output resale is conservative.
  const cost=recipe.gold+Object.entries(recipe.materials).reduce((sum,[id,n])=>sum+n*Math.max(1,Math.round((rules.itemById[id].value||10)*.85)),0);
  const resale=Math.max(1,Math.floor((rules.itemById[recipe.item].value||10)/2));
  assert.ok(resale<cost,recipe.item+': legacy craft/resale cannot profit');
  return{cost,resale};
});
const campaign={missions:rules.missions.length,
  guaranteedJade:rules.missions.reduce((sum,mission)=>sum+(mission.rewards?.gold||0),0),
  guaranteedHeroEssence:rules.missions.reduce((sum,mission)=>sum+(mission.rewards?.essence||0),0),
  aggregateChoiceBonusJade:{min:rules.missions.reduce((sum,m)=>sum+(m.choices?.length?Math.min(...m.choices.map(c=>c.rewards?.gold||0)):0),0),
    max:rules.missions.reduce((sum,m)=>sum+(m.choices?.length?Math.max(...m.choices.map(c=>c.rewards?.gold||0)):0),0)}};
console.log(JSON.stringify({status:'passed',scope:'formula and gate audit; no fabricated battle earnings',
  rateProposal:{jadePerUsd:100,centsPerJade},cards:rules.cards.length,cardsByRarity,commissions,campaign,
  cultivation:{heroBreakthroughJade,petEvolutionJade,perfectedEssence:6470,
    postBaselineStoryTier5EssenceOnlyWins:Math.ceil((6470-campaign.guaranteedHeroEssence)/repeatableSource.essence)},
  gates:{level1CardsStillLockedDespiteMillionJade:locked.length,heroEssenceGate:true,petHeroRealmGate:true},
  noProfitCycles:{cardRecipes:rules.cards.length,legacyCrafts:legacyCrafts.length},
  notes:['Pet experience is indirectly purchasable through jade-funded spare cards.',
    'Essence-only tier-five estimate assumes the tier has already unlocked; actual path changes tiers.',
    'USD equivalents describe proposal values, never a cash-out or guaranteed play-time rate.']},null,2));
