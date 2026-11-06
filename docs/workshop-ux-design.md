# Shop, workshop, decks, and guided introduction

Design specification for the next expansion. This document proposes flows and interfaces; economy and cultivation design own final numerical formulas. The current game has 597 illustrated techniques, twelve types, an illustrated eight-button navigation dock, an 8–22-card active deck, individual ownership counts, family-wide refinement, a modal card inspector, and a two-hero battle board. Retain its jade frames, type emblems, readable effect badges, and direct card interaction.

## Navigation and visual hierarchy

Rename Night Market to **Shop**, Alchemy & Forge to **Workshop**, and Techniques to **Decks** in the dock. Keep the original market and equipment forge reachable as tabs, preserving their actions and item rewards. Three clear destinations answer three questions: Shop obtains resources, Workshop transforms resources, Decks decides what to bring into combat. The Chronicle remains the complete discovery reference.

Each new screen has a single illustrated header, a compact wallet showing jade plus only relevant material currencies, a short tab strip, a search/filter bar, and visual card or material tiles. Prefer icons, owned/required counters, locks, level badges, and explicit primary actions to explanatory paragraphs. On selecting a card, a recipe or transaction panel takes visual priority; the player should never need to infer a recipe from prose.

Use jade for available actions, gold for prices and target outcomes, ice blue for current inventory, and muted violet for locked progression. Retain an accompanying word/icon for every color. Material rarity uses a border and written name; material tier uses `T1`–`T5` or whatever final economy specifies. Card level uses a separate `Lv. N` badge, never rarity-colored stars that could be confused with grade.

## Shop

Tabs: **Cards**, **Materials**, **Goods**, **Sell goods**. Default Cards. Cards lists all 597 techniques, including locked ones, with a default Available filter that can be switched to All. Filters are school, type, rarity, tier/required realm, ownership, affordability, and search; collapse advanced filters on small screens. Paginate 24–28 cards; preserve filters and scroll position after purchasing.

Card tile: existing illustrated jade frame, rarity, type, base Qi, card level currently owned, `Owned N`, required cultivation stage/layer, and price. One primary button reads `Buy · 120 jade` or `Requires Foundation · Layer 3`. If locked, the inspect button still works. Do not silently hide higher cards: inspect shows the exact cultivation target and a **View cultivation** shortcut. Buying one copy is explicit; quantity selection appears in the transaction panel where useful. Show purchase limit or available-copy limit before clicking. Mission rewards remain an independent acquisition route and are not relabeled as shop purchases.

Card purchase panel: target card, intrinsic base rules, owned count before/after, exact jade debit, required progression and current progression, quantity bounded by remaining allowed copies, and one **Buy N copies** button. Bulk purchase repeats no hidden random result. Ordinary single-copy purchases can commit immediately from their clear price button; modal confirmation is unnecessary for every reversible purchase. Always show a receipt toast with remaining jade.

Materials tab uses square illustrated material tiles with names, school/family icon, tier, rarity, owned count, pack quantity, and price. Selecting one reveals its purpose, purchase controls, eligibility, and where it drops. Never reuse the same unexplained gem for every material. Buttons for 1, 5, and 10 units or a bounded number input are easier than ten repeated clicks. A disabled button states the actual reason: insufficient jade, locked tier, full quantity cap, or expedition in progress. Material detail can link to **Used in recipes** with a matching workshop filter.

Goods retains the old catalogue and stall behavior, shown as subfilters rather than displacing the card catalogue. Sell goods retains equipment protection. Do not permit selling workshop currency to create a buy/salvage/sell arbitrage route unless the economy explicitly prices that route.

Empty states are actionable: no affordable cards offers **Clear affordability filter** and **Earn jade**; locked stock offers **View cultivation**; missing materials offers **Shop materials** and the named eligible activity that awards them. There must be a repeatable activity accessible before the player needs repeatable crafting resources. A “grind” loop is actual encounters and transparent rewards, not a free resource button or a real-time wait timer.

## Workshop

Tabs: **Forge cards**, **Upgrade cards**, **Salvage cards**, **Equipment & alchemy**. Show the relevant selected operation persistently. The last tab retains the existing 32 item recipes, all artwork, and their inventory interactions.

On desktop the workshop is a catalogue plus a sticky workbench panel. The catalogue selects a target; the panel contains the full card, recipe slots, output, progression gate, and action. On mobile the selected workbench is a full-width panel above a collapsible catalogue or a modal sheet with a visible Close button. Never require drag-and-drop; click/tap and keyboard are sufficient. Do not render 597 expanded recipe ingredient lists at once.

### Forge

All 597 cards have a deterministic recipe. Forge creates one inventory copy at the family's existing or initial level according to the economy contract. The workbench shows an output card with `+1 copy`, `Owned N → N+1`, base level, and four or fewer ingredient groups where possible. Each ingredient slot shows an illustrated icon, material name, tier/rarity, `owned / required`, and shortage. Jade fees occupy their own final row. Show formula-derived prices as exact integers, not approximate ranges.

Insufficient ingredient slots have a **Buy missing** shortcut which opens the Shop filtered to the exact material. It does not silently buy or spend resources. **Find material** links to an eligible encounter or activity with that drop. The selected target and filters survive this round trip, so the player can return without searching again.

Button labels describe the transaction: **Forge 1 copy**, then show ingredient absorption, a restrained jade flare, and the new card entering the output slot. Follow with **Add to deck** or **Forge another**. Reduced motion uses a static success state. Do not show random rarity reveal animation for a deterministic recipe. Purchases and forging use the same canonical acquisition requirement helper. Already-owned and mission-reward cards remain usable at base without a new carrying restriction.

### Upgrade

Only owned families appear by default, with an All owned toggle if filtering by affordable. Select a card to display **Current Lv. N → Next Lv. N+1** with the actual before/after card values produced by the same resolver as combat. Show changed numbers in gold and unchanged Qi, health payment, delay, aura timing, and exhaustion plainly. Never imply that mastery increases Qi refunds or creates extra action-triggered resource engines. The economy/combat contract determines safe scaling.

The recipe lists exact material costs and required cultivation stage. A compact five- or ten-node level track communicates progress to the cap. Show current upgrade scope explicitly: **Upgrades every owned copy of this technique** if levels remain family-wide. A player should not believe they upgraded a single physical card when the save stores one family level. Existing +1/+2 refinement must migrate visibly into the new system; there should not be two independent paid upgrade buttons for the same effect.

At maximum level, show **Maximum level** and the final resolved values, without a disabled mystery price. If the next level is cultivation-gated, show the precise required realm/layer. If an unowned technique retains a family upgrade record after salvage, communicate that in inspect and forge; otherwise reject any operation that would silently erase paid progress. The final economy must choose one consistent rule.

### Salvage

Show only owned card families and the number safely salvageable. Each tile displays owned count, reserved count, and exact material yield for one copy. Selected workbench shows **Remove 1 copy → receive [material icons/counts]**, remaining ownership, and a quantity bounded by safe surplus. Preserve crafted card-level investment according to the final family-level rule; the preview explains whether an upgrade record remains.

Reserve requirement is the maximum copy count used in any saved deck, including the active deck, not the sum across presets: saved decks reuse the collection. Salvage can never reduce ownership below that maximum. Show **Reserved in Ember Oath, Patient Lotus** with shortcuts to those decklists. Both the active list and inactive saved lists are protected. The last surviving playable deck cannot be destroyed by salvaging its cards.

Do not introduce one-click **Salvage all duplicates** initially; a safe quantity selector is adequate and easier to reason about. Salvage is destructive and merits one confirmation panel for the concrete transaction. Never preselect legendary or last-copy cards. A `Locked / Keep` family toggle is a useful additional guard, persisted as card preferences; reserve validation remains authoritative even if Keep is off. Confirm the current transaction again in the rule layer before any mutation, because UI state may be stale.

## Inventory-based deck workspace

Default screen is a split view: **Owned cards** catalogue and **Deck tray**. Ownership is the source of truth. Catalogue filters include school, twelve types, rarity, Qi, card level, and available copies. Each tile shows `In draft / Owned`; a plus button adds exactly one legal copy. Hover, tap Details, or keyboard opens the same intrinsic/current-level rules used by the workshop. Never consume inventory on adding a card to a deck.

The tray contains the deck name, 8–22 count, compact illustrated rows grouped by Qi or type, copy quantities, school distribution, and a small Qi curve. It includes **Save deck**, **Activate**, **New**, **Duplicate**, **Rename**, and **Delete** in an overflow menu. Highlight the active preset with a jade seal. A school distribution and curve are informative, not opaque “power scores.”

Editing happens in an independent draft. Removing a card can temporarily put the draft below eight without damaging the active playable deck. The editing draft persists across reloads even while incomplete; saving a named preset requires a legal 8–22-card list. Failed saves preserve the draft and explain the blocker. Activation and encounter entry revalidate size and known ownership. An invalid draft never replaces `game.deck`. Editing or switching is disabled during an expedition because the combat deck is already captured.

The active deck is a validated snapshot. Successful activation atomically updates the active preset ID and `game.deck`; begin battle checks it again. Switching saved decks does not double-reserve inventory, duplicate copies, or charge currency. Deleting an inactive preset frees its reserves; deleting the active preset requires another valid deck or leaves the current deck preserved as a default preset. Suggested maximum 12 named presets and 24-character names; escape names in UI.

New games receive a **Wayfarer's Oath** preset cloned from the starter deck. Old saves receive a **Legacy deck** preset cloned from their active deck; migrate without inventing cards. Progression gates regulate purchasing, forging, and upgrades. Cards already owned or earned through missions remain usable at base. UI labels must say **Acquisition requirement**, not **Cannot carry**, so the player can understand why a mission reward works while an additional copy is unavailable in the shop.

## First-run guided introduction

Use a small guided overlay with a highlighted actual control, a concise title and one or two sentences, **Next**, **Back**, and **Skip tutorial**. It runs after swearing the oath and only once per fresh chronicle. Existing saves default to completed, with **Replay tutorial** in the Field Guide or Settings. Persist progress after every step and never trigger on every reload.

Suggested six sanctuary steps:

1. Cultivator plaque: realm/layer and progress, explicit breakthrough when the stage is complete.
2. Expeditions button: mission rewards include cards and cultivation resources.
3. Decks dock: owned copies become a named battle deck.
4. Shop dock: cards and materials unlock through cultivation.
5. Workshop dock: forge, upgrade, salvage, with previews before spending.
6. Continue journey: start the first expedition when ready.

The first actual combat has a separate four-step introduction highlighting a hand card, Qi gems, enemy intent, and End turn. It explains drag-to-hero and click-card/target alternatives. It does not auto-cast cards, consume supplies, spend jade, salvage cards, start combat without user action, or pretend demo resources are real inventory. The player can skip at any time and still use the game normally.

The overlay identifies targets through stable `data-tutorial` attributes. Recompute target rectangles on resize, scroll, render, and dialog changes. If a target is missing, advance to a safe explanatory step or return to the sanctuary, never trap the user behind an invisible overlay. Keep highlighted controls reachable if the step expects interaction. Do not use a full-screen pointer blocker over the target. Keyboard focus remains inside tutorial controls when instructional, Escape skips or closes, and status announcements report the step. Prefer a CSS outline/backdrop and short fade; honor reduced motion. At 390px place the tutorial card at the bottom with a max-height and close control; avoid covering the selected dock target or End turn.

## Proposed state and rule interfaces

These names are a coordination contract proposal, not an instruction to duplicate modules already designed elsewhere.

| Layer | Proposed data / API | Invariant |
| --- | --- | --- |
| Economy definitions | `materialById`, `recipeFor(cardId)`, `cardPurchaseQuote(game,id,quantity)`, `forgeQuote`, `upgradeQuote`, `salvageQuote` | Quotes return exact costs, output, and an array of eligibility blockers; never mutate. |
| Economy commands | `buyCard`, `buyMaterial`, `forgeCard`, `upgradeCard`, `salvageCard` | Recheck complete quote atomically, reject without any mutation, and block during expeditions. |
| Inventory | Existing `known`; new material count map; canonical card family level map | No unexplained second ownership inventory; mission rewards still grant into `known`. |
| Saved decks | `decks:[{id,name,cards,created}]`, `activeDeckId`; existing `deck` snapshot | Saved lists are bounded and use supported IDs; actual ownership checked at activation. |
| Deck rules | `validateDeck(game,cards)`, `saveDeck`, `activateDeck`, `deleteDeck`, `reservedCopies(game,id)` | No UI-only protection; same validation at activation and battle entry. |
| User preferences | Optional `cardLocks:{id:true}` | Never overrides hard saved-deck reserve protection. |
| Tutorial | `tutorial:{version:1,sanctuaryStep,battleStep,skipped}` | Bounded integers/enums, migrated defaults, persisted progress. |
| View-only state | `ui.shopTab`, filters/page, `ui.workshopMode`, selected card/material, quantity, `ui.deckDraft`, dirty flag | Navigation preserves selected target for Shop → Workshop round trip without persisting DOM state. |

Keep quotes independent of DOM so unit tests and all screens share the same answer. A card inspector routes to the relevant Shop or Workshop target rather than retaining a legacy cheap Learn/Refine path that bypasses the new grind economy. Clear disabled reasons come from quote blockers, not duplicated ad hoc conditions in templates.

## Acceptance checklist

- All 597 cards are visible in Shop/Forge and have an inspectable exact recipe; high-level gates state required and current progression.
- Buy/forge/upgrade/salvage previews match committed inventory, jade, and resolved combat values exactly. Rejects mutate nothing.
- Recipe materials show individual icons, names, tier, rarity, current counts, shortage, and an actionable source.
- Salvage cannot break active or inactive saved decks, including duplicate counts, nor protected card families. Stale quantities are revalidated.
- Drafting fewer than eight is possible; activating fewer than eight is impossible. Failed activation leaves the original active deck unchanged.
- Switching decks reuses owned copies without consuming them. Legacy active lists and in-progress battles restore safely.
- First-run and first-battle tutorials can complete, skip, persist, replay, and adapt at 390px without blocking normal gameplay.
- Keyboard navigation, focus restoration, modal close, accessible names, reduced motion, and 390px overflow checks cover every new screen.
- Final browser QA tests real UI flows for one purchase, material purchase, forge, upgrade, protected salvage rejection, successful surplus salvage, named-deck activation/reload, and tutorial progression/reload.
