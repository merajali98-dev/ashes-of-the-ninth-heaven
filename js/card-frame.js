export const CARD_TYPES = {
  strike: { name:'Strike', glyph:'sword' },
  ward: { name:'Ward', glyph:'shield' },
  mantra: { name:'Mantra', glyph:'spell' },
  remedy: { name:'Remedy', glyph:'heart' },
  hex: {name:'Hex', glyph:'hex'},
  formation: {name:'Formation', glyph:'formation'},
  stance: {name:'Stance', glyph:'stance'},
  counter: {name:'Counter', glyph:'counter'},
  pact: {name:'Pact', glyph:'pact'},
  ritual: {name:'Ritual', glyph:'ritual'},
  transmute: {name:'Transmute', glyph:'transmute'},
  finisher: {name:'Finisher', glyph:'finisher'},
};
const RARITIES = {common:1,uncommon:2,rare:3,legendary:5};
const EMBLEMS = {
  strike:'M7 3 11 4 17 14 14 17 4 11 3 7 8 9 9 8 7 3ZM19 3l2 4-5 2-7 11-3-3L17 6l2-3ZM3 19l3-3m12 2 3 3',
  ward:'M12 2 21 6v6c0 5-5 8-9 10-4-2-9-5-9-10V6l9-4ZM7 10l5-5 5 5v7H7v-7Zm3 7v-5h4v5',
  mantra:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M4 12c4-7 12-7 16 0-4 7-12 7-16 0ZM12 8l3 4-3 4-3-4 3-4Z',
  remedy:'M12 3c-4 4-5 8 0 13 5-5 4-9 0-13ZM3 9c0 8 4 12 9 10-1-6-5-9-9-10Zm18 0c-4 1-8 4-9 10 5 2 9-2 9-10ZM5 21h14',
  hex:'M3 12c4-8 14-8 18 0-4 8-14 8-18 0Zm9-4 3 4-3 4-3-4 3-4ZM7 2l2 3m6 14 2 3M2 5l3 3m14 8 3 3',
  formation:'M12 2 22 20H2L12 2Zm0 5 6 10H6l6-10Zm0 1v13M3 19l17-9M4 10l17 9',
  stance:'M18 3c-9-3-17 8-10 16 5 6 15 0 11-7-2-4-7-4-9-1-2 4 3 7 5 4M12 3v3m-9 7h3m13 5 2 2',
  counter:'M5 7h10l-4-4m4 4-4 4M19 17H9l4 4m-4-4 4-4M3 12V7m18 5v5',
  pact:'M12 2c-2 5-6 7-6 12a6 6 0 0 0 12 0c0-5-4-7-6-12ZM2 11l5 3m10 0 5-3M3 19l5-2m8 0 5 2',
  ritual:'M5 3h14M5 21h14M7 3v4l10 10v4M17 3v4L7 17v4m5-13v4m-2 7h4M2 12h3m14 0h3',
  transmute:'M12 2 22 12 12 22 2 12 12 2Zm0 4 5 6-5 6-5-6 5-6ZM2 5l4-3m12 20 4-3',
  finisher:'M12 1 14 8l7-3-5 7 6 4-8-1-2 8-2-8-8 1 6-4-5-7 7 3 2-7Zm0 6v10',
};

function typeEmblem(form) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${EMBLEMS[form]}"/></svg>`;
}

export function cardForm(card) {
  if (Object.hasOwn(CARD_TYPES,card.type)) return card.type;
  if (card.kind === 'attack') return 'strike';
  if (card.effects.some(effect => effect.type === 'heal' || effect.type === 'cleanse')) return 'remedy';
  if (card.effects.some(effect => effect.type === 'damage' ||
      effect.type === 'status' && ['burn','poison','bleed','weak','vulnerable'].includes(effect.status) && effect.target !== 'self')) return 'mantra';
  if (card.effects.some(effect => effect.type === 'block' ||
      effect.type === 'status' && ['ward','focus','regen'].includes(effect.status))) return 'ward';
  return 'mantra';
}

export function frameClasses(card) {
  const rarity = Object.hasOwn(RARITIES,card.rarity) ? card.rarity : 'common';
  return `seal-card form-${cardForm(card)} grade-${rarity}`;
}

export function frameCrest(card) {
  const rarity = Object.hasOwn(RARITIES,card.rarity) ? card.rarity : 'common';
  return `<span class="tablet-crown" aria-hidden="true"><i></i><b>${typeEmblem(cardForm(card))}</b><i></i></span>
    <svg class="jade-relief" viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">
      <path class="carving-shadow" d="M7 31V12Q7 5 14 5H23L30 12H41M59 12H70L77 5H86Q93 5 93 12V31M7 129V148Q7 155 14 155H23L30 148H41M59 148H70L77 155H86Q93 155 93 148V129"/>
      <path class="carving-light" d="M7 30V11Q7 4 14 4H23L30 11H41M59 11H70L77 4H86Q93 4 93 11V30M7 128V147Q7 154 14 154H23L30 147H41M59 147H70L77 154H86Q93 154 93 147V128"/>
    </svg>
    <span class="rarity-seals" title="${rarity}">${Array.from({length:RARITIES[rarity]},() => '<i></i>').join('')}<span class="sr-only">${rarity}</span></span>`;
}

export function typeSeal(card) {
  const form = cardForm(card);
  return `<span class="technique-type">${typeEmblem(form)}<span>${CARD_TYPES[form].name}</span></span>`;
}
