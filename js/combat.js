export const STATUS_INFO = Object.freeze({
  burn: { name: 'Burn', description: 'Lose HP equal to Burn at the start of your turn, then lose half the stacks, rounded up.' },
  poison: { name: 'Poison', description: 'Lose HP equal to Poison at the start of your turn, then lose one stack.' },
  bleed: { name: 'Bleed', description: 'The next attack hit deals extra damage equal to Bleed and removes one stack.' },
  weak: { name: 'Weak', description: 'Deal 25% less attack damage. Lose one stack at the end of your turn.' },
  vulnerable: { name: 'Vulnerable', description: 'The next attack hit deals 50% more damage and removes one stack.' },
  strength: { name: 'Strength', description: 'Add one attack damage per stack to each hit.' },
  focus: { name: 'Focus', description: 'Gain one additional Guard per stack whenever you gain Guard.' },
  regen: { name: 'Regeneration', description: 'Heal equal to Regeneration at the start of your turn, then lose one stack.' },
  ward: { name: 'Ward', description: 'Prevent the next hostile status application and remove one Ward.' },
});

export const RESONANCE_INFO = Object.freeze({
  iron: { name: 'Iron Bastion', description: 'Gain 6 Guard.', effect: { type: 'block', amount: 6 } },
  ember: { name: 'Ember Pyre', description: 'Apply 3 Burn.', effect: { type: 'status', status: 'burn', amount: 3 } },
  tide: { name: 'Tide Renewal', description: 'Heal 4 HP.', effect: { type: 'heal', amount: 4 } },
  shade: { name: 'Shade Ambush', description: 'Apply 2 Vulnerable.', effect: { type: 'status', status: 'vulnerable', amount: 2 } },
  lotus: { name: 'Lotus Sanctuary', description: 'Gain 1 Ward.', effect: { type: 'status', status: 'ward', amount: 1, target: 'self' } },
  thunder: { name: 'Thunder Judgment', description: 'Deal 6 attack damage.', effect: { type: 'damage', amount: 6 } },
  star: { name: 'Star Revelation', description: 'Draw 1 additional card.', effect: { type: 'draw', amount: 1 } },
});

const AFFLICTIONS = ['poison', 'burn', 'bleed', 'vulnerable', 'weak'];
const HAND_LIMIT = 10;
const LOG_LIMIT = 100;
const RESONANCE_THRESHOLD = 3;

function quantity(value, fallback = 0) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function initialSeed(seed) {
  if (Number.isFinite(seed)) return (seed >>> 0) || 1;
  let hash = 2166136261;
  for (const character of String(seed ?? 'ninth-heaven')) {
    hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
  }
  return (hash >>> 0) || 1;
}

function random(state) {
  let seed = state.rng;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  state.rng = seed >>> 0;
  return state.rng / 4294967296;
}

function shuffle(state, cards) {
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random(state) * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

function log(state, message) {
  state.log.push(message);
  if (state.log.length > LOG_LIMIT) state.log.shift();
}

const eventCollectors = new WeakMap();

// Presentation events are scoped to a single action and never stored in a save.
export function captureCombatEvents(state, action) {
  const events = [];
  const previous = eventCollectors.get(state);
  eventCollectors.set(state, events);
  try {
    return { result: action(), events };
  } finally {
    if (previous) eventCollectors.set(state, previous);
    else eventCollectors.delete(state);
  }
}

function emit(state, type, target, details) {
  eventCollectors.get(state)?.push({ type, target: target === state.enemy ? 'enemy' : 'player', ...details });
}

function combatant(name, hp, maxHp) {
  return { name, hp, maxHp, block: 0, statuses: {} };
}

function cardRegistry(cards) {
  return Array.isArray(cards) ? Object.fromEntries(cards.map(card => [card.id, card])) : cards;
}

function lookupCard(registry, id) {
  if (registry instanceof Map) return registry.get(id);
  return Object.hasOwn(registry, id) ? registry[id] : undefined;
}

function normalizeDeck(deck, registry) {
  if (!Array.isArray(deck) || deck.length === 0) throw new TypeError('A nonempty deck is required.');
  return deck.map(entry => {
    const id = typeof entry === 'string' ? entry : entry?.id;
    if (typeof id !== 'string' || !lookupCard(registry, id)) {
      throw new TypeError(`Unknown combat card: ${id}`);
    }
    return { id, upgrade: quantity(entry?.upgrade), ...(Number.isInteger(entry?.level) ? {level:Math.max(1,Math.min(5,entry.level))} : {}) };
  });
}

function getPhases(enemy) {
  if (!Array.isArray(enemy.intents) || !enemy.intents.length) {
    throw new TypeError('An enemy must have at least one intent.');
  }
  const transitions = (enemy.phases ?? []).filter(phase => (
    Number.isFinite(phase.at) && phase.at > 0 && phase.at < 1 && phase.intents?.length
  )).sort((left, right) => right.at - left.at);
  return [{ at: 1, intents: enemy.intents }, ...transitions];
}

/** Create a deterministic encounter. Card and enemy definitions remain untouched. */
export function createCombat({
  deck, cards, enemy, hp, maxHp, seed, energy = 3, draw = 5, bonuses = {}, pet = null,
}) {
  const registry = cardRegistry(cards ?? {});
  const playerMaxHp = Math.max(1, quantity(maxHp, quantity(hp, 60)));
  const enemyMaxHp = Math.max(1, quantity(enemy?.hp, 1));
  const drawPile = normalizeDeck(deck, registry);
  const cardIds = new Set(drawPile.map(entry => entry.id));
  const state = {
    player: combatant('You', Math.min(quantity(hp, playerMaxHp), playerMaxHp), playerMaxHp),
    enemy: { ...combatant(enemy.name, enemyMaxHp, enemyMaxHp), id: enemy.id, phase: 0, phaseName: null,
      sealPhases: Boolean(enemy.sealPhases) },
    cards: Object.fromEntries([...cardIds].map(id => [id, lookupCard(registry, id)])),
    phases: getPhases(enemy),
    bonuses,
    rng: initialSeed(seed),
    turn: 1,
    enemyMove: 0,
    energy: 0,
    maxEnergy: quantity(energy, 3) + quantity(bonuses.energy),
    draw: quantity(draw, 5) + quantity(bonuses.draw),
    hand: [],
    drawPile,
    discard: [],
    exhausted: [],
    auras: [],
    rituals: [],
    outcome: null,
    resonance: { element: null, count: 0 },
    log: [],
    ...(pet ? {pet:{...structuredClone(pet),readyAt:{},lastAbilityTurn:0}} : {}),
  };
  shuffle(state, state.drawPile);
  log(state, `${state.enemy.name} challenges you.`);
  if (settleOutcome(state)) return state;
  state.energy = state.maxEnergy;
  state.player.block = quantity(bonuses.block);
  for (const status of ['strength', 'focus', 'ward', 'regen']) {
    const amount = quantity(bonuses[status]);
    if (amount) state.player.statuses[status] = amount;
  }
  heal(state.player, quantity(bonuses.heal));
  drawCards(state, state.draw);
  triggerPetPassives(state,'opening');
  return state;
}

function drawCards(state, count) {
  let drawn = 0;
  while (drawn < count && state.hand.length < HAND_LIMIT) {
    if (!state.drawPile.length && state.discard.length) {
      state.drawPile = shuffle(state, state.discard);
      state.discard = [];
    }
    const card = state.drawPile.pop();
    if (!card) break;
    state.hand.push(card);
    drawn++;
  }
  return drawn;
}

export function resolveTechnique(base, upgradeLevel = 0, bonuses = {}, cardLevel) {
  const level = Number.isInteger(cardLevel) ? Math.max(1,Math.min(5,cardLevel)) : null;
  if (level) upgradeLevel = Math.floor((level - 1) / 2);
  const school = base.school ?? base.element ?? 'neutral';
  const upgraded = upgradeLevel > 0 ? base.upgraded : undefined;
  const effects = (upgraded?.effects ?? base.effects ?? []).map(effect => {
    const type = effect.type;
    const amount = quantity(effect.amount ?? effect.value, type === 'cleanse' ? 1 : 0);
    const increment = type === 'block' || type === 'heal' || (type === 'damage' && quantity(effect.hits, 1) === 1)
      ? 2 : 1;
    const upgrade = amount && type !== 'energy' && !upgraded?.effects ? increment * upgradeLevel : 0;
    const schoolBonus = quantity(bonuses.school?.[school]?.[type]);
    return { ...effect, amount: amount + upgrade + schoolBonus };
  });
  if (upgradeLevel > 0 && !upgraded?.effects && effects.length && effects.every(effect => effect.type === 'energy')) {
    effects.push({type:'block',amount:upgradeLevel * 2});
  }
  if (level && Math.floor(level / 2)) {
    const guard = effects.find(effect => effect.type === 'block' && effect.target !== 'opponent');
    if (guard) guard.amount += Math.floor(level / 2);
    else effects.push({type:'block',amount:Math.floor(level / 2)});
  }
  return { ...base, ...upgraded, school, effects, upgrade:upgradeLevel, ...(level ? {level} : {}), cost:quantity(upgraded?.cost ?? base.cost) };
}

function resolvedCard(state, entry) {
  return resolveTechnique(lookupCard(state.cards,entry.id),entry.upgrade,state.bonuses,entry.level);
}

/** Resolve a hand slot to its actual playable card, including upgrades and gear. */
export function getCard(state, handIndex) {
  const entry = Number.isInteger(handIndex) ? state.hand[handIndex] : undefined;
  return entry ? resolvedCard(state, entry) : undefined;
}

/** The displayed intent can change immediately when a foe crosses a phase threshold. */
export function getIntent(state) {
  if (state.outcome) return null;
  const intents = state.phases[state.enemy.phase].intents;
  return intents[state.enemyMove % intents.length];
}

function syncEnemyPhase(state) {
  let phase = state.enemy.phase;
  const hpFraction = state.enemy.hp / state.enemy.maxHp;
  while (phase + 1 < state.phases.length && hpFraction <= state.phases[phase + 1].at) phase++;
  if (phase === state.enemy.phase) return;
  state.enemy.phase = phase;
  state.enemy.phaseName = state.phases[phase].name ?? `Phase ${phase + 1}`;
  state.enemyMove = 0;
  log(state, `${state.enemy.name} enters ${state.enemy.phaseName}.`);
  emit(state, 'phase', state.enemy, {name:state.enemy.phaseName, sealed:state.enemy.sealPhases});
}

function decay(unit, status, amount = 1) {
  const remaining = (unit.statuses[status] ?? 0) - amount;
  if (remaining > 0) unit.statuses[status] = remaining;
  else delete unit.statuses[status];
}

function addStatus(state, target, status, amount) {
  if (!Object.hasOwn(STATUS_INFO, status) || !amount) return;
  if (AFFLICTIONS.includes(status) && target.statuses.ward) {
    decay(target, 'ward');
    log(state, `${target.name}: Ward prevents ${STATUS_INFO[status].name}.`);
    emit(state, 'ward', target, {status});
    return;
  }
  target.statuses[status] = (target.statuses[status] ?? 0) + amount;
  log(state, `${target.name}: +${amount} ${STATUS_INFO[status].name}.`);
  emit(state, 'status', target, {amount,status,hostile:AFFLICTIONS.includes(status)});
}

function cleanse(state, target, amount) {
  for (const status of AFFLICTIONS) {
    const removed = Math.min(amount, target.statuses[status] ?? 0);
    if (!removed) continue;
    decay(target, status, removed);
    log(state, `${target.name}: Cleansed ${removed} ${STATUS_INFO[status].name}.`);
    emit(state, 'cleanse', target, {amount:removed,status});
    amount -= removed;
    if (!amount) break;
  }
}

function loseHp(state, unit, amount) {
  const sealed = unit === state.enemy && unit.sealPhases;
  const next = sealed ? state.phases[unit.phase + 1] : null;
  const floor = next ? Math.floor(next.at * unit.maxHp) : 0;
  const lost = sealed && unit.phase > 0 && state.enemyMove === 0
    ? 0 : Math.min(Math.max(0, unit.hp - floor), amount);
  unit.hp -= lost;
  if (sealed) syncEnemyPhase(state);
  return lost;
}

function heal(unit, amount) {
  const restored = Math.min(unit.maxHp - unit.hp, amount);
  unit.hp += restored;
  return restored;
}

function attackDamage(actor, base, bleed, vulnerable) {
  const strong = base + (actor.statuses.strength ?? 0);
  const weakened = actor.statuses.weak ? Math.floor(strong * 0.75) : strong;
  return (vulnerable ? Math.floor(weakened * 1.5) : weakened) + bleed;
}

function attack(state, actor, target, amount, hits) {
  let blocked = 0;
  let lost = 0;
  let landed = 0;
  for (let hit = 0; hit < hits && target.hp > 0; hit++) {
    if (target === state.enemy && target.sealPhases && target.phase > 0 && state.enemyMove === 0) {
      if (!landed) emit(state, 'seal', target);
      break;
    }
    landed++;
    const bleed = target.statuses.bleed ?? 0;
    const vulnerable = target.statuses.vulnerable ?? 0;
    const damage = attackDamage(actor, amount, bleed, vulnerable);
    const absorbed = Math.min(target.block, damage);
    target.block -= absorbed;
    blocked += absorbed;
    lost += loseHp(state, target, damage - absorbed);
    if (bleed) decay(target, 'bleed');
    if (vulnerable) decay(target, 'vulnerable');
  }
  log(state, `${target.name}: ${lost} HP lost${blocked ? `, ${blocked} absorbed by Guard` : ''}.`);
  if (landed) emit(state, 'strike', target, {amount:lost,blocked,hits:landed});
}

function settleOutcome(state) {
  if (state.outcome) return state.outcome;
  if (state.player.hp <= 0) {
    state.outcome = 'defeat';
    log(state, 'Your meridians fall silent.');
  } else if (state.enemy.hp <= 0) {
    state.outcome = 'victory';
    log(state, `${state.enemy.name} falls.`);
  }
  if (state.outcome) {
    state.auras = [];
    state.rituals = [];
  }
  return state.outcome;
}

function applyEffect(state, actor, opponent, effect, sourceId) {
  const { type, status } = effect;
  const hostile = type === 'damage' || (type === 'status' && AFFLICTIONS.includes(status));
  const target = effect.target ? (effect.target === 'self' ? actor : opponent) : hostile ? opponent : actor;
  const amount = quantity(effect.amount ?? effect.value, type === 'cleanse' ? 1 : 0);
  switch (type) {
    case 'damage':
      attack(state, actor, target, amount, quantity(effect.hits, 1));
      break;
    case 'block': {
      const block = amount + (target.statuses.focus ?? 0);
      target.block += block;
      if (block) log(state, `${target.name}: +${block} Guard.`);
      if (block) emit(state, 'guard', target, {amount:block});
      break;
    }
    case 'heal': {
      const restored = heal(target, amount);
      if (restored) log(state, `${target.name}: +${restored} HP.`);
      emit(state, 'heal', target, {amount:restored});
      break;
    }
    case 'draw':
      if (target === state.player) emit(state, 'draw', target, {amount:drawCards(state, amount)});
      break;
    case 'energy':
      if (target === state.player) {
        state.energy += amount;
        if (amount) emit(state, 'qi', target, {amount});
      }
      break;
    case 'status':
      addStatus(state, target, status, amount);
      break;
    case 'cleanse':
      cleanse(state, target, amount);
      break;
    case 'recover': {
      const recovered = [];
      for (let index = state.exhausted.length - 1; index >= 0 && recovered.length < amount; index--) {
        const entry = state.exhausted[index];
        const definition = lookupCard(state.cards,entry.id);
        const payloads = [...definition.effects,...(definition.bonusEffects || []),
          ...(definition.aura?.effects || []),...(definition.delayed?.effects || [])];
        if (entry.id !== sourceId && !payloads.some(effect => effect.type === 'recover')) {
          recovered.unshift(...state.exhausted.splice(index,1));
        }
      }
      state.discard.push(...recovered);
      log(state, `Recovered ${recovered.length} exhausted techniques to discard.`);
      emit(state,'recover',state.player,{amount:recovered.length});
      break;
    }
    case 'dispel': {
      let remaining = amount;
      for (const buff of ['strength','focus','regen','ward']) {
        const removed = Math.min(remaining,opponent.statuses[buff] || 0);
        if (removed) decay(opponent,buff,removed);
        remaining -= removed;
        if (!remaining) break;
      }
      log(state,`${opponent.name}: ${amount - remaining} positive stacks dispelled.`);
      emit(state,'dispel',opponent,{amount:amount - remaining});
      break;
    }
    default:
      throw new TypeError(`Unknown combat effect: ${type}`);
  }
}

function applyEffects(state, actor, opponent, effects, sourceId) {
  for (const effect of effects) {
    applyEffect(state, actor, opponent, effect, sourceId);
    if (settleOutcome(state)) return;
  }
}

function resonate(state, school) {
  if (school === 'neutral') return;
  const chain = state.resonance;
  chain.count = school === chain.element ? chain.count + 1 : 1;
  chain.element = school;
  if (chain.count < RESONANCE_THRESHOLD) return;
  chain.count = 0;
  const resonance = Object.hasOwn(RESONANCE_INFO, school) ? RESONANCE_INFO[school] : undefined;
  log(state, `${resonance?.name ?? 'Resonance'}: +1 Qi and draw 1.`);
  emit(state, 'resonance', state.player, {name:resonance?.name ?? 'Resonance',school});
  state.energy++;
  emit(state, 'qi', state.player, {amount:1});
  emit(state, 'draw', state.player, {amount:drawCards(state, 1)});
  if (resonance) applyEffects(state, state.player, state.enemy, [resonance.effect]);
}

export function conditionMet(state, card) {
  switch (card.condition) {
    case 'guarded': return state.player.block > 0;
    case 'wounded': return state.player.hp * 2 <= state.player.maxHp;
    case 'afflicted': return AFFLICTIONS.some(status => state.enemy.statuses[status] > 0);
    case 'resonant': return card.school !== 'neutral' && state.resonance.element === card.school && state.resonance.count >= 2;
    case 'empty-hand': return state.hand.length === 0;
    default: return false;
  }
}

function triggerAuras(state, trigger, auras = state.auras || []) {
  for (const aura of auras) {
    if (aura.trigger !== trigger) continue;
    log(state,`${aura.name} activates.`);
    emit(state,'aura',state.player,{name:aura.name,school:aura.school});
    applyEffects(state,state.player,state.enemy,aura.effects,aura.source);
    if (state.outcome) return;
  }
}

function installTechniques(state, card) {
  if (card.aura) {
    state.auras ||= [];
    const aura = {source:card.id,name:card.name,school:card.school,created:state.turn,
      expires:state.turn + card.aura.duration,...card.aura};
    const old = state.auras.findIndex(entry => entry.source === card.id);
    if (old >= 0) state.auras[old] = aura;
    else state.auras.push(aura);
    emit(state,'aura',state.player,{name:card.name,school:card.school});
    log(state,`${card.name} established for ${card.aura.duration} turns.`);
  }
  if (card.delayed) {
    state.rituals ||= [];
    state.rituals.push({source:card.id,name:card.name,school:card.school,
      due:state.turn + card.delayed.turns,effects:card.delayed.effects});
    emit(state,'ritual',state.player,{name:card.name,turns:card.delayed.turns});
    log(state,`${card.name} will resolve in ${card.delayed.turns} turns.`);
  }
}

function resolveScheduledTechniques(state) {
  const ready = (state.rituals || []).filter(ritual => ritual.due <= state.turn);
  state.rituals = (state.rituals || []).filter(ritual => ritual.due > state.turn);
  for (const ritual of ready) {
    log(state,`${ritual.name} resolves.`);
    emit(state,'ritual',state.player,{name:ritual.name,turns:0});
    applyEffects(state,state.player,state.enemy,ritual.effects,ritual.source);
    if (state.outcome) return;
  }
  const startAuras = (state.auras || []).filter(aura =>
    aura.trigger === 'turn-start' && aura.created < state.turn && aura.expires >= state.turn);
  triggerAuras(state,'turn-start',startAuras);
  state.auras = (state.auras || []).filter(aura => aura.expires > state.turn);
}

/** Play a single hand slot. Invalid actions leave the encounter untouched. */
export function playCard(state, handIndex) {
  if (state.outcome) return { ok: false, reason: 'The battle has ended.' };
  const card = getCard(state, handIndex);
  if (!card) return { ok: false, reason: 'That card is no longer in hand.' };
  if (state.energy < card.cost) return { ok: false, reason: 'Not enough Qi.' };
  if (card.healthCost && state.player.hp <= card.healthCost) return {ok:false,reason:'This pact must leave at least 1 vitality.'};
  if (card.aura && (state.auras || []).length >= 3 && !state.auras.some(aura => aura.source === card.id)) {
    return {ok:false,reason:'Three formations or stances are already active.'};
  }
  if (card.delayed && (state.rituals || []).length >= 6) return {ok:false,reason:'Six rituals are already pending.'};
  const priorAuras = [...(state.auras || [])];
  const [entry] = state.hand.splice(handIndex, 1);
  const qualified = conditionMet(state,card);
  state.energy -= card.cost;
  if (card.healthCost) {
    state.player.hp -= card.healthCost;
    emit(state,'sacrifice',state.player,{amount:card.healthCost});
    log(state,`Pact paid: ${card.healthCost} vitality.`);
  }
  log(state, `You play ${card.name}${card.upgrade ? '+' : ''}.`);
  applyEffects(state, state.player, state.enemy, card.effects, card.id);
  if (!state.outcome && qualified && card.bonusEffects) {
    emit(state,'condition',state.player,{name:card.condition});
    log(state,`${card.condition} condition fulfilled.`);
    applyEffects(state,state.player,state.enemy,card.bonusEffects,card.id);
  }
  const directEffects = [...card.effects,...(qualified ? card.bonusEffects || [] : [])];
  for (const [trigger,type] of [['on-attack','damage'],['on-guard','block'],['on-status','status']]) {
    if (state.outcome) break;
    const activated = trigger === 'on-attack' ? card.kind === 'attack' : directEffects.some(effect => effect.type === type);
    if (activated) triggerAuras(state,trigger,priorAuras);
  }
  if (!state.outcome) installTechniques(state,card);
  if (!state.outcome) resonate(state, card.school);
  (card.exhaust ? state.exhausted : state.discard).push(entry);
  if (!state.outcome) syncEnemyPhase(state);
  return { ok: true };
}

/** Apply campaign-owned consumable effects without playing a card. */
export function useConsumable(state, effects, label = 'a consumable') {
  if (state.outcome) return { ok: false, reason: 'The battle has ended.' };
  if (!Array.isArray(effects) || !effects.length) return { ok: false, reason: 'This item has no combat effect.' };
  log(state, `You use ${label}.`);
  applyEffects(state, state.player, state.enemy, effects);
  if (!state.outcome) syncEnemyPhase(state);
  return { ok: true };
}

/** Companion actions share one invocation per player turn; cooldowns use absolute turns. */
export function petAbilityStatus(state,id) {
  const pet=state?.pet;
  const ability=pet?.abilities?.find(ability=>ability.id===id);
  const remaining=ability?Math.max(0,(pet.readyAt?.[id]||0)-state.turn):0;
  let reason='';
  if(!pet||!ability)reason='No companion ability is selected.';
  else if(state.outcome)reason='The battle has ended.';
  else if(pet.realm<ability.unlockRealm)reason='Evolve your companion to unlock this ability.';
  else if(remaining)reason=`Ready in ${remaining} ${remaining===1?'turn':'turns'}.`;
  else if(pet.lastAbilityTurn===state.turn)reason='Your companion has already acted this turn.';
  return {ok:!reason,reason,remaining,ability};
}

export function usePetAbility(state,id) {
  const quote=petAbilityStatus(state,id);
  if(!quote.ok)return {ok:false,reason:quote.reason};
  const pet=state.pet;
  pet.readyAt[id]=state.turn+quote.ability.cooldown;
  pet.lastAbilityTurn=state.turn;
  log(state,`${pet.name} invokes ${quote.ability.name}.`);
  emit(state,'pet-ability',state.player,{name:quote.ability.name,pet:pet.name,school:pet.school});
  applyEffects(state,state.player,state.enemy,quote.ability.effects);
  if(!state.outcome)syncEnemyPhase(state);
  return {ok:true};
}

function triggerPetPassives(state,trigger) {
  if(!state.pet||state.outcome)return;
  for(const passive of state.pet.passives||[]) {
    if(passive.trigger!==trigger||state.pet.realm<passive.unlockRealm)continue;
    log(state,`${state.pet.name}: ${passive.name}.`);
    emit(state,'pet-passive',state.player,{name:passive.name,pet:state.pet.name,school:state.pet.school});
    applyEffects(state,state.player,state.enemy,passive.effects);
    if(state.outcome)return;
    syncEnemyPhase(state);
  }
}

function startTurn(state, unit) {
  unit.block = 0;
  for (const status of ['burn', 'poison']) {
    const amount = unit.statuses[status];
    if (!amount) continue;
    const lost = loseHp(state, unit, amount);
    decay(unit, status, status === 'burn' ? Math.ceil(amount / 2) : 1);
    log(state, `${unit.name}: ${lost} HP lost to ${STATUS_INFO[status].name}.`);
    if (lost) emit(state, 'tick', unit, {amount:lost,status});
    if (settleOutcome(state)) return;
  }
  const regeneration = unit.statuses.regen;
  if (regeneration) {
    const restored = heal(unit, regeneration);
    decay(unit, 'regen');
    if (restored) log(state, `${unit.name}: +${restored} HP from Regeneration.`);
    if (restored) emit(state, 'heal', unit, {amount:restored});
  }
}

/** Resolve the telegraphed foe action, then deal the next player turn. */
export function endTurn(state) {
  if (state.outcome) return { ok: false, reason: 'The battle has ended.' };
  const intent = getIntent(state);
  const phaseAtStart = state.enemy.phase;
  const retained = [];
  for (const entry of state.hand) {
    if (resolvedCard(state, entry).retain) retained.push(entry);
    else state.discard.push(entry);
  }
  state.hand = retained;
  decay(state.player, 'weak');
  triggerAuras(state,'turn-end');
  if (state.outcome) return {ok:true};
  triggerPetPassives(state,'turn-end');
  if (state.outcome) return {ok:true};
  startTurn(state, state.enemy);
  if (state.outcome) return { ok: true };
  log(state, `${state.enemy.name} uses ${intent.name}.`);
  emit(state, 'intent', state.enemy, {name:intent.name});
  applyEffects(state, state.enemy, state.player, intent.effects ?? []);
  if (state.outcome) return { ok: true };
  decay(state.enemy, 'weak');
  if (state.enemy.phase === phaseAtStart) state.enemyMove++;
  syncEnemyPhase(state);
  state.turn++;
  startTurn(state, state.player);
  if (state.outcome) return { ok: true };
  state.energy = state.maxEnergy;
  resolveScheduledTechniques(state);
  if (state.outcome) return {ok:true};
  triggerPetPassives(state,'turn-start');
  if (state.outcome) return {ok:true};
  drawCards(state, state.draw);
  return { ok: true };
}

/** Forecast the next round without changing the live encounter. */
export function previewEndTurn(state) {
  if (state.outcome) return null;
  const preview = {
    ...state,
    player: { ...state.player, statuses: { ...state.player.statuses } },
    enemy: { ...state.enemy, statuses: { ...state.enemy.statuses } },
    hand: [...state.hand],
    drawPile: [...state.drawPile],
    discard: [...state.discard],
    exhausted: [...state.exhausted],
    auras: (state.auras || []).map(aura => ({...aura})),
    rituals: (state.rituals || []).map(ritual => ({...ritual})),
    ...(state.pet ? {pet:structuredClone(state.pet)} : {}),
    log: [],
  };
  endTurn(preview);
  return {
    hp: preview.player.hp,
    hpChange: preview.player.hp - state.player.hp,
    enemyHp: preview.enemy.hp,
    outcome: preview.outcome,
  };
}

/** Describe the actual magnitude of a resolved card effect. */
export function describeEffect(effect) {
  const amount = quantity(effect.amount ?? effect.value, effect.type === 'cleanse' ? 1 : 0);
  switch (effect.type) {
    case 'damage': return `Deal ${amount}${effect.hits > 1 ? ` × ${effect.hits}` : ''} damage.`;
    case 'block': return `Gain ${amount} Guard.`;
    case 'heal': return `Heal ${amount} HP.`;
    case 'draw': return `Draw ${amount} ${amount === 1 ? 'card' : 'cards'}.`;
    case 'energy': return `Gain ${amount} Qi.`;
    case 'status': {
      const name = STATUS_INFO[effect.status]?.name ?? effect.status;
      const self = effect.target === 'self' || (!effect.target && !AFFLICTIONS.includes(effect.status));
      return `${self ? 'Gain' : 'Apply'} ${amount} ${name}.`;
    }
    case 'cleanse': return `Remove ${amount} ${amount === 1 ? 'affliction stack' : 'affliction stacks'}.`;
    case 'recover': return `Return ${amount} exhausted techniques to discard. Recovery arts cannot return.`;
    case 'dispel': return `Dispel ${amount} enemy positive stacks.`;
    default: return '';
  }
}

export const CONDITION_INFO = {
  guarded:'while you have Guard',
  wounded:'while at or below half vitality',
  afflicted:'if the enemy is already afflicted',
  resonant:'as the third technique in a same-school chain',
  'empty-hand':'when played as your last card in hand',
};
export const TRIGGER_INFO = {
  'turn-start':'at the start of your turn',
  'turn-end':'at the end of your turn',
  'on-attack':'after an attack technique',
  'on-guard':'after a Guard technique',
  'on-status':'after a status technique',
};

export function techniqueRules(card) {
  const rules = card.effects.map(describeEffect);
  if (card.healthCost) rules.unshift(`Pay ${card.healthCost} vitality. Must leave at least 1.`);
  if (card.condition && card.bonusEffects) rules.push(
    `Bonus ${CONDITION_INFO[card.condition]}: ${card.bonusEffects.map(describeEffect).join(' ')}`);
  if (card.aura) rules.push(`For ${card.aura.duration} turns, ${TRIGGER_INFO[card.aura.trigger]}: ${card.aura.effects.map(describeEffect).join(' ')} Refreshes when replayed. Maximum 3 active arts.`);
  if (card.delayed) rules.push(`In ${card.delayed.turns} turns: ${card.delayed.effects.map(describeEffect).join(' ')}`);
  if (card.exhaust) rules.push('Exhaust after use.');
  return rules;
}
