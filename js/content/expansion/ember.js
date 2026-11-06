// Cinder Art: the furnace keeps an account of every offering.
const damage = amount => ({ type: 'damage', amount });
const block = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const energy = amount => ({ type: 'energy', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const recover = amount => ({ type: 'recover', amount });
const dispel = amount => ({ type: 'dispel', amount });
const afflict = (status, amount) => ({ type: 'status', status, amount });
const empower = (status, amount) => ({ type: 'status', status, amount, target: 'self' });
const aura = (trigger, duration, effects) => ({ trigger, duration, effects });
const delayed = (turns, effects) => ({ turns, effects });

function effectText(effect) {
  const { type, amount, status, target } = effect;
  if (type === 'damage') return `Deal ${amount} damage`;
  if (type === 'block') return `Gain ${amount} Guard`;
  if (type === 'draw') return `Draw ${amount}`;
  if (type === 'energy') return `Gain ${amount} Qi`;
  if (type === 'heal') return `Heal ${amount}`;
  if (type === 'cleanse') return `Cleanse ${amount} debuff${amount === 1 ? '' : 's'}`;
  if (type === 'recover') return `Return ${amount} exhausted technique${amount === 1 ? '' : 's'} to your discard pile`;
  if (type === 'dispel') return `Remove ${amount} enemy positive status stack${amount === 1 ? '' : 's'} (Strength, Focus, Regeneration, then Ward)`;
  return `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${status === 'regen' ? 'Regeneration' : status[0].toUpperCase() + status.slice(1)}`;
}
const conditionText = {
  guarded: 'If you had Guard before this cast',
  wounded: 'If you were at or below half vitality before this cast',
  afflicted: 'If the enemy was already afflicted before this cast',
  resonant: 'If your Cinder Art chain already had at least two steps',
  'empty-hand': 'If this was the last card in your hand',
};
const triggerText = {
  'turn-start': 'At the start of your turn',
  'turn-end': 'At the end of your turn',
  'on-attack': 'Once per directly played attack',
  'on-guard': 'Once per directly played technique that grants Guard',
  'on-status': 'Once per directly played technique that applies a status',
};
function card(name, type, kind, cost, rarity, effects, flavor, extra = {}) {
  const lines = [];
  if (extra.healthCost) lines.push(`Pay ${extra.healthCost} vitality; payment must leave at least 1`);
  lines.push(...effects.map(effectText));
  if (extra.condition) lines.push(`${conditionText[extra.condition]}: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) lines.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger].toLowerCase()}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; does not trigger recursively)`);
  if (extra.delayed) lines.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) lines.push('Exhaust');
  return {
    id: `ember-${name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}`,
    name, school: 'ember', type, kind, cost, rarity, effects,
    description: lines.join('. ') + '.', flavor, ...extra,
  };
}

export const emberCards = [
  // Hexes reward an affliction established by an earlier technique.
  card('Widow Kiln Mark', 'hex', 'skill', 1, 'common', [afflict('burn', 3)],
    'Every widow in Coalbridge owns one brick with a name beneath the glaze.',
    { condition: 'afflicted', bonusEffects: [damage(4)] }),
  card('Soot in the Warrant', 'hex', 'skill', 1, 'common', [afflict('weak', 1), afflict('burn', 2)],
    'The constable read the charge until his tongue became the missing signature.',
    { condition: 'afflicted', bonusEffects: [block(3)] }),
  card('Cracked Glaze Curse', 'hex', 'attack', 1, 'common', [damage(3), afflict('vulnerable', 1)],
    'Master Shen heard the fracture three rooms before the cup was touched.',
    { condition: 'afflicted', bonusEffects: [afflict('burn', 2)] }),
  card('Incense for the Unburied', 'hex', 'skill', 0, 'uncommon', [afflict('burn', 2)],
    'A stick for each body the magistrate deducted from the count.',
    { condition: 'afflicted', bonusEffects: [draw(1)], exhaust: true }),
  card('Scald the Ancestral Seal', 'hex', 'attack', 2, 'uncommon', [damage(8), afflict('burn', 3)],
    'An immortal lineage smells like common hair when it catches.',
    { condition: 'afflicted', bonusEffects: [dispel(2), damage(3)] }),
  card('Bellows Lung Malediction', 'hex', 'skill', 1, 'uncommon', [afflict('weak', 2)],
    'Breathe deeply, said the physician, shutting every window.',
    { condition: 'afflicted', bonusEffects: [afflict('burn', 3)], exhaust: true }),
  card('Red Census of Mount Que', 'hex', 'skill', 2, 'rare', [afflict('burn', 4), afflict('bleed', 2)],
    'The mountain records its missing apprentices in the color of the snow.',
    { condition: 'afflicted', bonusEffects: [afflict('vulnerable', 2), damage(4)], exhaust: true }),

  // Formations bank heat across owner turns rather than adding combatants.
  card('Three Brick Refuge', 'formation', 'skill', 1, 'common', [block(2)],
    'The fugitives slept behind the only wall the fire had spared.',
    { aura: aura('turn-end', 2, [block(2)]) }),
  card('Charcoal Meridian Ring', 'formation', 'skill', 1, 'common', [afflict('burn', 1)],
    'Draw the circle with yesterday’s fingers, said the abbot.',
    { aura: aura('turn-start', 3, [afflict('burn', 1)]) }),
  card('Kiln Mouth Tripwire', 'formation', 'skill', 1, 'common', [damage(2)],
    'The string is harmless. The open door behind it is not.',
    { aura: aura('turn-end', 2, [damage(2)]) }),
  card('Bank the Orphan Fire', 'formation', 'skill', 2, 'uncommon', [block(4)],
    'No child in the lower quarter remembered who first lit it.',
    { aura: aura('turn-start', 3, [block(3), afflict('burn', 1)]) }),
  card('Smoke Alphabet Array', 'formation', 'skill', 2, 'uncommon', [afflict('weak', 1)],
    'Read quickly. The executioner has opened the shutters.',
    { aura: aura('turn-start', 3, [draw(1)]), exhaust: true }),
  card('Red Tile Quarantine', 'formation', 'skill', 2, 'uncommon', [block(3)],
    'The plague inspector painted every door except his own.',
    { aura: aura('turn-end', 2, [cleanse(1), afflict('burn', 2)]) }),
  card('Nine Chambers of Embers', 'formation', 'skill', 3, 'rare', [afflict('burn', 2)],
    'Eight chambers cool by dawn. Nobody opens the ninth.',
    { aura: aura('turn-end', 3, [damage(3), block(2)]), exhaust: true }),

  // Stances never produce Qi or recursively activate another stance.
  card('Coal Picker Crouch', 'stance', 'skill', 1, 'common', [block(2)],
    'Keep the smallest coal; the overseer counts only the large ones.',
    { aura: aura('on-attack', 2, [block(1)]) }),
  card('Sleeve over the Flame', 'stance', 'skill', 1, 'common', [afflict('burn', 1)],
    'The sleeve was his last possession that had not belonged to a corpse.',
    { aura: aura('on-guard', 2, [damage(1)]) }),
  card('Cauterist Grip', 'stance', 'skill', 1, 'common', [damage(2)],
    'Grip the iron where the old blood has turned to glass.',
    { aura: aura('on-status', 2, [damage(1)]) }),
  card('Furnace Keeper Pivot', 'stance', 'skill', 2, 'uncommon', [block(3)],
    'Turn with the blast. Your brother stood against it.',
    { aura: aura('on-guard', 2, [afflict('burn', 1)]) }),
  card('Blacksmith Widow Form', 'stance', 'skill', 2, 'uncommon', [afflict('weak', 1)],
    'She learned to hear an approaching blade through the soles of her feet.',
    { aura: aura('on-attack', 3, [damage(1)]), exhaust: true }),
  card('Bitter Ash Mudra', 'stance', 'skill', 2, 'uncommon', [cleanse(1)],
    'Fold the scorched fingers inward, where the court cannot count them.',
    { aura: aura('on-status', 2, [block(2)]) }),
  card('Dance inside the Furnace', 'stance', 'skill', 3, 'rare', [block(5)],
    'Lan practiced until the flames began stepping aside for her.',
    { aura: aura('on-attack', 2, [damage(1), afflict('burn', 1)]), exhaust: true }),

  // Counters explicitly check Guard held before the cast.
  card('Catch the Fire Tong', 'counter', 'attack', 1, 'common', [damage(6)],
    'The apprentice caught it once. The master never threw it again.',
    { condition: 'guarded', bonusEffects: [afflict('burn', 2)] }),
  card('Oven Door Rebuttal', 'counter', 'skill', 1, 'common', [block(5)],
    'A closed oven gives a very short answer.',
    { condition: 'guarded', bonusEffects: [damage(3)] }),
  card('Spitting Clinker', 'counter', 'attack', 0, 'common', [damage(2)],
    'The condemned mason spat out the last tooth he could afford to lose.',
    { condition: 'guarded', bonusEffects: [afflict('weak', 1)], exhaust: true }),
  card('Rake the Assailant', 'counter', 'attack', 2, 'uncommon', [damage(9), block(3)],
    'The ash rake works equally well before the body burns.',
    { condition: 'guarded', bonusEffects: [damage(5)] }),
  card('Flue Reversal', 'counter', 'skill', 1, 'uncommon', [afflict('burn', 3)],
    'All the smoke the governor ordered away returned through his bedroom.',
    { condition: 'guarded', bonusEffects: [afflict('weak', 1), block(2)] }),
  card('Crucible Lid Salute', 'counter', 'skill', 2, 'uncommon', [block(9), cleanse(1)],
    'Bow low enough for the molten offering to pass overhead.',
    { condition: 'guarded', bonusEffects: [afflict('burn', 3)] }),
  card('Mirror of Tempered Soot', 'counter', 'attack', 2, 'rare', [damage(10), afflict('burn', 2)],
    'The assassin saw the fire behind him one heartbeat too late.',
    { condition: 'guarded', bonusEffects: [dispel(2), damage(4)], exhaust: true }),

  // Pacts require their entire nonlethal vitality payment.
  card('Palm for the Bellows', 'pact', 'attack', 1, 'common', [damage(11)],
    'The bellows leather split. Apprentice Yu put his hand over the tear.',
    { healthCost: 3 }),
  card('Tithe of Blistered Skin', 'pact', 'skill', 1, 'common', [block(9), afflict('burn', 1)],
    'The furnace priests accept no coin that can still be spent.',
    { healthCost: 3 }),
  card('Swallow the Live Coal', 'pact', 'skill', 0, 'common', [energy(1)],
    'Do not speak until the creditor leaves.',
    { healthCost: 3, exhaust: true }),
  card('Lend the Furnace a Vein', 'pact', 'attack', 2, 'uncommon', [damage(14), afflict('burn', 4)],
    'The copper tube returned empty; the engine began to sing.',
    { healthCost: 4 }),
  card('Scorched Tongue Bargain', 'pact', 'skill', 1, 'uncommon', [draw(3), afflict('vulnerable', 1)],
    'She bought the forbidden recipe with every word she had yet to say.',
    { healthCost: 4, exhaust: true }),
  card('Mortgage the Last Rib', 'pact', 'attack', 2, 'rare', [damage(16)],
    'A prudent debtor leaves the heart one bar to hide behind.',
    { healthCost: 5, condition: 'wounded', bonusEffects: [damage(7)], exhaust: true }),
  card('The Emperor Is Fuel', 'pact', 'skill', 3, 'legendary', [afflict('burn', 8), afflict('weak', 2), dispel(4)],
    'The rebel furnace had no throne, only a carefully measured opening.',
    { healthCost: 8, delayed: delayed(1, [damage(12)]), exhaust: true }),

  // Rituals grant a small immediate effect while their heat matures.
  card('Seal the Coal Jar', 'ritual', 'skill', 1, 'common', [block(2)],
    'Mark the lid with the hour. Never with a name.',
    { delayed: delayed(1, [damage(7)]) }),
  card('Buried Brazier Vigil', 'ritual', 'skill', 1, 'common', [afflict('burn', 1)],
    'Keep watch where the snow melts without footsteps.',
    { delayed: delayed(2, [afflict('burn', 4)]) }),
  card('Dry the Funeral Timber', 'ritual', 'skill', 1, 'common', [afflict('weak', 1)],
    'The execution is tomorrow. The carpenter has been awake for three nights.',
    { delayed: delayed(1, [block(6)]) }),
  card('Wait for the Glaze to Run', 'ritual', 'skill', 2, 'uncommon', [block(3)],
    'When the painted eyes begin to weep, strike the vessel.',
    { delayed: delayed(1, [damage(10), afflict('burn', 3)]) }),
  card('Ash Wrapped Dispatch', 'ritual', 'skill', 1, 'uncommon', [damage(2)],
    'The message becomes legible only after its courier is beyond the gate.',
    { delayed: delayed(1, [draw(2)]), exhaust: true }),
  card('Feed the Sealed Mountain', 'ritual', 'skill', 3, 'rare', [block(5)],
    'For a century the village lowered offerings into a hole that breathed.',
    { delayed: delayed(2, [damage(21), afflict('burn', 5)]), exhaust: true }),
  card('Dawn under the Execution Ground', 'ritual', 'skill', 3, 'legendary', [afflict('weak', 2)],
    'The first light rose through the paving stones. Nobody mistook it for mercy.',
    { delayed: delayed(2, [damage(25), dispel(4), afflict('burn', 4)]), exhaust: true }),

  // Recovery returns spent techniques to discard, never straight to the hand.
  card('Sift the Bone Char', 'transmute', 'skill', 1, 'common', [recover(1), afflict('burn', 1)],
    'The apprentice found one unburned lesson among his master’s remains.',
    { healthCost: 2, exhaust: true }),
  card('Melt the Honor Badge', 'transmute', 'attack', 1, 'common', [dispel(1), damage(4)],
    'Gold runs down the breastplate just as easily as tin.'),
  card('Burn the Protective Writ', 'transmute', 'skill', 1, 'common', [dispel(2), block(2)],
    'Hold the paper by the imperial signature; it burns last.'),
  card('Rescue the Furnace Notes', 'transmute', 'skill', 2, 'uncommon', [recover(2), block(4)],
    'The lower pages cost two fingers. The upper pages cost the ladder.',
    { healthCost: 3, exhaust: true }),
  card('Render the Spirit Lacquer', 'transmute', 'skill', 1, 'uncommon', [dispel(2), afflict('burn', 2)],
    'All that ancestral protection makes excellent varnish.'),
  card('Refire the Broken Mandate', 'transmute', 'skill', 2, 'rare', [recover(1), dispel(3), afflict('weak', 1)],
    'The edict left the kiln with a different dynasty on its face.',
    { healthCost: 2, exhaust: true }),
  card('Unmake the Immortal Alloy', 'transmute', 'attack', 3, 'legendary', [dispel(6), damage(14)],
    'The divine smith hid his mistake in every blade he ever forged.',
    { condition: 'afflicted', bonusEffects: [afflict('burn', 5)], exhaust: true }),

  // Finishers cash in a prepared chain or an emptied hand.
  card('Last Coal Cast', 'finisher', 'attack', 1, 'common', [damage(7)],
    'There is nothing left in the basket worth keeping warm.',
    { condition: 'empty-hand', bonusEffects: [damage(4)], exhaust: true }),
  card('Close the Red Circle', 'finisher', 'attack', 1, 'common', [damage(5), afflict('burn', 1)],
    'The final footprint joins the first, and both disappear.',
    { condition: 'resonant', bonusEffects: [afflict('burn', 3)], exhaust: true }),
  card('Break the Firing Rod', 'finisher', 'attack', 2, 'common', [damage(12)],
    'A broken rod cannot measure another apprentice’s failing.',
    { condition: 'empty-hand', bonusEffects: [damage(5), block(2)], exhaust: true }),
  card('Pour the Crucible Dry', 'finisher', 'attack', 2, 'uncommon', [damage(10), afflict('burn', 2)],
    'Tilt it until the bottom shines like an empty eye.',
    { condition: 'resonant', bonusEffects: [damage(6)], exhaust: true }),
  card('Ash at the Banquet Door', 'finisher', 'attack', 2, 'uncommon', [damage(11), block(3)],
    'The invitation promised that every guest would leave lighter.',
    { condition: 'empty-hand', bonusEffects: [afflict('weak', 2), damage(3)], exhaust: true }),
  card('No Witness but the Chimney', 'finisher', 'attack', 2, 'rare', [damage(13), dispel(1)],
    'The chimney gave its testimony to a wind no court could summon.',
    { condition: 'resonant', bonusEffects: [afflict('burn', 4), dispel(2)], exhaust: true }),
  card('Night the Kiln Ate Heaven', 'finisher', 'attack', 3, 'legendary', [damage(22)],
    'By morning the stars were holes in a roof that no longer belonged to the gods.',
    { condition: 'resonant', bonusEffects: [damage(9), afflict('burn', 3)], exhaust: true }),

  // Four familiar forms bridge the new disciplines into existing decks.
  card('Cinder Surgeon Thrust', 'strike', 'attack', 1, 'rare', [damage(6), afflict('bleed', 2)],
    'He learned the killing point while closing it in his own chest.',
    { condition: 'wounded', bonusEffects: [afflict('burn', 3)] }),
  card('Carry the Cooling Door', 'ward', 'skill', 2, 'rare', [block(10), afflict('burn', 2)],
    'The rescued prisoner carried the iron door all the way home.',
    { condition: 'wounded', bonusEffects: [block(5)] }),
  card('Name Each Lost Apprentice', 'mantra', 'skill', 1, 'rare', [empower('strength', 1), block(3)],
    'At the twenty-third name, the old master’s hands stopped trembling.',
    { condition: 'resonant', bonusEffects: [draw(2)], exhaust: true }),
  card('Cold Ash Poultice', 'remedy', 'skill', 1, 'rare', [heal(6), cleanse(1)],
    'Wait until the ashes forget what they were asked to consume.',
    { condition: 'empty-hand', bonusEffects: [block(4)], exhaust: true }),
];
