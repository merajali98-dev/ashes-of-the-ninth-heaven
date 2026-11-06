# Workshop, cultivation, and deck integration QA

The independent integration suite now covers the new economy without retaining obsolete assumptions about two-jade learning, jade-only refinement, or buying the entire collection from story rewards alone. Existing tests were updated to require finite targeted acquisition, cultivation gates, exact material spending, and five bounded card levels. Art checks remain strict.

## Automated integration evidence

`node --test` passes all 98 tests, including `tests/workshop-integration.test.js` and the economy/cultivation unit suites. The integration checks include:

- All seven legacy realm indices at each old mastery rank, for 21 actual save-reader migrations. Original ownership, deck, bag, jade, mission completion, vitality, and stored active combat remain unchanged. Migration is idempotent, and the next old-combat round is identical after restoration.
- Rejection of malformed material maps, quality levels, conflicting legacy/mastery fields, named deck references, unowned draft cards, oversized drafts, tutorial progress, and combat entry levels.
- All 597 techniques at levels 1–5: 2,985 real `createCombat` casts and 8,955 follow-up rounds, checking canonical UI/combat magnitudes, meaningful paid steps, the exact extra-Guard budget, unchanged resource/nested payload scaling, forecast isolation, and JSON replay parity.
- Independent draft persistence, save/activate separation, maximum rather than summed reservations, active-preset deletion protection, surplus salvage, encounter editing locks, four-copy and 22-card limits, eight saved presets, and rejection of unowned cards at both activation and encounter entry.
- Commission gates and save restoration at every tier, scaled opponents, no starting reward, exact repeatable payouts after victory, duplicate claim rejection, and no reward from retreat or defeat. These transaction tests use explicit QA damage to reach a real engine victory state; they do not measure battle difficulty.
- Manual prices cannot undercut direct acquisition, manual purchases cannot bypass cultivation requirements, and already-earned manuals remain usable.
- All 45 material images and nine new realm portraits have distinct bundled paths and exist, alongside the unchanged card/item/environment art assertions.
- In-battle inspection uses the stored battle quality, including migrated legacy encounters, and disables Shop/Workshop navigation until returning. An unstarted legacy chronicle still receives the first-run guide.

The integration review identified missing encounter-entry deck validation and conflicting saved mastery sources; both now have passing regressions. Draft behavior was clarified: an incomplete editing draft persists, while a named preset must be legal before saving. This preserves a valid active battle deck throughout editing.

## Browser evidence

With the local server on port 4181, `node tests/workshop-browser.mjs` passes in an isolated Edge context. It operates visible controls for the following flows:

- Legacy mastery migration, the complete 597-card and 45-material catalogues, pagination, and combined school/type/rarity/Qi/ownership/search filters.
- Ten material quantity purchases with live totals, exact jade and inventory changes, an insufficient-ingredients preview, and successful forging.
- All four material-funded upgrades, before/after effect previews, shared family quality, and the maximum-level state.
- A direct shop purchase, protected-card salvage rejection, a concrete salvage preview that spends nothing, and confirmed surplus salvage preserving quality.
- Named deck duplication, saving without activation, activation, reload persistence, and an incomplete one-card draft that survives reload while preserving the active deck.
- Desktop and 390-pixel mobile layouts with no horizontal page overflow. Screenshots in `tmp/workshop-browser/` were visually inspected.

Browser QA found a genuine header-art URL bug: CSS custom-property image paths resolved below `/css/assets/`. The URLs were corrected to absolute module-resolved paths. The final rerun reports zero JavaScript errors and zero HTTP errors.

The previous `tests/expansion-browser.mjs` was adapted to the new archive and gated purchase controls and also passes. It retains pending-art inspection/reload, exactly two combatants, and the nine-active-effect mobile layout checks. Root's `tests/tutorial-browser.mjs` separately covers sanctuary/battle tutorials, cultivation, and commissions.

The tutorial suite completes all six overview steps and four battle steps on both desktop and a 390×844 mobile viewport, verifies persistence, and checks every tip remains inside the viewport. Cultivation and commission views have no horizontal overflow. Native browser decoding also verifies all 54 new portrait/material files from the live port-4173 server, with no shared paths or missing images. Final visual review improved the mobile sanctuary layout, card-level badge contrast, and the Perfected workshop state. The 509-combat legal-resource playthrough passes; pacing assumptions and measured outcomes are recorded in `workshop-balance.md`.

## Limits

These are deterministic rules and workflow checks, not an exhaustive proof of balance across every legal deck. Legal campaign and commission pace measurements belong to `tests/workshop-playthrough.mjs` and the campaign simulation, which use actual card sequences and report their starting progression assumptions. No fight-duration or hours-to-completion claim is inferred from the transaction tests.
