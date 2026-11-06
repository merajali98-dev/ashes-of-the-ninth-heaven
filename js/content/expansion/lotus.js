// Jade Sutra: a testimony survives only while someone keeps breathing it.
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
  afflicted: 'If the enemy already had an affliction before this cast',
  guarded: 'If you already had Guard before this cast',
  wounded: 'If you were at or below half vitality before this cast',
  resonant: 'If your Jade Sutra chain already had at least two steps',
  'empty-hand': 'If no other cards remained in your hand when this cast began',
};
const triggerText = {
  'turn-start': 'At the start of your turn',
  'turn-end': 'At the end of your turn',
  'on-attack': 'Once per directly played attack',
  'on-guard': 'Once per directly played technique that grants Guard',
  'on-status': 'Once per directly played technique that applies a status',
};
function effectText({ type, amount, status, target }) {
  if (type === 'status') return `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${status === 'regen' ? 'Regeneration' : status[0].toUpperCase() + status.slice(1)}`;
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`,
    draw: `Draw ${amount}`, heal: `Heal ${amount}`,
    cleanse: `Cleanse ${amount} affliction stacks`,
    recover: `Return ${amount} exhausted techniques to your discard pile, excluding this technique`,
    dispel: `Remove ${amount} enemy positive status stacks in order: Strength, Focus, Regeneration, Ward`,
  }[type];
}
function card(name, type, kind, cost, rarity, effects, extra, flavor) {
  const clauses = [];
  if (extra.healthCost) clauses.push(`Pay ${extra.healthCost} vitality; full payment must leave at least 1`);
  clauses.push(...effects.map(effectText));
  if (extra.condition) clauses.push(`${conditionText[extra.condition]}: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) clauses.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger].toLowerCase()}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; never triggers recursively)`);
  if (extra.delayed) clauses.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) clauses.push('Exhaust');
  return {
    id: `lotus-${name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-')}`,
    name, school: 'lotus', type, kind, cost, rarity, effects, ...extra,
    description: clauses.join('. ') + '.', flavor,
  };
}

export const lotusCards = [
  // A hex cannot use its own accusation to satisfy the prior-affliction clause.
  card('Inkless Rebuke', 'hex', 'skill', 1, 'common', [curse('weak'), guard(2)], when('afflicted', [guard(2)]),
    'Yanxu raises a blank sheet. The soldier lowers his eyes before he can read it.'),
  card('Margin for the Accused', 'hex', 'attack', 1, 'common', [hit(3), curse('vulnerable')], when('afflicted', [cleanse(1)]),
    'Leave room beside the official account for the body that survived it.'),
  card('Hush the False Witness', 'hex', 'skill', 0, 'common', [curse('weak')], { ...when('afflicted', [guard(1)]), exhaust: true },
    'The novice closes the door softly enough to hear the lie stop breathing.'),
  card('Borrowed Years Citation', 'hex', 'skill', 2, 'uncommon', [curse('weak', 2), guard(4)], when('afflicted', [boon('ward')]),
    'Kuang Yi reads the dates sewn inside his sleeve. None belongs to him.'),
  card('Expose the Corrected Line', 'hex', 'attack', 2, 'uncommon', [hit(7), curse('vulnerable')], when('afflicted', [dispel(2)]),
    'Hold the page to the lamp; the scrape marks still spell the village name.'),
  card('Throat Full of Unsaid Names', 'hex', 'skill', 2, 'rare', [curse('weak', 2), cleanse(2)], { ...when('afflicted', [draw(1)]), exhaust: true },
    'The abbot cannot swallow until someone else agrees to remember.'),
  card('Correction in Red Thread', 'hex', 'attack', 1, 'uncommon', [hit(3), curse('bleed')], when('afflicted', [guard(2)]),
    'The archivist stitches the missing sentence through the censor’s cuff.'),

  // Defensive diagrams buy particular future turns, never an extra combatant.
  card('Shelf of Rain Bowls', 'formation', 'skill', 1, 'common', [guard(2)], aura('turn-end', 2, [guard(2)]),
    'Each bowl catches a leak above a different forbidden book.'),
  card('Drying Room Mandala', 'formation', 'skill', 1, 'common', [guard(3)], aura('turn-start', 3, [cleanse(1)]),
    'Spread the soaked testimonies far enough apart that their voices do not mingle.'),
  card('Recess for the Exhausted Scribe', 'formation', 'skill', 1, 'common', [guard(2)], { ...aura('turn-end', 2, [heal(1)]), exhaust: true },
    'The recess fits one seated monk and the years he cannot put down.'),
  card('Bronze Screens of the Sick Hall', 'formation', 'skill', 2, 'uncommon', [guard(4)], aura('turn-end', 2, [boon('ward')]),
    'Turn the polished side toward the fever, not the patient.'),
  card('Lanterns beside the Catalogue', 'formation', 'skill', 2, 'uncommon', [guard(3)], { ...aura('turn-start', 3, [draw(1)]), exhaust: true },
    'Light the lamp beside a missing volume; the empty shelf will tell you where to look.'),
  card('Courtyard of Listening Stone', 'formation', 'skill', 2, 'rare', [curse('weak')], { ...aura('turn-end', 2, [guard(3), cleanse(1)]), exhaust: true },
    'The paving stones are warm wherever a witness once stood barefoot.'),
  card('Archive beneath the Held Breath', 'formation', 'skill', 3, 'legendary', [boon('focus'), guard(2)], { ...aura('turn-end', 3, [guard(2), heal(1)]), exhaust: true },
    'For three breaths, Yanxu remembers the monastery before anyone built it.'),

  // Action auras respond once to a direct card; none produces Qi or permanent Focus.
  card('Palm beneath the Falling Book', 'stance', 'skill', 1, 'common', [guard(2)], aura('on-attack', 2, [guard(1)]),
    'Strike with the empty hand. The other is keeping a century off the floor.'),
  card('Brush Held Level', 'stance', 'skill', 1, 'common', [guard(3)], aura('on-status', 2, [guard(1)]),
    'A shaking brush can turn a witness into an accomplice.'),
  card('Heel against the Archive Door', 'stance', 'skill', 1, 'common', [hit(2)], aura('on-guard', 2, [hit(1)]),
    'The intruder discovers that every careful retreat closes the door on his fingers.'),
  card('Pillow Monk Listening Form', 'stance', 'skill', 2, 'uncommon', [guard(4)], aura('on-status', 2, [cleanse(1)]),
    'Let the sleeper finish before deciding which words belong to the nightmare.'),
  card('Carry the Unbroken Bowl', 'stance', 'skill', 2, 'uncommon', [boon('ward')], aura('on-attack', 2, [cleanse(1)]),
    'Your wrist follows the blade. The surface of the water does not.'),
  card('Rest between Two Verses', 'stance', 'skill', 2, 'rare', [guard(3)], { ...aura('on-guard', 2, [heal(1)]), exhaust: true },
    'The patient learns to breathe in the pause where the chant expects an answer.'),
  card('Yanxu Stands among His Readers', 'stance', 'skill', 3, 'legendary', [guard(5)], { ...aura('on-status', 2, [guard(1), hit(1)]), exhaust: true },
    'Every voice makes room for him. None can agree which one gave him a body.'),

  // Guard is checked before the counter grants any Guard of its own.
  card('Close the Reading Shutter', 'counter', 'attack', 1, 'common', [hit(4), guard(1)], when('guarded', [hit(3)]),
    'The blade enters with the daylight; only the daylight is allowed to leave.'),
  card('Keep the Page Dry', 'counter', 'skill', 1, 'common', [guard(5)], when('guarded', [cleanse(1)]),
    'Blood on the sleeve is acceptable. Blood across the names is not.'),
  card('A Finger on the Doorstop', 'counter', 'skill', 0, 'common', [guard(2)], { ...when('guarded', [hit(1)]), exhaust: true },
    'Chang Yu needs only one finger to keep the wrong history outside.'),
  card('Witness behind the Screen', 'counter', 'attack', 2, 'uncommon', [hit(7), guard(3)], when('guarded', [curse('weak')]),
    'The voice is small. The bronze screen carries it across the entire hall.'),
  card('Catch the Seal in Linen', 'counter', 'skill', 1, 'uncommon', [guard(4)], when('guarded', [boon('ward')]),
    'Do not let the seal touch skin. It will mistake the hand for a petition.'),
  card('Rebuttal from the Inner Gate', 'counter', 'attack', 3, 'rare', [hit(12), guard(4)], when('guarded', [hit(5), dispel(2)]),
    'The besieger hears his own proclamation recited from inside the wall.'),
  card('Return the Censor His Brush', 'counter', 'attack', 2, 'uncommon', [hit(8), cleanse(1)], when('guarded', [draw(1)]),
    'The handle strikes first, leaving the ink available for his confession.'),

  // These vows spend real vitality; none heals away its payment.
  card('Blood on the Borrowing Slip', 'pact', 'skill', 0, 'common', [draw(1)], { healthCost: 2, exhaust: true },
    'The forbidden shelf accepts a thumbprint the ordinary library would reject.'),
  card('Take the Witness Seat', 'pact', 'skill', 1, 'common', [guard(7), boon('ward')], { healthCost: 3 },
    'The chair is built for the testimony. The witness must make room inside it.'),
  card('Speak through the Split Lip', 'pact', 'attack', 1, 'common', [hit(8), curse('weak')], { healthCost: 3 },
    'They have broken every instrument in the hall except your voice.'),
  card('Copy the Ledger onto Skin', 'pact', 'skill', 2, 'uncommon', [boon('focus'), guard(5)], { healthCost: 4, exhaust: true },
    'No confiscation order names the page beneath a disciple’s robe.'),
  card('Offer a Night of Sleep', 'pact', 'skill', 1, 'uncommon', [draw(2), cleanse(1)], { healthCost: 3, exhaust: true },
    'The Pillow Monk keeps your nightmare awake while you read its testimony.'),
  card('Bear the Absent Signature', 'pact', 'skill', 2, 'rare', [guard(10), boon('ward', 2)], { healthCost: 5, ...when('wounded', [guard(4)]), exhaust: true },
    'Someone must sign for the witnesses who did not reach the monastery.'),
  card('Vow at the Broken Lectern', 'pact', 'attack', 2, 'uncommon', [hit(10), dispel(3)], { healthCost: 4 },
    'The wood has split along the oath. Place your hand where the two halves meet.'),

  // Patient readings queue once and require surviving the intervening enemy action.
  card('Steep the Snow Stem', 'ritual', 'skill', 1, 'common', [guard(2)], { ...later(1, [heal(3)]), exhaust: true },
    'Drink when the pale root sinks. Before then it is only bitter water.'),
  card('Air the Mildewed Testimony', 'ritual', 'skill', 1, 'common', [boon('ward')], later(1, [cleanse(3)]),
    'By morning the page will remember whether the stain came before the words.'),
  card('Wait for the Bronze to Settle', 'ritual', 'skill', 1, 'common', [guard(2)], later(1, [guard(6)]),
    'The bell must stop moving before its silence can bear your weight.'),
  card('Recite beneath the Closed Floor', 'ritual', 'skill', 2, 'uncommon', [guard(3)], later(2, [hit(11), curse('weak')]),
    'Those buried beneath the archive answer on the second morning.'),
  card('Restore the Missing Season', 'ritual', 'skill', 2, 'uncommon', [cleanse(1)], { ...later(2, [heal(4), guard(5)]), exhaust: true },
    'Kuang Yi counts the stolen days back into the farmer’s palms.'),
  card('Teach the Orphan an Old Name', 'ritual', 'skill', 2, 'rare', [guard(4)], { ...later(1, [boon('focus'), draw(1)]), exhaust: true },
    'Chang Yu says it correctly the next morning. The mountain answers.'),
  card('Night Sutra for an Unborn Witness', 'ritual', 'skill', 3, 'legendary', [guard(5), boon('ward')], { ...later(2, [recover(2), heal(4), cleanse(2)]), exhaust: true },
    'Leave the final verse unfinished; the child will need somewhere to begin.'),

  // Recovery goes to discard; dispelling counts individual positive stacks.
  card('Lift the Rice Paste Seal', 'transmute', 'skill', 1, 'common', [recover(1), guard(2)], { exhaust: true },
    'Wet the edge gently. The words beneath have already survived one burning.'),
  card('Wash the Imperial Gilding', 'transmute', 'skill', 1, 'common', [dispel(2), cleanse(1)], {},
    'In clear water the emperor’s protection looks remarkably like dirt.'),
  card('Scrape the Borrowed Halo', 'transmute', 'attack', 1, 'common', [dispel(1), hit(4)], {},
    'The light comes away in flakes. The skull underneath is ordinary.'),
  card('Rebind the Sleepless Volume', 'transmute', 'skill', 2, 'uncommon', [recover(2), boon('ward')], { exhaust: true },
    'Bind it loosely enough that the remembered voices can still breathe.'),
  card('Bleach the False Colophon', 'transmute', 'skill', 2, 'uncommon', [dispel(3), guard(5)], {},
    'The conqueror’s name dissolves. The village scribe’s thumbprint remains.'),
  card('Separate the Voice from the Seal', 'transmute', 'attack', 2, 'rare', [dispel(2), hit(7)], when('afflicted', [boon('ward'), guard(2)]),
    'The decree loses its authority at the exact moment someone dares repeat it.'),
  card('Retrieve the Unsent Confession', 'transmute', 'skill', 1, 'uncommon', [recover(1), cleanse(2)], { ...when('wounded', [guard(2)]), exhaust: true },
    'The confession never left the sleeve. The hand that wrote it has long since gone.'),

  // Closing verses trade a prepared chain or emptied hand for a bounded release.
  card('Fold the Final Margin', 'finisher', 'attack', 1, 'common', [hit(6)], { ...when('empty-hand', [guard(3)]), exhaust: true },
    'Fold inward, until every name is sheltered behind the edge.'),
  card('Third Bell Palm', 'finisher', 'attack', 1, 'common', [hit(5), guard(1)], { ...when('resonant', [hit(3)]), exhaust: true },
    'The first bell gathers witnesses. The second stills them. The third needs no rope.'),
  card('No More Questions Tonight', 'finisher', 'skill', 2, 'common', [guard(8), curse('weak')], { ...when('empty-hand', [guard(4)]), exhaust: true },
    'The witness is trembling. Even truth must wait until morning.'),
  card('Seal the Listener Inside', 'finisher', 'attack', 2, 'uncommon', [hit(9), boon('ward')], { ...when('resonant', [hit(3), cleanse(1)]), exhaust: true },
    'Keep one listener safe, and the massacre can never become a rumor.'),
  card('Set Down the Last Burden', 'finisher', 'attack', 2, 'uncommon', [hit(8), guard(3)], { ...when('empty-hand', [heal(2)]), exhaust: true },
    'The floor accepts the bundle. Your shoulders take another breath to believe it.'),
  card('The Unwritten Answer', 'finisher', 'attack', 3, 'rare', [hit(13), guard(4)], { ...when('resonant', [dispel(3), hit(4)]), exhaust: true },
    'Yanxu opens both hands. The question breaks against what is absent.'),
  card('Let the Archive Walk Out', 'finisher', 'attack', 3, 'legendary', [hit(14), cleanse(2)], { ...when('empty-hand', [recover(2), guard(3)]), exhaust: true },
    'The doors open onto a road full of people carrying nothing you can confiscate.'),

  card('Clapper Finds the Hollow Joint', 'strike', 'attack', 2, 'rare', [hit(9), curse('weak'), dispel(1)], {},
    'The novice hears the flaw in the armor before he sees where to strike.'),
  card('Linen over the Witness Window', 'ward', 'skill', 2, 'rare', [guard(8), boon('ward'), cleanse(1)], {},
    'The witness can still see the street. The street can no longer see the witness.'),
  card('One Breath for Each Reader', 'mantra', 'skill', 2, 'rare', [boon('focus'), guard(4)], { ...when('resonant', [draw(1)]), exhaust: true },
    'Count the readers slowly. Include the one whose chair appears empty.'),
  card('Tea after the Testimony', 'remedy', 'skill', 1, 'rare', [heal(3), cleanse(1)], { ...when('wounded', [guard(2)]), exhaust: true },
    'No one asks what happened until the cup stops rattling against the saucer.'),
];
