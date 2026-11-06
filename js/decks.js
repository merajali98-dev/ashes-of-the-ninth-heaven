import {cards} from './content.js';

const cardIds=new Set(cards.map(card=>card.id));
export const DECK_LIMITS={min:8,max:22,copies:4,presets:8};
const fail=reason=>({ok:false,reason});
const ok=message=>({ok:true,message});
const nameOf=value=>String(value??'').trim().slice(0,24);
const counts=list=>list.reduce((result,id)=>(result[id]=(result[id]||0)+1,result),{});

export function initializeDecks(game) {
  game.deckPresets??=[{id:'deck-1',name:'Ashen Pilgrim',cards:[...game.deck]}];
  game.activeDeckId??=game.deckPresets[0]?.id??null;
  game.deckDraft??={name:game.deckPresets.find(deck=>deck.id===game.activeDeckId)?.name||'Journey deck',cards:[...game.deck],sourceId:game.activeDeckId};
  return game;
}

export function deckDraft(game) {
  return game.deckDraft||{name:'Journey deck',cards:[...game.deck],sourceId:game.activeDeckId??null};
}

export function deckRequirement(game,list,{allowLegacyCopies=false}={}) {
  if(!Array.isArray(list)||list.length<DECK_LIMITS.min||list.length>DECK_LIMITS.max) return 'A deck needs 8–22 cards.';
  for(const [id,quantity] of Object.entries(counts(list))) {
    if(!cardIds.has(id)||quantity>(game.known[id]||0)) return 'The deck contains a card copy you do not own.';
    if(!allowLegacyCopies&&quantity>DECK_LIMITS.copies) return 'A deck can carry at most four copies of one technique.';
  }
  return '';
}

export function beginDeckDraft(game,id='') {
  if(game.active) return fail('Return from your expedition before editing decks.');
  initializeDecks(game);
  const preset=game.deckPresets.find(deck=>deck.id===id);
  if(id&&id!=='new'&&!preset) return fail('This saved deck no longer exists.');
  game.deckDraft=id==='new'?{name:'Untitled deck',cards:[],sourceId:null}:
    {name:preset?.name||'Journey deck',cards:[...(preset?.cards||game.deck)],sourceId:preset?.id||game.activeDeckId};
  return ok();
}

export function editDeckDraft(game,id,delta) {
  if(game.active) return fail('The deck workshop is sealed during an expedition.');
  if(!cardIds.has(id)||![1,-1].includes(delta)) return fail('Choose a valid technique.');
  const draft=deckDraft(game);
  const quantity=draft.cards.filter(key=>key===id).length;
  if(delta===1&&(draft.cards.length>=DECK_LIMITS.max||quantity>=Math.min(DECK_LIMITS.copies,game.known[id]||0))) return fail('No spare copy or deck slot is available.');
  if(delta===-1&&!quantity) return fail('This technique is absent from the draft.');
  game.deckDraft={...draft,cards:[...draft.cards]};
  if(delta===1) game.deckDraft.cards.push(id);
  else game.deckDraft.cards.splice(game.deckDraft.cards.indexOf(id),1);
  return ok();
}

export function renameDeckDraft(game,name) {
  if(game.active) return fail('Return from your expedition before editing decks.');
  const clean=nameOf(name);
  if(!clean) return fail('Give this deck a name.');
  game.deckDraft={...deckDraft(game),name:clean};
  return ok();
}

export function saveDeckDraft(game,name) {
  if(game.active) return fail('Return from your expedition before saving decks.');
  const draft=deckDraft(game);
  const reason=deckRequirement(game,draft.cards);
  const clean=nameOf(name??draft.name);
  if(reason) return fail(reason);
  if(!clean) return fail('Give this deck a name.');
  const presets=game.deckPresets||[];
  const existing=presets.find(deck=>deck.id===draft.sourceId);
  if(presets.some(deck=>deck.id!==existing?.id&&deck.name.toLowerCase()===clean.toLowerCase())) return fail('Another saved deck already uses this name.');
  if(!existing&&presets.length>=DECK_LIMITS.presets) return fail('Eight decks are saved. Replace or delete one first.');
  const id=existing?.id||Array.from({length:8},(_,i)=>'deck-'+(i+1)).find(key=>!presets.some(deck=>deck.id===key));
  const saved={id,name:clean,cards:[...draft.cards]};
  game.deckPresets=existing?presets.map(deck=>deck.id===id?saved:deck):[...presets,saved];
  game.deckDraft={name:clean,cards:[...draft.cards],sourceId:id};
  return ok('Saved '+clean+'. Activate it to use this list in battle.');
}

export function activateDeck(game,id) {
  if(game.active) return fail('Finish the current expedition before switching decks.');
  const preset=game.deckPresets?.find(deck=>deck.id===id);
  if(!preset) return fail('Choose a saved deck.');
  const reason=deckRequirement(game,preset.cards,{allowLegacyCopies:true});
  if(reason) return fail(reason);
  game.deck=[...preset.cards];
  game.activeDeckId=id;
  return ok(preset.name+' is ready for battle.');
}

export function deleteDeck(game,id) {
  if(game.active) return fail('Return from your expedition before deleting decks.');
  if(id===game.activeDeckId) return fail('Activate another deck before deleting this one.');
  if(!game.deckPresets?.some(deck=>deck.id===id)) return fail('This saved deck no longer exists.');
  game.deckPresets=game.deckPresets.filter(deck=>deck.id!==id);
  if(game.deckDraft?.sourceId===id) game.deckDraft={...game.deckDraft,sourceId:null};
  return ok('Saved deck deleted. Your cards remain in inventory.');
}

export function reservedCopies(game,id) {
  return Math.max(game.deck.filter(key=>key===id).length,(game.deckDraft?.cards||[]).filter(key=>key===id).length,...(game.deckPresets||[]).map(deck=>deck.cards.filter(key=>key===id).length));
}

export function syncActiveDeck(game) {
  if(!game.activeDeckId||!game.deckPresets) return;
  game.deckPresets=game.deckPresets.map(deck=>deck.id===game.activeDeckId?{...deck,cards:[...game.deck]}:deck);
}

export function validDeckState(game) {
  if(!Array.isArray(game.deckPresets)||game.deckPresets.length<1||game.deckPresets.length>8||new Set(game.deckPresets.map(deck=>deck?.id)).size!==game.deckPresets.length) return false;
  if(!game.deckPresets.every(deck=>deck&&/^deck-[1-8]$/.test(deck.id)&&typeof deck.name==='string'&&deck.name.length>0&&deck.name.length<=24&&!deckRequirement(game,deck.cards,{allowLegacyCopies:true}))) return false;
  if(!game.deckPresets.some(deck=>deck.id===game.activeDeckId)) return false;
  const draft=game.deckDraft;
  return draft&&typeof draft.name==='string'&&draft.name.length<=24&&Array.isArray(draft.cards)&&draft.cards.length<=22&&
    draft.cards.every(id=>cardIds.has(id))&&Object.entries(counts(draft.cards)).every(([id,n])=>n<=game.known[id])&&
    (draft.sourceId===null||game.deckPresets.some(deck=>deck.id===draft.sourceId));
}
