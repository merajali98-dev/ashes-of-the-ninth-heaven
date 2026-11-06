# Effects and progression motion QA

Run `node --test` for the full regression suite. The motion-specific pure checks are `tests/motion.test.js`. Run `node tests/motion-browser.mjs` against an isolated local server on port 4181 for the Edge workflow checks. The browser script uses its own storage context and does not alter the player's port-4173 chronicle.

## Pure and engine-adjacent checks

Eight motion tests verify coverage of all twelve card categories, distinct effect geometry identifiers, bounded cast/release durations, detached presentation snapshots, and exact progression deltas. A first capture, reloaded state, newly hatched pet, or within-layer essence gain does not fabricate a level-up. Batched hero and pet advancement becomes one transition with the correct number of gained layers. Actual breakthroughs remain distinct from layers; final perfection can be celebrated once even when the last level was already attained. Presentation helpers remain harmless without a browser and never grant rewards or mutate saves.

The full project suite passes **126 tests**, retaining all combat, economy, pet, save, acquisition, and artwork assertions.

## Browser workflows

Each of the twelve card forms is cast through visible game controls using its authored technique definition. The fixture supplies sufficient Qi and an enduring opponent so the test measures presentation rather than encounter balance. For every cast, the persisted combat must exactly match a single action executed through the combat engine. Each form produces distinct rendered SVG content and a distinct effect shape, then disposes its presentation nodes and releases the input lock.

The workflow suite additionally verifies:

- Click, hotkey, and drag attempts during a running cast cannot commit a second combat action. The same controls work again after completion or cancellation.
- Fully absorbed attacks show the actual absorbed amount, multi-hit receipts report the real aggregate loss and hit count, and a completely depleted shield fractures even when no vitality was lost.
- Companion projectiles originate at the companion. Delayed rituals receive their resolution signature. Boss transitions retain the actual phase-sealed damage result.
- Lethal results wait for the impact presentation. Opening Settings during that sequence cancels effects, reveals the committed outcome, and cannot later dismiss a different dialog. Mid-cast reload, save import, and reset leave no stale effects or input locks.
- Reduced motion retains a compact signature and result receipt rather than suppressing action feedback. Mobile casting produces no horizontal overflow.
- An actual commission reward claim produces a hero layer transition. A confirmed fourteen-card feeding consumes exactly those copies and produces one eight-layer pet transition. A realm evolution displays one pet ceremony rather than two overlapping overlays.
- Character breakthroughs commit their jade cost and realm once. Continue, Escape, and keyboard focus handling restore the background correctly. Reloading never replays an old advancement.
- Final immortal perfection has its own notice. The reduced-motion realm display retains its new portrait and fits a 390 × 844 viewport.

All tested browser flows pass with **zero JavaScript errors and zero HTTP errors**. The visible casts, impact receipts, hero/pet layer notices, character realm ceremony, and mobile reduced-motion ceremony were inspected. Readable mid-transition screenshots are in `tmp/motion-browser/`.

## Practical limits

These checks establish rule/presentation agreement, distinct category effects, cleanup, accessibility behavior, and the exercised interaction races. They do not assert identical frame rates on every device or an exhaustive visual inspection of all 597 individual card illustrations. Existing campaign and pet balance simulations remain separate checks; this overhaul changes presentation rather than battle mathematics.
