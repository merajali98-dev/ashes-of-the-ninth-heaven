// Common Form belongs to the people who cannot afford a lineage.
const hit = amount => ({ type: 'damage', amount });
const guard = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const recover = amount => ({ type: 'recover', amount });
const dispel = amount => ({ type: 'dispel', amount });
const curse = (status, amount = 1) => ({ type: 'status', status, amount, target: 'opponent' });
const boon = (status, amount = 1) => ({ type: 'status', status, amount, target: 'self' });
const when = (condition, bonusEffects) => ({ condition, bonusEffects });
const aura = (trigger, duration, effects) => ({ aura: { trigger, duration, effects } });
const later = (turns, effects) => ({ delayed: { turns, effects } });

const conditionText = {
  guarded: 'If you already had Guard',
  wounded: 'If you were already at or below half vitality',
  afflicted: 'If the enemy already had Burn, Poison, Bleed, Weak, or Vulnerable',
  'empty-hand': 'If no other cards remained in your hand',
};
const triggerText = {
  'turn-start': 'at the start of your turn',
  'turn-end': 'at the end of your turn',
  'on-attack': 'once per directly played attack',
  'on-guard': 'once per directly played card that grants Guard',
  'on-status': 'once per directly played card that applies a status',
};
function effectText({ type, amount, status, target }) {
  const label = status && (status === 'regen' ? 'Regeneration' : status[0].toUpperCase() + status.slice(1));
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`, draw: `Draw ${amount}`,
    heal: `Heal ${amount}`, cleanse: `Cleanse ${amount} debuff stacks`,
    recover: `Return ${amount} exhausted technique${amount === 1 ? '' : 's'} to your discard pile`,
    dispel: `Remove ${amount} enemy positive status stacks (Strength, Focus, Regeneration, then Ward)`,
    status: `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${label}`,
  }[type];
}
function card(name, type, cost, rarity, effects, extra, flavor) {
  const lines = [];
  if (extra.healthCost) lines.push(`Pay ${extra.healthCost} vitality; payment must leave at least 1`);
  lines.push(...effects.map(effectText));
  if (extra.condition) lines.push(`${conditionText[extra.condition]} after removing this card from hand, before vitality payment or effects: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) lines.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger]}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; triggers do not recurse; duplicate refreshes; maximum 3 active auras)`);
  if (extra.delayed) lines.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) lines.push('Exhaust');
  return {
    id: `neutral-${name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}`,
    name, school: 'neutral', type,
    kind: [...effects, ...(extra.bonusEffects || [])].some(effect => effect.type === 'damage') ? 'attack' : 'skill',
    cost, rarity, effects, description: lines.join('. ') + '.', flavor, ...extra,
  };
}

export const neutralCards = [
  // Small curses work best on trouble that somebody else has already started.
  card('Dust from the Wrong Doorstep', 'hex', 1, 'common', [hit(2), curse('weak')], when('afflicted', [guard(2)]), 'Sweep it into your sleeve. Never bring it home.'),
  card('Nettle in the Boot', 'hex', 1, 'common', [curse('bleed'), guard(2)], when('afflicted', [hit(2)]), 'The village children know which leaves the tax collector cannot name.'),
  card('Point with the Funeral Spoon', 'hex', 0, 'common', [curse('vulnerable')], { exhaust: true }, 'Nobody will eat with it afterward, which is how the custom survives.'),
  card('Sour Well Gossip', 'hex', 2, 'uncommon', [curse('poison'), curse('weak')], when('afflicted', [draw(1)]), 'Tell the story quietly enough that the bucket has to lean closer.'),
  card('Tie the Fever to a Fence', 'hex', 1, 'uncommon', [curse('weak'), cleanse(1)], when('afflicted', [guard(2)]), 'Use a loose knot. A trapped fever learns the way back.'),
  card('Crooked Horseshoe Rebuke', 'hex', 2, 'uncommon', [hit(5), curse('vulnerable')], when('afflicted', [curse('bleed')]), 'The smith guarantees bad luck only on the side with the bent nail.'),
  card('Village Censure', 'hex', 2, 'rare', [curse('weak', 2), dispel(2)], when('afflicted', [hit(4)]), 'Every door closes in the same breath. Even a magistrate notices.'),

  // Household arrangements turn a little preparation into dependable shelter.
  card('Upside Down Market Baskets', 'formation', 1, 'common', [guard(3)], aura('turn-end', 2, [guard(1)]), 'Put a stone on each one. The wind is the first bandit to arrive.'),
  card('Broken Crock Perimeter', 'formation', 1, 'common', [hit(1)], aura('turn-end', 2, [hit(2)]), 'The useful pieces are the ones too small to mend.'),
  card('Chalk Marks by the Milestone', 'formation', 1, 'common', [guard(2)], { ...aura('turn-start', 2, [draw(1)]), exhaust: true }, 'Leave directions for the person you will be after a bad night.'),
  card('Laundry Line Sanctuary', 'formation', 2, 'uncommon', [guard(3)], { ...aura('turn-start', 3, [cleanse(1)]), exhaust: true }, 'Hang the cursed shirt where the morning can find both sleeves.'),
  card('Soup Pot at the Crossroads', 'formation', 2, 'uncommon', [guard(4)], { ...aura('turn-end', 3, [heal(1)]), exhaust: true }, 'The ladle is chained down; the bowl is not.'),
  card('Thorn Hedge Switchback', 'formation', 2, 'rare', [guard(2)], aura('turn-start', 3, [guard(3), hit(1)]), 'A stranger sees a garden. The gardener knows where to turn.'),
  card('Wake with Every Door Open', 'formation', 3, 'legendary', [guard(5)], { ...aura('turn-end', 3, [cleanse(1), dispel(1)]), exhaust: true }, 'For one night the whole village lets its ghosts pass without asking whose they are.'),

  // Stances reward ordinary actions; the installation never triggers itself.
  card('Porter Keeps His Balance', 'stance', 1, 'common', [guard(2)], aura('on-attack', 2, [guard(1)]), 'The shoulder learns the counterweight before the hand learns the fist.'),
  card('Broom Held Crosswise', 'stance', 1, 'common', [hit(2)], aura('on-guard', 2, [hit(1)]), 'Push the trouble out with the bristles; keep the handle for what refuses.'),
  card('Spit over the Left Shoulder', 'stance', 1, 'common', [curse('weak')], aura('on-status', 2, [guard(1)]), 'The right shoulder is for thanks. Do not confuse them.'),
  card('Beggars Recognize Brass', 'stance', 2, 'uncommon', [guard(2)], { ...aura('on-attack', 2, [dispel(1)]), exhaust: true }, 'Tap the holy badge with a knuckle. Listen before you bow.'),
  card('Apron Turned Inside Out', 'stance', 2, 'uncommon', [guard(3)], { ...aura('on-guard', 2, [cleanse(1)]), exhaust: true }, 'Mother kept the clean side for wounds, even when there was no clean side left.'),
  card('Midwife Counts the Breaths', 'stance', 2, 'rare', [guard(4)], { ...aura('on-status', 2, [heal(1)]), exhaust: true }, 'Each curse spoken aloud is one less thing the frightened patient must swallow.'),
  card('Old Auntie Takes the Doorway', 'stance', 3, 'legendary', [guard(5)], { ...aura('on-guard', 2, [hit(1), dispel(1)]), exhaust: true }, 'She has no cultivation title. She has made emperors wipe their feet.'),

  // Every counter checks the Guard already present before this card resolves.
  card('Walking Stick under the Wrist', 'counter', 1, 'common', [hit(5)], when('guarded', [guard(2)]), 'A straight stick does not need to understand a curved sword.'),
  card('Pull the Cart Shaft Across', 'counter', 1, 'common', [guard(4)], when('guarded', [hit(2)]), 'The cart is empty. The shaft still remembers the weight.'),
  card('Heel Full of Gravel', 'counter', 0, 'common', [hit(2)], { ...when('guarded', [guard(1)]), exhaust: true }, 'Save one stone for the person who made you run.'),
  card('Duck behind the Grain Sack', 'counter', 1, 'uncommon', [guard(4)], when('guarded', [cleanse(1)]), 'The grain catches the blade; the dust catches the curse.'),
  card('Ladle against the Knuckles', 'counter', 2, 'uncommon', [hit(8), guard(2)], when('guarded', [curse('weak')]), 'Soup thieves and swordsmen reach with the same four fingers.'),
  card('Catch the Loose Roof Tile', 'counter', 2, 'uncommon', [guard(7)], when('guarded', [draw(1)]), 'The roof offers advice one piece at a time.'),
  card('Turn the Coffin on Its Side', 'counter', 2, 'rare', [guard(7), dispel(1)], { ...when('guarded', [hit(4)]), exhaust: true }, 'Its intended occupant takes the handles and helps.'),

  // A mortal bargain pays in present vitality and never refunds its own wound.
  card('Prick the Shared Thumb', 'pact', 0, 'common', [guard(3)], { healthCost: 2, exhaust: true }, 'The oath is small because neither traveler owns much to promise.'),
  card('Carry One More Sack', 'pact', 1, 'common', [guard(7)], { healthCost: 2 }, 'The knees object. The hungry family does not.'),
  card('Bite the Broken Tooth', 'pact', 1, 'common', [hit(7), curse('bleed')], { healthCost: 2 }, 'Spit it into the fist before you close your hand.'),
  card('Pawn the Winter Quilt', 'pact', 1, 'uncommon', [draw(2)], { healthCost: 3, exhaust: true }, 'Tomorrow can be cold if there is a tomorrow.'),
  card('Oath to Walk Home', 'pact', 2, 'uncommon', [hit(9), guard(4)], { healthCost: 3, ...when('wounded', [guard(3)]) }, 'Name each turn in the road before naming the person waiting at its end.'),
  card('Give the Shrine a Bandage', 'pact', 1, 'uncommon', [boon('ward', 2), guard(2)], { healthCost: 2, exhaust: true }, 'The little god has never seen a clean offering and would not recognize one.'),
  card('Borrow the Ancestors Work Gloves', 'pact', 2, 'rare', [boon('strength'), recover(1), guard(3)], { healthCost: 4, exhaust: true }, 'They fit every hand in the family and leave the same two blisters.'),

  // Rituals promise a concrete next turn, not an extra fighter on the field.
  card('Soak the Willow Bark', 'ritual', 1, 'common', [guard(2)], { ...later(1, [heal(3)]), exhaust: true }, 'The bowl must sit long enough for the bitterness to reach the bottom.'),
  card('Warm a Brick for the Bed', 'ritual', 1, 'common', [guard(1)], later(1, [guard(5)]), 'Wrap it twice. Warmth is useful only while it stays on your side of the cloth.'),
  card('Lay the Rabbit Snare', 'ritual', 1, 'common', [curse('weak')], later(1, [hit(4)]), 'A hurried step is still a step through the loop.'),
  card('Leave a Note in the Rice Jar', 'ritual', 1, 'uncommon', [guard(3)], { ...later(2, [draw(2)]), exhaust: true }, 'You will remember to eat before you remember to be brave.'),
  card('Ask the Cooper for a Favor', 'ritual', 2, 'uncommon', [guard(4)], later(1, [hit(6), dispel(1)]), 'He needs a night to loosen the hoops around the magistrate’s armor.'),
  card('Mend by the Last Candle', 'ritual', 2, 'rare', [cleanse(1)], { ...later(1, [recover(2), guard(3)]), exhaust: true }, 'Patch the lesson where the blade went through it.'),
  card('Set a Place for the Missing', 'ritual', 3, 'legendary', [guard(6)], { ...later(2, [recover(2), heal(4), boon('ward')]), exhaust: true }, 'At dawn the chair is still empty, but the worn tools have been left beside it.'),

  // Salvage returns exhausted techniques to discard; dispel removes stacks.
  card('Unpick the Burial Hem', 'transmute', 1, 'common', [recover(1), cleanse(1)], { exhaust: true }, 'A living sleeve needs the thread more than a dead one.'),
  card('Knock the Gilt from the Buckle', 'transmute', 1, 'common', [dispel(1), hit(3)], {}, 'The fine officer underneath makes the same noise as anyone else.'),
  card('Rub Out the Borrowed Seal', 'transmute', 0, 'common', [dispel(1)], { exhaust: true }, 'A damp thumb is enough if the signature was never yours.'),
  card('Rebind the Rain Soaked Manual', 'transmute', 2, 'uncommon', [recover(1), guard(5)], { exhaust: true }, 'Keep the pages in the order the stains remember.'),
  card('Trade the Lucky Copper', 'transmute', 1, 'uncommon', [dispel(2), boon('ward')], { exhaust: true }, 'The coin buys one bad moment from the person who most deserves it.'),
  card('Strip the Painted Talisman', 'transmute', 2, 'uncommon', [dispel(3), curse('vulnerable')], {}, 'Under the dragon is an old advertisement for lamp oil.'),
  card('Salvage the Burned Schoolhouse', 'transmute', 3, 'rare', [recover(2), guard(5)], { ...when('wounded', [cleanse(2)]), exhaust: true }, 'The roof is gone. The children still know which bench was theirs.'),

  // Common Form preserves other school chains but never claims their resonance.
  card('Throw the Last Chopstick', 'finisher', 1, 'common', [hit(5)], { ...when('empty-hand', [hit(2)]), exhaust: true }, 'The meal is over when there is nothing left to hold it with.'),
  card('Shut the Stall for the Night', 'finisher', 1, 'common', [hit(3), guard(2)], { ...when('empty-hand', [guard(2)]), exhaust: true }, 'Count the coins after the shutters are down.'),
  card('Break the Empty Water Gourd', 'finisher', 2, 'common', [hit(8), curse('weak')], { ...when('empty-hand', [hit(4)]), exhaust: true }, 'A dry gourd finally has room for a louder answer.'),
  card('No More Stones in the Sleeve', 'finisher', 2, 'uncommon', [hit(9)], { ...when('empty-hand', [curse('vulnerable'), guard(2)]), exhaust: true }, 'Open both hands so the next traveler knows the road is clear.'),
  card('Sweep the Wake Hall Empty', 'finisher', 2, 'uncommon', [hit(7), cleanse(1)], { ...when('empty-hand', [dispel(2)]), exhaust: true }, 'The last mourner leaves carrying a chair instead of a grievance.'),
  card('Nothing Left to Pawn', 'finisher', 2, 'rare', [hit(8), guard(3)], { ...when('empty-hand', [recover(1)]), exhaust: true }, 'The broker gives back your first lesson. Nobody else would buy it.'),
  card('Last House Still Lit', 'finisher', 3, 'legendary', [hit(12), guard(4)], { ...when('empty-hand', [boon('ward'), cleanse(2)]), ...later(1, [dispel(2)]), exhaust: true }, 'When the immortal reaches the end of the ruined street, someone opens a door.'),

  // Familiar forms give novices a plain entry into the expanded disciplines.
  card('Miller Knows the Heavy End', 'strike', 1, 'rare', [hit(5), dispel(1)], when('afflicted', [hit(2)]), 'The pestle was balanced for grain. The miller adjusts.'),
  card('Patchwork Travelers Coat', 'ward', 2, 'rare', [guard(8), cleanse(1)], when('wounded', [boon('ward')]), 'Every patch was a place that let you stay until the rain stopped.'),
  card('Remember the Names at Supper', 'mantra', 1, 'rare', [draw(1), boon('ward')], { ...when('wounded', [guard(2)]), exhaust: true }, 'Say your own name too. Somebody saved you a place.'),
  card('Honey on the Cracked Lip', 'remedy', 1, 'rare', [heal(3), cleanse(1)], { ...when('wounded', [guard(2)]), exhaust: true }, 'The beekeeper charged nothing after seeing how carefully you carried the spoon.'),
];
