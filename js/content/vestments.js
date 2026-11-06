import { schoolInventory, damage, block, draw, energy, heal, cleanse, status, buff } from './inventory.js';

const shade = schoolInventory('shade', {
  weapon: [
    ['Shroud Shears', 'common', 'A quick cut leaves the fold intact on both sides.', { strength: 1, school: { shade: { damage: 1 } } }],
    ['Stagehand’s Hook', 'uncommon', 'A painted wooden handle lets a stagehand reach the curtains without showing a hand.', { strength: 2, school: { shade: { status: 1 } } }],
    ['Eulogy Kris', 'rare', 'The blade waves three times, one for each part of a forbidden eulogy.', { strength: 2, school: { shade: { damage: 2, status: 1 } } }],
    ['Black Bamboo’s Last Mouth', 'legendary', 'There is a carved tongue in the handle where a grip usually goes.', { strength: 3, school: { shade: { status: 2 } }, ward: 1 }],
  ],
  armor: [
    ['Rehearsal Shroud', 'common', 'The tear through the back lets the wearer leave the stage without stepping into the light.', { maxHp: 5, block: 3 }],
    ['Velvet Usher’s Wrap', 'uncommon', 'The folds have more room to hide things than they have cloth.', { maxHp: 7, ward: 2 }],
    ['Funeral Understudy’s Robe', 'rare', 'It is stitched in a color that looks black from the stage and purple from the seats.', { maxHp: 12, school: { shade: { block: 2 } } }],
  ],
  accessory: [
    ['Understudy’s Brooch', 'uncommon', 'The stage manager pins it on whoever has to speak first.', { ward: 1, school: { shade: { damage: 1 } } }],
    ['Folded Throat Mask', 'rare', 'The audience can see the wearer’s face only when it remains still.', { ward: 2, strength: 1 }],
    ['Belltower Hook', 'common', 'It was made to hold the rope while the widow changed her shoes.', { block: 3, strength: 1 }],
  ],
  relic: [
    ['Usher’s Ticket', 'common', 'There is a time on the back for when the bearer should leave the building.', { block: 3, ward: 1 }],
    ['Bride Bell Clapper', 'uncommon', 'It sounds like an ordinary iron weight until its namesake takes it up.', { strength: 1, school: { shade: { status: 1 } } }],
    ['Keeper of Faces', 'rare', 'A numbered case with one unnumbered hook at the bottom.', { draw: 1, ward: 1 }],
    ['Veil of the Last Audience', 'legendary', 'Each knot corresponds to a seat whose occupant was never listed.', { draw: 1, school: { shade: { status: 2 } }, block: 6 }],
  ],
  talisman: [
    ['Torn Playbill', 'common', 'The torn edge is the cue for the company to turn the lamps down.', [status('weak', 2), draw(1)]],
    ['Casket Invitation', 'uncommon', 'No respectable company would print the recipient’s name on the front.', [status('vulnerable', 3), status('bleed', 3)]],
    ['Eight-Panel Curtain', 'rare', 'Unfold all eight panels to see which room you are standing in.', [status('weak', 3), block(14), energy(1)]],
  ],
  pill: [
    ['Rehearsal Lozenge', 'common', 'A crumb of licorice that lets the weeping actor sing again.', [heal(6), draw(1)]],
    ['Unseen Hour Draught', 'uncommon', 'The dark liquid leaves an outline around whatever is poured into it.', [heal(8), status('weak', 2), cleanse(1)]],
    ['Blank Face Pearl', 'rare', 'It goes white in your hand when you recognize the face it came from.', [heal(13), buff('ward', 2), status('vulnerable', 2)]],
  ],
  material: [
    ['Wake Thread', 'common', 'A loose thread from a well-worn shroud, saved before it reached the grave.'],
    ['Curtain Silk', 'common', 'One face of the silk is smooth and the other holds the dust of the stage.'],
    ['Black Bamboo', 'uncommon', 'A joint of bamboo grown in a garden where nobody uses names aloud.'],
    ['Stage Soot', 'uncommon', 'Lampblack sifted from the lantern over a stage door.'],
    ['Mirror Foil', 'rare', 'At certain angles it reflects only whatever stands behind the observer.'],
  ],
});

const lotus = schoolInventory('lotus', {
  weapon: [
    ['Prayer Rod', 'common', 'The rod fits through the handles of a pair of water bowls.', { strength: 1, focus: 1 }],
    ['Clapper Staff', 'uncommon', 'The bronze cap was worn round from striking the inside of a bell.', { strength: 2, school: { lotus: { block: 1 } } }],
    ['Sutra Mallet', 'rare', 'Every blow leaves a letter sharp enough to read on an upright stone.', { strength: 2, focus: 2 }],
    ['Yanxu’s Empty Hand', 'legendary', 'This gauntlet has a paper palm to keep its wearer’s grip gentle.', { strength: 3, focus: 2, school: { lotus: { damage: 2 } } }],
  ],
  armor: [
    ['Ash Novice’s Kasaya', 'common', 'A second patch is sewn under every patch the outside can see.', { maxHp: 5, block: 3 }],
    ['Mantle of Witness', 'uncommon', 'The shoulders have loops to keep a witness’s borrowed cloak in place.', { maxHp: 8, focus: 1 }],
    ['Bronze Petal Harness', 'rare', 'Small bronze plates meet over the ribs without striking one another.', { maxHp: 12, focus: 2 }],
  ],
  accessory: [
    ['Stone Incense', 'common', 'Press the stone between your palms until you can smell the rain it holds.', { focus: 1, ward: 1 }],
    ['Pillow Hall Censer', 'uncommon', 'The handle is long enough to light it without waking the patient.', { ward: 2, regen: 2 }],
    ['Abbot’s Lower Beads', 'rare', 'They are heavier than the beads he wore before he entered the vault.', { focus: 2, ward: 1, school: { lotus: { block: 1 } } }],
  ],
  relic: [
    ['Empty Sutra Slip', 'common', 'The pen strokes are visible only in the way the paper bends.', { focus: 1 }],
    ['Ceremony Bowl', 'uncommon', 'When it tips, the water leans away from the rim.', { maxHp: 5, block: 5, ward: 1 }],
    ['Bronze Oath Wheel', 'rare', 'The handle is grooved from generations of hands counting back their breaths.', { focus: 2, ward: 2, school: { lotus: { block: 1 } } }],
    ['Bowl of the Unwritten Sea', 'legendary', 'Listen from above and the waves sound as though they are below the floor.', { energy: 1, focus: 2, school: { lotus: { block: 1 } } }],
  ],
  talisman: [
    ['Breathing Incense', 'common', 'A mark in the incense tells you when to take the next breath.', [block(8), cleanse(1)]],
    ['Ten Breath Seal', 'uncommon', 'Write the last stroke before you draw your next breath.', [block(12), buff('focus', 2)]],
    ['Unburied Verse', 'rare', 'The writing curls up from a corner that would usually be held down.', [block(19), cleanse(2), buff('ward', 2)]],
  ],
  pill: [
    ['Rice Heart Pill', 'common', 'A grain of warm rice keeps the center from cracking.', [heal(7), buff('ward', 1)]],
    ['Clear Vein Tea', 'uncommon', 'Pour it slowly into a wide bowl so the first steam escapes.', [heal(10), cleanse(2), draw(1)]],
    ['Bronze Lotus Kernel', 'rare', 'The seed makes a note like a small bell when bitten through.', [heal(15), buff('regen', 4), buff('focus', 1)]],
  ],
  material: [
    ['Prayer Jade', 'common', 'A jade fragment worn smooth on the side that faced the hand.'],
    ['Clapper Bronze', 'common', 'Bronze salvaged from the inner lip of a bell after it cracked.'],
    ['Sutra Velum', 'uncommon', 'A vellum backing used to support a written prayer through damp winters.'],
    ['Snow Lotus Stem', 'uncommon', 'The dried stem stays flexible through a whole season of frost.'],
    ['Tears of the First Monk', 'rare', 'Hardened drops collected where they had been holding up a roof beam.'],
  ],
});

export const vestments = [...shade, ...lotus];
