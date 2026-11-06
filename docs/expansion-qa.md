# Forbidden Lineages independent QA

The expansion registry contains 480 new techniques, 60 per school, alongside the original 117. Each school has seven techniques of each new type and one each of Strike, Ward, Mantra, and Remedy. Every school has 24 common, 20 uncommon, 12 rare, and four legendary techniques. All identifiers are unique and no two techniques within a school have identical mechanical signatures.

`node --test tests/expansion.test.js` currently passes all 12 tests. These checks exercise every technique at mastery 0 and mastery 2: 960 casts, followed by four rounds each. Situational cards receive relevant targets, including spent techniques, removable statuses, wounded vitality, Guard, and a prepared school chain. This proves supported execution and a usable effect under appropriate conditions; it is not a claim that every card has equal strategic value.

The runtime sweep checks that forecasts leave live state unchanged, forecast vitality matches execution, JSON restoration produces identical results, definitions are not mutated, effects expire, and numeric resources remain valid. A separate integration test uses the actual campaign save reader with pending formations and rituals, then resumes the same next turn. A malformed pending source is rejected.

Focused authored regressions cover:

- Qi from all turn-start formations and delayed rituals remains available after the turn refresh.
- Delayed recovery cannot recover its own exhausted source technique.
- A multi-hit attack triggers an attack stance once; a ritual cast with only delayed damage and its later payload do not trigger it.
- Delayed damage respects the enemy's phase seal.
- Every zero-Qi expansion card exhausts, and action stances do not grant draw, Qi, or recovery that directly funds further plays.
- Every expansion card can be learned through the completed campaign library, with correct ownership and jade changes.

The existing `tests/lineage-combat.test.js` additionally covers condition snapshots, atomic rejection of unpayable pacts and a fourth aura, timed formation payouts, aura refresh, the six-ritual limit, recovery pile order, dispel stack order, and cleanup after timed lethal damage.

Independent review found two engine defects now covered by passing regressions: scheduled Qi was overwritten by the turn reset, and delayed recovery could return its own source. Attack stance triggering also now follows explicit card kind, with registration classifying techniques by immediate and conditional damage rather than delayed payloads.

The balance review separately found a cross-expansion recovery/draw/Qi loop involving original cards; its dedicated adversarial simulation belongs to `tests/expansion-playthrough.mjs`. Recovery now excludes all techniques containing recovery, including immediate, conditional, aura, and ritual payloads. A targeted regression checks all four locations. The simple zero-cost checks here do not replace the adversarial simulation. Paid mastery of the two pure-Qi pacts now adds two Guard per rank without increasing Qi generation; a regression checks ranks zero, one, and two, including vitality payment and exhaustion.

`node tests/expansion-browser.mjs` passes against an isolated local server on port 4181 using Edge. It verifies original-technique-only version-1 sanctuary saves, legacy battle saves without aura/ritual fields, the 597-card archive and pagination, combined school/type/rarity/Qi/ownership/search filters, learning with correct jade payment, and persisted ownership after reload. It casts a formation and ritual through the visible card/target controls, inspects the active-art details, reloads the pending effects, and confirms exactly two combatants. Desktop and 390-pixel mobile screenshots were visually inspected. The mobile active-art panel remains within the viewport even at three auras and six rituals, using its scrollable area. No browser JavaScript errors were reported. Screenshots are in `tmp/expansion-browser/`.

Final release verification: `node --test` passes all 66 tests, including the strict bundled-asset check for 597 distinct technique artwork paths. An independent asset sweep confirms 597 unique SHA-256 image hashes and fetches and decodes every image in Edge from the running game server; all 597 succeed, with a minimum dimension of 309 pixels. The final browser suite also passes after complete art installation. `node tests/expansion-playthrough.mjs` passes its 60 tactical encounters, vitality-payment checks, and resource-loop probes. All three full 49-mission campaign routes pass on both Wayfarer and Tribulation. The twelve-type design preview is `docs/preview-card-types.jpg`. These checks establish execution, acquisition, and the tested balance cases; they do not exhaustively balance every possible deck.
