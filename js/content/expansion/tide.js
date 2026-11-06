// The Grave Tide ferries spent things home, but never without another crossing.
const hit = amount => ({ type: 'damage', amount });
const guard = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const recover = amount => ({ type: 'recover', amount });
const dispel = amount => ({ type: 'dispel', amount });
const curse = (status, amount = 1) => ({ type: 'status', status, amount, target: 'opponent' });
const boon = (status, amount = 1) => ({ type: 'status', status, amount, target: 'self' });
const aura = (trigger, duration, effects) => ({ aura: { trigger, duration, effects } });
const later = (turns, effects) => ({ delayed: { turns, effects } });
const when = (condition, bonusEffects) => ({ condition, bonusEffects });

const conditionText = {
  afflicted: 'If the opponent already has a debuff', guarded: 'If you already have Guard',
  resonant: 'If your Tide chain is at least 2', wounded: 'If you have half Health or less',
  'empty-hand': 'If no other cards remain in your hand',
};
const triggerText = {
  'turn-start': 'At the start of your turn', 'turn-end': 'At the end of your turn',
  'on-attack': 'When you play an attack', 'on-guard': 'When a played card grants Guard',
  'on-status': 'When a played card applies a status',
};
function effectText({ type, amount, status, target }) {
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`, draw: `Draw ${amount}`,
    heal: `Heal ${amount}`, cleanse: `Cleanse ${amount} debuff stacks`,
    recover: `Return ${amount} most recently exhausted card${amount === 1 ? '' : 's'} to your discard`,
    dispel: `Remove ${amount} opposing Strength, Focus, Regen, or Ward stacks`,
    status: `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${status}`,
  }[type];
}
function card(name, type, cost, rarity, effects, extra, flavor) {
  const clauses = [];
  if (extra.healthCost) clauses.push(`Pay ${extra.healthCost} Health (must survive full payment)`);
  clauses.push(...effects.map(effectText));
  if (extra.condition) clauses.push(`${conditionText[extra.condition]} before this card resolves: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) clauses.push(`For ${extra.aura.duration} of your turns, ${triggerText[extra.aura.trigger].toLowerCase()}: ${extra.aura.effects.map(effectText).join('; ')}`);
  if (extra.delayed) clauses.push(`After ${extra.delayed.turns} of your turns: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) clauses.push('Exhaust');
  return {
    id: `tide-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name, school: 'tide', type,
    kind: [...effects, ...(extra.bonusEffects || [])].some(e => e.type === 'damage') ? 'attack' : 'skill',
    cost, rarity, effects, ...extra, flavor, description: clauses.join('. ') + '.',
  };
}

export const tideCards = [
  // Hexes contaminate an existing wound; their own brine cannot satisfy the condition.
  card('Salt in the Passenger Roll', 'hex', 1, 'common', [curse('poison'), guard(2)], when('afflicted', [guard(2)]), 'The clerk wets his finger and tastes a name he buried yesterday.'),
  card('Leech Beneath the Tongue', 'hex', 1, 'common', [hit(3), curse('weak')], when('afflicted', [curse('poison')]), 'It drinks the answer before the witness can speak.'),
  card('One Grain for the Dead', 'hex', 0, 'common', [curse('poison')], { ...when('afflicted', [hit(1)]), exhaust: true }, 'A grain on each eyelid keeps the dreams from floating away.'),
  card('Quarantine the Well', 'hex', 2, 'uncommon', [curse('poison', 2), curse('weak')], when('afflicted', [guard(4)]), 'Tie the red rope above the bucket, where thirsty hands must see it.'),
  card('Silt in the Sutures', 'hex', 2, 'uncommon', [hit(5), curse('poison', 2)], when('afflicted', [curse('vulnerable')]), 'The river sews badly, but it never loses a patient.'),
  card('Blackwater Baptism', 'hex', 3, 'rare', [guard(6), curse('poison', 3), curse('weak')], when('afflicted', [hit(6)]), 'The priest asks which name you wish the water to forget.'),
  card('Borrowed Fever', 'hex', 1, 'uncommon', [curse('weak'), cleanse(1)], when('afflicted', [guard(2)]), 'Pour the sickroom water downstream. Someone is always downstream.'),

  // These diagrams lie on the water around the duel, not on a second battlefield.
  card('Reed Mat Infirmary', 'formation', 1, 'common', [guard(3)], { ...aura('turn-end', 2, [heal(1)]), exhaust: true }, 'The mat rises and falls with a patient who has forgotten how.'),
  card('Two Bank Markers', 'formation', 1, 'common', [guard(2)], aura('turn-start', 3, [guard(2)]), 'Move neither stone. The river must remember where to return.'),
  card('Saltpan Boundary', 'formation', 1, 'common', [hit(2)], aura('turn-end', 2, [hit(2)]), 'Every drying pool leaves an edge sharp enough to open skin.'),
  card('Quarantine Buoys', 'formation', 2, 'uncommon', [guard(3)], { ...aura('turn-end', 2, [curse('poison')]), exhaust: true }, 'The bells on the buoys ring only under water.'),
  card('Drainage Channels of Mercy', 'formation', 2, 'uncommon', [cleanse(1)], { ...aura('turn-start', 3, [guard(3)]), exhaust: true }, 'Cut shallow channels around the bed before the nightmares thaw.'),
  card('Lanterns for the Second Crossing', 'formation', 2, 'rare', [guard(4)], { ...aura('turn-start', 3, [heal(1), cleanse(1)]), exhaust: true }, 'Set out one lamp for the traveler and one for what follows home.'),
  card('Harbor of Unclaimed Ashes', 'formation', 3, 'legendary', [guard(5)], { ...aura('turn-end', 3, [heal(1), hit(3)]), exhaust: true }, 'The ash settles into names each evening. Each morning the boats disturb it.'),

  // Action stances pay once per directly played card and cannot feed one another.
  card('Oar Across the Knees', 'stance', 1, 'common', [guard(3)], aura('on-attack', 2, [guard(1)]), 'Row with the hips; keep both hands free for the drowning.'),
  card('Listen Beneath the Hull', 'stance', 1, 'common', [guard(2)], aura('on-guard', 2, [hit(1)]), 'Answer each knock with the flat of the oar.'),
  card('Gloves of Dried Kelp', 'stance', 1, 'common', [cleanse(1)], aura('on-status', 2, [guard(1)]), 'The kelp takes the stain. Your fingers keep their names.'),
  card('Pulse of the Mooring Rope', 'stance', 2, 'uncommon', [guard(4)], { ...aura('on-guard', 2, [heal(1)]), exhaust: true }, 'Hold until the rope beats at the same pace as your wrist.'),
  card('Turn the Hook Inward', 'stance', 2, 'uncommon', [hit(4)], { ...aura('on-attack', 2, [curse('poison')]), exhaust: true }, 'The hook carries what the bait would not swallow.'),
  card('Salt Reader Posture', 'stance', 2, 'rare', [curse('weak')], { ...aura('on-status', 2, [hit(2)]), exhaust: true }, 'Read the crystals left on the skin. They spell the next wound.'),
  card('Ferryman at the Broken Lock', 'stance', 3, 'legendary', [guard(5)], { ...aura('on-guard', 2, [hit(1), curse('poison')]), exhaust: true }, 'He takes no passengers tonight. The lock itself must be ferried across.'),

  card('Sound the Shoal', 'counter', 1, 'common', [hit(4), guard(1)], when('guarded', [curse('poison')]), 'The sounding pole finds a rib where the chart promised sand.'),
  card('Fold Behind the Oar', 'counter', 1, 'common', [guard(5)], when('guarded', [curse('weak')]), 'A blade cannot follow a body through so narrow a wake.'),
  card('Pebble Against the Flood', 'counter', 0, 'common', [guard(2)], { ...when('guarded', [hit(1)]), exhaust: true }, 'A small stone redirects a large river when placed early enough.'),
  card('Catch the Undertow', 'counter', 2, 'uncommon', [hit(7), guard(3)], when('guarded', [hit(4)]), 'Let the pull beneath the surface carry the returning blow.'),
  card('Close the Spillway Teeth', 'counter', 1, 'uncommon', [guard(4)], when('guarded', [curse('poison')]), 'Each tooth traps one dark drop for the next hand on the gate.'),
  card('Break Against the Harbor Wall', 'counter', 3, 'rare', [hit(12), guard(4)], when('guarded', [curse('poison', 2)]), 'Even the sea comes back bruised from that wall.'),
  card('Rescue from the Lee Side', 'counter', 2, 'uncommon', [guard(7), cleanse(1)], { ...when('guarded', [heal(3)]), exhaust: true }, 'Reach around the sheltered side. Do not offer the storm your other arm.'),

  // No pact refunds its own vitality price, immediately or on a later turn.
  card('Coin Under the Nail', 'pact', 0, 'common', [curse('poison', 2)], { healthCost: 3, exhaust: true }, 'The ferryman accepts warm coins, but refuses to say why.'),
  card('Rent a Dry Breath', 'pact', 1, 'common', [guard(6), cleanse(1)], { healthCost: 2 }, 'The breath belongs to someone waiting on the other bank.'),
  card('Bait with the Little Finger', 'pact', 1, 'common', [hit(5), curse('poison', 2)], { healthCost: 3 }, 'The smallest offering catches the fish with human teeth.'),
  card('Mortgage the Shore', 'pact', 1, 'uncommon', [draw(2), curse('weak')], { healthCost: 4, exhaust: true }, 'For one crossing, promise never again to call either bank home.'),
  card('Blood for the Lockkeeper', 'pact', 2, 'uncommon', [guard(7), curse('poison', 2)], { healthCost: 3 }, 'He opens the sluice only after the measuring cup is full.'),
  card('Purchase the Sunk Cargo', 'pact', 2, 'rare', [recover(2), guard(4)], { healthCost: 4, exhaust: true }, 'Everything aboard is yours, including the weight that took it down.'),
  card('Passage for an Unburied King', 'pact', 3, 'legendary', [hit(12), curse('poison', 3), dispel(2)], { healthCost: 7, exhaust: true }, 'His crown pays for the boat. Your blood pays for the empty seat beside him.'),

  card('Steep the Funeral Tea', 'ritual', 1, 'common', [guard(3)], { ...later(1, [heal(3)]), exhaust: true }, 'Wait until the steam no longer resembles the departed.'),
  card('Sink the Sealed Jar', 'ritual', 1, 'common', [hit(2)], later(1, [curse('poison', 2)]), 'Tie a reed to the lid. When it snaps, stop drinking from the river.'),
  card('Float the Empty Basket', 'ritual', 1, 'common', [guard(2)], later(2, [draw(2)]), 'The tide will put something in it. Do not watch what climbs aboard.'),
  card('Wait for the Silt to Settle', 'ritual', 2, 'uncommon', [curse('weak')], later(1, [guard(8), cleanse(1)]), 'Clear water is only mud that has learned patience.'),
  card('Bury the Anchor Upright', 'ritual', 2, 'uncommon', [guard(3)], later(2, [hit(10), curse('poison')]), 'By dawn the buried iron will remember which way the ship was falling.'),
  card('Send the Return Ferry', 'ritual', 2, 'rare', [guard(5)], { ...later(2, [recover(2), heal(2)]), exhaust: true }, 'Leave the far bank empty. Your old mistakes know where to board.'),
  card('Open the Brine Cask Tomorrow', 'ritual', 2, 'uncommon', [curse('poison')], later(1, [hit(6), curse('weak')]), 'The cooper seals it with a date, not a name.'),

  card('Wash the Golden Bones', 'transmute', 1, 'common', [dispel(1), curse('poison')], {}, 'Gold flakes away. The bones beneath belong to no saint.'),
  card('Dredge the Lost Parcel', 'transmute', 1, 'common', [recover(1), guard(2)], { exhaust: true }, 'The wrapping has rotted. The address is still your own.'),
  card('Scrape the Salt Crown', 'transmute', 0, 'common', [dispel(1)], { exhaust: true }, 'One wet thumb undoes a king of the salt flats.'),
  card('Filter the Funeral Silt', 'transmute', 2, 'uncommon', [recover(1), cleanse(2)], { exhaust: true }, 'The sieve keeps the useful fragments and lets the lament pass through.'),
  card('Dissolve the Pearl Reliquary', 'transmute', 2, 'uncommon', [dispel(2), guard(5)], {}, 'A pearl is only a prison that forgot its prisoner.'),
  card('Drag the Chapel from the Channel', 'transmute', 3, 'rare', [recover(2), guard(6)], { exhaust: true }, 'The bell rises first, ringing with all the water still inside.'),
  card('Distill the Stolen Blessing', 'transmute', 2, 'uncommon', [dispel(2), heal(3)], { exhaust: true }, 'Boil away the priesthood. Keep the small kindness left at the bottom.'),

  card('Last Pole into Deep Water', 'finisher', 2, 'common', [hit(8), curse('poison')], { ...when('resonant', [hit(4)]), exhaust: true }, 'Below this depth the river will not give the pole back.'),
  card('Empty the Passenger Bowl', 'finisher', 1, 'common', [hit(5)], { ...when('empty-hand', [curse('poison')]), exhaust: true }, 'Nothing remains to feed the crossing except its keeper.'),
  card('Close the Reed Coffin', 'finisher', 2, 'common', [hit(8), guard(3)], { ...when('empty-hand', [curse('weak')]), exhaust: true }, 'Weave the final reed while the occupant is still deciding whether to rise.'),
  card('All Tributaries Converge', 'finisher', 2, 'uncommon', [hit(9)], { ...when('resonant', [curse('poison', 2)]), exhaust: true }, 'Every small river arrives carrying the same accusation.'),
  card('Cast Off the Mourning Rope', 'finisher', 2, 'uncommon', [hit(9), cleanse(1)], { ...when('empty-hand', [guard(4)]), exhaust: true }, 'Do not tie the loose end around your wrist this time.'),
  card('The Mouth of the Drowned River', 'finisher', 3, 'rare', [hit(13), curse('poison', 2)], { ...when('resonant', [hit(6)]), exhaust: true }, 'It opens beneath the sea, still trying to say where it came from.'),
  card('No Boat Returns from This Dawn', 'finisher', 3, 'legendary', [hit(12), curse('poison', 2)], { ...when('empty-hand', [hit(5), dispel(2)]), exhaust: true }, 'Cut every mooring. Let the shore be the thing left drifting.'),

  card('Hook the Waterline', 'strike', 2, 'rare', [hit(9), curse('weak'), curse('poison')], {}, 'Find the line where a reflection meets the body, and pull.'),
  card('Oilskin of the Night Pilot', 'ward', 2, 'rare', [guard(9), boon('ward'), cleanse(1)], {}, 'Rain runs off it. Names run down the inside.'),
  card('Recite the Tidal Almanac', 'mantra', 1, 'rare', [draw(1), guard(2)], later(1, [draw(1)]), 'Read tomorrow aloud so the tide knows where to find you.'),
  card('Freshwater from the Grave Spring', 'remedy', 2, 'rare', [heal(4), cleanse(2)], { ...when('wounded', [guard(4)]), exhaust: true }, 'It tastes of rain that fell before the cemetery was built.'),
];
