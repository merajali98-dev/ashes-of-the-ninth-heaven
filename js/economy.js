import {cards, starterDeck} from './content.js';
import {cultivationLevel} from './cultivation.js';
import {reservedCopies} from './decks.js';

const cardById=Object.assign(Object.create(null),Object.fromEntries(cards.map(card=>[card.id,card])));
const starterIds=new Set(starterDeck.map(card=>typeof card==='string'?card:card.id));
const rarityIndex={common:0,uncommon:1,rare:2,legendary:3};
const quantities={jade:[10,22,48,100],essence:[6,14,32,72],service:[8,20,50,140]};
const familyData=[
  ['seal-jade','Seal Jade',null,'#a6dec1','jade'],
  ['essence-iron','Oathsteel Essence','iron','#d9d4c4','shield'],
  ['essence-ember','Cinder Essence','ember','#ff9862','flame'],
  ['essence-tide','Frosttide Essence','tide','#74e0ec','droplet'],
  ['essence-shade','Umbral Essence','shade','#c4a0ff','moon'],
  ['essence-lotus','Verdant Essence','lotus','#9be3a5','lotus'],
  ['essence-thunder','Storm Essence','thunder','#88baff','lightning'],
  ['essence-star','Astral Essence','star','#f5d181','star'],
  ['essence-neutral','Mortal Essence','neutral','#d4b38a','vessel'],
];
export const MATERIAL_TIERS=Object.freeze([
  {tier:1,name:'Mortal',rarity:'common',level:1,jadePrice:1,essencePrice:2},
  {tier:2,name:'Spirit',rarity:'uncommon',level:10,jadePrice:2,essencePrice:3},
  {tier:3,name:'Earth',rarity:'rare',level:28,jadePrice:3,essencePrice:5},
  {tier:4,name:'Heaven',rarity:'rare',level:37,jadePrice:5,essencePrice:8},
  {tier:5,name:'Immortal',rarity:'legendary',level:55,jadePrice:8,essencePrice:12},
].map(Object.freeze));
export const materials=Object.freeze(familyData.flatMap(([family,name,school,color,glyph])=>MATERIAL_TIERS.map(grade=>{
  const id=family+'-'+grade.tier;
  return Object.freeze({id,name:grade.name+' '+name,family,school,tier:grade.tier,rarity:grade.rarity,
    requiredLevel:grade.level,level:grade.level,price:school?grade.essencePrice:grade.jadePrice,color,glyph,
    art:`assets/art/material-${id}.webp`,icon:`assets/art/material-${id}.webp`,
    description:school?`A tier ${grade.tier} lineage essence used to forge and temper ${school} techniques.`:
      `A tier ${grade.tier} binding stone used in every technique formula.`,
    source:`Buy at the Spirit Exchange or win a tier ${grade.tier} material commission.`,
  });
})));
export const materialById=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(materials.map(material=>[material.id,material]))));

const positiveQuantity=value=>Number.isSafeInteger(value)&&value>=1&&value<=99;
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0;
const cardOf=card=>typeof card==='string'?cardById[card]:cardById[card?.id];
const materialOf=material=>typeof material==='string'?materialById[material]:materialById[material?.id];
const hash=text=>{let result=2166136261;for(const letter of text)result=Math.imul(result^letter.charCodeAt(0),16777619);return result>>>0};
const tierInfo=tier=>MATERIAL_TIERS[tier-1];
const validMap=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const levelOf=game=>{try{return cultivationLevel(game)}catch{return 0}};
const failure=(reason,details={})=>({ok:false,reason,jade:0,materials:{},requiredLevel:1,result:null,...details});

export function initializeEconomy(game) {
  if(game.materials===undefined)game.materials={};
  if(game.cardLevels===undefined){
    game.cardLevels={};
    if(validMap(game.upgrades))for(const [id,rank] of Object.entries(game.upgrades)){
      if(cardById[id]&&Number.isInteger(rank)&&rank>=0&&rank<=2)game.cardLevels[id]=1+rank*2;
    }
  }
  if(game.upgrades===undefined)game.upgrades={};
  if(validMap(game.cardLevels)&&validMap(game.upgrades))for(const [id,level] of Object.entries(game.cardLevels)){
    if(cardById[id]&&Number.isInteger(level)&&level>=1&&level<=5)game.upgrades[id]=Math.floor((level-1)/2);
  }
  if(game.economyVersion===undefined)game.economyVersion=1;
  return game;
}

export function validEconomy(game) {
  return game.economyVersion===1&&validMap(game.materials)&&validMap(game.cardLevels)&&
    Object.entries(game.materials).every(([id,n])=>Object.hasOwn(materialById,id)&&nonnegative(n))&&
    Object.entries(game.cardLevels).every(([id,n])=>Object.hasOwn(cardById,id)&&Number.isInteger(n)&&n>=1&&n<=5);
}

export function cardLevel(game,id) {
  const level=game.cardLevels?.[id];
  if(Number.isInteger(level)&&level>=1&&level<=5)return level;
  const old=game.upgrades?.[id];
  return Number.isInteger(old)&&old>=0&&old<=2?1+old*2:1;
}

export function cardRequirement(value) {
  const card=cardOf(value);
  if(!card)return null;
  const rank=rarityIndex[card.rarity]??0;
  const code=hash(card.id);
  const tier=[1,2,3+(code%2),4+(code%2)][rank];
  const level=starterIds.has(card.id)?1:Math.max([1,10,28,46][rank]+code%[9,18,18,18][rank],tierInfo(tier).level);
  return {level,tier,rarity:card.rarity};
}

export function materialRequirement(value) {
  const material=materialOf(value);
  return material?{level:material.requiredLevel,tier:material.tier}:null;
}

export function forgeRecipe(value) {
  const card=cardOf(value);
  if(!card)return null;
  const rank=rarityIndex[card.rarity]??0;
  const {level,tier}=cardRequirement(card);
  return {card:card.id,tier,requiredLevel:level,
    jade:Math.ceil(quantities.service[rank]*(1+.10*(tier-1))),
    materials:{['seal-jade-'+tier]:quantities.jade[rank],['essence-'+(card.school||'neutral')+'-'+tier]:quantities.essence[rank]},
  };
}

export function upgradeRecipe(value,targetLevel) {
  const recipe=forgeRecipe(value);
  if(!recipe||!Number.isInteger(targetLevel)||targetLevel<2||targetLevel>5)return null;
  const multiplier=[.50,.85,1.30,2.00][targetLevel-2];
  const tier=Math.max(recipe.tier,targetLevel);
  const requiredLevel=Math.max(recipe.requiredLevel,[10,28,37,55][targetLevel-2]);
  return {card:recipe.card,targetLevel,tier,requiredLevel,jade:Math.ceil(recipe.jade*multiplier),
    materials:Object.fromEntries(Object.entries(recipe.materials).map(([id,amount])=>[id.replace(/-\d$/,'-'+tier),Math.ceil(amount*multiplier)])),
  };
}

export function materialPrice(value) {return materialOf(value)?.price??0}
export function cardPrice(value) {
  const recipe=forgeRecipe(value);
  if(!recipe)return 0;
  const total=recipe.jade+Object.entries(recipe.materials).reduce((sum,[id,n])=>sum+n*materialPrice(id),0);
  return Math.ceil(total*1.35/5)*5;
}
export function salvageYield(value) {
  const recipe=forgeRecipe(value);
  return recipe?Object.fromEntries(Object.entries(recipe.materials).map(([id,n])=>[id,Math.max(1,Math.floor(n*.25))])):null;
}

function commonReason(game,requiredLevel) {
  if(!game.started)return 'Swear your oath before using the exchange or workshop.';
  if(game.active)return 'Return from your expedition before using the exchange or workshop.';
  if(levelOf(game)<requiredLevel)return `Reach cultivation level ${requiredLevel}.`;
  if(!nonnegative(game.jade))return 'The jade balance is invalid.';
  return '';
}

function quoteCosts(game,details) {
  const missing=Object.fromEntries(Object.entries(details.materials).filter(([id,n])=>(game.materials?.[id]||0)<n)
    .map(([id,n])=>[id,n-(game.materials?.[id]||0)]));
  let reason=commonReason(game,details.requiredLevel);
  if(!reason&&game.jade<details.jade)reason=`Need ${details.jade-game.jade} more jade.`;
  if(!reason&&Object.keys(missing).length){const [id,n]=Object.entries(missing)[0];reason=`Need ${n} more ${materialById[id].name}.`}
  if(!reason&&!Object.entries(details.materials).every(([id,n])=>nonnegative(game.materials?.[id])&&nonnegative(n)))reason='A material balance is invalid.';
  return {ok:!reason,reason,...details,missing};
}

function acquisition(game,id,quantity,forge) {
  const card=cardById[id];
  if(!card)return failure('Choose a valid technique.');
  if(!positiveQuantity(quantity))return failure('Choose a whole quantity from 1 to 99.');
  const owned=game.known?.[id]??0;
  const recipe=forgeRecipe(card);
  const details={jade:(forge?recipe.jade:cardPrice(card))*quantity,
    materials:forge?Object.fromEntries(Object.entries(recipe.materials).map(([key,n])=>[key,n*quantity])):{},
    requiredLevel:recipe.requiredLevel,tier:recipe.tier,owned,
    result:{card:id,quantity,level:cardLevel(game,id)},
  };
  if(!nonnegative(owned)||owned+quantity>4)return failure('Four copies already owned or requested.',details);
  return quoteCosts(game,details);
}
export const quoteBuyCard=(game,id,quantity=1)=>acquisition(game,id,quantity,false);
export const quotePurchase=quoteBuyCard;
export const quoteForge=(game,id,quantity=1)=>acquisition(game,id,quantity,true);

export function quoteBuyMaterial(game,id,quantity=1) {
  const material=materialById[id];
  if(!material)return failure('Choose a valid raw material.');
  if(!positiveQuantity(quantity))return failure('Choose a whole quantity from 1 to 99.');
  const current=game.materials?.[id]??0;
  const details={jade:material.price*quantity,materials:{},requiredLevel:material.requiredLevel,tier:material.tier,
    result:{material:id,quantity},owned:current};
  if(!nonnegative(current)||!Number.isSafeInteger(current+quantity))return failure('The material stack would exceed its safe limit.',details);
  return quoteCosts(game,details);
}

export function quoteUpgrade(game,id) {
  const card=cardById[id];
  if(!card)return failure('Choose a valid technique.');
  const currentLevel=cardLevel(game,id);
  if(!nonnegative(game.known?.[id])||!game.known[id])return failure('Own a copy of this technique before tempering it.');
  if(currentLevel>=5)return failure('This technique is already Perfected.',{level:currentLevel});
  const recipe=upgradeRecipe(card,currentLevel+1);
  return quoteCosts(game,{...recipe,level:currentLevel,result:{card:id,level:currentLevel+1,quantity:0}});
}

export function quoteSalvage(game,id,quantity=1) {
  if(!cardById[id])return failure('Choose a valid technique.');
  if(!positiveQuantity(quantity))return failure('Choose a whole quantity from 1 to 99.');
  const owned=game.known?.[id]??0;
  const reserved=reservedCopies(game,id);
  const output=Object.fromEntries(Object.entries(salvageYield(id)).map(([key,n])=>[key,n*quantity]));
  const details={jade:0,materials:{},requiredLevel:1,owned,reserved,available:Math.max(0,owned-reserved),
    result:{card:id,quantity,materials:output},yield:output};
  let reason=commonReason(game,1);
  if(!reason&&(!nonnegative(owned)||quantity>owned-reserved))reason=`Keep ${reserved} copies reserved in your active deck, saved decks, or draft.`;
  if(!reason&&!Object.entries(output).every(([key,n])=>nonnegative(game.materials?.[key]??0)&&Number.isSafeInteger((game.materials?.[key]||0)+n)))reason='The material stack would exceed its safe limit.';
  return {ok:!reason,reason,...details};
}

function spend(game,quote) {
  game.jade-=quote.jade;
  game.materials??={};
  for(const [id,n] of Object.entries(quote.materials)){
    const left=game.materials[id]-n;
    if(left)game.materials[id]=left;else delete game.materials[id];
  }
}
const success=(message,quote)=>({ok:true,message,...quote,reason:''});
export function buyCard(game,id,quantity=1) {
  const quote=quoteBuyCard(game,id,quantity);if(!quote.ok)return quote;
  spend(game,quote);game.known[id]=(game.known[id]||0)+quantity;
  return success(`Purchased ${cardById[id].name}.`,quote);
}
export function buyMaterial(game,id,quantity=1) {
  const quote=quoteBuyMaterial(game,id,quantity);if(!quote.ok)return quote;
  spend(game,quote);game.materials[id]=(game.materials[id]||0)+quantity;
  return success(`Purchased ${quantity} ${materialById[id].name}.`,quote);
}
export function forgeCard(game,id,quantity=1) {
  const quote=quoteForge(game,id,quantity);if(!quote.ok)return quote;
  spend(game,quote);game.known[id]=(game.known[id]||0)+quantity;
  return success(`Forged ${cardById[id].name}.`,quote);
}
export function upgradeCard(game,id) {
  const quote=quoteUpgrade(game,id);if(!quote.ok)return quote;
  spend(game,quote);game.cardLevels??={};game.upgrades??={};
  game.cardLevels[id]=quote.result.level;
  game.upgrades[id]=Math.floor((quote.result.level-1)/2);
  return success(`${cardById[id].name} reached level ${quote.result.level}.`,quote);
}
export function salvageCard(game,id,quantity=1) {
  const quote=quoteSalvage(game,id,quantity);if(!quote.ok)return quote;
  game.known[id]-=quantity;if(!game.known[id])delete game.known[id];
  game.materials??={};
  for(const [key,n] of Object.entries(quote.result.materials))game.materials[key]=(game.materials[key]||0)+n;
  return success(`Dismantled ${quantity} ${cardById[id].name}.`,quote);
}

export function bountyRewards(school,tier) {
  if(typeof school!=='string'||!familyData.some(entry=>entry[2]===school)||!Number.isInteger(tier)||!tierInfo(tier))return null;
  return {gold:8+5*tier,essence:6+3*tier,materials:{['seal-jade-'+tier]:6+2*tier,['essence-'+school+'-'+tier]:3+Math.floor(tier/2)}};
}

export function materialIcon(value,className='') {
  const material=materialOf(value);
  return material?`<img class="material-icon ${String(className).replace(/[^a-zA-Z0-9 _-]/g,'')}" src="${material.art}" alt="${material.name}" loading="lazy" decoding="async">`:'';
}
