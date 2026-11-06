# Combat motion direction and implementation

The combat presentation now treats a cast as a sequence: lift the actual jade tablet from the hand, gather its type-specific geometry, release the technique, then show factual impact numbers and the changed hero readouts. All effects are rendered locally with SVG, CSS and the Web Animations API; no new raster artwork or external service is required.

## Twelve distinct techniques

| Type | Geometry and motion | Release / complete (ms) |
| --- | --- | --- |
| Strike | Three staggered, crossing blade cuts | 300 / 900 |
| Ward | Shield shell, assembled seams and a luminous jade core | 340 / 980 |
| Mantra | Counter-rotating scripture rings and a diamond seal | 360 / 1000 |
| Remedy | Eight opening lotus petals, a heart light and water ripple | 320 / 1000 |
| Hex | Opening spectral eye, contracting pupil and six drawn tendrils | 350 / 1030 |
| Formation | Unfolding ground hexagram with six rising pillars | 390 / 1100 |
| Stance | Coiling sword spiral and three orbiting blades | 320 / 1000 |
| Counter | Incoming arc, arresting shield, then the returning arc | 300 / 930 |
| Pact | Crimson covenant seal, non-graphic flame and crossing qi tethers | 370 / 1060 |
| Ritual | Rotating clock ring, hourglass and falling light-sand | 410 / 1100 |
| Transmute | Twelve dissolving matter shards, crucible and reforming wheel | 370 / 1070 |
| Finisher | Celestial judgment rings, descending sword and ground fracture | 470 / 1250 |

Schools supply a secondary color palette to trails and impact particles; each signature's own category hue has explicit precedence. Type silhouette remains recognizable across schools. Rare casts add glow, while legendary casts gain an additional drawn corona. Defensive Ward, Remedy, Stance and Pact geometry surrounds the player even when a mixed card also produces a hostile effect. Formation, Mantra, Ritual, Transmute and Finisher establish their geometry on the central board. Finishers add a translucent, glowing blade core and a low-opacity ground shockwave at impact; their brief board recoil is limited to a few pixels and occurs only on actual vitality damage.

## Factual feedback

Damage numbers show the engine's actual aggregate vitality loss. Multi-hit techniques may show repeated cosmetic streaks, but display the aggregate loss once together with the actual hit count and absorbed Guard. Absorption, healing, vitality sacrifice, status changes, Ward prevention, cleanse and dispel have distinct receipts. A fully absorbed attack that exhausts Guard can still fragment the shield without implying vitality damage.

Hero vitality and Guard readouts briefly retain their pre-action values through the windup. They update at release, with a matching meter transition. Cancelling an effect restores the committed values immediately; presentation never rolls back the engine state. Projectiles follow actual strike targets. End-turn pet, formation or ritual damage never invents an enemy attack merely because the player pressed End turn. Pet commands launch from the companion and give it a small lunge.

## Lifecycle and accessibility

`playBattleEffects(root, before, hand, events, school, action, {card, petAbility})` returns `{duration, finished, cancel}`. `snapshotBattle` captures hand rectangles, a sanitized source-card clone, hero points, vitality, Guard and companion origin. `TYPE_EFFECTS` exposes the twelve signatures and durations for tests without requiring a browser.

The controller owns input locking and outcome timing. The presentation owns every timer, inserted effect and Web Animation. Calling `clearBattleEffects()` cancels and resolves the current timeline, removes all effect nodes, cancels outstanding hero/hand/card animations and restores committed readouts. Starting a replacement timeline performs the same cleanup. Effect nodes are inert and have no interactive selectors; card clones remove descendant IDs and all action data attributes. A per-timeline cap of 72 effect containers bounds bursts and labels.

Reduced motion uses a 240ms, static type seal and compact factual receipts. It keeps announcements and persistent battle feedback, while removing projectiles, recoil, animated card travel and particle motion. A preference change also cancels any running full-motion timeline.

Runtime, visual and cancellation verification is recorded in the motion QA report and browser suite.
