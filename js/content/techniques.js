const damage = (amount, hits) => ({ type: 'damage', amount, ...(hits && { hits }) });
const block = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const energy = amount => ({ type: 'energy', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const afflict = (status, amount) => ({ type: 'status', status, amount });
const empower = (status, amount) => ({ type: 'status', status, amount, target: 'self' });

function effectText(effect) {
  const { type, amount, hits, status, target } = effect;
  switch (type) {
    case 'damage': return `Deal ${amount} damage${hits ? ` × ${hits}` : ''}`;
    case 'block': return `Gain ${amount} Guard`;
    case 'draw': return `Draw ${amount}`;
    case 'energy': return `Gain ${amount} Qi`;
    case 'heal': return `Heal ${amount}`;
    case 'cleanse': return `Cleanse ${amount} debuff${amount === 1 ? '' : 's'}`;
    case 'status': {
      const label = status[0].toUpperCase() + status.slice(1);
      return `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${label}`;
    }
  }
}

// Order within each school controls discovery and catalog sorting.
const forms = {
  neutral: [
    ['Palm Strike', 'attack', 1, 'common', [damage(6)], 'A form passed from cook to porter to orphan.'],
    ['Breath Ward', 'skill', 1, 'common', [block(5)], 'Breathe into the place the blow is going to land.'],
    ['Gather Qi', 'skill', 0, 'common', [draw(1), energy(1)], 'You still own the breath you have just taken.', true],
    ['Piercing Step', 'attack', 1, 'common', [damage(5), afflict('vulnerable', 1)], 'Leave the last pace for the enemy to take.'],
    ['Traveling Parry', 'skill', 1, 'common', [block(4), draw(1)], 'The road teaches the elbow what the sword forgets.'],
    ['Bitter Root', 'skill', 1, 'common', [heal(4), cleanse(1)], 'The bitterness tells you when the medicine is working.', true],
    ['Sweep the Threshold', 'attack', 1, 'common', [damage(4, 2)], 'The first arc asks. The second makes room.'],
    ['Empty Jar', 'skill', 0, 'uncommon', [draw(2)], 'An empty jar still holds its shape.', true],
    ['Weathered Stance', 'skill', 2, 'uncommon', [block(13), cleanse(1)], 'Turn the storm around your shoulders.'],
    ['Seven Mile Blow', 'attack', 2, 'uncommon', [damage(16)], 'A traveler puts the whole road behind this punch.'],
    ['Refuse the Toll', 'skill', 1, 'rare', [block(7), empower('ward', 2)], 'The empty sleeve is all you owe.'],
    ['Carry the Hearth', 'skill', 2, 'rare', [heal(10), empower('regen', 3)], 'A kitchen fire, tucked inside the ribs.', true],
  ],
  iron: [
    ['Iron Vow', 'attack', 1, 'common', [damage(6), block(3)], 'I shall answer for the edge.'],
    ['Bailiff’s Guard', 'skill', 1, 'common', [block(8)], 'Stand where the warrant says you should not.'],
    ['Split the Seal', 'attack', 1, 'common', [damage(7), afflict('vulnerable', 1)], 'Every seal has a flaw where the maker lifted the stamp.'],
    ['Gatepost Cut', 'attack', 2, 'common', [damage(16), block(3)], 'Learn it first with a wooden hinge.'],
    ['Witness Blade', 'attack', 1, 'common', [damage(3, 2), draw(1)], 'The second cut will speak for the first.'],
    ['Hold the Door', 'skill', 0, 'common', [block(4)], 'Someone is still inside.', true],
    ['Sword Petition', 'attack', 1, 'uncommon', [damage(8), afflict('bleed', 2)], 'The court accepts petitions in red.'],
    ['Dismiss the Bailiff', 'attack', 2, 'uncommon', [damage(13), afflict('weak', 2)], 'You have no office here.'],
    ['Temper the Spine', 'skill', 1, 'uncommon', [block(5), empower('strength', 2)], 'Cold water gives the iron somewhere to go.', true],
    ['Iron on Iron', 'skill', 1, 'uncommon', [block(6), empower('focus', 1)], 'Lean on the weight that would have sunk you.'],
    ['Hundred Hinge Ward', 'skill', 2, 'uncommon', [block(15), draw(1)], 'All the gates open into your stance.'],
    ['Contract Severance', 'attack', 2, 'rare', [afflict('vulnerable', 2), damage(11, 2)], 'Draw the edge through the signature.', true],
    ['Blade of Recusal', 'attack', 1, 'rare', [damage(10), block(9)], 'The captain set the blade down and stood in front of it.'],
    ['Living Bastion', 'skill', 2, 'rare', [block(18), empower('focus', 2), empower('ward', 1)], 'Hold the last gate with both hands.', true],
    ['Verdict of Bent Steel', 'attack', 3, 'legendary', [damage(33), block(12), afflict('weak', 2)], 'Some judgments have to be made with a broken sword.'],
  ],
  ember: [
    ['Cinder Finger', 'attack', 1, 'common', [damage(5), afflict('burn', 3)], 'The kiln remembers the touch.'],
    ['Furnace Skin', 'skill', 1, 'common', [block(6), afflict('burn', 2)], 'Let the first layer char.'],
    ['Red Coals', 'skill', 0, 'common', [afflict('burn', 2)], 'Sweep them under the grate before the guards come.', true],
    ['Soot Needle', 'attack', 1, 'common', [damage(8), afflict('burn', 1)], 'Even a closed eye has a seam.'],
    ['Ash Basket', 'skill', 1, 'common', [block(4), draw(2)], 'The ash holds heat until you ask for it.'],
    ['Brazier Kick', 'attack', 2, 'common', [damage(12), afflict('burn', 4)], 'Tip it toward the draft.'],
    ['Glass Lungs', 'skill', 1, 'uncommon', [energy(2), afflict('burn', 2)], 'There is one breath left in the vial.', true],
    ['Spite Kiln', 'attack', 2, 'uncommon', [damage(6, 3), afflict('burn', 2)], 'Turn each brick to face its maker.'],
    ['First Firing', 'skill', 1, 'uncommon', [afflict('burn', 5), empower('ward', 1)], 'Remember whose hands shaped the clay.'],
    ['Coal Heart Draught', 'skill', 1, 'uncommon', [heal(5), empower('strength', 2)], 'Swallow before the bubbles rise.', true],
    ['Cinder Screen', 'skill', 2, 'uncommon', [block(12), afflict('weak', 2), afflict('burn', 2)], 'Put the smoke between you and the body.'],
    ['Funeral Sun', 'attack', 2, 'rare', [damage(15), afflict('burn', 7)], 'We kept it lit all the way down the road.', true],
    ['Devouring Crucible', 'skill', 2, 'rare', [afflict('burn', 6), draw(2), block(9)], 'It is hungry for the shape of the offering.'],
    ['Ember Testament', 'attack', 1, 'rare', [damage(10), afflict('burn', 4), afflict('vulnerable', 1)], 'Seal the jar while the words are still hot.'],
    ['Last Breath of the Kiln', 'attack', 3, 'legendary', [damage(28), afflict('burn', 9), draw(2)], 'Turn the bellows one last time and leave the room.', true],
  ],
  tide: [
    ['Saltwater Lance', 'attack', 1, 'common', [damage(5), afflict('poison', 3)], 'Throw from below the waterline.'],
    ['River Skin', 'skill', 1, 'common', [block(6), empower('regen', 1)], 'Bruises drift down from the shoulders.'],
    ['Bitter Brine', 'skill', 0, 'common', [afflict('poison', 2)], 'Hold it under the tongue until it goes sweet.', true],
    ['Tidebone Cut', 'attack', 1, 'common', [damage(7), afflict('poison', 1)], 'The blade was never quite dry.'],
    ['Ferry’s Wake', 'skill', 1, 'common', [block(5), draw(1), cleanse(1)], 'The trick is stepping onto the ripples.'],
    ['Mudbank Snare', 'attack', 2, 'common', [damage(11), afflict('weak', 2), afflict('poison', 2)], 'One foot at a time until there is no bank.'],
    ['Estuary Breath', 'skill', 1, 'uncommon', [heal(6), cleanse(2)], 'Take air where the river changes its mind.', true],
    ['Salt Stitch', 'skill', 1, 'uncommon', [block(7), empower('regen', 2)], 'The knots must sit on the inside.'],
    ['Drowning Needle', 'attack', 1, 'uncommon', [damage(4), afflict('poison', 5)], 'The patient hears the river before the fever.'],
    ['Reedbed Ambush', 'attack', 2, 'uncommon', [damage(5, 3), afflict('bleed', 3)], 'Wade where the reeds face upstream.'],
    ['Bones of the Ferry', 'skill', 2, 'uncommon', [block(13), afflict('poison', 3)], 'Some passengers still have their hands on the rail.'],
    ['Hunger of the Silt', 'skill', 1, 'rare', [afflict('poison', 6), afflict('weak', 2), draw(1)], 'The river has a long memory for teeth.'],
    ['Return the Drowned', 'skill', 2, 'rare', [heal(9), empower('regen', 4), cleanse(2)], 'Call the youngest one last.', true],
    ['Flood the Locks', 'attack', 2, 'rare', [damage(15), afflict('poison', 7)], 'Open everything that once held the river.', true],
    ['Tide at the End of Names', 'attack', 3, 'legendary', [damage(23), afflict('poison', 10), empower('regen', 3)], 'There is room for every lost name in the open sea.'],
  ],
  shade: [
    ['Mourner’s Knife', 'attack', 1, 'common', [damage(6), afflict('bleed', 3)], 'Keep the edge turned toward the heart.'],
    ['Borrowed Face', 'skill', 1, 'common', [block(6), afflict('weak', 1)], 'A well-worn mask will turn your head for you.'],
    ['Candle Snuffer', 'attack', 0, 'common', [damage(3), afflict('weak', 1)], 'Put your thumb and forefinger through the flame.', true],
    ['Wake Needle', 'attack', 1, 'common', [afflict('vulnerable', 1), damage(5)], 'Stitch the shroud with the wearer looking on.'],
    ['Cut Behind the Curtain', 'attack', 2, 'common', [damage(7, 2), afflict('bleed', 2)], 'Wait for the first clap.'],
    ['Curtain Hem', 'skill', 1, 'common', [block(5), draw(2)], 'A good seam hides a smaller one.'],
    ['Sable Interrogation', 'skill', 1, 'uncommon', [afflict('weak', 3), afflict('vulnerable', 2)], 'Ask the shadow which of you arrived first.'],
    ['Thousand Pin Mask', 'attack', 2, 'uncommon', [afflict('bleed', 4), damage(5, 3)], 'It looks best from the other side of the stage.'],
    ['Dress Rehearsal', 'skill', 0, 'uncommon', [draw(2), afflict('vulnerable', 1)], 'Die once before the audience gets here.', true],
    ['Sister’s Shadow', 'skill', 1, 'uncommon', [block(8), empower('ward', 1), afflict('weak', 1)], 'She promised to keep to your left.'],
    ['Quiet Usher', 'attack', 2, 'uncommon', [damage(13), afflict('weak', 3)], 'You can go as soon as the names are called.'],
    ['Black Bamboo Testimony', 'attack', 2, 'rare', [afflict('bleed', 6), damage(6, 3), afflict('weak', 1)], 'The mask had been waiting years to say it.'],
    ['Open Casket', 'skill', 1, 'rare', [afflict('vulnerable', 4), afflict('weak', 2), draw(1)], 'The empty space has your measure.', true],
    ['Four Stages of Grief', 'attack', 2, 'rare', [damage(5, 4), afflict('bleed', 4)], 'Only four of the stages need the knife.'],
    ['Final Unmasking', 'attack', 3, 'legendary', [afflict('vulnerable', 3), damage(10, 3), afflict('bleed', 6)], 'When they see your face, let them remember theirs.', true],
  ],
  lotus: [
    ['Jade Palm', 'attack', 1, 'common', [damage(6), block(4)], 'A prayer may begin with a bruise.'],
    ['Unwritten Shield', 'skill', 1, 'common', [block(7), cleanse(1)], 'The law is easiest to read where it cannot reach.'],
    ['Sutra Seed', 'skill', 0, 'common', [block(3), draw(1)], 'Begin where the verse began in your sleep.', true],
    ['Silent Chime', 'attack', 1, 'common', [damage(7), empower('ward', 1)], 'Hold the clapper until you feel it ring.'],
    ['Prayer Wheel', 'skill', 1, 'common', [block(6), empower('focus', 1)], 'Stop turning it when the names turn on their own.'],
    ['Two Hands, One Stone', 'attack', 2, 'common', [damage(13), block(8)], 'Lift the stone between two quiet breaths.'],
    ['Lotus Under Snow', 'skill', 1, 'uncommon', [heal(5), empower('regen', 3)], 'The stalk grows where the air is gone.', true],
    ['Deny the Writ', 'skill', 1, 'uncommon', [block(7), empower('ward', 2)], 'You need only shake your head.'],
    ['Patient Stone', 'skill', 2, 'uncommon', [block(13), empower('focus', 2)], 'The long wait wears down the steps.'],
    ['Testimony Palm', 'attack', 1, 'uncommon', [damage(8), afflict('weak', 2)], 'Speak exactly as loudly as the witness.'],
    ['Fold the Sutra', 'skill', 2, 'uncommon', [block(10), cleanse(3), draw(2)], 'Keep the last verse inside the first.'],
    ['Open the Bronze Door', 'attack', 2, 'rare', [damage(16), block(12), empower('ward', 1)], 'The latch is on the inside of your wrist.'],
    ['Voice of Ten Thousand', 'skill', 1, 'rare', [empower('focus', 3), empower('regen', 3), draw(1)], 'If the verse has room, say their name first.', true],
    ['Relief of the Living', 'skill', 2, 'rare', [heal(11), block(11), cleanse(2)], 'There is no shame in staying to hear the last verse.', true],
    ['No Gate in the World', 'skill', 3, 'legendary', [block(28), empower('ward', 4), empower('focus', 4), draw(2)], 'The verse ends where you stand.', true],
  ],
  thunder: [
    ['Cable Spark', 'attack', 1, 'common', [damage(4, 2)], 'Stay low until the cable sings.'],
    ['Kite Wire', 'attack', 0, 'common', [damage(3), draw(1)], 'Always leave enough length for the wind.', true],
    ['Storm Brace', 'skill', 1, 'common', [block(7), draw(1)], 'Plant the shorter leg downhill.'],
    ['Forked Spear', 'attack', 1, 'common', [damage(7), afflict('vulnerable', 1)], 'Leave one tine in the cloud.'],
    ['Pay the Courier', 'skill', 0, 'common', [energy(1), block(3)], 'Give her the fare before you give her the letter.', true],
    ['Run the Span', 'attack', 2, 'common', [damage(6, 3)], 'The far bank will meet your last step.'],
    ['Ground Wire', 'skill', 1, 'uncommon', [block(8), empower('ward', 1), energy(1)], 'What you do with the charge determines who carries it.', true],
    ['Rookery Flash', 'attack', 1, 'uncommon', [damage(4, 3), afflict('weak', 1)], 'One call from each side of the cliff.'],
    ['Lightning Ledger', 'skill', 1, 'uncommon', [draw(3), energy(1)], 'Check the signature in the afterimage.', true],
    ['Silver Relay', 'attack', 2, 'uncommon', [damage(12), draw(2), energy(1)], 'Take the next letter without stopping.'],
    ['Before the Thunder', 'skill', 1, 'uncommon', [block(6), empower('strength', 2)], 'There is a little room between arrival and sound.', true],
    ['Cross the Blue Hour', 'attack', 1, 'rare', [damage(5, 3), draw(1), energy(1)], 'The entire crossing fits in the flash.', true],
    ['Weather Vane Canon', 'attack', 2, 'rare', [afflict('vulnerable', 2), damage(6, 3)], 'Call the wind by its direction and wait.'],
    ['The Fourth Storm', 'skill', 1, 'rare', [energy(3), empower('strength', 2)], 'Three storms were enough to teach her its name.', true],
    ['Spear Across the Sky', 'attack', 3, 'legendary', [damage(9, 4), afflict('weak', 2), energy(2)], 'The spear reached the other side before the letter did.', true],
  ],
  star: [
    ['Read the Vacancy', 'skill', 1, 'common', [draw(2), block(4)], 'Trace the part of the chart that never sees ink.'],
    ['Astral Needle', 'attack', 1, 'common', [damage(7), draw(1)], 'The thread finds the puncture on its own.'],
    ['Eclipse Glint', 'attack', 0, 'common', [damage(4), afflict('vulnerable', 1)], 'It takes only a corner of the sun.', true],
    ['Orbiting Screen', 'skill', 1, 'common', [block(7), empower('ward', 1)], 'Let the stone come around again.'],
    ['Starfallen Brush', 'attack', 1, 'common', [damage(5), afflict('burn', 2), draw(1)], 'Keep the quill pointed down.'],
    ['Cross the Meridian', 'attack', 2, 'common', [damage(14), draw(2)], 'A familiar star is behind you now.'],
    ['Vacant Constellation', 'skill', 1, 'uncommon', [draw(3), empower('ward', 1)], 'Leave room between the lines for the missing ones.'],
    ['Censor’s Comet', 'attack', 2, 'uncommon', [damage(16), afflict('vulnerable', 2)], 'An objection that returns every thirty years.'],
    ['Missing Second', 'skill', 0, 'uncommon', [energy(1), draw(2)], 'Spend the second Yu Shuang kept off the books.', true],
    ['Gold Ring Transit', 'skill', 2, 'uncommon', [block(13), draw(2), empower('ward', 1)], 'Look through the gold only when the sky darkens.'],
    ['Falling Ink', 'attack', 2, 'uncommon', [damage(6, 3), afflict('burn', 3)], 'Move the paper before the drop hits.'],
    ['Witness of Polaris', 'attack', 1, 'rare', [damage(11), afflict('vulnerable', 2), draw(2)], 'Face the one point the ministry could not move.', true],
    ['Celestial Injunction', 'skill', 2, 'rare', [afflict('weak', 3), afflict('vulnerable', 3), block(11), draw(1)], 'Address it to the law itself.'],
    ['When the Moon Objects', 'attack', 2, 'rare', [afflict('vulnerable', 2), damage(13), draw(3)], 'The room stayed dark for the length of her testimony.'],
    ['Write a New Heaven', 'attack', 3, 'legendary', [damage(30), afflict('vulnerable', 3), draw(3), empower('ward', 2)], 'Leave the last stroke open for whoever comes after.', true],
  ],
};

export const cards = Object.entries(forms).flatMap(([school, records]) =>
  records.map(([name, kind, cost, rarity, effects, flavor, exhaust = false]) => ({
    id: name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-'),
    name, school, kind, cost, rarity, effects, flavor, exhaust,
    description: [...effects.map(effectText), ...(exhaust ? ['Exhaust'] : [])].join('. ') + '.',
  })),
);

export const starterDeck = [
  'palm-strike', 'palm-strike', 'palm-strike', 'palm-strike', 'breath-ward',
  'breath-ward', 'breath-ward', 'gather-qi', 'piercing-step', 'traveling-parry',
];
