# Spirit companion balance playthrough

Run `node tests/pet-playthrough.mjs`, optionally with `--save-examples` to write earned preview saves under `tmp/pet-playthrough`. The suite resolves **252 real combats** using ordinary public player actions. Pet realms, feeding XP, cards, jade and victories are never injected. It uses a bounded tactical search that can sequence a pet command before or after cards and evaluates the displayed enemy action. Forecast copies include the pet's cooldown state; every starter case checks that planning leaves the live battle untouched.

## First hatch and starter battles

Every one of the eight species was selected as the free first hatch, equipped, and used against its school's tier-one commission on Wayfarer and Tribulation. The character had its unmodified starter deck, no equipment and only the actual starting supplies. A matched no-pet state used the same seed and encounter. All sixteen pet encounters and all sixteen baseline encounters won.

| Species | Wayfarer rounds, without → with | Tribulation rounds, without → with |
| --- | ---: | ---: |
| Azure Dragon | 6 → 3 | 22 → 19 |
| Vermilion Phoenix | 2 → 1 | 3 → 2 |
| White Tiger | 3 → 3 | 5 → 3 |
| Black Tortoise | 2 → 2 | 3 → 2 |
| Nine-Tail Fox | 3 → 3 | 5 → 4 |
| Jade Qilin | 2 → 2 | 3 → 2 |
| Kun Peng | 4 → 4 | 6 → 4 |
| Thunder Serpent | 2 → 1 | 3 → 2 |

Each case executes the first unlocked command and verifies that it consumes neither Qi nor a hand card, then lets the tactical player continue. These are different school opponents, so this table is not a species power ranking. The short-horizon search can take different phase-transition lines: for example the Dragon's Tribulation fight finished sooner but with 37% vitality instead of the baseline's 44%. This is not evidence that adding a pet is intrinsically harmful or that a human player cannot find a better line.

## Real feeding through six full campaigns

Three teacher routes each completed all 49 missions and 35 battles on both difficulties: Iron with White Tiger, Ember with Vermilion Phoenix, and Lotus with Jade Qilin. Feeding occurred after each legal deck preparation, using only `quoteFeed.available`; every reserved copy in the active deck, saved decks and draft remained protected.

The test deliberately consumes **all unreserved cards**, including unique unwanted cards and two or three legendaries. It is a sacrifice-based growth route, not a promise that a collector can keep the full library and achieve the same progression for free.

| Route / pet | Common copies fed | Uncommon | Rare | Legendary | Pet XP after story | Jade after story |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Iron / White Tiger | 90 | 45 | 28 | 3 | 3,580 | 504 |
| Ember / Vermilion Phoenix | 91 | 45 | 28 | 2 | 3,448 | 555 |
| Lotus / Jade Qilin | 89 | 45 | 29 | 3 | 3,627 | 424 |

Each route fed 166 genuinely owned card copies. Those feeding and financial outcomes are the same across the two difficulties. The pets reached Foundation after the second chapter, Core Formation after the third, adult Nascent Soul during Lotus Vault, Soul Transformation during Thunder Span and Void Refinement during Last Observatory. Five evolutions cost a total of 263 jade. Growth remained capped by the hero's actual realm even when pet XP was already sufficient for another evolution.

For the Iron route, the final earned 504 jade funded the hero's 300-jade Body Integration breakthrough and the pet's 150-jade evolution. This produced an **ascended realm-six White Tiger**, with all four commands unlocked, 3,580 XP, and 54 jade remaining. It subsequently won real tier-five commissions using that existing campaign deck.

## Paid second hatch and purchased food

Starting from that earned ascended state, nine tier-five commissions supplied enough additional jade to hatch a second Azure Dragon, buy its missing tier-one hatching materials, and purchase a 45-jade common technique as food. The hatch charged the actual 250 jade, twelve Seal Jade and eight Astral Essence. Feeding the purchased card destroyed the unreserved copy and added exactly eight XP. The second pet was equipped and used in another real tier-one victory; the late-game deck killed that foe without needing a pet command. The earlier starter case already exercised that species' command.

The final record saved and resumed normally. Generated preview examples are:

- `tmp/pet-playthrough/earned-white-tiger-young.json`: first free hatch and equipment selection.
- `tmp/pet-playthrough/earned-white-tiger-adult.json`: real chapter-four feeding/evolution checkpoint.
- `tmp/pet-playthrough/earned-white-tiger-ascended.json`: real post-story hero and pet breakthroughs.

## Endgame XP projection, not an executed max-pet grind

A fresh pet requires 6,470 XP to perfect the final layer: 809 common cards at eight XP each, or 47 legendary cards at 140 XP each, ignoring mixed feeding. The tested White Tiger still needed 2,890 XP after its story sacrifices, equivalent to 362 additional common copies.

At the tested common formula's prices, buying those 362 cards directly costs 16,290 jade. Forging them with entirely purchased materials costs 10,860 jade. These figures exclude later pet evolution fees, account for rounding to whole copies, and are projections; the suite does not claim to have acquired and fed those hundreds of cards. Already-earned materials or additional unwanted story cards can change the cost. The four-copy ownership limit also means a buyer must feed between batches.

This makes final pet perfection a longer collection sink than the separately tested 217-win hero-cultivation route when no further free cards are consumed. Adult and ascended forms, however, are demonstrably reachable through the story and ordinary early post-story expenses.

## Resolved balance observation and limitations

The initial Jade Qilin opening passive only healed. Free sanctuary rest made it inactive whenever the player began at full vitality. The final passive adds one non-scaling Guard alongside its existing heal, preserving a small benefit for rested players. The complete pet suite was rerun after that change and passed; the starter Qilin Tribulation case ended at 98% vitality.

No broader tuning was required for these routes. The suite is not exhaustive deck-balance proof and does not measure human enjoyment of a long feeding grind. The separate low-level pet QA covers all commands and realm combinations; this suite concentrates on legally earned progression and intentional combat choices. The existing **509-combat workshop progression suite also still passes** with no pets equipped, confirming the shared planner additions did not disturb those baseline routes.
