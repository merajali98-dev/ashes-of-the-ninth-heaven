# Spirit companion independent QA

## Runtime and state verification

`node --test tests/pet-integration.test.js tests/pets.test.js` passes all 20 tests. The integration sweep covers all eight species at all ten realms, including 240 unlocked ability casts. Each cast must produce a useful combat effect in an appropriate state. All commands preserve card piles, Qi, RNG state, and resonance chains. Cooldowns become ready exactly at the casting turn plus the authored cooldown; different abilities still share one command per player turn. Locked, unknown, cooling, and finished-battle commands reject without mutation.

Opening passives fire once. Every unlocked turn-start and turn-end passive fires once per scheduled round, without activating attack/Guard/status stances or producing card resources. Pet damage respects sealed phases, and a phase reached by the phoenix's turn-end Burn still executes the enemy intent already shown to the player. Lethal pet effects clear pending auras and rituals; pet healing cannot revive a defeated owner.

Forecasts leave the full live state unchanged, including nested pet definitions and cooldowns. Actual execution agrees with forecast vitality and JSON-restored battles remain identical. Old version-1 and pre-pet economy saves receive an empty sanctuary and no selected companion, while their existing battle snapshots remain unchanged.

Save validation rejects altered ability/passive effects, changed cooldown definitions, unknown cooldown IDs, impossible readiness history, two abilities claiming the same invocation turn, future invocation turns, missing owned pets, selection mismatches, and parent/snapshot growth mismatches. Review found that the first validator admitted impossible cooldown histories; it now reconstructs invocation turns from each cooldown and enforces a coherent latest invocation.

Feeding tests preserve the maximum reservation across active, saved, and draft decks. A quote is revalidated on commit after draft changes. Feeding destroys only safe surplus, grants fixed rarity experience, preserves shared card quality, and produces no jade/material refund. Hatching never silently equips a companion; deliberate selection alone attaches one immutable pet snapshot to a new encounter. Sanctuary mutations are blocked during combat.

The full project suite passed 118 tests at the first integrated checkpoint. Existing pet-model tests additionally cover exact hatch/evolution costs, all ninety layers, all eight selectable first hatches, no-value overfeeding, lifetime essence bounds, and atomic transaction rejection.

## Browser workflow

`tests/pet-browser.mjs` drives an isolated Edge context against port 4181. It covers an empty migrated sanctuary, all eight chosen hatches, normal and reduced-motion reveals, protected feed choices, search/no-match/clear states, invalid quantity rejection, read-only previews, exact feeding consumption, evolution, map/list/zoom controls, one equipped companion, persisted selection, real battle commands, cooldown reload, and 390-pixel layout.

The final workflow run passes with zero JavaScript errors and zero HTTP errors. All 33 artworks—the habitat map and every egg/young/adult/ascended sprite—decode successfully through the actual server. Feeding search, no-match, and clear states work. Zoom preserves the map viewport height, and mouse dragging pans the enlarged map on both axes. The normal hatch reveal completes automatically and restores application interaction; reduced-motion reveals expose an explicit Continue control. Screenshots in `tmp/pet-browser/` were reviewed at desktop and 390-pixel mobile sizes, including the fully hatched map, feeding confirmation, evolution, and the companion command panel with a full hand visible.

## Scope limits

These tests verify authored effects and workflows, not every possible deck/companion combination. Legal fight-length and power comparisons belong to the separate pet balance simulation. The companion remains an untargeted support entity; browser assertions retain exactly two combatants and one companion portrait.
