import { schoolInventory, damage, block, draw, energy, heal, cleanse, status, buff } from './inventory.js';

const iron = schoolInventory('iron', {
  weapon: [
    ['Writ Knife', 'common', 'The thin blade opens official dispatches and cuts the thread around them.', { strength: 1, block: 2 }],
    ['Bailiff’s Hinge Sword', 'uncommon', 'Its hinge lets the blade hang out of reach until a warrant is presented.', { strength: 2, school: { iron: { block: 1 } } }],
    ['Oath Severer', 'rare', 'A flat back lets its bearer use a single stroke to cut the ring from an oath hand.', { strength: 2, school: { iron: { damage: 2 } } }],
    ['Mu Qing’s Broken Verdict', 'legendary', 'The broken tip was left inside the gate where the captain stood her ground.', { strength: 3, focus: 1, school: { iron: { damage: 2 } } }],
  ],
  armor: [
    ['Gatekeeper’s Vest', 'common', 'Knots inside the ribs let the wearer tell whether the top clasp is fastened in the dark.', { maxHp: 6, block: 2 }],
    ['Stone Vow Greaves', 'uncommon', 'The shin plates are dusted with grit from the oath court’s entrance steps.', { maxHp: 8, focus: 1 }],
    ['Recusal Lamellar', 'rare', 'The armor has no space left for a crest where the wearer cut it out.', { maxHp: 14, block: 5 }],
  ],
  accessory: [
    ['Court Hinge', 'common', 'The doors came off after the last public hearing. The hinge still swings freely.', { block: 4 }],
    ['Split Seal Pendant', 'uncommon', 'The edges fit together if you need to prove that the break was deliberate.', { strength: 1, ward: 1 }],
    ['Gritbound Thumb Ring', 'rare', 'The ring has room underneath for the sand a bailiff brings from home.', { focus: 2, maxHp: 4 }],
  ],
  relic: [
    ['Unfiled Scabbard', 'common', 'The scabbard’s owner left the service before the stamp could be applied.', { strength: 1 }],
    ['Single Witness Plaque', 'uncommon', 'Only one name survived where the rest of the plaque was burned.', { block: 6, ward: 1 }],
    ['Captain’s Lintel', 'rare', 'Its brass panel shows a sword turned sideways to hold a door.', { focus: 2, school: { iron: { block: 1 } } }],
    ['Six-Handed Vow', 'legendary', 'All six signatures are different enough to belong to different people.', { strength: 3, block: 8, ward: 2 }],
  ],
  talisman: [
    ['Threshold Strip', 'common', 'Nail the strip low enough for a child to touch it on the way through.', [block(9), buff('ward', 1)]],
    ['Counterseal', 'uncommon', 'Heat the edge and press it over the seal you want to break.', [status('vulnerable', 2), damage(8)]],
    ['Rejected Writ', 'rare', 'Every blank corner bears the mark of someone who refused to deliver it.', [block(17), status('weak', 3)]],
  ],
  pill: [
    ['Rust Root Pellet', 'common', 'The root gets its red skin from pots rinsed in the smithy well.', [heal(6), block(5)]],
    ['Hinge Oil Draught', 'uncommon', 'Drink it from a wooden cup. Iron vessels seize when it dries.', [heal(8), buff('strength', 2)]],
    ['Tempered Heart Pearl', 'rare', 'It cools from the inside out once it touches the tongue.', [heal(12), buff('focus', 3)]],
  ],
  material: [
    ['Hinge Iron', 'common', 'Leaf-thin scraps cut from a gate built to swing against a current.'],
    ['Oath Ink', 'uncommon', 'This ink stains a hand only if it signed a contract that day.'],
    ['Iron Thread', 'common', 'A smith draws it thin enough to sew through the holes in a sword belt.'],
    ['Witness Grit', 'uncommon', 'Grit gathered from the kneeling stones after a hearing has ended.'],
    ['Unstamped Jade', 'rare', 'A seal blank with room for the person who will use it to cut their own name.'],
  ],
});

const ember = schoolInventory('ember', {
  weapon: [
    ['Coal Tongs', 'common', 'Heat lingers in the serrated tips long after they have cooled to the eye.', { strength: 1, school: { ember: { damage: 1 } } }],
    ['Kiln Needle', 'uncommon', 'The slender tool can turn a firing piece without scraping away its glaze.', { strength: 2, school: { ember: { status: 1 } } }],
    ['Veilfire Sabre', 'rare', 'Smoke follows the hollow in its fuller whenever it is drawn.', { strength: 2, school: { ember: { damage: 2, status: 1 } } }],
    ['Mourning Sun', 'legendary', 'The pommel holds a coal taken from the first kiln the House sealed after the sky broke.', { strength: 3, school: { ember: { damage: 2, status: 2 } } }],
  ],
  armor: [
    ['Kiln Apron', 'common', 'Clay beads insulate the places closest to the fire.', { maxHp: 5, ward: 1 }],
    ['Red Veil Robes', 'uncommon', 'When someone stands close, the fabric smells faintly of hot cinnamon.', { maxHp: 7, regen: 2 }],
    ['Cremation Coat', 'rare', 'The lining is the part that has already passed through the fire.', { maxHp: 10, ward: 2, school: { ember: { block: 2 } } }],
  ],
  accessory: [
    ['Soot Ampoule', 'common', 'A glassblower drew the vessel around a falling piece of ash.', { regen: 1, block: 2 }],
    ['Sinder’s Thimble', 'uncommon', 'Its only dent came from the inside, where a thimble usually stays smooth.', { strength: 1, ward: 1 }],
    ['Brazier Beads', 'rare', 'Each bead has a grain of coal that can be relit in a closed fist.', { school: { ember: { status: 1 } }, regen: 3 }],
  ],
  relic: [
    ['Lidded Coal Cup', 'common', 'The little lid has a breathing hole small enough to cover with a thumb.', { regen: 2 }],
    ['Furnace Rattle', 'uncommon', 'Shake it once before opening a kiln that has been cold all night.', { strength: 2 }],
    ['Wedding Crucible', 'rare', 'Two handprints are fired into the clay, on opposite sides of the handle.', { strength: 2, regen: 3, school: { ember: { status: 1 } } }],
    ['Jar of the Last Warmth', 'legendary', 'A warm patch the size of a palm moves along its side while you carry it.', { energy: 1, school: { ember: { status: 1 } } }],
  ],
  talisman: [
    ['Brazier Spark', 'common', 'Rub the paper against the base of a clay lamp to wake the writing.', [status('burn', 4)]],
    ['Copper Wick Seal', 'uncommon', 'The paper follows the curve of a spiral stamped into copper.', [damage(8), status('burn', 4), draw(1)]],
    ['Seal of Closed Embers', 'rare', 'The stroke enclosing the fire is the first to burn.', [status('burn', 8), status('weak', 2), block(6)]],
  ],
  pill: [
    ['Smokeberry Pearl', 'common', 'The berry cools a burned mouth while it warms the throat.', [heal(7), status('burn', 2)]],
    ['Ember-Heart Syrup', 'uncommon', 'A streak of copper runs along the sides of the jar after the liquid settles.', [heal(10), buff('regen', 2)]],
    ['Second Firing Pill', 'rare', 'The patient swallows it with cold tea to keep the clay wrapping intact.', [heal(14), energy(2)]],
  ],
  material: [
    ['Funeral Ash', 'common', 'The pale ash was sifted away from scraps of wedding silk.'],
    ['Kiln Copper', 'common', 'Soft copper salvaged from the winding around a kiln mouth.'],
    ['Fireglass', 'uncommon', 'The pane turns transparent again when returned to an open flame.'],
    ['Cinder Resin', 'uncommon', 'Resin skimmed from the top of a clay jar after its first firing.'],
    ['Ash Plum Pit', 'rare', 'The plum’s stone survived the fire that cooked every fruit on the tree.'],
  ],
});

const tide = schoolInventory('tide', {
  weapon: [
    ['Quarantine Lancet', 'common', 'Sailors use the flat side to lift the seal on a new case of medicine.', { strength: 1, school: { tide: { damage: 1 } } }],
    ['Brine Needle', 'uncommon', 'A hole in the tip holds enough salt to leave a mark deep in the wound.', { strength: 2, school: { tide: { status: 1 } } }],
    ['Shoalbone Oar', 'rare', 'A ferry pole carved from the rib of the creature that first carried the village across.', { strength: 2, regen: 2, school: { tide: { damage: 2 } } }],
    ['The Drowned Ferryman', 'legendary', 'The hook at its end still pulls toward the dock on nights when the fog comes up.', { strength: 3, regen: 3, school: { tide: { status: 2 } } }],
  ],
  armor: [
    ['Ferry Sash', 'common', 'The wide cloth doubles as a sling for passengers who have forgotten how to stand.', { maxHp: 6, regen: 1 }],
    ['Concord Shouldercloth', 'uncommon', 'Its long end keeps one side of the bearer dry enough to hold a child.', { maxHp: 9, regen: 2 }],
    ['Quarantine Coat', 'rare', 'The layered sleeves carry old instructions on how to turn the cloth without touching it.', { maxHp: 11, ward: 3 }],
  ],
  accessory: [
    ['Mother-of-Tide', 'common', 'A narrow band made from the hinge of the shell that held the Pearl Son.', { regen: 2 }],
    ['Surgeon’s Horn', 'uncommon', 'The horn calls one patient at a time and carries strangely far underwater.', { ward: 1, regen: 2 }],
    ['Ferry Chain Anklet', 'rare', 'Its links open one way when the tide rises and the other way when it falls.', { maxHp: 7, school: { tide: { status: 1 } } }],
  ],
  relic: [
    ['Ceramic Scale', 'common', 'The scale is scratched with the name of a household the other copy forgot.', { block: 4, regen: 1 }],
    ['Cord of the Returned', 'uncommon', 'Every knot has a strip of cloth woven through it for a passenger who came back.', { regen: 3 }],
    ['Register in Shell', 'rare', 'Open it where nobody can see the light come from inside.', { regen: 3, ward: 2, school: { tide: { status: 1 } } }],
    ['Anchor of Borrowed Names', 'legendary', 'People can find this anchor by calling their old names over the bank.', { maxHp: 12, regen: 4, school: { tide: { status: 2 } } }],
  ],
  talisman: [
    ['Sluice Mark', 'common', 'Keep this strip of cloth facing upriver when you tie it to a post.', [status('poison', 3), block(4)]],
    ['Talisman of Low Water', 'uncommon', 'Drawn on a reed split while it was still green.', [status('poison', 5), status('weak', 1)]],
    ['Estuary Levee Knot', 'rare', 'The knot loosens only after you speak both banks of the river aloud.', [block(15), buff('regen', 3), cleanse(2)]],
  ],
  pill: [
    ['Pearl-Salt Pill', 'common', 'It tastes of the clean part of an incoming tide.', [heal(6), cleanse(2)]],
    ['Reed-Lung Potion', 'uncommon', 'Let the foam settle before pouring it. The medicine is in the foam.', [heal(10), buff('regen', 3)]],
    ['Drowned Moon Elixir', 'rare', 'Su He keeps the bottle underwater until there is a patient on his deck.', [heal(16), cleanse(3), buff('ward', 1)]],
  ],
  material: [
    ['Pearl Grit', 'common', 'Sand collected around an oyster that was once a door hinge.'],
    ['Estuary Bone', 'common', 'A small translucent rib worn down by a lifetime of tides.'],
    ['Shoal Salt', 'uncommon', 'Coarse grains picked out of the upstream side of the salt pans.'],
    ['Drowned Coin', 'uncommon', 'A coin with a well-worn hole where a ferryman once wore it around his neck.'],
    ['Deepwater Glaze', 'rare', 'It settles on ceramic only if the vessel is lowered past a submerged rooftop.'],
  ],
});

export const arms = [...iron, ...ember, ...tide];
