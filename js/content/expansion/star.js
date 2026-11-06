// Astral Seal: the sky is accurate; the ministry's copy is not.
const damage = amount => ({ type: 'damage', amount });
const block = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const heal = amount => ({ type: 'heal', amount });
const cleanse = amount => ({ type: 'cleanse', amount });
const recover = amount => ({ type: 'recover', amount });
const dispel = amount => ({ type: 'dispel', amount });
const curse = (status, amount = 1) => ({ type: 'status', status, amount, target: 'opponent' });
const boon = (status, amount = 1) => ({ type: 'status', status, amount, target: 'self' });
const when = (condition, bonusEffects) => ({ condition, bonusEffects });
const field = (trigger, duration, effects) => ({ aura: { trigger, duration, effects } });
const later = (turns, effects) => ({ delayed: { turns, effects } });
const conditionText = {
  guarded: 'If you already had Guard before this cast',
  wounded: 'If you were at or below half vitality before this cast',
  afflicted: 'If the opponent already had an affliction before this cast',
  resonant: 'If your Astral Seal chain already had at least two steps',
  'empty-hand': 'If no other cards remained in your hand before this cast',
};
const triggerText = {
  'turn-start': 'at the start of your turn',
  'turn-end': 'at the end of your turn',
  'on-attack': 'once per directly played attack',
  'on-guard': 'once per directly played card that grants Guard',
  'on-status': 'once per directly played card that applies a status',
};
function effectText({ type, amount, status, target }) {
  if (type === 'damage') return `Deal ${amount} damage`;
  if (type === 'block') return `Gain ${amount} Guard`;
  if (type === 'draw') return `Draw ${amount}`;
  if (type === 'heal') return `Heal ${amount}`;
  if (type === 'cleanse') return `Cleanse ${amount} affliction stacks`;
  if (type === 'recover') return `Return ${amount} most recently exhausted techniques to discard`;
  if (type === 'dispel') return `Remove ${amount} enemy positive stacks (Strength, Focus, Regeneration, then Ward)`;
  return `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${status === 'regen' ? 'Regeneration' : status[0].toUpperCase() + status.slice(1)}`;
}
function card(name, type, kind, cost, rarity, effects, flavor, extra = {}) {
  const lines = [];
  if (extra.healthCost) lines.push(`Pay ${extra.healthCost} vitality; full payment must leave at least 1`);
  lines.push(...effects.map(effectText));
  if (extra.condition) lines.push(`${conditionText[extra.condition]}: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) lines.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger]}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; triggers cannot recurse)`);
  if (extra.delayed) lines.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) lines.push('Exhaust');
  return {
    id: `star-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name, school: 'star', type, kind, cost, rarity, effects,
    flavor, description: lines.join('. ') + '.', ...extra,
  };
}

export const starCards = [
  // Hexes mark errors already present in the opponent's chart.
  card('Parallax Citation', 'hex', 'skill', 1, 'common', [curse('vulnerable'), block(2)],
    'From the forbidden balcony, the imperial pole star stands one finger to the left.', when('afflicted', [draw(1)])),
  card('Blemish in the Ephemeris', 'hex', 'attack', 1, 'common', [damage(3), curse('weak')],
    'The clerk circled the stain. The stain circled the clerk.', when('afflicted', [block(2)])),
  card('Unlicensed Zodiac', 'hex', 'skill', 0, 'common', [curse('weak')],
    'Twelve beasts signed the license. The thirteenth ate it.', { exhaust: true, ...when('afflicted', [damage(1)]) }),
  card('Comet Tail Footnote', 'hex', 'attack', 2, 'uncommon', [damage(5), curse('burn', 2)],
    'A marginal correction stretches all the way across the winter sky.', when('afflicted', [draw(1)])),
  card('Name the False North', 'hex', 'skill', 1, 'uncommon', [curse('vulnerable'), draw(1)],
    'The mapmaker died facing the direction his compass had been ordered to indicate.', when('afflicted', [damage(2)])),
  card('Royal Shadow Audit', 'hex', 'skill', 2, 'uncommon', [curse('weak', 2), block(4)],
    'His Majesty casts an extra shadow on nights omitted from the calendar.', when('afflicted', [dispel(1)])),
  card('Decree Against the Sunrise', 'hex', 'skill', 3, 'rare', [curse('weak', 2), curse('vulnerable', 2), draw(1)],
    'The herald reads until dawn, then arrests the light upon his page.', when('afflicted', [damage(5)])),

  // Turn-start diagrams reserve information and protection for a later hand.
  card('Observatory Chalk Ring', 'formation', 'skill', 1, 'common', [block(2)],
    'The apprentices replenish the circle whenever a star moves outside it.', field('turn-start', 2, [draw(1)])),
  card('Broken Sundial Court', 'formation', 'skill', 1, 'common', [draw(1)],
    'Its missing gnomon points to the hour when the master disappeared.', field('turn-end', 2, [block(1)])),
  card('Roof Tile Meridian', 'formation', 'skill', 2, 'common', [block(5)],
    'Every tile is numbered underneath, where the inspectors never look.', field('turn-start', 2, [block(3), draw(1)])),
  card('Lanterns Below Polaris', 'formation', 'skill', 2, 'uncommon', [curse('weak')],
    'The astronomers lower their lamps to show the village which star remains honest.', field('turn-start', 3, [block(3)])),
  card('Atlas Beneath the Floor', 'formation', 'skill', 2, 'uncommon', [block(2)],
    'Each loose board conceals a country the heavens were forbidden to acknowledge.', { ...field('turn-start', 3, [draw(1)]), exhaust: true }),
  card('Glass Dome Quarantine', 'formation', 'skill', 2, 'rare', [cleanse(1)],
    'Nothing enters the dome except light, and lately even light must state its business.', { ...field('turn-end', 2, [block(3), cleanse(1)]), exhaust: true }),
  card('The Unapproved Heaven', 'formation', 'skill', 3, 'legendary', [block(3)],
    'Generations of dismissed astronomers contributed one accurate star apiece.', { ...field('turn-start', 3, [draw(1), block(3)]), exhaust: true }),

  // Action stances reward sequencing without generating Qi or drawing recursive hands.
  card('One Eye at the Lens', 'stance', 'skill', 1, 'common', [block(2)],
    'Keep the other eye on the observatory door.', field('on-attack', 2, [block(1)])),
  card('Hold the Measuring Thread', 'stance', 'skill', 1, 'common', [draw(1)],
    'Do not pull it taut until the constellation stops struggling.', field('on-guard', 2, [damage(1)])),
  card('Read Between Orbits', 'stance', 'skill', 2, 'uncommon', [draw(1), block(2)],
    'The empty intervals carry dispatches too small for the court telescope.', field('on-status', 2, [block(1)])),
  card('Ink the Moving Point', 'stance', 'attack', 2, 'uncommon', [damage(4)],
    'The brush must arrive where the star will be, never where it was.', field('on-attack', 2, [damage(1)])),
  card('Back to the Zenith', 'stance', 'skill', 2, 'uncommon', [block(4)],
    'Trust the sky behind you only after measuring it twice.', field('on-guard', 2, [cleanse(1)])),
  card('Apprentice of the Dark Lens', 'stance', 'skill', 2, 'rare', [draw(2)],
    'Her master taught her to look longest at the places that refused to shine.', { ...field('on-status', 2, [damage(1)]), exhaust: true }),
  card('Keep the Forbidden Bearing', 'stance', 'skill', 3, 'rare', [block(5)],
    'The navigator tied the compass to his ribs so no officer could confiscate north.', { ...field('on-attack', 2, [block(1), damage(1)]), exhaust: true }),

  // Counters turn earlier protection into a choice of knowledge or pressure.
  card('Brass Lens Rebuttal', 'counter', 'attack', 1, 'common', [damage(5)],
    'The inspector leans closer. The brass rim supplies the answer.', when('guarded', [draw(1)])),
  card('Close the Shutter Slit', 'counter', 'skill', 1, 'common', [block(5)],
    'Leave only enough sky to aim through.', when('guarded', [damage(2)])),
  card('Second Hand Correction', 'counter', 'attack', 0, 'common', [damage(2)],
    'An apprentice taps the clock once. Someone else loses the moment.', { ...when('guarded', [block(1)]), exhaust: true }),
  card('Deflect Along the Ecliptic', 'counter', 'attack', 2, 'uncommon', [damage(8), block(2)],
    'A blade follows the same law as a planet, provided you supply the missing force.', when('guarded', [curse('weak')])),
  card('Check the Other Telescope', 'counter', 'skill', 2, 'uncommon', [draw(2), block(2)],
    'One instrument observes the stars; the other observes the men who move the charts.', when('guarded', [block(4)])),
  card('Reflect the Royal Seal', 'counter', 'skill', 2, 'uncommon', [block(7), dispel(1)],
    'Polished silver shows the decree backward, where its authority cannot read itself.', when('guarded', [draw(1)])),
  card('Strike at the Recorded Hour', 'counter', 'attack', 3, 'rare', [damage(14), block(2)],
    'The appointment was entered thirty years before either duelist was born.', when('guarded', [damage(6)])),

  // Blood buys access to restricted observations, never a refund of the price.
  card('Prick the Star Ledger', 'pact', 'skill', 0, 'common', [draw(1)],
    'The index opens only to a red fingerprint.', { healthCost: 2, exhaust: true }),
  card('Rent a Night Without Sleep', 'pact', 'skill', 1, 'common', [draw(2)],
    'The observatory rents its hours cheaply and collects them from your pulse.', { healthCost: 2, exhaust: true }),
  card('Pulse Driven Orrery', 'pact', 'attack', 1, 'common', [damage(7), block(2)],
    'The model planets turn whenever the astronomer flinches.', { healthCost: 3 }),
  card('Admission to the Red Archive', 'pact', 'skill', 2, 'uncommon', [draw(2), block(5)],
    'The guard weighs the visitor before and after consulting the shelves.', { healthCost: 3, exhaust: true }),
  card('Mortgage a Future Dawn', 'pact', 'attack', 2, 'uncommon', [damage(11)],
    'One morning you will wake to find the sunrise has been collected.', { healthCost: 4, ...later(1, [draw(1)]) }),
  card('Last Pulse Calibration', 'pact', 'attack', 2, 'rare', [damage(12), draw(1)],
    'A fading heartbeat is still a clock if someone is willing to listen.', { healthCost: 4, exhaust: true, ...when('wounded', [block(5)]) }),
  card('Borrow the Censor Telescope', 'pact', 'skill', 3, 'rare', [draw(3), curse('weak', 2)],
    'The eyepiece charges its observer for every truth the ministry erased.', { healthCost: 5, exhaust: true, ...when('resonant', [block(5)]) }),

  // Ritual payloads resolve only after the named number of owner turn starts.
  card('Petition the Distant Moon', 'ritual', 'skill', 1, 'common', [block(2)],
    'The courier cannot hurry, but the moon always acknowledges receipt.', later(1, [draw(2)])),
  card('Set the Meteor Bell', 'ritual', 'skill', 1, 'common', [curse('vulnerable')],
    'The bell rings at the impact, although no hand has touched it in centuries.', later(1, [damage(6)])),
  card('Notice of Revised Midnight', 'ritual', 'skill', 2, 'uncommon', [draw(1)],
    'Citizens are instructed to survive until the corrected hour arrives.', later(1, [block(8)])),
  card('Develop the Eclipse Plate', 'ritual', 'skill', 2, 'uncommon', [block(3)],
    'Immerse the silver in darkness until the hidden light becomes legible.', later(2, [draw(2), damage(5)])),
  card('Sentence of the Empty Throne', 'ritual', 'skill', 3, 'rare', [curse('weak')],
    'No emperor occupies that constellation. Its sentences still arrive sealed.', { ...later(2, [damage(19)]), exhaust: true }),
  card('Return of the Lost Minute', 'ritual', 'skill', 2, 'rare', [cleanse(1)],
    'Yu Shuang found sixty abandoned seconds waiting beneath the clock tower.', { ...later(1, [draw(2), block(5)]), exhaust: true }),
  card('Calendar for an Impossible Year', 'ritual', 'skill', 3, 'legendary', [block(4)],
    'The extra month has room for every appointment death forced you to miss.', { ...later(2, [damage(12), draw(2), block(6)]), exhaust: true }),

  // Retrieval always goes to discard; no retrieved page is immediately reread.
  card('Scrape the Imperial Gilt', 'transmute', 'skill', 1, 'common', [dispel(2), block(3)],
    'Under the golden constellation lies a more useful arrangement of scratches.'),
  card('Retrieve the Burned Chart', 'transmute', 'skill', 1, 'common', [recover(1), block(3)],
    'The ashes retain their coordinates if you gather them before the wind.', { exhaust: true }),
  card('Revoke a Minor Star', 'transmute', 'skill', 0, 'common', [dispel(1)],
    'A junior censor blots one dot and waits for the sky to obey.', { exhaust: true }),
  card('Unbind the Observatory Index', 'transmute', 'skill', 2, 'uncommon', [recover(2), cleanse(1)],
    'Its cross references point to volumes officially destroyed before they were written.', { exhaust: true }),
  card('Wash the Lens with Rain', 'transmute', 'skill', 2, 'uncommon', [dispel(2), draw(1), block(2)],
    'Ordinary weather removes what decades of official polishing left behind.'),
  card('Demote the Northern Regent', 'transmute', 'attack', 2, 'rare', [damage(6), dispel(3)],
    'A title can be revoked even when its holder is ninety million miles away.', when('resonant', [damage(3)])),
  card('The Sky Before Its Naming', 'transmute', 'skill', 3, 'legendary', [dispel(4), recover(2), block(5)],
    'Erase the labels and the stars remember where they stood before the empire.', { exhaust: true }),

  // Finishers snapshot the chain or last-card commitment before resolving.
  card('Seal the Third Coordinate', 'finisher', 'attack', 1, 'common', [damage(6)],
    'Two measurements locate the star. The third tells it where to fall.', { ...when('resonant', [damage(3)]), exhaust: true }),
  card('Fold the Empty Atlas', 'finisher', 'attack', 1, 'common', [damage(4), block(2)],
    'With every page gone, the binding finally closes around its subject.', { ...when('empty-hand', [damage(3)]), exhaust: true }),
  card('Connect the Forbidden Points', 'finisher', 'attack', 2, 'uncommon', [damage(9), draw(1)],
    'The treason is not in the stars. It is in the line between them.', { ...when('resonant', [damage(4)]), exhaust: true }),
  card('Last Entry Before Dawn', 'finisher', 'attack', 2, 'uncommon', [damage(10)],
    'Close the ledger before the light reveals which names you spared.', { ...when('empty-hand', [block(5)]), exhaust: true }),
  card('Collapse the False Firmament', 'finisher', 'attack', 3, 'rare', [damage(15), dispel(1)],
    'Only the painted stars fall. Their iron nails are quite real.', { ...when('resonant', [damage(6)]), exhaust: true }),
  card('Hour Without a Witness', 'finisher', 'attack', 2, 'rare', [damage(11), cleanse(1)],
    'No chart records the interval. No court can prove you were there.', { ...when('empty-hand', [draw(2)]), exhaust: true }),
  card('Yu Shuang Closes the Sky', 'finisher', 'attack', 3, 'legendary', [damage(16)],
    'She checks every sum, puts down the brush, and lets the ministry look up.', { ...when('resonant', [damage(5), block(4)]), exhaust: true }),

  // Familiar forms remain useful without requiring a timed engine.
  card('Surveyor Needle Thrust', 'strike', 'attack', 1, 'common', [damage(5), block(1)],
    'The needle measures a distance the opponent would rather leave unknown.'),
  card('Folded Roof Chart', 'ward', 'skill', 1, 'common', [block(4)],
    'Rain ruined the official copy. Yours remembers which tiles are missing.', when('wounded', [draw(1)])),
  card('Count the Hidden Seconds', 'mantra', 'skill', 0, 'common', [draw(1), block(1)],
    'Whisper the numbers the tower clock has been instructed to omit.', { exhaust: true }),
  card('Moonwater Eye Bath', 'remedy', 'skill', 1, 'uncommon', [heal(3), cleanse(1)],
    'The basin reflects the sky as it was before your eyes learned to obey.', { exhaust: true, ...when('wounded', [heal(2)]) }),
];
