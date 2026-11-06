# Cultivation progression design

## Player experience

The disciple advances through ten realms, each with nine visible layers. Essence is cultivation experience earned by resolving encounters. A layer advances automatically when its experience threshold is crossed. At the ninth layer the progress bar continues toward a guaranteed, manually initiated breakthrough. The breakthrough consumes jade, changes the portrait and realm presentation, increases maximum vitality, and opens the next band of purchases and recipes. Experience is never spent, lost on defeat, or awarded merely for opening a screen or clicking meditation.

The existing seven-chapter story and its card rewards remain intact. Cultivation outlasts the story: a complete campaign supplies 1,842 base essence before choice rewards, reaching late Void Refinement if breakthroughs are taken. Repeatable combat supplies the later progression and the materials needed for more decks. The player can complete the story before finishing all ninety layers.

## Ten realms

Indices are zero-based in saved data; layers are presented as I–IX. The effective cultivation level is `realm * 9 + layer`, ranging from 1 to 90.

| Index | Realm | Entry essence | Essence to next realm | Vitality bonus | Portrait development |
| ---: | --- | ---: | ---: | ---: | --- |
| 0 | Qi Condensation | 0 | 110 | 0 | Existing Shen Luo: weathered travelling robes, quiet ember of qi. |
| 1 | Foundation Establishment | 110 | 280 | 8 | Structured dark robes, a jade breast clasp, one faint circular aura. |
| 2 | Core Formation | 280 | 520 | 17 | Engraved shoulder armour, luminous golden core, one complete halo. |
| 3 | Nascent Soul | 520 | 850 | 29 | Layered blue-black battle silk, floating soul seal, two delicate rings. |
| 4 | Soul Transformation | 850 | 1,290 | 44 | Obsidian and silver armour, pale violet qi, an awakened soul crown. |
| 5 | Void Refinement | 1,290 | 1,870 | 61 | Armoured celestial mantle, fractured star-ring, indigo spatial light. |
| 6 | Body Integration | 1,870 | 2,640 | 73 | Integrated jade-metal plate, disciplined solar geometry, three rings. |
| 7 | Mahayana | 2,640 | 3,640 | 84 | Imperial cultivation armour, flowing gold mantle, radiant multi-ring wheel. |
| 8 | Tribulation Transcendence | 3,640 | 4,940 | 96 | Storm-tempered armour, suspended lightning seals, elaborate storm halo. |
| 9 | True Immortal | 4,940 | 6,470 perfected | 108 | Refined black-and-gold immortal armour, elaborate ninefold celestial halo. |

All portraits depict the same adult original character, with consistent facial structure and hair. Armour, cloth, halo and lighting evolve while the face stays recognisable. Use the existing portrait as the visual identity reference. The sanctuary portrait, battle hero, profile and breakthrough presentation must resolve the same realm-specific asset. The avatar is a reward for the breakthrough, not for each individual layer; subtle progress-ring changes convey layers.

## Layer thresholds and progress

For realm `r`, let `start = REALMS[r].essence` and `end = REALMS[r+1]?.essence ?? 6470`. Threshold for layer `l` is:

`start + ceil((end - start) * (l - 1) / 9)`

The next threshold is `start + ceil((end - start) * l / 9)`. Determine the highest qualifying layer from I–IX; cap the result at IX until the player performs a breakthrough. A player with banked essence may enter a later layer immediately after a breakthrough. Every layer has a visible integer threshold and a non-zero interval. For IX, the next threshold is the breakthrough requirement. For True Immortal IX, the final threshold produces “Perfected” instead of another realm.

`maxHp = 54 + REALMS[realm].hp + equipment vitality`. Layers do not add Strength, Focus, Qi or draw. This preserves the tactical combat economy and prevents ninety levels from multiplying every card effect. The ten realm vitality bonuses retain the old curve closely: old Void Return remains approximately the same strength as new Void Refinement; old Heaven Ascension maps to Mahayana with 84 rather than 83 bonus vitality.

## Breakthrough costs and rules

Jade costs for entering realms 1–9 are `[30,55,90,140,210,300,420,580,780]`. They are deliberately meaningful beside equipment and technique purchases. Breakthrough is available only after the oath, outside any encounter, with the full next-realm essence threshold and sufficient jade. It is guaranteed; no random failure, destructive downgrade, real-time timer, or vitality lottery.

The operation validates every requirement before mutation, subtracts jade exactly once, increments the realm exactly once, restores vitality to the new maximum, and records the realm transition. The experience counter is not subtracted. Repeated clicks are evaluated against the newly reached realm. The same entry points enforce requirements for keyboard or programmatic actions. The first failed requirement is shown beside the disabled button. The UI displays both the full price and any jade shortage, and previews the next portrait and vitality increase.

## Gates shared with shop and workshop

The economy module owns the card-specific gate formula and starter exceptions. The cultivation module supplies a stable 1–90 level. Recommended acquisition bands are common levels 1–9, uncommon 10–27, rare 28–45, legendary 46–63, so all card purchases become available by Body Integration IX. The gate applies to shop and forge acquisition. Mission rewards and already owned cards remain usable; earning a rare technique through a story choice is a legitimate alternate acquisition route. The UI states “Purchase requirement” rather than implying an already owned card will be revoked. Existing equipped decks are protected during migration as described below.

Five raw-material potency tiers unlock at realms `[0,1,3,4,6]`, effective levels `[1,10,28,37,55]`. The highest tier is available in Body Integration, leaving later cultivation to improve access to expensive card upgrade levels and repeatable challenges rather than withholding entire card types until the final realm. Material potency tier and material rarity are separate fields. Tier unlocks are derived from the current realm, never guessed from the largest item in the bag.

## Repeatable earning and pacing

The current pagoda rewards only first records, so it cannot be the sole long-term source. Add an explicitly repeatable combat activity with a chosen lineage and challenge rank. It grants deterministic jade, cultivation essence and forging materials only after a victory is resolved. Completed missions retain their one-time story/card rewards; repeatable activities never re-run story choices or duplicate those rewards. Withdrawals and defeats give no materials or experience.

The approved five-tier repeatable combat pays `6 + 3*t` essence, where `t` is material tier 1–5: 9/12/15/18/21 essence. It also supplies the economy module's jade and material payout. A player can farm a lower tier for a targeted lineage but receives lower material potency and lower rewards than a current-tier fight. Early stages require a handful of victories; later stages require multiple sessions. From a full story's roughly 1,900 essence to entering True Immortal at 4,940 is roughly 150–200 additional suitable victories, depending on chosen tier and pagoda first-clear rewards. Perfecting the last realm is a further long-term goal. There is no energy timer; the cost is winning battles, not waiting.

This is a pacing target rather than a claim that a fixed weak enemy remains challenging at every rank. Combat QA should simulate representative cards and equipment at early, middle and final challenge ranks, adjust the enemy scale and payout together, and verify that victories cannot be claimed twice.

## Save migration

Introduce a cultivation schema marker independent of the old save's top-level version. Existing saves without the marker map old realm indices `[0,1,2,3,4,5,6]` to `[0,1,2,3,4,5,7]`. Names with no exact modern match retain their attained power: Spirit Severing becomes Soul Transformation, Void Return becomes Void Refinement, and Heaven Ascension becomes Mahayana.

Set essence to at least the mapped realm's entry threshold. Do not remove cards, dissolve decks, charge jade, or automatically upgrade cards. Apply this conversion exactly once. All known cards, original mission completions, equipment, card upgrades and jade remain intact. Acquisition-only card gates preserve existing deck legality. An active battle keeps its existing combat snapshot and portrait may update immediately; combat statistics are not rebuilt mid-battle. New encounters use the migrated realm's statistics.

Validate original realm indices before migration, so malformed old data cannot be made valid merely by clamping to the nearest realm. For current saves require an integer realm in 0–9, non-negative safe-integer essence, and an explicit supported schema marker. Derive layers and effective level instead of storing redundant mutable counters. A fresh save starts realm 0 at essence 0, layer I, level 1.

## Isolated implementation API

`js/cultivation.js` should be independent of the DOM, progression module and item registry, to avoid circular imports.

- `REALMS`: ten realm entries with `id`, `name`, `essence`, `jade`, `hp`, `avatar`, `description`.
- `cultivationStatus(game)`: realm, layer, effective level, current and next essence threshold, progress fraction, breakthrough-ready experience, perfected flag, and current/next realm data.
- `cultivationLevel(game)`: derived effective level 1–90.
- `materialTier(game)`: available potency tier 1–5.
- `realmAvatar(game)`: the current realm's local portrait path.
- `breakthroughRequirement(game)`: explanatory string or empty string when eligible, including started/encounter/realm/essence/jade conditions.
- `advanceCultivation(game)`: atomic pure-domain mutation returning the existing `{ok,reason/message}` action shape, incrementing realm and deducting jade. The progression wrapper handles journal and vitality because it owns equipment bonuses.
- `migrateCultivation(game)`: non-mutating shallow clone with one-time legacy mapping and supported `cultivationVersion:1` marker; progression invokes it after legacy structural validation and before current validation. Unsupported versions or invalid cultivation data throw, allowing the save reader to reject the import.

Root owns `progression.js` integration, reward transactions, acquisition gates and battle snapshots. `js/cultivation.js` is implemented with nine passing tests in `tests/cultivation.test.js`. They cover all ninety distinct layer thresholds, every integer experience value through each realm, banked experience, all nine transitions, final perfection, rejection of unavailable breakthroughs without mutation, monotonic material gates, malformed data, and migration exactly once. Integration tests should additionally cover full save round trips, old active battles and rewards being claimable only once.
