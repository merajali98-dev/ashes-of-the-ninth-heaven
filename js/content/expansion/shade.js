// Hollow Veil: the stage survives by making its witnesses disappear.
const hit = amount => ({ type: 'damage', amount });
const guard = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const recover = amount => ({ type: 'recover', amount });
const dispel = amount => ({ type: 'dispel', amount });
const curse = (status, amount = 1) => ({ type: 'status', status, amount, target: 'opponent' });
const when = (condition, bonusEffects) => ({ condition, bonusEffects });
const aura = (trigger, duration, effects) => ({ aura: { trigger, duration, effects } });
const later = (turns, effects) => ({ delayed: { turns, effects } });
const conditionText = {
  afflicted: 'If the opponent already had Burn, Poison, Bleed, Weak, or Vulnerable',
  guarded: 'If you already had Guard',
  wounded: 'If you were at or below half vitality before payment',
  resonant: 'If your Hollow Veil chain already had at least two steps',
  'empty-hand': 'If no other cards remained in your hand',
};
const triggerText = {
  'turn-start': 'At your turn start', 'turn-end': 'At your turn end',
  'on-attack': 'Once per directly played attack',
  'on-guard': 'Once per directly played card granting Guard',
  'on-status': 'Once per directly played card applying a status',
};
function effectText({ type, amount, status }) {
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`,
    draw: `Draw ${amount}`, heal: `Heal ${amount}`, cleanse: `Cleanse ${amount} debuff stacks`,
    recover: `Return ${amount} most recently exhausted technique${amount === 1 ? '' : 's'} to your discard pile`,
    dispel: `Remove ${amount} opposing positive stacks in order: Strength, Focus, Regeneration, Ward`,
    status: `Inflict ${amount} ${status}`,
  }[type];
}
function card(name, type, cost, rarity, effects, extra, flavor) {
  const lines = [];
  if (extra.healthCost) lines.push(`Pay ${extra.healthCost} vitality; full payment must leave at least 1`);
  lines.push(...effects.map(effectText));
  if (extra.condition) lines.push(`${conditionText[extra.condition]} when this card left your hand, before costs or effects: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) lines.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger].toLowerCase()}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; never triggers recursively)`);
  if (extra.delayed) lines.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) lines.push('Exhaust');
  return {
    id: `shade-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name, school: 'shade', type,
    kind: [...effects, ...(extra.bonusEffects || [])].some(e => e.type === 'damage') ? 'attack' : 'skill',
    cost, rarity, effects, ...extra, description: lines.join('. ') + '.', flavor,
  };
}

export const shadeCards = [
  // Hex: an earlier affliction supplies the missing line of the script.
  card('Red Thread Under the Tongue', 'hex', 1, 'common', [hit(3), curse('bleed')], when('afflicted', [hit(2)]), 'The witness remembered every word except the one holding the knot.'),
  card('Paint the Coward Brow', 'hex', 1, 'common', [curse('weak', 2)], when('afflicted', [curse('bleed')]), 'Two white strokes make even a sword saint look toward the door.'),
  card('Pin the Missing Portrait', 'hex', 0, 'common', [curse('vulnerable')], { ...when('afflicted', [hit(1)]), exhaust: true }, 'The nail finds the face that the wall has forgotten.'),
  card('False Widow Lament', 'hex', 2, 'uncommon', [curse('bleed', 3), curse('weak')], when('afflicted', [hit(4)]), 'She weeps for the man who will die when the song ends.'),
  card('Smear the Imperial Rouge', 'hex', 1, 'uncommon', [curse('vulnerable'), hit(2)], when('afflicted', [dispel(1)]), 'A damp sleeve reveals how little of the emperor was skin.'),
  card('Erase the Last Witness', 'hex', 2, 'rare', [hit(8), curse('weak')], when('afflicted', [dispel(2), hit(2)]), 'Without a witness, even Heaven must withdraw its accusation.'),
  card('Script Written in Scars', 'hex', 3, 'rare', [hit(10), curse('bleed', 3)], { ...when('afflicted', [curse('vulnerable', 2), hit(3)]), exhaust: true }, 'The actor learned the role before anyone taught him to read.'),

  // Formations arrange a duel's timing without adding actors to the battlefield.
  card('Screen of Unlit Windows', 'formation', 1, 'common', [guard(2)], aura('turn-end', 2, [hit(2)]), 'From outside, every room appears empty. From inside, every window has teeth.'),
  card('Bloodstain Seating Chart', 'formation', 1, 'common', [hit(2)], aura('turn-start', 2, [curse('bleed')]), 'The usher never seats a patron twice in the same stain.'),
  card('Ash Circle Footlights', 'formation', 1, 'common', [curse('weak')], aura('turn-end', 2, [guard(2)]), 'Keep within the cold light until the blade passes.'),
  card('Corridor Without Reflections', 'formation', 2, 'uncommon', [dispel(1)], aura('turn-start', 3, [hit(3)]), 'Every missing reflection leaves a narrow place for a knife.'),
  card('Two Bells Before Dawn', 'formation', 2, 'uncommon', [guard(2)], { ...aura('turn-start', 3, [draw(1)]), exhaust: true }, 'The first bell calls the living. Nobody admits who answers the second.'),
  card('Curtain of Borrowed Titles', 'formation', 2, 'uncommon', [curse('vulnerable')], aura('turn-end', 2, [dispel(1), hit(2)]), 'Each embroidered title unravels into the name of a servant.'),
  card('Theater That Denies Its Dead', 'formation', 3, 'legendary', [curse('weak')], { ...aura('turn-end', 3, [curse('bleed'), dispel(1), hit(2)]), exhaust: true }, 'The playbill lists no deaths. The stagehands keep replacing the floor.'),

  // Stances reward direct plays only; their wounds cannot applaud themselves.
  card('Listen Behind the Mask', 'stance', 1, 'common', [curse('weak')], aura('on-status', 2, [hit(1)]), 'Wait for the breath that does not belong to the speaker.'),
  card('Elbow Beneath the Sleeve', 'stance', 1, 'common', [guard(2)], aura('on-guard', 2, [hit(2)]), 'The sleeve rises in surrender. The elbow never learned that gesture.'),
  card('Step Through the Applause', 'stance', 1, 'common', [hit(2)], aura('on-attack', 2, [guard(1)]), 'For one heartbeat, the crowd supplies every sound your feet would make.'),
  card('Needle Held Between Teeth', 'stance', 2, 'uncommon', [hit(3)], aura('on-attack', 2, [curse('bleed')]), 'The smile is measured from the sharp end.'),
  card('Lower the Mourning Fan', 'stance', 2, 'uncommon', [curse('vulnerable')], aura('on-status', 2, [guard(1)]), 'Nobody watches the hand that has already concealed its grief.'),
  card('Understudy of the Knife', 'stance', 2, 'rare', [dispel(1)], { ...aura('on-guard', 3, [curse('vulnerable')]), exhaust: true }, 'Learn where the master flinches. The rest of the role is ornament.'),
  card('Refuse the Hero Entrance', 'stance', 3, 'rare', [curse('weak', 2)], { ...aura('on-attack', 2, [hit(1), dispel(1)]), exhaust: true }, 'Enter quietly enough and the prophecy never turns to face you.'),

  // Counters require Guard from an earlier action.
  card('Knife Through the Prop Door', 'counter', 1, 'common', [hit(5)], when('guarded', [curse('bleed')]), 'The painted lock never mattered. Neither did the painted wood.'),
  card('Turn the Porcelain Cheek', 'counter', 1, 'common', [guard(4)], when('guarded', [curse('weak')]), 'Let the beautiful side break first.'),
  card('Catch the Falling Hairpin', 'counter', 0, 'common', [hit(2)], { ...when('guarded', [hit(1)]), exhaust: true }, 'It was falling toward your throat before you changed its owner.'),
  card('Return the Unread Summons', 'counter', 2, 'uncommon', [hit(8), dispel(1)], when('guarded', [hit(4)]), 'Fold it around the blade so the magistrate knows which invitation you declined.'),
  card('Fold Behind the Backdrop', 'counter', 1, 'uncommon', [guard(3), hit(2)], when('guarded', [curse('vulnerable')]), 'The mountain painted on silk offers one excellent hiding place.'),
  card('Silence the Front Row', 'counter', 2, 'rare', [hit(7), curse('weak')], when('guarded', [curse('bleed', 2), hit(1)]), 'Only the spectators close enough to recognize you need to stop breathing.'),
  card('Break the General Mask', 'counter', 3, 'rare', [hit(13), dispel(2)], { ...when('guarded', [hit(5), curse('vulnerable')]), exhaust: true }, 'Beneath the lacquer, the invincible general is trying to remember his lines.'),

  // Pacts sell parts of the self; none refunds its own vitality payment.
  card('Rent a Living Face', 'pact', 0, 'common', [curse('weak'), hit(2)], { healthCost: 2, exhaust: true }, 'The lender will recognize you when the face comes due.'),
  card('Leave a Fingerprint in Red', 'pact', 1, 'common', [hit(7), curse('bleed')], { healthCost: 2 }, 'The mark proves you were present after the witnesses cease to be.'),
  card('Sell the Childhood Name', 'pact', 1, 'common', [draw(2)], { healthCost: 2, exhaust: true }, 'Your mother calls from the dream. You no longer know to answer.'),
  card('Promise the Second Shadow', 'pact', 2, 'uncommon', [hit(9), curse('vulnerable', 2)], { healthCost: 3 }, 'The first shadow still follows you. The second waits beside your enemy.'),
  card('Let the Mask Drink First', 'pact', 1, 'uncommon', [hit(7)], { healthCost: 2, ...when('wounded', [curse('bleed'), hit(1)]) }, 'A thirsty mask speaks with its wearer only after swallowing.'),
  card('Pawn the Funeral Portrait', 'pact', 2, 'uncommon', [dispel(3), curse('weak', 2), hit(4)], { healthCost: 4 }, 'You will have to die without a likeness. The broker considers this a fair price.'),
  card('Marriage to the Empty Role', 'pact', 3, 'legendary', [hit(14), curse('bleed', 3)], { healthCost: 7, ...when('empty-hand', [hit(6), curse('weak')]), exhaust: true }, 'Both families attend. Neither can point to the other spouse.'),

  // Rituals announce the next scene before the enemy has finished this one.
  card('Set the Trapdoor Rope', 'ritual', 1, 'common', [curse('vulnerable')], later(1, [hit(5)]), 'Pull only after the actor has placed his weight on the promise.'),
  card('Dye the Burial Sleeve', 'ritual', 1, 'common', [hit(2)], later(1, [curse('bleed', 2)]), 'The red takes a full breath to reach the cuff.'),
  card('Rehearse the Missing Verse', 'ritual', 1, 'common', [guard(2)], later(2, [draw(2)]), 'Leave two beats where the censor cut the words. The audience fills them in.'),
  card('Age the Funeral Wine', 'ritual', 2, 'uncommon', [curse('weak')], later(2, [hit(10), curse('bleed')]), 'The vintage is named for the year the guest will stop drinking.'),
  card('Wait for the Gilding to Crack', 'ritual', 2, 'uncommon', [dispel(1)], later(1, [dispel(3), hit(5)]), 'A counterfeit immortal sheds gold before it sheds blood.'),
  card('Teach the Corpse Its Cue', 'ritual', 2, 'rare', [curse('weak')], { ...later(2, [recover(2), curse('vulnerable')]), exhaust: true }, 'The old role returns to the script; the actor must find it again.'),
  card('Bury the Stage Directions', 'ritual', 3, 'rare', [curse('bleed', 2)], { ...later(2, [curse('vulnerable', 2), hit(14)]), exhaust: true }, 'Read the last instruction with a shovel in your hands.'),

  // Transmutations strip prestige or put exhausted techniques back into circulation.
  card('Scrape Gold from the Mask', 'transmute', 1, 'common', [dispel(2), hit(3)], {}, 'The flakes are worth more than the face beneath them.'),
  card('Restitch the Discarded Role', 'transmute', 1, 'common', [recover(1), curse('weak')], { exhaust: true }, 'An old sleeve can still hold a new wrist.'),
  card('Rub Out the Honorific', 'transmute', 0, 'common', [dispel(1)], { exhaust: true }, 'It takes less ink to describe a man after he has lost everything.'),
  card('Unravel the Victory Sash', 'transmute', 2, 'uncommon', [dispel(3), curse('bleed', 2)], {}, 'Each campaign was sewn with thread pulled from somebody else.'),
  card('Fish the Script from Lime', 'transmute', 2, 'uncommon', [recover(2), hit(3)], { exhaust: true }, 'Most of the words survived. The names have become small holes.'),
  card('Exchange the Ancestor Plaque', 'transmute', 1, 'uncommon', [dispel(2)], when('afflicted', [curse('vulnerable')]), 'The new ancestor disowns the family before the incense is lit.'),
  card('Archive of Faces Never Worn', 'transmute', 3, 'legendary', [recover(3), dispel(3), curse('weak')], { exhaust: true }, 'Every unused face remembers a life you still have time to ruin.'),

  // Finishers pay for an empty hand or a chain established before the final bow.
  card('Close the Last Eye', 'finisher', 1, 'common', [hit(6)], { ...when('empty-hand', [hit(3)]), exhaust: true }, 'The witness closes one eye willingly. Help with the other.'),
  card('Bow with Both Hands Empty', 'finisher', 1, 'common', [hit(4), curse('bleed')], { ...when('empty-hand', [curse('vulnerable')]), exhaust: true }, 'The audience can see your palms. That is all the reassurance they receive.'),
  card('Third Knock at the Greenroom', 'finisher', 2, 'common', [hit(9), curse('weak')], { ...when('resonant', [hit(5)]), exhaust: true }, 'The first knock is courtesy. The second is tradition. The third is inside.'),
  card('No Curtain Call', 'finisher', 2, 'uncommon', [hit(10)], { ...when('empty-hand', [dispel(2), hit(3)]), exhaust: true }, 'Leave while the applause still believes there is someone to thank.'),
  card('Decapitate the Painted Moon', 'finisher', 2, 'uncommon', [hit(8), curse('vulnerable')], { ...when('resonant', [curse('bleed', 2), hit(2)]), exhaust: true }, 'Without its moon, the tragic night has nowhere left to hide.'),
  card('One Seat Remains Unclaimed', 'finisher', 3, 'uncommon', [hit(14), curse('bleed')], { ...when('empty-hand', [hit(5), curse('weak')]), exhaust: true }, 'The empty seat is not reserved for someone who is late.'),
  card('The Play Ends Without You', 'finisher', 3, 'legendary', [dispel(3), hit(14)], { ...when('empty-hand', [curse('vulnerable'), hit(6)]), exhaust: true }, 'When the actors count the survivors, the stage itself refuses your name.'),

  card('Seam Ripper of Widow Lane', 'strike', 2, 'rare', [hit(8), curse('bleed', 2)], when('wounded', [hit(4)]), 'The tailor kept the blade after the soldiers took every needle.'),
  card('Shroud Sewn from Invitations', 'ward', 1, 'rare', [guard(4), dispel(1)], when('empty-hand', [curse('weak')]), 'Every household that welcomed you contributes a little protection.'),
  card('Recite the Uncredited Names', 'mantra', 1, 'rare', [draw(1), curse('weak')], { ...when('resonant', [dispel(1)]), exhaust: true }, 'Speak the names hidden beneath the famous ones until the ink begins to run.'),
  card('Wash Away the Stage Blood', 'remedy', 1, 'rare', [heal(3), cleanse(1)], { ...when('wounded', [cleanse(1)]), exhaust: true }, 'The water clears. The hands remember which stains were real.'),
];
