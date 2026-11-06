# The Spirit Exchange and Thousand-Seal Workshop

The market that sets merchant prices is specified in [game-loop.md](game-loop.md) and implemented in `js/market/`. The earned-resource rules below remain in force.

This is the design contract for the requested economy expansion. It replaces cheap archive learning with a progression-gated exchange for all 597 techniques, adds deterministic card recipes and material tempering, and preserves the existing mission rewards, equipment crafting, and usable owned cards. The intended collection loop is choose a technique, see its exact cost and cultivation requirement, pursue a suitable material commission, then buy or forge the desired card. There are no random crafting failures, real-money currencies, energy timers, or randomly rolled card stats.

## Reference systems and adaptations

Blizzard's [original Hearthstone crafting explanation](https://hearthstone.blizzard.com/en-gb/news/10245930/hearthstone-crafting-in-dust-we-trust-20-06-2013/) describes converting unwanted cards into a universal resource and choosing a specific card to create. We adopt that deterministic destination and visible dismantling value. Our additional school essences provide targeted gathering choices appropriate to a cultivation RPG; players do not need a lucky pack opening.

CD Projekt RED's [2019 GWENT economy explanation](https://www.playgwent.com/en/news/25048/updated-changes-to-gwents-economy-and-full-mill-value-refund-policy) distinguishes gameplay crafting resources from cosmetic upgrades and describes problems caused by mixing those economies. We keep cultivation portraits cosmetic and free on breakthrough; spending card materials never becomes necessary to obtain the new avatar.

Wizards' [MTG Arena reward information](https://magic.wizards.com/en/mtgarena/drop-rates) makes rarity and reward distribution explicit. We adopt that transparency: every recipe and guaranteed commission payout is inspectable before payment or combat. These are design adaptations, not claims about the latest balance values of those games.

## Forty-five material entries

Create five quality tiers of nine material families: **Seal Jade** plus eight school essences. Seal Jade is the common structure; the school essence is the technique's lineage. This yields 45 small, recognizable inventory entries instead of hundreds of unrelated reagents.

| Family | School | Visual and mechanical association |
| --- | --- | --- |
| Seal Jade | Universal | Carved jade blank; binds every card and upgrade. |
| Oathsteel Essence | Iron | Silver filings and a scarlet seal; Guard and disciplined strikes. |
| Cinder Essence | Ember | Orange furnace crystal; existing Burn and vitality pacts. |
| Frosttide Essence | Tide | Cyan salt crystal; tide, poison, recovery, and cold-water imagery. |
| Umbral Essence | Shade | Violet smoke pearl; Bleed, Weak, and Vulnerable. |
| Verdant Essence | Lotus | Green lotus seed; healing, cleansing, and protective arts. |
| Storm Essence | Thunder | Cobalt lightning shard; precision and momentum. |
| Astral Essence | Star | Gold star fragment; draw planning and delayed decrees. |
| Mortal Essence | Neutral | Warm amber ash; reliable Common Form techniques. |

Frosttide is a material identity, not an unimplemented Freeze effect. School material requirements express the card's authored effects; spending a different essence does not silently add Burn or change its school. Additional elemental infusions would require explicit card text, a supported status, enemy behavior, and separate balance QA before becoming a real feature.

| Tier | Grade | Required cultivation level | Seal Jade unit price | Essence unit price |
| ---: | --- | ---: | ---: | ---: |
| 1 | Mortal / common | 1 | 1 | 2 |
| 2 | Spirit / uncommon | 10 | 2 | 3 |
| 3 | Earth / rare | 28 | 3 | 5 |
| 4 | Heaven / rare | 37 | 5 | 8 |
| 5 | Immortal / legendary | 55 | 8 | 12 |

Each entry has a stable ID, family, school (or null), tier, rarity, level requirement, icon treatment, source description, and unit price. IDs should be deterministic, such as `seal-jade-3` and `essence-ember-3`. Tier is shown on the icon as well as in text. Store these quantities in `game.materials`, separate from the existing equipment/alchemy `bag`.

## A formula for every technique

Let `r` be rarity index 0–3 (common, uncommon, rare, legendary), and `h = stableHash(card.id)`. All starter techniques have acquisition level 1. Every other card receives a deterministic recipe and gate:

| Rarity | Recipe material tier | Cultivation level band | Seal Jade | School essence | Base service jade |
| --- | --- | --- | ---: | ---: | ---: |
| Common | 1 | 1–9 | 10 | 6 | 8 |
| Uncommon | 2 | 10–27 | 22 | 14 | 20 |
| Rare | `3 + h % 2` | 28–45 | 48 | 32 | 50 |
| Legendary | `4 + h % 2` | 46–63 | 100 | 72 | 140 |

`requiredLevel = max(rarityBandStart + h % rarityBandWidth, materialTierLevel)`. Band widths are 9, 18, 18, 18. Material grades are therefore available by the card's acquisition level. All cards become purchasable and forgeable by level 63; final cultivation is an additional long-term goal rather than a permanent card lock.

Recipe service fee is `ceil(baseServiceJade * (1 + 0.10 * (tier - 1)))`. Required materials are the listed Seal Jade and that card's school essence at the recipe tier. Optional presentation may describe the existing card type's forging action, such as inscribing a Hex or sealing a Formation, without introducing extra mechanical ingredients.

Direct card price is `ceil((sum(requiredMaterialQuantity * materialUnitPrice) + serviceFee) * 1.35 / 5) * 5`. This derives price from the actual formula, so buying all reagents and forging is consistently cheaper than purchasing the finished card. Typical prices: common 45 jade, uncommon 150, rare approximately 495–760, legendary approximately 1,700–2,515. Exact integers come from the formula, not manually maintained copies of a price table.

Owned mission rewards remain usable even if their purchase gate is higher than current cultivation. Gate **new purchases, forging, and tempering**, not existing ownership or deck activation. All 597 cards are listed in the Exchange with locked rows showing their requirements. Purchased and forged copies use the existing `known[id]` count. Four owned copies stops additional purchases/forging; mission rewards continue to grant their original quantities even above four.

The old `learn` API and every archive Learn button must route to this same gated purchase action. Old manuals require the same acquisition gate when bought, and their shop price must be no cheaper than the linked card. Studying an already-owned mission/legacy manual remains a reward. This closes the 2-jade archive and discounted-manual bypasses without deleting earned content.

## Five card levels, bounded power

Technique quality is shared across owned copies. `game.cardLevels[id]` is an integer 1–5, absent meaning 1. Do not create individually rolled copies: existing decks and the 597-card registry use technique IDs, and quality sharing keeps collection management intuitive.

| Card level | Name | Core mastery | Additional tempering Guard per play | Minimum cultivation level |
| ---: | --- | ---: | ---: | ---: |
| 1 | Inscribed | 0 | 0 | Card's acquisition level for new acquisitions |
| 2 | Honed | 0 | 1 | 10 |
| 3 | Tempered | 1 | 1 | 28 |
| 4 | Refined | 1 | 2 | 37 |
| 5 | Perfected | 2 | 2 | 55 |

Use `coreMastery = floor((cardLevel - 1) / 2)` and `temperingGuard = floor(cardLevel / 2)`. This makes every paid step useful and monotonic, including cards whose single-point status effects cannot be divided into half a mastery rank. The maximum adds only two Guard over the previous +2 design; it does not create unlimited stat scaling. Guard from tempering is an explicit benefit of the played card and is included in tooltips, previews, combat feedback, save-resolved definitions, and targeting/stance analysis.

Keep the old bounded mastery budget: core mastery remains capped at the existing +2. Intermediate tempering never increases Qi, card draw, recovery, aura duration, trigger frequency, or nested conditional/aura/ritual payouts. Existing resource behavior at core ranks 0/1/2 is retained for compatibility, with no additional resource scaling beyond that prior cap. Pure-Qi cards still gain the existing mastery Guard benefit and the displayed tempering Guard. The recovery and free-card safeguards remain necessary, and adversarial loops must be retested at level five. The live combat resolver and UI preview must use one canonical level resolver.

To upgrade from level `L-1` to `L` (2–5), use the card's base recipe quantities multiplied by `[0.50, 0.85, 1.30, 2.00]`, each quantity rounded up. Upgrade material tier is `max(baseRecipeTier, L)`, capped at five. Upgrade jade fee is `ceil(baseServiceFee * multiplier)`; required cultivation is `max(cardAcquisitionLevel, [10,28,37,55][L-2])`. No duplicate card is consumed. There is no downgrade or failure roll. Show exact before/after rules, required ingredients, owned quantities, and the resulting level before confirmation.

## Dismantling without profitable cycles

Salvaging one copy returns `floor(baseRecipeSealJade * 0.25)` and `floor(baseRecipeEssence * 0.25)` at its **base recipe tier**, at least one of each. It returns no jade and no tempering investment. A purchase → salvage or forge → salvage cycle therefore always loses resources. The per-technique level remains learned even if its last copy is dismantled; re-acquiring the technique restores that quality. This prevents accidental loss of a long investment while avoiding refunds that could be multiplied across shared copies.

Protect copies reserved in decks. For a technique, reserved quantity is the **maximum** number used by the active deck or any saved named deck, rather than the sum across mutually exclusive decks. A salvage action requires `known[id] - quantity >= reserved`. It is unavailable during an encounter. UI shows available duplicates, protected copies, selected quantity, and exact yield. Do not auto-remove cards from decks to make salvage succeed. Dismantling one duplicate can be immediate after the visible preview; batch or last-copy dismantling needs an in-game confirmation with the named cards and quantities, not a generic browser confirm.

## Repeatable acquisition and grind targets

The current Pagoda gives jade and essence only on first clears, so it cannot alone support the requested sustainable material grind. Add material commissions under the Workshop's Gather tab or Exchange's source links. A player chooses a school and unlocked tier, sees a named opponent and exact guaranteed payout, and fights through the existing two-hero combat engine. The active encounter must have a validated saved context, and rewards are granted once on resolution. No material comes from simply opening or abandoning a commission.

For tier `t` 1–5, a successful commission grants `6 + 2*t` Seal Jade, `3 + floor(t/2)` chosen-school essence at tier `t`, `8 + 5*t` jade, and `6 + 3*t` cultivation essence. The encounter tier is determined by the selected grade, not a low-grade enemy wearing a high-grade reward label. Rewards are repeatable and guaranteed. Defeat/retreat grants no rewards. School targeting eliminates an eight-way RNG bottleneck.

A common recipe takes roughly two relevant victories for materials. A tier-4 legendary requires about fifteen victories for its essence, while the same rewards also cover its jade service fee; a tier-5 legendary likewise requires about fifteen. Buying those finished legendary cards instead takes roughly 50–75 suitable victories without other income. Material upgrading is a deliberate longer sink, not required to finish the story. Original campaign card, jade, and essence reward values remain intact. First-time campaign clears can additionally grant a small school/material parcel; they must not replace their existing technique reward.

Targeted commissions at 9–21 cultivation essence per win also give a bounded repeatable route toward the ten-realm progression. This is a starting tuning target, not proof of a particular hours-to-completion figure; root's playthrough QA must measure actual legal decks, fight lengths, purchased equipment, and realm availability before release. Never make all schools require different unique boss drops; every card must retain a finite, visible acquisition path.

## Shop and Workshop interaction

**Exchange:** three clear tabs, Techniques / Raw Materials / Existing Wares. Techniques use card thumbnails, name, type, rarity, Lv1 rules, required cultivation, owned copies, and jade price. Shared school/type/rarity/level filters, search, paginated grids, and an Unlocked toggle keep all 597 usable. Selecting an offer opens a detail panel with Buy and Forge instead actions. Material quantities have +/−, fixed quantity shortcuts, total price, and affordability; all transactions revalidate quantity and balance in the model. Existing equipment/alchemy wares retain their functions.

**Workshop:** Forge / Temper / Dismantle / Gather, with existing equipment crafting in a separate Alchemy & Gear tab. Selecting a card opens one persistent workbench detail panel: a large card, its actual level, recipe slots with ingredient artwork and owned/required counts, missing-material source links, exact jade fee, and one primary action. Temper shows before and after effects. Dismantle shows protected/available counts and yield. Gather shows the full guaranteed commission reward. Resource errors should name the missing amount rather than say only that crafting failed. Disabled actions retain an adjacent explanation.

**Deckbuilding:** named deck loadouts contain only owned card IDs. Support create, rename, duplicate, delete, save, and activate. Keep the existing 8–22 card size and four-copy purchase convention. Draft edits may be incomplete; saving an invalid draft should preserve it with errors, while activation requires a legal owned list. Activating is atomic and forbidden in encounters. An active deck cannot be deleted. Equipped technique quality is shared, so switching decks neither consumes nor clones cards. Salvage protection must inspect saved lists as well as the current deck. Root's deck UI agent owns exact schema and interaction details.

## Module boundaries and save migration

Implement `js/economy.js` as a pure transaction module importing content and a cultivation-independent helper only; it must not import `progression.js`, avoiding a circular dependency. Suggested exports:

```js
materials; materialById; MATERIAL_TIERS;
cardRequirement(card); materialRequirement(material);
forgeRecipe(card); upgradeRecipe(card, targetLevel); salvageYield(card);
cardPrice(card); materialPrice(material);
quotePurchase(game, cardId, context); quoteForge(game, cardId, context);
quoteUpgrade(game, cardId, context); quoteSalvage(game, cardId, quantity, context);
buyCard(game, cardId, context); buyMaterial(game, materialId, quantity, context);
forgeCard(game, cardId, context); upgradeCard(game, cardId, context);
salvageCard(game, cardId, quantity, context);
```

`context` supplies canonical cultivation level and deck-reserved counts, avoiding economy-to-progression imports. Every quote returns `{ok, reason, jade, materials, requiredLevel, result}`. Mutations recompute the quote, reject invalid IDs/noninteger quantities/insufficient balances/active encounters before spending, then update atomically. The UI cannot authorize its own cached quote. Re-export wrapper APIs through progression for the app. Use safe nonnegative integer quantities, no undefined material values, and no partially applied transactions.

Migrate saves before validating their new optional fields: absent `materials` becomes `{}`; old `upgrades[id]` 0/1/2 maps to `cardLevels[id]` 1/3/5. Preserve original known counts, active deck, mission completion, bags, currency, and active combat. Existing battles retain their stored resolved card definitions until conclusion, so migration does not change a halfway-played battle. New encounters resolve the new card level. Keep legacy `upgrades` as a derived compatibility view only if existing callers/tests require it; do not permit two independent upgrade sources.

## Required validation

Enumerate all 597 recipes and check valid IDs, allowed tiers, positive safe-integer costs, deterministic gates, finite source paths, and affordable material alternatives relative to direct purchases. Sweep forge/salvage, buy/salvage, manual purchase/study/salvage, material purchase/resale, and all card-level paths for arbitrage. Reject quantities 0, negatives, fractions, infinity, and overflow. Failures must leave a deep-equal state. Verify every new level has a real, monotonic combat change and the maximum stays within the stated power budget.

Run actual encounter-save restoration for commissions, one-time payout checks, defeat/retreat cases, and legacy saves at all old upgrade ranks. Test all named-deck reservation cases and atomic activation. Browser QA must cover full exchange filtering, quantity purchase, a successful forge, insufficient ingredients, all four upgrades, protected salvage, commission payout, direct-shop parity, old manual parity, and narrow-screen recipe panels. Balance reports should state measured fight counts and remaining uncertainty rather than claim exhaustive balance across every possible deck.
