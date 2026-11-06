import { schoolInventory, damage, block, draw, energy, heal, cleanse, status, buff } from './inventory.js';

const thunder = schoolInventory('thunder', {
  weapon: [
    ['Spare Pike', 'common', 'A bent hook on the haft lets it hang from a cable when the runner needs both hands.', { strength: 1, school: { thunder: { damage: 1 } } }],
    ['Signal Fork', 'uncommon', 'Strike it against the span so its twin can ring across the ravine.', { strength: 2, school: { thunder: { damage: 1 } } }],
    ['Rookery Lightning Rod', 'rare', 'Its inner wire is braided from fallen brass feathers.', { strength: 2, school: { thunder: { damage: 2 } }, block: 4 }],
    ['Lei Han’s Far-Tower Spear', 'legendary', 'The broken tip arrived with the letter and was kept in its envelope.', { strength: 3, school: { thunder: { damage: 3 } } }],
  ],
  armor: [
    ['Crosswind Vest', 'common', 'A slot in the back lets the mountain wind go through rather than around.', { maxHp: 5, block: 4 }],
    ['Rope Guard Mantle', 'uncommon', 'It cushions the shoulder where a heavy rope will try to saw through.', { maxHp: 8, ward: 1, block: 3 }],
    ['Garrison Thundercoat', 'rare', 'A loose tail of wire drains the charge into the ground after a strike.', { maxHp: 11, ward: 2, school: { thunder: { block: 1 } } }],
  ],
  accessory: [
    ['Cable Sleeve', 'common', 'A small leather tube for one urgent letter and the charge it will carry.', { block: 4, maxHp: 2 }],
    ['Courier Pin', 'uncommon', 'Its copper back is green from rain that went through three layers of cloth.', { strength: 1, school: { thunder: { damage: 1 } } }],
    ['Captain’s Weather Knot', 'rare', 'Every strand is the same color except where the old rain touched it.', { draw: 1 }],
  ],
  relic: [
    ['Split Signal Bell', 'common', 'It sounds one note in the tower and another under the bridge.', { strength: 1, block: 2 }],
    ['Far Tower Key', 'uncommon', 'The key turns the tower door only if it is already wet.', { ward: 2, school: { thunder: { block: 1 } } }],
    ['Garrison Grounding Wheel', 'rare', 'The wheel drains a whole storm through a coil a child could lift.', { energy: 1 }],
    ['Seal of Seven Valleys', 'legendary', 'Seven drops on the face of the seal remain suspended whenever it is held upright.', { energy: 1, strength: 2, school: { thunder: { damage: 1 } } }],
  ],
  talisman: [
    ['Blue Route Slip', 'common', 'Mark it with the directions you can see when the flash comes.', [energy(1), draw(1)]],
    ['Signal Flare Strip', 'uncommon', 'Tear it slowly so the flash has time to travel both directions.', [damage(5, 2), energy(1)]],
    ['Thunder Without a Cloud', 'rare', 'The paper is cut to the size of a clear square of sky.', [damage(8, 2), energy(2), draw(1)]],
  ],
  pill: [
    ['Copper Tongue Drop', 'common', 'The taste tells you when the storm is close enough to hear.', [heal(6), energy(1)]],
    ['Wire Runner Powder', 'uncommon', 'Dissolve it under the tongue before the last foot leaves the tower.', [heal(8), energy(1), draw(2)]],
    ['Meridian Spark Pill', 'rare', 'Swallow it without touching the damp outer wrapping.', [heal(12), energy(3)]],
  ],
  material: [
    ['Weathered Wire', 'common', 'A single strand teased from the oldest cable on the span.'],
    ['Brass Feather', 'common', 'It is warm along the quill where the living bird used to carry a charge.'],
    ['Storm Glass', 'uncommon', 'Sand fused around a splinter of iron during a cloudburst.'],
    ['Cable Resin', 'uncommon', 'A resin scraped from the sheltered underside of a tension cable.'],
    ['Blue Cliff Mica', 'rare', 'Thin flakes that turn blue before lightning strikes.'],
  ],
});

const star = schoolInventory('star', {
  weapon: [
    ['Brass Pointer', 'common', 'A star sight rubbed smooth by people tracking constellations they could barely see.', { strength: 1, school: { star: { damage: 1 } } }],
    ['Comet Quill', 'uncommon', 'Ink catches where a fragment of tail has curled up along the nib.', { strength: 2, school: { star: { damage: 1 } } }],
    ['Eclipse Transit Blade', 'rare', 'The fuller frames one star when held up during an eclipse.', { strength: 2, school: { star: { damage: 2, status: 1 } } }],
    ['Sword of the Vacant Meridian', 'legendary', 'The blade reflects a sky with one extra dark place where a star could have been.', { strength: 3, school: { star: { damage: 2, status: 1 } }, ward: 1 }],
  ],
  armor: [
    ['Almanac Jacket', 'common', 'There is a narrow inner pocket to keep a folded chart dry.', { maxHp: 5, ward: 1 }],
    ['Silent Transit Robe', 'uncommon', 'The sleeves are hemmed short so no fabric catches in the orrery.', { maxHp: 8, ward: 2 }],
    ['Coat of Turning Worlds', 'rare', 'A small weight in each seam helps the astronomer find the vertical in darkness.', { maxHp: 12, school: { star: { block: 2 } } }],
  ],
  accessory: [
    ['Second Hand Cuff', 'common', 'A turned-in edge marks where the cuff must stop before it hides the missing tooth.', { maxHp: 3, ward: 1 }],
    ['Clockmaker’s Tooth', 'uncommon', 'One clock still works without this piece. Every other clock needs it.', { block: 5, school: { star: { block: 1 } } }],
    ['Brass Vacancy Ring', 'rare', 'The outer rim has a gap for a star the maps won’t show.', { draw: 1, ward: 1 }],
  ],
  relic: [
    ['Loose Orrery Weight', 'common', 'A hand-shaped mark shows where the weight was carried out of the dome.', { strength: 1, ward: 1 }],
    ['Blank Brass Ephemeris', 'uncommon', 'It is easier to find the moving stars if you hold the empty plate still.', { ward: 2, block: 6 }],
    ['Almanac of Empty Squares', 'rare', 'From the date of the eclipse onward the margins are wider than the entries.', { draw: 1, school: { star: { damage: 1 } } }],
    ['Gold Circuit', 'legendary', 'The ring has been opened and soldered shut in three different places.', { energy: 1, draw: 1, ward: 1 }],
  ],
  talisman: [
    ['Single Star Stamp', 'common', 'The missing corner tells you which way to turn the chart in the dark.', [draw(2), block(4)]],
    ['Meridian Objection', 'uncommon', 'Press the paper against a window to see where the witness’s words continue.', [status('vulnerable', 2), draw(2), block(5)]],
    ['Mandate of the New Dawn', 'rare', 'The first line asks the reader to find a clear place for the sun to rise.', [damage(16), draw(3), buff('ward', 2)]],
  ],
  pill: [
    ['Midnight Ink Pellet', 'common', 'There is a spot of honey where the night ink would have run.', [heal(6), draw(2)]],
    ['Uncounted Hour Tonic', 'uncommon', 'It takes a long time for the last drop to fall, even with the bottle turned up.', [heal(10), energy(1), cleanse(1)]],
    ['Polaris Pearl', 'rare', 'The pearl rolls uphill when the pole star is visible.', [heal(13), draw(3), buff('ward', 2)]],
  ],
  material: [
    ['Meridian Brass', 'common', 'The sheet bears many fine scratches running in the same direction.'],
    ['Almanac Fiber', 'common', 'A fiber pressed from the underside of the discarded page of an almanac.'],
    ['Clock Shard', 'uncommon', 'It fell out of a gear without leaving a hole where it had been.'],
    ['Eclipse Ink', 'uncommon', 'The ink dries clear if it is used before sunset.'],
    ['Meteor Pith', 'rare', 'Pale wood pulled from a tree split by a falling star.'],
  ],
});

export const instruments = [...thunder, ...star];
