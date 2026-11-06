import {cards} from './content.js';
import {REALMS,PERFECTED_ESSENCE,cultivationStatus} from './cultivation.js';
import {reservedCopies} from './decks.js';

export const PET_VERSION=1;
export const PET_MAX_ESSENCE=PERFECTED_ESSENCE;
export const PET_MAP_ART='assets/art/pet-map.webp';
const cardById=Object.assign(Object.create(null),Object.fromEntries(cards.map(card=>[card.id,card])));
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const count=value=>Number.isSafeInteger(value)&&value>=0;
const own=(object,key)=>typeof key==='string'&&Object.hasOwn(object,key);
const damage=(amount,growth=3)=>({type:'damage',amount,growth});
const block=(amount,growth=4)=>({type:'block',amount,growth});
const heal=(amount,growth=4)=>({type:'heal',amount,growth});
const status=(status,amount=1,self=false,growth=0)=>({type:'status',status,amount,...(self?{target:'self'}:{}),...(growth?{growth}:{})});
const cleanse=amount=>({type:'cleanse',amount});
const dispel=amount=>({type:'dispel',amount});
const ability=(id,name,unlockRealm,cooldown,description,effects)=>({id,name,unlockRealm,realm:unlockRealm,cooldown,description,effects});
const passive=(id,name,unlockRealm,trigger,description,effects)=>({id,name,unlockRealm,realm:unlockRealm,trigger,description,effects});
const definitions=[
  {
    id:'azure-dragon',name:'Azure Dragon',title:'Sovereign of the Cloudpeak',school:'star',color:'#70d9e6',biome:'Cloudpeak Mountains',position:{x:18,y:22},
    description:'A celestial river dragon coils around the highest peak, keeping the first thunder of a new heaven beneath its scales.',
    abilities:[
      ability('cloudpiercer','Cloudpiercer',0,2,'A measured lance of celestial qi.',[damage(6)]),
      ability('rain-seal','Rain Seal',1,3,'A rain-woven barrier shields the cultivator.',[block(7),status('ward',1,true)]),
      ability('sky-rend','Sky Rend',3,4,'Tear away enemy blessings before the falling star.',[dispel(2),damage(10)]),
      ability('heaven-descends','Heaven Descends',6,5,'The dragon marks the foe and calls down a celestial torrent.',[status('vulnerable',1),damage(15)]),
    ],
    passives:[
      passive('cloud-blessing','Cloud Blessing',0,'opening','A single cloud seal repels a hostile affliction.',[status('ward',1,true)]),
      passive('circling-cloud','Circling Cloud',2,'turn-start','Circling scales shelter you at each new turn.',[block(1,5)]),
      passive('heavenly-omen','Heavenly Omen',5,'turn-end','A celestial omen exposes the enemy.',[status('vulnerable',1)]),
    ],
  },
  {
    id:'vermilion-phoenix',name:'Vermilion Phoenix',title:'The Unextinguished Dawn',school:'ember',color:'#ff9b61',biome:'Cinder Caldera',position:{x:73,y:20},
    description:'A phoenix tends an ember that outlived the fallen sun. Each feather carries the warmth of a dawn the ledger could not tax.',
    abilities:[
      ability('cinder-feather','Cinder Feather',0,2,'Release a feather that burns beyond its first strike.',[damage(3),status('burn',2)]),
      ability('warmth-of-return','Warmth of Return',1,3,'Restorative flame clears a burden from your meridians.',[heal(5),cleanse(1)]),
      ability('scarlet-wing','Scarlet Wing',3,4,'A broad wing of flame shields you and scorches the foe.',[block(6),status('burn',3)]),
      ability('sun-that-remains','The Sun That Remains',6,5,'Call an uncompromising burst of dawnfire.',[damage(12),status('burn',4)]),
    ],
    passives:[
      passive('first-ember','First Ember',0,'opening','A first ember warms your strikes.',[status('strength',1,true)]),
      passive('renewing-plume','Renewing Plume',2,'turn-start','Each new turn brings a little restorative warmth.',[heal(1,5)]),
      passive('unspent-spark','Unspent Spark',5,'turn-end','One spark escapes into the enemy robes.',[status('burn',1)]),
    ],
  },
  {
    id:'white-tiger',name:'White Tiger',title:'The Oath of Winter Steel',school:'iron',color:'#e2dfd5',biome:'Frostpine Ravine',position:{x:13,y:55},
    description:'A white tiger stalks the frostpine ravine, its silver stripes etched with the names of oaths that remained unbroken.',
    abilities:[
      ability('silver-claw','Silver Claw',0,2,'A clean, disciplined strike.',[damage(7)]),
      ability('frostpine-roar','Frostpine Roar',1,3,'A commanding roar steadies your stance and weakens the foe.',[block(5),status('weak',1)]),
      ability('oath-hunter','Oath Hunter',3,4,'A precise pounce leaves the next strike an opening.',[damage(9),status('bleed',3)]),
      ability('winter-verdict','Winter Verdict',6,5,'The tiger tears away an enemy blessing before judgment.',[dispel(2),damage(17)]),
    ],
    passives:[
      passive('sentinel-pelt','Sentinel Pelt',0,'opening','A silver pelt stands between you and the first blow.',[block(3,4)]),
      passive('patient-prowl','Patient Prowl',2,'turn-start','Patient footwork supplies a fresh defense.',[block(2,5)]),
      passive('silver-mark','Silver Mark',5,'turn-end','The tiger marks the foe for the next attack.',[status('bleed',1)]),
    ],
  },
  {
    id:'black-tortoise',name:'Black Tortoise',title:'Keeper of the Deep Stillness',school:'tide',color:'#78d3d2',biome:'Stillwater Island',position:{x:78,y:76},
    description:'An ancient black tortoise bears an island of jade upon its shell. The water around it remembers how to be still.',
    abilities:[
      ability('river-shell','River Shell',0,2,'Raise a dependable wall of stillwater qi.',[block(7)]),
      ability('deepwater-pulse','Deepwater Pulse',1,3,'A pulse from the deep weakens the foe and shields you.',[status('weak',1),block(6)]),
      ability('wash-the-ledger','Wash the Ledger',3,4,'Still waters cleanse afflictions and mend vitality.',[cleanse(2),heal(6)]),
      ability('mountain-on-the-sea','Mountain on the Sea',6,5,'The ancient shell becomes a mountain of protection.',[block(14),status('ward',2,true)]),
    ],
    passives:[
      passive('deep-seal','Deep Seal',0,'opening','An ancient seal turns aside one affliction.',[status('ward',1,true)]),
      passive('tidal-shell','Tidal Shell',2,'turn-start','The tide raises fresh shelter at each new turn.',[block(2,5)]),
      passive('stillwater-renewal','Stillwater Renewal',5,'turn-end','Still water leaves a thread of regeneration.',[status('regen',1,true)]),
    ],
  },
  {
    id:'nine-tail-fox',name:'Nine-Tail Fox',title:'Whisper Between Lanterns',school:'shade',color:'#c7a3f4',biome:'Moonveil Grove',position:{x:44,y:55},
    description:'A silver fox dreams beneath a moonlit lantern tree. Its tails hide paths that lead around the collectors rather than through them.',
    abilities:[
      ability('moonlit-needle','Moonlit Needle',0,2,'A small spectral strike carries an unsettling weakness.',[damage(4),status('weak',1)]),
      ability('borrowed-face','Borrowed Face',1,3,'A borrowed face confuses the foe while you take cover.',[status('vulnerable',1),block(5)]),
      ability('steal-the-blessing','Steal the Blessing',3,4,'Whisper away enemy blessings and cleanse your own burden.',[dispel(3),cleanse(1),heal(3)]),
      ability('nine-lanterns','Nine Lanterns',6,5,'Nine ghostly lanterns make every shadow a blade.',[status('bleed',4),damage(12)]),
    ],
    passives:[
      passive('doubting-glance','Doubting Glance',0,'opening','The enemy doubts its opening strike.',[status('weak',1)]),
      passive('silken-shadow','Silken Shadow',2,'turn-start','A silken shadow catches a little of the coming blow.',[block(1,5)]),
      passive('moonlit-rest','Moonlit Rest',5,'turn-end','Moonlight restores a little spent vitality.',[heal(1,6)]),
    ],
  },
  {
    id:'jade-qilin',name:'Jade Qilin',title:'Mercy of the Unwritten Spring',school:'lotus',color:'#a6e2a8',biome:'Verdant Spring',position:{x:44,y:28},
    description:'A jade qilin walks so lightly that no flower bends beneath it. Its antlers guard a spring untouched by the heavenly levy.',
    abilities:[
      ability('springstep','Springstep',0,2,'A gentle step restores vitality and lends shelter.',[heal(3),block(3)]),
      ability('jade-antler','Jade Antler',1,3,'Sacred jade cleanses the meridians and wards affliction.',[cleanse(2),status('ward',1,true)]),
      ability('unwritten-spring','Unwritten Spring',3,4,'The spring overflows with patient renewal.',[heal(8),status('regen',2,true)]),
      ability('mercy-and-judgment','Mercy and Judgment',6,5,'The qilin offers protection, then judges those who reject it.',[block(10),damage(11)]),
    ],
    passives:[
      passive('quiet-mercy','Quiet Mercy',0,'opening','The spring mends vitality and leaves a little shelter before the duel.',[heal(3,5),block(1,0)]),
      passive('verdant-breath','Verdant Breath',2,'turn-start','A fresh breath of spring brings gentle regeneration.',[status('regen',1,true)]),
      passive('soft-earth','Soft Earth',5,'turn-end','Soft earth steadies you before the enemy acts.',[block(2,6)]),
    ],
  },
  {
    id:'kun-peng',name:'Kun Peng',title:'Dreamer of the Boundless Sea',school:'neutral',color:'#a9d9ea',biome:'Skyreef Expanse',position:{x:72,y:47},
    description:'A small skywhale dreams of becoming the great bird Peng. Its songs join the deepest water to the highest air.',
    abilities:[
      ability('sea-sky-breath','Sea-Sky Breath',0,2,'A broad breath pushes back the foe and shelters you.',[damage(4),block(3)]),
      ability('cloudwake','Cloudwake',1,3,'Float beyond a burden and recover beneath a cloudwake.',[cleanse(1),heal(5)]),
      ability('turn-the-horizon','Turn the Horizon',3,4,'A turning horizon strips enemy blessings and raises shelter.',[dispel(2),block(8)]),
      ability('boundless-descent','Boundless Descent',6,5,'The skywhale descends with the force of an open sea.',[damage(16),status('weak',1)]),
    ],
    passives:[
      passive('small-cloud','Small Cloud',0,'opening','A small cloud softens the opening attack.',[block(3,4)]),
      passive('distant-song','Distant Song',2,'turn-start','A distant song returns a little vitality.',[heal(1,5)]),
      passive('horizon-doubt','Horizon Doubt',5,'turn-end','The shifting horizon unsettles the enemy strike.',[status('weak',1)]),
    ],
  },
  {
    id:'thunder-serpent',name:'Thunder Serpent',title:'Coil of the Returning Storm',school:'thunder',color:'#a4b9ff',biome:'Stormglass Marsh',position:{x:39,y:82},
    description:'A horned serpent nests among stormglass reeds. Lightning runs beneath its scales like words across a living scripture.',
    abilities:[
      ability('forked-spark','Forked Spark',0,2,'A focused spark leaps from the serpent fang.',[damage(6)]),
      ability('stormcoil','Stormcoil',1,3,'A tightening coil exposes the foe and protects your footing.',[status('vulnerable',1),block(5)]),
      ability('shed-the-storm','Shed the Storm',3,4,'A shed lightning scale clears affliction and strikes outward.',[cleanse(2),damage(8)]),
      ability('returning-thunder','Returning Thunder',6,5,'Thunder returns along the same path twice.',[{type:'damage',amount:8,hits:2,growth:5}]),
    ],
    passives:[
      passive('charged-scale','Charged Scale',0,'opening','A charged scale steadies the strength of your strikes.',[status('strength',1,true)]),
      passive('fang-current','Fang Current',2,'turn-start','A current marks the enemy for a later strike.',[status('bleed',1)]),
      passive('grounded-coil','Grounded Coil',5,'turn-end','A grounded coil offers shelter before the enemy acts.',[block(2,6)]),
    ],
  },
];

function freezeDeep(value) {
  if(value&&typeof value==='object') {Object.values(value).forEach(freezeDeep);Object.freeze(value)}
  return value;
}
export const spiritPets=freezeDeep(definitions.map(pet=>({...pet,map:pet.position,
  eggArt:`assets/art/pet-${pet.id}-egg.webp`,youngArt:`assets/art/pet-${pet.id}-young.webp`,
  adultArt:`assets/art/pet-${pet.id}-adult.webp`,ascendedArt:`assets/art/pet-${pet.id}-ascended.webp`,
})));
export const petById=Object.freeze(Object.assign(Object.create(null),Object.fromEntries(spiritPets.map(pet=>[pet.id,pet]))));

export function initializePets(game) {
  if(game.petVersion===undefined) {
    if(game.pets!==undefined||game.activePetId!==undefined)throw new TypeError('Incomplete spirit sanctuary record.');
    game.petVersion=PET_VERSION;
    game.pets={};
    game.activePetId=null;
  }
  return game;
}

export function validPets(game) {
  return game.petVersion===PET_VERSION&&record(game.pets)&&
    Object.entries(game.pets).every(([id,pet])=>own(petById,id)&&record(pet)&&Number.isInteger(pet.realm)&&pet.realm>=0&&pet.realm<REALMS.length&&
      count(pet.essence)&&pet.essence<=PET_MAX_ESSENCE&&pet.essence>=REALMS[pet.realm].essence&&pet.realm<=game.realm)&&
    (game.activePetId===null||own(game.pets,game.activePetId));
}

export function petArt(id,realm=null) {
  const pet=petById[id];
  if(!pet)return '';
  return realm===null?pet.eggArt:realm<3?pet.youngArt:realm<6?pet.adultArt:pet.ascendedArt;
}

const creature=(game,id)=>own(game.pets||{},id)?game.pets[id]:null;
const failure=(reason,details={})=>({ok:false,reason,jade:0,materials:{},result:null,...details});
function commonReason(game) {
  if(!game.started)return 'Swear your oath before tending spirit companions.';
  if(game.active)return 'Return from the current expedition before tending spirit companions.';
  if(!validPets(game)||!count(game.jade))return 'Your spirit sanctuary record is invalid.';
  return '';
}
function costQuote(game,details,reason='') {
  reason=reason||commonReason(game);
  if(!reason&&game.jade<details.jade)reason=`Need ${details.jade-game.jade} more jade.`;
  const missing={};
  for(const [id,n]of Object.entries(details.materials)) {
    const owned=game.materials?.[id]??0;
    if(!count(owned)) {reason||='A material balance is invalid.';continue}
    if(owned<n)missing[id]=n-owned;
  }
  if(!reason&&Object.keys(missing).length)reason='Gather the missing hatching materials from the Shop or material commissions.';
  return {ok:!reason,reason,...details,missing};
}
function spend(game,quote) {
  game.jade-=quote.jade;
  for(const[id,n]of Object.entries(quote.materials)) {
    const remaining=game.materials[id]-n;
    if(remaining)game.materials[id]=remaining;else delete game.materials[id];
  }
}

export function quoteHatch(game,id) {
  if(!own(petById,id))return failure('Choose a spirit egg.');
  if(creature(game,id))return failure('This spirit companion has already hatched.');
  const first=Object.keys(game.pets||{}).length===0;
  const pet=petById[id];
  return costQuote(game,{jade:first?0:250,materials:first?{}:{'seal-jade-1':12,[`essence-${pet.school}-1`]:8},
    first,result:{petId:id,realm:0,essence:0},requiredLevel:1});
}
export function hatchPet(game,id) {
  const quote=quoteHatch(game,id);if(!quote.ok)return quote;
  spend(game,quote);game.pets[id]={realm:0,essence:0};
  return {...quote,ok:true,message:`${petById[id].name} has hatched. Select it as your companion when you are ready.`};
}

export function feedExperience(value) {
  const card=typeof value==='string'?cardById[value]:cardById[value?.id];
  return card?({common:8,uncommon:20,rare:55,legendary:140}[card.rarity]||0):0;
}
export function quoteFeed(game,id,cardId,quantity=1) {
  if(!own(petById,id)||!creature(game,id))return failure('Hatch this companion before feeding it.');
  if(!own(cardById,cardId))return failure('Choose an owned technique to feed.');
  if(!Number.isSafeInteger(quantity)||quantity<1||quantity>99)return failure('Choose a whole number of copies from 1 to 99.');
  const pet=creature(game,id),owned=game.known?.[cardId]??0;
  const reserved=reservedCopies(game,cardId),available=Math.max(0,owned-reserved);
  const nourishment=feedExperience(cardId)*quantity;
  const gained=Math.max(0,Math.min(nourishment,PET_MAX_ESSENCE-pet.essence));
  const result={petId:id,cardId,quantity,experience:nourishment,essence:pet.essence+gained,gained,wasted:nourishment-gained};
  let reason=commonReason(game);
  if(!reason&&(!count(owned)||quantity>available))reason=`Keep ${reserved} copies reserved by your active deck, saved decks, or editing draft.`;
  if(!reason&&!gained)reason='This spirit companion has perfected its cultivation and needs no more cards.';
  return {ok:!reason,reason,jade:0,materials:{},owned,reserved,available,experience:nourishment,result};
}
export function feedPet(game,id,cardId,quantity=1) {
  const quote=quoteFeed(game,id,cardId,quantity);if(!quote.ok)return quote;
  game.known[cardId]-=quantity;if(!game.known[cardId])delete game.known[cardId];
  game.pets[id].essence=quote.result.essence;
  return {...quote,ok:true,message:`${petById[id].name} gained ${quote.result.gained} cultivation essence. ${quantity} technique ${quantity===1?'copy was':'copies were'} consumed.`};
}

export function quoteEvolve(game,id) {
  const pet=creature(game,id);
  if(!own(petById,id)||!pet)return failure('Hatch this companion before evolving it.');
  const next=REALMS[pet.realm+1];
  if(!next)return failure('This companion has reached the final realm.');
  const result={petId:id,realm:pet.realm+1,essence:pet.essence};
  let reason=commonReason(game);
  if(!reason&&game.realm<pet.realm+1)reason=`Enter ${next.name} yourself before guiding this evolution.`;
  if(!reason&&pet.essence<next.essence)reason=`Feed ${next.essence-pet.essence} more cultivation essence to reach ${next.name}.`;
  return costQuote(game,{jade:Math.ceil(next.jade/2),materials:{},result,requiredRealm:pet.realm+1,requiredEssence:next.essence},reason);
}
export function evolvePet(game,id) {
  const quote=quoteEvolve(game,id);if(!quote.ok)return quote;
  spend(game,quote);game.pets[id].realm=quote.result.realm;
  return {...quote,ok:true,message:`${petById[id].name} entered ${REALMS[quote.result.realm].name}.`};
}
export function equipPet(game,id=null) {
  const reason=commonReason(game);if(reason)return failure(reason);
  if(id!==null&&(!own(petById,id)||!creature(game,id)))return failure('Choose a hatched companion.');
  game.activePetId=id;
  return {ok:true,message:id?`${petById[id].name} will accompany you in battle.`:'Your companion will remain in its habitat.'};
}

function resolvedEffects(effects,realm) {
  return effects.map(effect=>{
    const {growth,...resolved}=effect;
    return {...resolved,amount:effect.amount+(growth?Math.floor(realm/growth):0)};
  });
}
export function previewPet(id,realm=0) {
  const definition=petById[id];
  if(!definition||!Number.isInteger(realm)||!REALMS[realm])return null;
  return {id,name:definition.name,title:definition.title,school:definition.school,realm,art:petArt(id,realm),
    abilities:definition.abilities.map(ability=>({...ability,effects:resolvedEffects(ability.effects,realm),unlocked:realm>=ability.unlockRealm})),
    passives:definition.passives.map(passive=>({...passive,effects:resolvedEffects(passive.effects,realm),unlocked:realm>=passive.unlockRealm})),
  };
}
export function petStatus(game,id) {
  const definition=petById[id];if(!definition)return null;
  const owned=creature(game,id),pet=owned||{realm:0,essence:0};
  const cultivation=cultivationStatus({...game,realm:pet.realm,essence:pet.essence,active:null});
  const quote=owned?quoteEvolve(game,id):null;
  return {...cultivation,petId:id,hatched:Boolean(owned),art:petArt(id,owned?pet.realm:null),
    evolutionReady:Boolean(quote?.ok),evolutionRequirement:quote?.reason||'',evolutionJade:quote?.jade||0,
    breakthroughReady:Boolean(quote?.ok),equipped:game.activePetId===id};
}
export function snapshotPet(game,id=game.activePetId) {
  const pet=creature(game,id);
  if(!pet)return null;
  return {...previewPet(id,pet.realm),essence:pet.essence,level:petStatus(game,id).level};
}

/** Battle snapshots are canonical copies, independent of the living sanctuary. */
export function validPetSnapshot(pet,turn) {
  if(pet===undefined||pet===null)return true;
  if(!record(pet)||!own(petById,pet.id)||!Number.isInteger(pet.realm)||!REALMS[pet.realm]||!count(pet.essence)||
    pet.essence<REALMS[pet.realm].essence||pet.essence>PET_MAX_ESSENCE||!Number.isInteger(turn)||turn<1)return false;
  const expected=previewPet(pet.id,pet.realm);
  if(!Object.entries(expected).every(([key,value])=>JSON.stringify(pet[key])===JSON.stringify(value)))return false;
  const level=cultivationStatus({started:true,jade:0,active:null,realm:pet.realm,essence:pet.essence}).level;
  if(pet.level!==level||!record(pet.readyAt)||!count(pet.lastAbilityTurn)||pet.lastAbilityTurn>turn)return false;
  const usedTurns=[];
  if(!Object.entries(pet.readyAt).every(([id,ready])=>{
    const ability=expected.abilities.find(ability=>ability.id===id);
    if(!ability||!ability.unlocked||!count(ready)||ready>turn+ability.cooldown)return false;
    const used=ready-ability.cooldown;
    if(used<1||used>pet.lastAbilityTurn)return false;
    usedTurns.push(used);
    return true;
  }))return false;
  return new Set(usedTurns).size===usedTurns.length&&Math.max(0,...usedTurns)===pet.lastAbilityTurn;
}
