// Iron's courts have no living officers: the duelist must be blade, seal, and witness.
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
  afflicted: 'If the opponent already has a debuff',
  guarded: 'If you already have Guard',
  resonant: 'If your Iron chain is at least 2',
  wounded: 'If you have half Health or less',
  'empty-hand': 'If no other cards remain in your hand',
};
const triggerText = {
  'turn-start': 'At the start of your turn', 'turn-end': 'At the end of your turn',
  'on-attack': 'When you play an attack', 'on-guard': 'When a played card grants Guard',
  'on-status': 'When a played card applies a status',
};
function effectText(effect) {
  const { type, amount, status, target } = effect;
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`,
    draw: `Draw ${amount}`, heal: `Heal ${amount}`, cleanse: `Cleanse ${amount} debuff stacks`,
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
    id: `iron-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name, school: 'iron', type,
    kind: [...effects, ...(extra.bonusEffects || []), ...(extra.delayed?.effects || [])].some(e => e.type === 'damage') ? 'attack' : 'skill',
    cost, rarity, effects, ...extra, flavor, description: clauses.join('. ') + '.',
  };
}

export const ironCards = [
  // Hexes make existing testimony matter. A fresh curse cannot satisfy its own clause.
  card('Black Wax Citation', 'hex', 1, 'common', [curse('weak'), guard(2)], when('afflicted', [guard(2)]), 'The wax keeps the impression of a thumb that was cut off years ago.'),
  card('Unpaid Blood Tithe', 'hex', 1, 'common', [hit(3), curse('bleed')], when('afflicted', [hit(2)]), 'The court takes a little each time you insist the debt is settled.'),
  card('Seal of Contempt', 'hex', 0, 'common', [curse('vulnerable')], { ...when('afflicted', [guard(1)]), exhaust: true }, 'One red mark. No appeal. No surviving clerk.'),
  card('Name Beneath the Rust', 'hex', 2, 'uncommon', [hit(7), curse('bleed', 2)], when('afflicted', [draw(1)]), 'Scrape away the rust and the prisoner is still signing.'),
  card('Clenched Fist Injunction', 'hex', 2, 'uncommon', [curse('weak', 2), guard(5)], when('afflicted', [curse('vulnerable')]), 'A writ folded into the palm prevents the hand from opening.'),
  card('Sword Seal of False Oaths', 'hex', 3, 'rare', [hit(12), curse('vulnerable', 2)], when('afflicted', [hit(6)]), 'The sword cuts cleanly through truth. Lies catch on its teeth.'),
  card('Indict the Shadow', 'hex', 1, 'uncommon', [curse('bleed'), guard(3)], when('afflicted', [cleanse(1)]), 'Pin the accusation to the shadow; let its owner try to walk away.'),

  // Formations are seals drawn around the two duelists, never summoned fighters.
  card('Four Nails Boundary', 'formation', 1, 'common', [guard(2)], aura('turn-end', 2, [guard(2)]), 'Four coffin nails mark the places where retreat used to be.'),
  card('Rust Rain Diagram', 'formation', 1, 'common', [hit(2)], aura('turn-start', 2, [hit(2)]), 'The suspended filings fall only when the condemned draws breath.'),
  card('Witness Stone Circle', 'formation', 2, 'common', [guard(4)], aura('turn-start', 2, [guard(3)]), 'Each stone bears your own face, turned toward a different escape.'),
  card('Closed Court Geometry', 'formation', 2, 'uncommon', [curse('weak')], aura('turn-end', 2, [guard(4)]), 'There is room inside the diagram for a defendant and a verdict.'),
  card('Blade Rack Mandala', 'formation', 2, 'uncommon', [hit(3)], aura('turn-start', 3, [hit(3)]), 'The empty sword rack casts seven occupied shadows.'),
  card('Hall of Erased Names', 'formation', 2, 'rare', [cleanse(1)], { ...aura('turn-start', 2, [guard(3), cleanse(1)]), exhaust: true }, 'Without a name, the curses cannot find a seat in the hall.'),
  card('Jurisdiction of the Last Gate', 'formation', 3, 'legendary', [guard(5)], { ...aura('turn-end', 3, [guard(3), hit(2)]), exhaust: true }, 'The empire is ash. The gate still demands your papers.'),

  // Stances reward a chosen sequence; their effects cannot trigger themselves.
  card('Scabbard Across the Throat', 'stance', 1, 'common', [guard(2)], aura('on-attack', 2, [guard(1)]), 'Leave the sword sheathed until the other edge has passed your neck.'),
  card('Nail the Heel', 'stance', 1, 'common', [guard(3)], aura('on-guard', 2, [hit(1)]), 'The iron underfoot remembers every step you refuse to take.'),
  card('Read the Accusation', 'stance', 1, 'common', [guard(2)], aura('on-status', 2, [guard(1)]), 'Breathe between each charge; the pauses are where the armor grows.'),
  card('Executioner Without a Hood', 'stance', 2, 'uncommon', [hit(3)], aura('on-attack', 2, [hit(1)]), 'If this must be done, the condemned will know whose hands did it.'),
  card('Palm on the Warrant', 'stance', 2, 'uncommon', [guard(3)], aura('on-guard', 2, [guard(1)]), 'Do not let the wind lift the paper, even when it begins to scream.'),
  card('Witness Your Own Wound', 'stance', 2, 'rare', [guard(3)], { ...aura('on-status', 2, [heal(1)]), exhaust: true }, 'Recite what happened in your own voice. Do not let the scar testify alone.'),
  card('Unmoving Sword Tribunal', 'stance', 3, 'legendary', [guard(5)], { ...aura('on-attack', 2, [guard(1), hit(1)]), exhaust: true }, 'One sword stands upright. Every other blade must answer to it.'),

  // Counters check Guard before their own effects; none creates its own opening.
  card('Objection at the Hilt', 'counter', 1, 'common', [hit(5)], when('guarded', [hit(3)]), 'Catch the argument before it reaches the point.'),
  card('Shut the Iron Shutter', 'counter', 1, 'common', [guard(5)], when('guarded', [guard(2)]), 'The last strip of light lands on the blade outside.'),
  card('Not One Step Further', 'counter', 0, 'common', [hit(2)], { ...when('guarded', [guard(1)]), exhaust: true }, 'The line is thin enough to mistake for a crack in the floor.'),
  card('Cross-Examine the Edge', 'counter', 2, 'uncommon', [hit(9)], when('guarded', [hit(3), curse('weak')]), 'Ask the blade where it was when its master swore peace.'),
  card('Catch the Falling Seal', 'counter', 1, 'uncommon', [guard(4)], when('guarded', [draw(1)]), 'A broken seal would free both of you. Your hand moves anyway.'),
  card('Return the Death Warrant', 'counter', 3, 'rare', [hit(15)], when('guarded', [hit(6), guard(2)]), 'Write the return address along the edge and fold it only once.'),
  card('Door Bolt Reversal', 'counter', 2, 'uncommon', [guard(8)], when('guarded', [hit(5)]), 'The bolt was always meant to slide from this side.'),

  // Pacts demand immediate, nonlethal payment; healing cannot finance the payment.
  card('Thumbprint in Iron', 'pact', 0, 'common', [guard(4)], { healthCost: 2, exhaust: true }, 'Press hard. The contract does not accept fingerprints without blood.'),
  card('Rent the Execution Sword', 'pact', 1, 'common', [hit(9)], { healthCost: 2 }, 'The rental is cheap. The blade collects its sharpening fee from the wrist.'),
  card('Collateral Rib', 'pact', 1, 'common', [guard(8)], { healthCost: 2 }, 'You may reclaim the rib after the court is satisfied.'),
  card('Purchase the Missing Page', 'pact', 1, 'uncommon', [draw(2), guard(2)], { healthCost: 3, exhaust: true }, 'The page describes how you died. The margin is still wide enough to write in.'),
  card('No Heir to the Debt', 'pact', 2, 'uncommon', [hit(12), guard(4)], { healthCost: 4 }, 'Strike your descendants from the agreement, one heartbeat at a time.'),
  card('Mortgage the Sword Arm', 'pact', 2, 'rare', [boon('strength', 2), guard(6)], { healthCost: 5, exhaust: true }, 'The arm remains yours until the sword has finished using it.'),
  card('Sign Against Heaven', 'pact', 3, 'legendary', [hit(19), guard(7), cleanse(1)], { healthCost: 7, exhaust: true }, 'The sky refuses to countersign. You drive the pen through it.'),

  // Rituals reveal their sentence now and execute it on a later turn.
  card('Heat the Judgment Brand', 'ritual', 1, 'common', [guard(2)], later(1, [hit(6)]), 'Keep the brand in the coals until the name has stopped moving.'),
  card('Set the Coffin Hinges', 'ritual', 1, 'common', [guard(2)], later(1, [guard(6)]), 'Fit the hinges outward. You have not decided who will be inside.'),
  card('Count the Rusted Bells', 'ritual', 1, 'common', [hit(2)], later(2, [draw(2)]), 'The tower rings twice after the bell has fallen.'),
  card('Cool the Severed Seal', 'ritual', 2, 'uncommon', [guard(3)], later(1, [guard(6), cleanse(1)]), 'Do not lift the seal until its reflection has stopped bleeding.'),
  card('Sharpen the Unspoken Charge', 'ritual', 2, 'uncommon', [hit(3)], later(2, [hit(12)]), 'Speak the accusation only when the whetstone has worn through.'),
  card('Reopen the Buried Hearing', 'ritual', 2, 'rare', [guard(3)], { ...later(2, [recover(2), guard(5)]), exhaust: true }, 'The old evidence is under the floor, wrapped in your previous robes.'),
  card('Prepare the Final Deposition', 'ritual', 2, 'uncommon', [guard(3)], later(1, [hit(7), curse('vulnerable')]), 'Leave the last question blank. The wound will supply its wording.'),

  // Transmutations alter the disposition of existing power or exhausted testimony.
  card('Melt the Forged Badge', 'transmute', 1, 'common', [dispel(1), guard(4)], {}, 'The badge melts before the face stamped upon it does.'),
  card('Salvage the Broken Oath', 'transmute', 1, 'common', [recover(1), guard(3)], { exhaust: true }, 'Only the broken half can still be made into something honest.'),
  card('Rub Out the Privilege', 'transmute', 0, 'common', [dispel(1)], { exhaust: true }, 'The gilding comes off on a sleeve already black with soot.'),
  card('Reforge the Evidence', 'transmute', 2, 'uncommon', [recover(1), hit(8)], { exhaust: true }, 'A sword made from the shackles remembers the shape of the wrists.'),
  card('Strip the Magistrate Gold', 'transmute', 2, 'uncommon', [dispel(2), guard(6)], {}, 'Under the ceremonial gold is the same hungry iron.'),
  card('Annul the Immortal Patent', 'transmute', 3, 'rare', [dispel(3), hit(11)], {}, 'Eternal office expires when the issuing heaven is struck from the record.'),
  card('Rebind the Ash Docket', 'transmute', 2, 'uncommon', [recover(1), cleanse(1), guard(3)], { exhaust: true }, 'Sew the ashes between iron covers; the words will find their old wounds.'),

  // Finishers offer four different ways to bring the hearing to a close.
  card('Sentence at Sundown', 'finisher', 2, 'common', [hit(10)], { ...when('resonant', [hit(5)]), exhaust: true }, 'The second bell ends deliberation. The third belongs to the sword.'),
  card('The Last Entry', 'finisher', 1, 'common', [hit(6)], { ...when('empty-hand', [hit(3)]), exhaust: true }, 'There is nothing left to place on the table except the blade.'),
  card('Kneeling Is Not Surrender', 'finisher', 2, 'common', [hit(10)], { ...when('wounded', [guard(4)]), exhaust: true }, 'From one knee, the sword reaches the heart by a shorter road.'),
  card('Enforce the Red Clause', 'finisher', 2, 'uncommon', [hit(11)], { ...when('afflicted', [hit(4), curse('bleed')]), exhaust: true }, 'The clause was printed in blood because ink might have faded.'),
  card('Close the Chain of Custody', 'finisher', 2, 'uncommon', [hit(10), guard(2)], { ...when('resonant', [hit(5)]), exhaust: true }, 'The weapon passes from your left hand to your right. The chain is complete.'),
  card('No Further Witnesses', 'finisher', 3, 'rare', [hit(16)], { ...when('empty-hand', [hit(7)]), exhaust: true }, 'The empty benches hear the sword leave its sheath.'),
  card('Verdict Beyond the Grave', 'finisher', 3, 'legendary', [hit(17), guard(3)], { ...when('wounded', [hit(6), cleanse(1)]), exhaust: true }, 'Death may close the court. It cannot unwrite the sentence.'),

  card('Split the Court Anvil', 'strike', 2, 'rare', [hit(12), guard(3)], {}, 'The anvil breaks along the line where a thousand confessions were hammered flat.'),
  card('Armor of Unsigned Petitions', 'ward', 2, 'rare', [guard(10), boon('ward')], {}, 'Every unanswered petition folds into another scale over the heart.'),
  card('Recite the Abolished Law', 'mantra', 1, 'rare', [draw(1), boon('focus')], { exhaust: true }, 'Its words were forbidden because they once protected someone.'),
  card('Quench the Embedded Shard', 'remedy', 2, 'rare', [heal(7), cleanse(2)], { exhaust: true }, 'Cool the iron before you pull. Some of it has become bone.'),
];
