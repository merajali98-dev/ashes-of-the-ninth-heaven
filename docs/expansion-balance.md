# Forbidden Lineages balance review

Run `node tests/expansion-playthrough.mjs` for the bounded tactical simulation and exploit regressions. This review uses the real combat resolver, authored cards, school resonance, mastery 0/2, enemy phases and displayed intents. It does not establish that every possible deck is balanced.

## Infinite-action findings

The initial expansion exposed a mutual recovery loop. At mastery 2, ordinary Recover 1 becomes Recover 3. A legal eight-card deck containing Retrieve the Burned Chart, Salvage the Broken Oath, two Gather Qi, two Missing Second and two Lightning Ledger sustained 300 consecutive actions on turn one with 47 Qi remaining. Source-ID exclusion did not stop the two different recovery techniques returning each other. Excluding every recovery-bearing technique from recovery eligibility closes this cycle; the same sequence now ends after 10 actions at base mastery and 13 at mastery 2. Recovery still returns ordinary exhausted techniques.

The review also reproduced existing free-card resonance loops, which new action stances could amplify. Four Red Coals plus two Ash Basket, Empty Jar and Gather Qi sustained 300 actions, 54 Qi and 1,293 Burn at mastery 2. Candle Snuffer with Curtain Hem similarly produced 2,334 immediate damage. Ground Wire's full Qi refund made it effectively free: four copies plus two Silver Relay and the same neutral support produced 1,378 damage and 2,988 Guard in 300 actions. The regression suite covers those three families plus Bitter Brine/Ferry's Wake across five deterministic shuffles.

These are repeatable turn-one engines, not merely strong opening hands. Exhaustion on free/refunded techniques is an appropriate remedy; an arbitrary global action limit would conceal the cause.

After the fixes, all twenty free/refund shuffle probes terminate: the longest opening is 13 actions for Red Coals, Bitter Brine and Candle Snuffer, and 12 for Ground Wire. The full 597-card registry also passes mastery 0/2 invariants: every non-exhausting technique has a strictly positive net Qi cost even including conditional refunds; every recovery technique exhausts; no action-triggered aura draws, grants Qi or recovers cards. Existing gear supplies no school-specific draw, energy or recovery modifier that bypasses those checks. A healing stance cannot turn a pact into a free repeating play because Qi still decreases.

## Intentional decks

Each build contains twelve cards: eight expansion techniques plus four existing school techniques. The new cards cover hexes, formations, stances, counters, pacts, rituals and finishers. The tactical player evaluates the actual next enemy intent and scheduled effects with a bounded beam, checks whether plays succeed, and may end the turn without playing a harmful pact. All builds use the actual common loadout equivalent of Pilgrim's Staff, Sootcloth Coat, Jade Prayer Beads and Windproof Wick: +1 Strength, +1 Focus, +2 Ward, +5 maximum vitality.

The opening tier uses 59 vitality and unrefined cards against Magistrate Wei. It is an encounter-strength comparison, not a claim that these complete lists are obtainable before chapter one: several support cards have higher acquisition rarity. The refined tier uses Spirit Severing's 103 vitality and mastery 2 against General Hong. The final tier uses Heaven Ascension's 142 vitality and mastery 2 against the phase-sealed Ninth Heaven. Each pairing runs seeds 1–5, without consumables.

| Build | Opening wins | Hong wins | Ninth Heaven wins | Final mean turns | Final mean vitality |
| --- | ---: | ---: | ---: | ---: | ---: |
| Iron Guard/counter | 5/5 | 5/5 | 5/5 | 5.0 | 135.0 |
| Ember affliction/ritual | 5/5 | 5/5 | 5/5 | 7.2 | 116.2 |
| Lotus protection/counter | 5/5 | 5/5 | 5/5 | 9.6 | 135.6 |
| Star draw/conditional attack | 5/5 | 5/5 | 5/5 | 9.4 | 51.2 |

All seven new types were actually played across each school's final-boss seeds. Opening Star often ended fights before installing its slower arts. These results establish that the expansion supports purposeful playable decks; they do not prove that rare utility arts, every school, or Tribulation difficulty are equally strong. The slower Star result also shows that a nominal draw advantage does not automatically replace Guard and damage planning.

Every authored pact is separately checked at exactly its vitality payment: the resolver rejects the play and leaves all state unchanged. The simulation asserts finite encounters and a minimum 3/5 success rate for the opening and Hong tiers; final-boss outcomes remain reported rather than imposing an automatic win requirement.

## Remaining balance judgments

No broad number increases are needed to make the new mechanics usable. Low-cost conditional cards provide viable school cores. Expensive dispel/recovery legendaries are specialized tools and are not represented by the combat table. The twelve-card, fully refined late-game decks are deliberately efficient; campaign acquisition cost and access gates remain separate checks. The tactical search is bounded and does not exhaustively enumerate every multischool combination.
