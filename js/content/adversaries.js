const strike = (amount, hits) => ({ type: 'damage', amount, ...(hits && { hits }) });
const guard = amount => ({ type: 'block', amount });
const status = (status, amount, target) => ({ type: 'status', status, amount, ...(target && { target }) });
const mend = amount => ({ type: 'heal', amount });
const grow = amount => status('strength', amount, 'self');
const ward = amount => status('ward', amount, 'self');
const intent = (name, ...effects) => ({ name, effects });
const phase = (at, name, ...intents) => ({ at, name, intents });
const enemy = (id, name, hp, school, description, intents, phases = []) => ({
  id, name, hp, school, description, intents, ...(phases.length && { phases }),
  ...(id === 'ninth-heaven' && { sealPhases: true }),
});

export const enemies = [
  enemy('paper-taxman', 'Paper Taxman', 28, 'iron', 'A revenue warrant held together by soot and certainty.', [
    intent('Audit Stroke', strike(7)),
    intent('Stamp the Warrant', guard(5), status('vulnerable', 1)),
    intent('Collect Arrears', strike(9)),
  ]),
  enemy('roof-crow', 'Warrant Crow', 30, 'thunder', 'It can smell a fresh signature through a tiled roof.', [
    intent('Rake the Eaves', strike(4, 2)),
    intent('Scatter Tiles', status('weak', 1), strike(5)),
    intent('Swooping Reprimand', strike(11)),
  ]),
  enemy('toll-ox', 'Iron Toll Ox', 42, 'iron', 'Its iron harness names a bridge that has been underwater for fifty years.', [
    intent('Set the Yoke', guard(8), grow(1)),
    intent('Pull the Chain', strike(12)),
    intent('Lower the Horns', strike(7), status('vulnerable', 2)),
  ]),
  enemy('bell-widow', 'The Bell Widow', 47, 'shade', 'Grief moves her sleeves before the body inside them turns.', [
    intent('Name of the Lost', status('weak', 2), strike(6)),
    intent('Iron Toll', strike(13)),
    intent('Shroud of Echoes', guard(8), status('bleed', 2)),
  ], [phase(0.35, 'The Last Toll', intent('Last Toll', strike(5, 3)), intent('Bride’s Lament', status('bleed', 3), strike(9)))]),
  enemy('magistrate-wei', 'Magistrate Wei', 57, 'iron', 'Each seal he wears is a case he refuses to reopen.', [
    intent('Writ of Seizure', strike(10)),
    intent('Seal the Court', guard(9), ward(1)),
    intent('Two Counts', strike(6, 2), status('vulnerable', 1)),
  ], [phase(0.5, 'Behind the Mask', intent('Unmask the Prefect', grow(2), strike(11)), intent('Sentence Without Appeal', strike(15)), intent('Demand Surety', guard(6), status('weak', 2)))]),
  enemy('brine-jackal', 'Brine Jackal', 44, 'tide', 'The salt has left the creature’s tongue raw. It hunts near fresh water.', [
    intent('Sour Bite', strike(7), status('poison', 3)),
    intent('Shake Off Salt', mend(5), guard(7)),
    intent('Pace the Bank', strike(5, 2)),
  ]),
  enemy('teeth-in-rain', 'Teeth-in-Rain', 59, 'tide', 'A familiar river demon whose borrowed jaws have snapped their restraints.', [
    intent('Borrowed Bite', strike(8), status('poison', 3)),
    intent('Reach Through Reeds', strike(5, 3)),
    intent('Draw Breath Below', guard(10), status('weak', 2)),
  ]),
  enemy('drowned-patrol', 'Drowned Patrol', 61, 'tide', 'Three helmets fixed to a single sheet of river mud.', [
    intent('Pikes Underwater', strike(5, 3)),
    intent('Salt Formation', guard(11), ward(2)),
    intent('Haul to the Mud', strike(12), status('vulnerable', 1)),
  ]),
  enemy('brine-surgeon', 'The Brine Surgeon', 68, 'tide', 'The sluice has taught her to excise breath as easily as a splinter.', [
    intent('Trim the Fever', strike(10), status('poison', 4)),
    intent('Stitch the Gills', mend(8), guard(8)),
    intent('Open the Artery', status('bleed', 4), strike(7, 2)),
  ]),
  enemy('salt-counselor', 'Salt Counselor', 78, 'tide', 'The water inside his scales balances only when a living name is added.', [
    intent('Measure the Brine', strike(11), status('poison', 3)),
    intent('Preserve the Evidence', guard(12), ward(2)),
    intent('Invoke High Water', strike(15), status('weak', 1)),
  ], [phase(0.5, 'The Scales Overturn', intent('Overturn the Scales', status('poison', 6), strike(9)), intent('Evict the Living', strike(8, 3)), intent('Preserve the Prefect', guard(13), mend(7)))]),
  enemy('velvet-usher', 'Velvet Usher', 64, 'shade', 'He needs only a glimpse of your face to know which seat has been kept empty.', [
    intent('Show the Seat', status('weak', 2), strike(9)),
    intent('Tear the Stub', strike(9, 2)),
    intent('Close the Aisle', guard(12), status('bleed', 2)),
  ]),
  enemy('mourning-double', 'Mourning Double', 73, 'shade', 'An understudy who learned every line a grieving child might say.', [
    intent('Forget the Line', strike(7), status('vulnerable', 2)),
    intent('Enter at the Cue', strike(7, 3)),
    intent('Hide in the Wings', guard(14), grow(2)),
  ]),
  enemy('mirror-advocate', 'Mirror Advocate', 80, 'shade', 'Your reflection on the night the ministry decided you belonged to it.', [
    intent('Object to the Charge', guard(12), status('weak', 2)),
    intent('Take the Shape', strike(7, 3), status('bleed', 2)),
    intent('Return the Accusation', strike(17), status('vulnerable', 2)),
  ], [phase(0.4, 'The Shattered Face', intent('Shatter on the Stand', strike(6, 4)), intent('Gather the Pieces', guard(14), grow(2)))]),
  enemy('painted-hound', 'Painted Hound', 70, 'shade', 'It leaves charcoal prints inside rooms with no doors.', [
    intent('Charcoal Teeth', strike(7, 2), status('bleed', 3)),
    intent('Stalk the Script', status('vulnerable', 3), guard(7)),
    intent('Break the Frame', strike(23)),
  ]),
  enemy('warden-chao', 'Warden Chao', 96, 'shade', 'His sleeves hold every witness he would rather hear than the living ones.', [
    intent('Call the First Witness', strike(15), status('vulnerable', 1)),
    intent('Read the Prison Roll', guard(13), status('weak', 2), ward(1)),
    intent('The Accused May Stand', strike(8, 3)),
  ], [phase(0.52, 'The Purged Transcript', intent('Strike Their Names', strike(11, 2), status('bleed', 4)), intent('Seal the Transcript', guard(17), grow(2)), intent('Adjournment', strike(24)))]),
  enemy('bronze-novice', 'Bronze Novice', 78, 'lotus', 'A standing bell that remembers how to bow.', [
    intent('Bow to the Living', guard(16), ward(1)),
    intent('Bell Palm', strike(11, 2)),
    intent('Stair Practice', strike(19), status('weak', 2)),
  ]),
  enemy('page-eater', 'Page Eater', 87, 'ember', 'A bookworm born inside a decree that commanded a thousand books burned.', [
    intent('Eat the Margin', strike(12), status('burn', 4)),
    intent('Pulp Shell', guard(15), grow(2)),
    intent('Shed Embers', strike(7, 4)),
  ]),
  enemy('penitent-shape', 'Sleeved Penitent', 92, 'lotus', 'Empty monastic robes held open by too many names.', [
    intent('Fill the Sleeves', guard(14), status('regen', 3, 'self')),
    intent('Fold the Robes', strike(9, 3), status('weak', 1)),
    intent('Lift the Stone', strike(25), status('vulnerable', 1)),
  ]),
  enemy('vow-eater', 'The Vow Eater', 106, 'iron', 'Each exposed rib carries the contract that gave it shape.', [
    intent('Hinge the Ribs', guard(15), ward(2)),
    intent('Swallow the Promise', strike(15), status('weak', 3)),
    intent('Gnaw the Signature', strike(10, 3), status('bleed', 2)),
  ], [phase(0.42, 'Ribs of the Broken Oath', intent('Chew Through the Seal', strike(9, 4)), intent('New Rib', grow(4), guard(15)))]),
  enemy('drowned-abbot', 'The Drowned Abbot', 119, 'lotus', 'The testimony he swallowed still pushes at his throat when he breathes.', [
    intent('Take the Long Breath', guard(18), status('regen', 3, 'self'), ward(2)),
    intent('Hold the Flood', strike(23), status('weak', 2)),
    intent('Beat on the Bronze', strike(10, 3)),
  ], [phase(0.5, 'The Names Surface', intent('Let the Names Surface', strike(13, 2), status('vulnerable', 2)), intent('Flood the Vault', strike(10, 4)), intent('Protect the Unwritten', guard(18), mend(9)))]),
  enemy('cable-wraith', 'Cable Wraith', 94, 'thunder', 'A courier who died halfway across a span and has been completing the run ever since.', [
    intent('Blue Step', strike(7, 3)),
    intent('Drop the Letter', status('vulnerable', 3), guard(9)),
    intent('Reach the Far Tower', strike(10, 3)),
  ]),
  enemy('brass-roc', 'Brass Rookery Roc', 105, 'thunder', 'A colossal messenger bird fed on unclaimed storm warrants.', [
    intent('Brace the Pinions', guard(16), grow(2)),
    intent('Storming Talons', strike(10, 3), status('bleed', 2)),
    intent('Wind Off the Cliffs', strike(23), status('weak', 2)),
  ]),
  enemy('pike-captain', 'Pike Captain of the Span', 112, 'thunder', 'He counts the lightning because he lost his drum on the ascent.', [
    intent('Set Three Pikes', guard(17), status('vulnerable', 2)),
    intent('Issue the Charge', strike(11, 3)),
    intent('Drum on the Cable', grow(3), strike(15)),
  ]),
  enemy('bride-of-cinders', 'Bride of Cinders', 125, 'ember', 'A furnace walking a pace behind a soot-stained wedding veil.', [
    intent('Tend the Veil', status('burn', 5), guard(14)),
    intent('Feed the Furnace', strike(21), status('vulnerable', 2)),
    intent('Rake the Coals', strike(8, 4)),
  ], [phase(0.4, 'The Open Firebox', intent('Empty the Firebox', status('burn', 8), strike(18)), intent('Carry the Coals Home', strike(13, 3), grow(1)))]),
  enemy('general-hong', 'General Hong', 142, 'thunder', 'The weather stolen from seven valleys hangs inside his armor.', [
    intent('Hold the Banner', guard(18), ward(2)),
    intent('Summon the Pike Line', strike(12, 3)),
    intent('Confiscate the Rain', strike(25), status('weak', 2)),
  ], [phase(0.5, 'The Last Storm Seal', intent('Cut the Signal Cable', strike(15, 2), status('vulnerable', 2)), intent('Empty the Storm Seals', strike(11, 4)), intent('Feed the Garrison', guard(16), grow(3)))]),
  enemy('ink-comet', 'Ink Comet', 122, 'star', 'A star painted out of the sky and still traveling through the paper.', [
    intent('Pass the Meridian', strike(24), status('burn', 3)),
    intent('Coil into Orbit', guard(21), ward(1)),
    intent('Inkfall', strike(9, 4)),
  ]),
  enemy('hour-thief', 'Hour Thief', 131, 'star', 'It crowds a clock’s missing second until the gears give way.', [
    intent('Steal a Moment', strike(15), status('weak', 3)),
    intent('Skip the Tooth', strike(14, 3)),
    intent('Wind the Spring', guard(20), grow(2)),
  ]),
  enemy('starved-orrery', 'Starved Orrery', 139, 'star', 'Iron planets orbit the pressure that used to be a sun.', [
    intent('Align the Gears', guard(22), ward(2)),
    intent('Miss a World', strike(13, 3), status('vulnerable', 2)),
    intent('Fall into the Sun', strike(31), status('burn', 4)),
  ]),
  enemy('eclipse-scribe', 'Eclipse Scribe', 145, 'star', 'An attendant drowned in the ink prepared for his own retirement.', [
    intent('Stir the Ink', status('burn', 6), guard(15)),
    intent('Strike the Last Minute', strike(14, 3)),
    intent('Correct the Entry', strike(27), status('weak', 3)),
  ]),
  enemy('archivist-ru', 'Archivist Ru', 165, 'star', 'The blood dried on his brush before he learned how to set it down.', [
    intent('Censor the Sky', strike(26), status('weak', 2)),
    intent('Close the Almanac', guard(22), ward(3)),
    intent('Prick the Brush', strike(14, 3)),
  ], [phase(0.52, 'The Red Eclipse', intent('Erase the Witness', strike(11, 4), status('vulnerable', 2)), intent('Restore the Official Time', guard(22), mend(10)), intent('Ink the Eclipse', strike(32), status('burn', 6)))]),
  enemy('gate-lion', 'Lion of the Broken Gate', 145, 'iron', 'A weathered guardian carrying the first sky’s debris in its open mouth.', [
    intent('Pace the Threshold', guard(23), grow(2)),
    intent('Teeth of Old Stone', strike(14, 3), status('bleed', 3)),
    intent('Swallow the Lintel', strike(35)),
  ]),
  enemy('clause-keeper', 'Keeper of Exceptions', 154, 'lotus', 'A lawful thing desperate to find the loophole in its own life.', [
    intent('Require Consideration', guard(22), ward(3), status('weak', 2)),
    intent('Except as Provided', strike(15, 3)),
    intent('Bind the Counterparty', strike(30), status('vulnerable', 3)),
  ]),
  enemy('ghost-of-the-first', 'Ghost of the First Sky', 172, 'ember', 'The first collapse preserved its sound inside a body of falling ash.', [
    intent('Let the Sky Slip', strike(18, 2), status('burn', 4)),
    intent('Burn the Witness Stand', status('burn', 7), guard(19)),
    intent('Falling Pillars', strike(11, 4)),
  ], [phase(0.38, 'The Old Sky Falls', intent('The Old Sky Lands', strike(14, 4)), intent('Coals in the Dust', status('burn', 8), grow(4)))]),
  enemy('heavenly-bailiff', 'Heavenly Bailiff', 185, 'iron', 'Six raised hands. Six contradictory oaths. One voice.', [
    intent('Swear Both Truths', guard(24), status('weak', 3), ward(2)),
    intent('Seize the Exhibit', strike(15, 3), status('bleed', 2)),
    intent('Remove the Witness', strike(37), status('vulnerable', 2)),
  ], [phase(0.5, 'Contempt of Heaven', intent('Contempt of Heaven', strike(14, 4)), intent('Hold Up Six Hands', guard(27), grow(4)), intent('Repeat the Statement', strike(17, 3)))]),
  enemy('ninth-heaven', 'The Ninth Heaven', 220, 'star', 'The laws inside it are all trying to turn the same page.', [
    intent('Collect the Tomorrows', strike(29), status('weak', 2)),
    intent('Confirm the Assessment', guard(24), ward(3)),
    intent('Writ Against the Living', strike(15, 3), status('vulnerable', 2)),
  ], [
    phase(0.66, 'The Law of Dead Names', intent('One Law for the Dead', strike(11, 4), status('poison', 5)), intent('Reassemble the Court', guard(26), grow(3)), intent('Tax the Sunlight', strike(34), status('burn', 5))),
    phase(0.31, 'The Empty Sky', intent('Close All Nine Ledgers', strike(13, 4), status('vulnerable', 2)), intent('Leave the Sky Empty', guard(20), grow(4)), intent('The Final Levy', strike(16, 4))),
  ]),
];
