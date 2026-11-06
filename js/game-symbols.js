import { icon, esc } from './ui.js';
import { STATUS_INFO, describeEffect } from './combat.js';

const glyphs = {damage:'sword',strength:'sword',block:'shield',heal:'heart',draw:'cards',energy:'essence',cleanse:'spark',recover:'regen',dispel:'vulnerable'};
export function effectBadges(effects) {
  return `<span class="effect-badges">${effects.map(effect => {
    const amount = effect.amount ?? effect.value ?? 0;
    const kind = effect.type === 'status' ? effect.status : effect.type;
    const glyph = glyphs[kind] || kind;
    return `<span class="effect-badge effect-${esc(glyph)}" title="${esc(describeEffect(effect))}" aria-label="${esc(describeEffect(effect))}">
      ${icon(glyph)}<b>${amount}${effect.hits > 1 ? `×${effect.hits}` : ''}</b></span>`;
  }).join('')}</span>`;
}
export function statusBadges(entity) {
  return `<span class="status-badges">${Object.entries(entity.statuses || {}).filter(([,n]) => n > 0).map(([id,n]) =>
    `<span class="status-gem status-${esc(id)}" title="${esc(STATUS_INFO[id]?.name)} · ${esc(STATUS_INFO[id]?.description)}" aria-label="${esc(STATUS_INFO[id]?.name)} ${n}">${icon(id === 'strength' ? 'sword' : id)}<b>${n}</b></span>`).join('')}</span>`;
}

export function mechanicBadges(card) {
  const badges = [];
  if (card.healthCost) badges.push(`<span class="mechanic-badge" title="Vitality paid before effects">${icon('heart')} −${card.healthCost}</span>`);
  if (card.condition) badges.push(`<span class="mechanic-badge" title="Conditional bonus">${icon('focus')} ${esc(card.condition.replace('-',' '))}</span>`);
  if (card.aura) badges.push(`<span class="mechanic-badge" title="Timed formation or stance">${icon('ward')} ${card.aura.duration} turns</span>`);
  if (card.delayed) badges.push(`<span class="mechanic-badge" title="Delayed ritual">${icon('moon')} +${card.delayed.turns} turns</span>`);
  return `<span class="mechanic-badges">${badges.join('')}</span>`;
}
