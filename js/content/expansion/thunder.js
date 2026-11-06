// Storm couriers treat every crossing as a circuit: prepare, carry, discharge.
const hit = amount => ({ type: 'damage', amount });
const guard = amount => ({ type: 'block', amount });
const draw = amount => ({ type: 'draw', amount });
const qi = amount => ({ type: 'energy', amount });
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
  afflicted: 'If the opponent already had an affliction',
  guarded: 'If you already had Guard',
  wounded: 'If you were at or below half vitality',
  resonant: 'If your Storm Script chain already had at least two steps',
  'empty-hand': 'If no other cards remained in your hand',
};
const triggerText = {
  'turn-start': 'at your turn start', 'turn-end': 'at your turn end',
  'on-attack': 'once per directly played attack',
  'on-guard': 'once per directly played card that grants Guard',
  'on-status': 'once per directly played card that applies a status',
};
function effectText({ type, amount, status, target }) {
  const label = status === 'regen' ? 'Regeneration' : status;
  return {
    damage: `Deal ${amount} damage`, block: `Gain ${amount} Guard`,
    draw: `Draw ${amount}`, energy: `Gain ${amount} Qi`, heal: `Heal ${amount}`,
    cleanse: `Remove ${amount} of your affliction stacks`,
    recover: `Return ${amount} exhausted techniques to your discard pile`,
    dispel: `Remove ${amount} enemy positive stacks (Strength, Focus, Regeneration, then Ward)`,
    status: `${target === 'self' ? 'Gain' : 'Inflict'} ${amount} ${label}`,
  }[type];
}
function card(name, type, cost, rarity, effects, extra, flavor) {
  const lines = [];
  if (extra.healthCost) lines.push(`Pay ${extra.healthCost} vitality before effects; full payment must leave at least 1`);
  lines.push(...effects.map(effectText));
  if (extra.condition) lines.push(`${conditionText[extra.condition]} before costs and effects: ${extra.bonusEffects.map(effectText).join('; ')}`);
  if (extra.aura) lines.push(`For ${extra.aura.duration} owner turns, ${triggerText[extra.aura.trigger]}: ${extra.aura.effects.map(effectText).join('; ')} (activates after this cast; no recursive triggers)`);
  if (extra.delayed) lines.push(`After ${extra.delayed.turns} of your turn starts: ${extra.delayed.effects.map(effectText).join('; ')}`);
  if (extra.exhaust) lines.push('Exhaust');
  return {
    id: `thunder-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name, school: 'thunder', type,
    kind: [...effects, ...(extra.bonusEffects || [])].some(effect => effect.type === 'damage') ? 'attack' : 'skill',
    cost, rarity, effects, description: lines.join('. ') + '.', flavor, ...extra,
  };
}

export const thunderCards = [
  // Hex: establish a fault before routing a second signal through it.
  card('Copper Tongue Citation', 'hex', 1, 'common', [curse('weak'), hit(2)], when('afflicted', [hit(2)]),
    'The inspector tastes every wire. The condemned taste only pennies.'),
  card('Needle in the Insulator', 'hex', 1, 'common', [curse('vulnerable'), guard(3)], when('afflicted', [guard(2)]),
    'A pin through porcelain can close an entire mountain road.'),
  card('Static Address', 'hex', 0, 'common', [curse('bleed')], { ...when('afflicted', [hit(1)]), exhaust: true },
    'Write the destination on the skin. Rain cannot wash it away.'),
  card('Storm Tax Stamp', 'hex', 2, 'uncommon', [hit(3), hit(3), curse('weak')], when('afflicted', [draw(1)]),
    'Two strikes for the fare; the silence afterward belongs to the collector.'),
  card('Frayed Harness Writ', 'hex', 1, 'uncommon', [curse('bleed', 2), guard(2)], when('afflicted', [cleanse(1)]),
    'The harness passes inspection only while nobody pulls on it.'),
  card('Blue Ink Interrogation', 'hex', 2, 'rare', [curse('weak', 2), curse('vulnerable'), hit(3)], when('afflicted', [hit(4)]),
    'The answers appear on the page before the courier asks her question.'),
  card('Dead Line Accusation', 'hex', 2, 'rare', [hit(8), curse('burn', 2)], { ...when('afflicted', [qi(1)]), exhaust: true },
    'Someone is still speaking at the other end of the severed cable.'),

  // Formation: pay for the full scheduled output of the circuit.
  card('Rain Barrel Grounding', 'formation', 1, 'common', [guard(2)], aura('turn-end', 2, [guard(2)]),
    'The oldest barrel has survived six towers and every man who owned them.'),
  card('Tin Roof Receiver', 'formation', 1, 'common', [hit(2)], aura('turn-start', 3, [hit(2)]),
    'A careful listener can distinguish rain from incoming orders.'),
  card('Switchback Guide Lamps', 'formation', 2, 'common', [guard(3)], aura('turn-start', 3, [guard(3)]),
    'Light the return path first. Departure will take care of itself.'),
  card('Night Dispatch Board', 'formation', 2, 'uncommon', [guard(2)], { ...aura('turn-start', 3, [draw(1)]), exhaust: true },
    'Nobody remembers hanging the third envelope, but its wax is warm.'),
  card('Reservoir of Cloudglass', 'formation', 2, 'uncommon', [guard(3)], { ...aura('turn-start', 3, [qi(1)]), exhaust: true },
    'Never tap the tank twice before the blue sediment settles.'),
  card('Porcelain Relay Garden', 'formation', 2, 'rare', [cleanse(1)], { ...aura('turn-end', 2, [guard(3), cleanse(1)]), exhaust: true },
    'The flowers are white until a curse finds its way into the roots.'),
  card('The Unmanned Weather Station', 'formation', 3, 'legendary', [guard(5)], { ...aura('turn-start', 3, [draw(1), qi(1)]), exhaust: true },
    'The last keeper died in winter. Every morning, her forecasts arrive on time.'),

  // Stance: direct actions close circuits; triggered effects cannot close another.
  card('Heel Along the Wire', 'stance', 1, 'common', [guard(2)], aura('on-attack', 2, [guard(1)]),
    'Each lunge tightens the cable beneath the trailing foot.'),
  card('Knuckles on the Mast', 'stance', 1, 'common', [hit(2)], aura('on-guard', 2, [hit(1)]),
    'Brace against the mast and let the vibration climb into the fist.'),
  card('Listening Through Teeth', 'stance', 1, 'common', [guard(3)], aura('on-status', 2, [guard(1)]),
    'The courier hears a curse as a tiny crack inside a molar.'),
  card('Two Fingers on Copper', 'stance', 2, 'uncommon', [guard(2)], aura('on-attack', 2, [hit(1)]),
    'One finger sends the message; the other makes sure it arrived.'),
  card('Rubber Sole Discipline', 'stance', 2, 'uncommon', [cleanse(1)], { ...aura('on-guard', 2, [cleanse(1)]), exhaust: true },
    'Keep both heels dry, especially when the floor is made of prayers.'),
  card('Read the Spark Gap', 'stance', 2, 'rare', [guard(4)], { ...aura('on-status', 2, [hit(1), guard(1)]), exhaust: true },
    'A trained eye measures the distance between danger and its explanation.'),
  card('Courier Without a Footfall', 'stance', 3, 'legendary', [guard(4)], { ...aura('on-attack', 2, [hit(1), guard(1)]), exhaust: true },
    'The bridges report her weight. The roads have never met her.'),

  // Counter: the hand must already be protected before reaching into the circuit.
  card('Catch the Guy Rope', 'counter', 1, 'common', [hit(5)], when('guarded', [guard(3)]),
    'The falling mast gives you one rope and no time to choose another.'),
  card('Latch the Storm Shutter', 'counter', 1, 'common', [guard(5)], when('guarded', [curse('weak')]),
    'Close it while the wind is still taking a breath.'),
  card('Dry Glove Slap', 'counter', 0, 'common', [hit(2)], { ...when('guarded', [hit(1)]), exhaust: true },
    'The apprentice learns this before being permitted to touch a live line.'),
  card('Crossed Arrestor Rods', 'counter', 2, 'uncommon', [hit(4), hit(4)], when('guarded', [hit(3)]),
    'The first rod takes the flash. The second points out its owner.'),
  card('Shelter at the Junction', 'counter', 1, 'uncommon', [guard(4)], when('guarded', [draw(1)]),
    'A dispatch can be read in the narrow shadow of a raised elbow.'),
  card('Return Along the Shield Braid', 'counter', 2, 'rare', [hit(10)], { ...when('guarded', [qi(1)]), exhaust: true },
    'A shield braid protects the message by giving the storm another road.'),
  card('Breakwater Switch Throw', 'counter', 3, 'rare', [guard(10), hit(5)], when('guarded', [hit(6)]),
    'Hold the lever until the lights on the far shore come back.'),

  // Pact: the courier pays in vitality before receiving the borrowed charge.
  card('Lease a Heartbeat', 'pact', 0, 'common', [qi(1)], { healthCost: 3, exhaust: true },
    'The station lends time in units too small to record on a clock.'),
  card('Bare Palm Splice', 'pact', 1, 'common', [hit(4), hit(4)], { healthCost: 2 },
    'Hold the two ends together until the message stops passing through you.'),
  card('Underwrite the Crossing', 'pact', 1, 'common', [guard(7)], { healthCost: 2, ...when('wounded', [guard(3)]) },
    'A red signature guarantees the passenger, never the bridge.'),
  card('Buy the Unsent Warning', 'pact', 1, 'uncommon', [draw(2), guard(2)], { healthCost: 3, exhaust: true },
    'The warning costs more after the disaster, but it still has a use.'),
  card('Lightning Through the Splint', 'pact', 2, 'uncommon', [hit(11), curse('weak')], { healthCost: 3, ...when('wounded', [hit(4)]) },
    'The broken arm points steadily when the storm holds it straight.'),
  card('Put the Pulse in Escrow', 'pact', 2, 'rare', [boon('strength', 1), guard(7)], { healthCost: 4, exhaust: true },
    'The clerk locks one beat in a copper box and waves you onward.'),
  card('Deliver Before Your Death', 'pact', 3, 'legendary', [hit(5), hit(5), hit(5), draw(2)], { healthCost: 7, exhaust: true },
    'The address is legible. The sender has left the date of death blank.'),

  // Ritual: the flash and its report need not arrive on the same turn.
  card('Count the Distant Flashes', 'ritual', 1, 'common', [guard(2)], later(1, [hit(3), hit(3)]),
    'Counting is how the children know when to run for the cellars.'),
  card('Send the Empty Capsule', 'ritual', 1, 'common', [guard(3)], later(1, [draw(1)]),
    'The reply matters more than the message that asked for it.'),
  card('Charge the Rescue Lantern', 'ritual', 1, 'common', [hit(2)], later(1, [guard(6)]),
    'If the flame turns blue, someone has seen your signal.'),
  card('Wind the Cliff Winch', 'ritual', 2, 'uncommon', [guard(3)], { ...later(1, [qi(2)]), exhaust: true },
    'The arm aches now so the ascent can happen in a single breath.'),
  card('Hang the Triple Chime', 'ritual', 2, 'uncommon', [curse('weak')], later(2, [hit(4), hit(4), hit(4)]),
    'The chimes must ring in order, even when the tower is falling.'),
  card('Forecast in a Sealed Envelope', 'ritual', 2, 'rare', [guard(4)], { ...later(2, [draw(2), qi(1)]), exhaust: true },
    'Open only after the second bell. Earlier weather belongs to somebody else.'),
  card('Raise the Flooded Substation', 'ritual', 3, 'rare', [guard(6), cleanse(1)], { ...later(1, [hit(12), dispel(2)]), exhaust: true },
    'As the water falls, every submerged terminal remembers its enemy.'),

  // Transmute: spent dispatches return to discard, while enemy advantages lose stacks.
  card('Strip the Gilt Terminal', 'transmute', 1, 'common', [dispel(2), hit(3)], {},
    'The plating is decorative until somebody mistakes it for insulation.'),
  card('Unroll the Spent Message', 'transmute', 1, 'common', [recover(1), guard(3)], { exhaust: true },
    'There is always a little blank paper beneath the last turn of the spool.'),
  card('Scrape the Storm Idol', 'transmute', 1, 'common', [dispel(1), guard(4)], {},
    'Under the silver prayers is an ordinary brass lightning rod.'),
  card('Reroute the Ruined Relay', 'transmute', 2, 'uncommon', [recover(2), hit(4)], { exhaust: true },
    'Two abandoned routes meet beneath the station nobody services.'),
  card('Clip the Privileged Line', 'transmute', 2, 'uncommon', [dispel(3), curse('weak'), hit(3)], {},
    'The governor asked for a private circuit. Nobody promised it would stay connected.'),
  card('Reclaim the Courier Bells', 'transmute', 2, 'rare', [recover(1), guard(6)], { ...when('resonant', [guard(4)]), exhaust: true },
    'A bell taken from a dead courier rings only for another courier.'),
  card('Disassemble the Cloud Throne', 'transmute', 3, 'rare', [dispel(4), hit(5), hit(5)], { ...when('afflicted', [hit(5)]), exhaust: true },
    'Remove the four grounding screws and heaven becomes salvage.'),

  // Finisher: the final delivery rewards a prepared chain or an emptied satchel.
  card('Last Stop at Needle Peak', 'finisher', 1, 'common', [hit(6)], { ...when('empty-hand', [hit(3)]), exhaust: true },
    'Leave the empty satchel hanging on the summit marker.'),
  card('Close the Three Bell Circuit', 'finisher', 1, 'common', [hit(3), hit(3)], { ...when('resonant', [guard(3)]), exhaust: true },
    'When the third bell answers, take your hands off the wire.'),
  card('Receipt in the Rain', 'finisher', 2, 'common', [hit(9), guard(3)], { ...when('empty-hand', [hit(5)]), exhaust: true },
    'The recipient signs with the only dry finger left.'),
  card('Cut the Returning Arc', 'finisher', 2, 'uncommon', [hit(5), hit(5)], { ...when('resonant', [qi(1)]), exhaust: true },
    'Take one useful breath from the charge on its way back to earth.'),
  card('No Letters for the Living', 'finisher', 2, 'uncommon', [hit(10), curse('weak')], { ...when('empty-hand', [curse('vulnerable'), hit(2)]), exhaust: true },
    'Every remaining address is carved on a stone.'),
  card('Signature Across the Stormfront', 'finisher', 3, 'rare', [hit(6), hit(6), hit(6)], { ...when('resonant', [hit(6)]), exhaust: true },
    'The magistrate spends the rest of the monsoon trying to read the name.'),
  card('The Dispatch Heaven Returned', 'finisher', 3, 'legendary', [hit(14), dispel(3)], { ...when('empty-hand', [hit(7), cleanse(1)]), exhaust: true },
    'Stamped undeliverable. Still warm from the hand that refused it.'),

  card('Cable Car Knuckle', 'strike', 1, 'uncommon', [hit(2), hit(2), guard(2)], {},
    'The cabin sways twice: once for the punch, once for the counterweight.'),
  card('Oilskin Over the Satchel', 'ward', 1, 'uncommon', [guard(4), boon('ward')], {},
    'Protect the letters. Their authors may no longer be able to rewrite them.'),
  card('Memorize the Detour', 'mantra', 0, 'uncommon', [draw(1)], { ...when('resonant', [guard(2)]), exhaust: true },
    'A route learned by lightning must be remembered in the dark.'),
  card('Liniment of Copper Leaf', 'remedy', 1, 'uncommon', [heal(3), cleanse(1)], { ...when('wounded', [guard(2)]), exhaust: true },
    'Rub it into the joints until the buzzing becomes a tolerable hum.'),
];
