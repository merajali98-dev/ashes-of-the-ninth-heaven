# Ashes of the Ninth Heaven

A single-player xianxia deckbuilding RPG. The Ninth Heaven fell, but its collectors still charge the dead for tomorrow. Follow an empty warrant through seven regions and decide what should replace the heavenly ledger.

## Play locally

On Windows, double-click `Play.cmd` to start the server and open the game. The launcher checks for Node.js in your PATH and in the Codex runtime.

On any platform, run `node server.js` from this directory with Node.js 22 or newer. Open [the local game](http://127.0.0.1:4173) in a browser. The game has no package installation step. Keep the terminal running while you play.

Choose **Begin your journey** and swear the oath. **Wayfarer** is the standard campaign. **Tribulation** strengthens enemies and gives phased opponents a protected transition before their next action.

Progress saves automatically in the current browser and includes battles in progress. Use **Settings** to download or load a save file. Browser storage is tied to the exact game address, so use the same host and port when returning.

## The game

- Seven campaign chapters, 49 expeditions, 35 opponents, and three endings. Story decisions award different techniques, items, and sect standing.
- 597 techniques across seven elemental schools and Common Form, including 480 Forbidden Lineages techniques. Twelve card types cover strikes, wards, mantras, remedies, hexes, formations, stances, counters, pacts, rituals, transmutations, and finishers.
- Same-school chains build Resonance. Conditional techniques, sustained formations, delayed rituals, life payments, and exhausted-card recovery add choices around Qi, enemy intent, Guard, and status effects.
- 231 equipment, supply, and crafting items, plus 45 illustrated card materials across five grades. All 597 techniques have exact forging recipes; the Workshop also retains 32 equipment and alchemy recipes.
- Buy unlocked cards and materials in the Shop. Forge copies, upgrade techniques through five shared card levels, or salvage spare copies for a quarter of their base materials. Active, saved, and draft decks protect their reserved copies.
- Save up to eight named decks and edit an independent draft from owned cards. Save an 8–22-card list, then activate it for battle. New saved lists allow up to four copies per technique.
- Ten cultivation realms with nine layers each: 90 cultivation levels, nine evolving breakthrough portraits, seven sects, 48 named characters, and the repeatable Endless Pagoda. Lifetime essence advances layers; guaranteed breakthroughs cost jade.
- Target a school and material grade in repeatable combat commissions for guaranteed jade, cultivation essence, Seal Jade, and school essence. These supply the long-term crafting and cultivation grind.
- Two heroes face each other on a single board. Drag a card onto its target hero, or select a card and tap the glowing hero. Press 1–9 to select a card, Enter to cast, Escape to cancel, or E to end the turn.
- All 231 items and 597 techniques have their own illustrations. Rounded jade card frames carry sculpted, contrasting type emblems and distinct rarity treatments.
- Browse the paginated collection and Shop by school, type, rarity, Qi, ownership, availability, and search. Cultivation gates new purchases, forging, and upgrades; all cards unlock for acquisition by level 63. Mission rewards and already-owned cards remain usable.
- A shrine keeper's guided first-run tour highlights cultivation, missions, decks, shopping, crafting, and battle controls. Replay it from Settings.
- Eight spirit species inhabit one living biome map: Azure Dragon, Vermilion Phoenix, White Tiger, Black Tortoise, Nine-Tail Fox, Jade Qilin, Kun Peng, and Thunder Serpent. Unhatched companions remain eggs in their own habitats. The first chosen hatch is free; further hatches require an exact offering.
- Feed spare techniques to cultivate pets through the same ten realms and ninety levels. Feeding destroys the confirmed copies, protects deck reservations, and retains learned card quality. Realm evolution cannot pass your own cultivation. Animated hatching and evolution have Skip, keyboard, and reduced-motion support.
- Select one travelling companion. Its innate arts trigger in battle, and its four unlockable commands each have a two-to-five-turn cooldown. Invoke one command per turn without spending Qi. Eight species provide 32 commands and 24 passives, with three illustrated forms and increasingly elaborate realm halos.
- Each of the twelve card types has a distinct cast sequence, with school-colored trails, rarity accents, impact timing, factual damage/Guard receipts, shield breaks, and pet command effects. Combat input pauses until the presentation finishes; opening menus or loading a save safely cancels it.
- Every actual hero or pet cultivation-layer gain has a level transition, including batched multi-layer gains and final perfection. Hero realm breakthroughs reveal the new armor and halo; pet realms retain their animated evolution ceremony. Reduced motion keeps concise feedback.
- A bundled sound palette provides 60 cues and 64 recordings: twelve distinct card casts, timed impacts, shields, workshop transactions, cultivation ceremonies, and eight spirit voices. Enable **Sound** in the toolbar or Settings, then use **Test sound** and the master, combat, interface, cultivation, and pet sliders. Preferences save with your chronicle; new games start muted.
- Visit **Shop → Celestial Treasury → Explore** for the future wallet store. Eight proposed packs cover Jade and planned cosmetic Star Silk, with exact USD prices, offer reviews, a purchase-history placeholder, and a progression-aware economy guide. Payments and wallet connection remain disabled. No address, signature, approval, transfer, or paid currency is requested or granted.

## Development and QA

Run the regression suite with `node --test`. It covers the combat engine, saves, the expedition dependency graph, choices, item effects, crafting, the market, equipment, learning, and bundled art paths.

Run `npm run test:performance` for desktop/mobile selection benchmarks with 4× CPU slowdown and DOM-preservation checks. Run `npm run test:browser` for the existing browser suites with a managed test server. These require the configured local Playwright and Edge installations. The performance review, implemented plan, measurements and limitations are in [docs/performance-review.md](docs/performance-review.md).

Run `node tests/campaign-playthrough.mjs` to simulate three legal deckbuilding routes through all 49 missions. In PowerShell, set `$env:PLAYTEST_DIFFICULTY = 'tribulation'` to exercise the harder campaign. The simulation chooses actions, acquires gear, refines cards, and resolves the story through the same game rules as the UI.

Run `node tests/expansion-playthrough.mjs` for expansion deck and resource-loop checks. `tests/expansion-browser.mjs` exercises archive filters, learning, saved battles, active effects, and mobile layout against a server on port 4181 using Playwright and Microsoft Edge. Expansion design and validation notes are in `docs/expansion-design.md`, `docs/expansion-qa.md`, and `docs/expansion-balance.md`.

Run `node tests/workshop-playthrough.mjs` for six complete campaign routes, all 80 school/grade/difficulty commission combinations, and an earned-resource crafting/cultivation grind: 509 actual combats. `tests/workshop-browser.mjs` covers Shop, Workshop, and Decks interactions against a server on port 4181. `node tests/tutorial-browser.mjs` starts its own port-4182 server and verifies the guided tour on desktop and mobile. Browser checks require Playwright and Edge at the paths configured in those scripts. Current verification and pacing reports are `docs/workshop-qa.md` and `docs/workshop-balance.md`.

Run `node tests/pet-playthrough.mjs` for 252 legal-action pet and baseline combats, six complete pet campaigns, earned-card feeding, realm evolution, and a paid second hatch. Add `--save-examples` to write earned young/adult/ascended preview chronicles under `tmp/pet-playthrough/`. `tests/pet-browser.mjs` tests hatching cinematics, feeding confirmations, habitat controls, one selected companion, turn cooldowns, saves, mobile layout, and all 33 pet art assets against port 4181. Pet rules, QA, balance limits, and built-in ImageGen artwork prompts are recorded in `docs/pet-design.md`, `docs/pet-qa.md`, `docs/pet-balance.md`, and `docs/pet-art.md`.

`tests/motion.test.js` verifies detached progression snapshots, real level deltas, batching, perfection, and the twelve cast profiles. Run `node tests/motion-browser.mjs` against an isolated port-4181 server for actual casts, impacts, input races, cancellation, loading/reset, cultivation transitions, and mobile/reduced-motion checks. Motion design and validation notes are in `docs/combat-motion.md`, `docs/progression-motion.md`, and `docs/motion-qa.md`.

Content registries live in `js/content/`. The engine and progression modules are independent of the browser. `js/views.js` renders the game screens and `js/app.js` handles input, saves, and navigation.

Sound adds nine engine tests and four save/asset integration tests to the 139-test regression suite. Run `node tests/audio-browser.mjs` against an isolated port-4181 server for native decoding, actual combat cues, mixer controls, cancellation, and output-graph checks. The runtime recordings total 2.13 MiB and play locally without a generation service. Original rendered sound design incorporates CC0 Kenney Foley; licenses, source links, production recipes, and the audition are documented in `docs/audio-assets.md`. Playback behavior is documented in `docs/audio-engine.md`, and browser results in `docs/audio-qa.md`.

The economy and cultivation contracts are in `docs/economy-design.md` and `docs/cultivation-design.md`. Quotes and transactions live in `js/economy.js`; named deck rules live in `js/decks.js`. Existing version-1 chronicles migrate once, retaining ownership, mission rewards, old refinement investments, and in-progress battle snapshots. Cultivation essence is never spent. Card quality persists even after the last unreserved copy is salvaged.

Future payments use the dependency-injected, disabled-by-default adapter in `js/payments.js`. Its tests exercise quote expiry, stable order keys, wallet/network changes, ambiguous transfers, stale callbacks, and verified-order response contracts without a real wallet. This is a frontend integration boundary, not a deployed payment service. Real money requires authenticated accounts, provider/network selection, server verification, a durable settlement ledger, and authoritative economy actions; editable browser chronicles cannot hold trusted paid balances. See `docs/payment-architecture.md`, `docs/monetization-economy.md`, and `docs/commerce-qa.md`.

Run `node scripts/economy-audit.mjs` to check all 597 card acquisition/salvage loops, 32 legacy crafting/resale loops, progression gates, commission payouts, and proposed monetary equivalents. Prices are design proposals rather than live exchange rates; no gameplay costs or mission rewards were changed. `node tests/treasury-browser.mjs` starts its own isolated port-4183 server and verifies store interactions, disabled wallet behavior, unchanged local balances, and mobile layout.
