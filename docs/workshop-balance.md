# Workshop and cultivation balance playthrough

Run `node tests/workshop-playthrough.mjs`. This is an action-level simulation, not a fixture with granted resources. Every game begins with `freshGame` and `begin`; missions, purchases, material purchases, tempering, bounties, reward claims, rest and breakthroughs use the public progression APIs. Campaign checkpoints are cloned to explore alternate bounty schools without claiming that the same rewards were earned on every branch.

The tactical player looks ahead through the actual displayed enemy action. Its beam search is bounded to eleven plays and eighteen retained candidates per depth. It can use genuinely owned consumables when threatened. It is stronger than an inexperienced player, and these deterministic runs establish viable routes rather than universal win rates.

## Six complete campaigns

Iron, Ember and Lotus teacher routes each cleared all 49 missions and 35 battles on both Wayfarer and Tribulation. No optional bounty grind was required for story completion. The simulator now purchases missing tempering materials rather than silently calling the retired jade-only refinement path. It also copies persistent combat effects when forecasting and excludes invalid simulated plays.

| Teacher route | Final jade | Final lifetime essence | Techniques tempered | Highest technique level |
| --- | ---: | ---: | ---: | ---: |
| Iron | 428 | 1,923 | 11 | 4 |
| Ember | 532 | 1,926 | 11 | 3 |
| Lotus | 555 | 1,923 | 12 | 4 |

Those economics are the same on both difficulties. All routes ended the story in Void Refinement; the final claim supplies enough essence and jade for an immediate Body Integration breakthrough. Tribulation's tightest chapter results left approximately 70%, 49% and 48% of opening vitality for Iron, Ember and Lotus respectively. Ember and Lotus each used one earned consumable over their Tribulation campaign. The strongest late decks mixed school rewards; these are teacher-choice routes, not claims of pure-school exclusivity.

## All forty material commissions, both difficulties

All 80 actual combats won and claimed rewards through `startBounty`, `fight` and `resolveEncounter`. Each claim verifies the exact victory counter, jade, lifetime essence and both material increments.

| Tier | Checkpoint cultivation level | Highest owned technique level | Wayfarer mean rounds | Wayfarer lowest vitality left | Tribulation mean rounds | Tribulation lowest vitality left |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 3.375 | 74% | 7.0 | 44% |
| 2 | 18 | 2 | 2.0 | 97% | 2.375 | 97% |
| 3 | 34 | 3 | 2.0 | 85% | 2.375 | 82% |
| 4 | 41 | 4 | 2.375 | 75% | 3.5 | 61% |
| 5 | 55 | 4 | 4.125 | 86% | 4.5 | 53% |

Tier one uses the untouched fresh starter deck, no equipment, and only its real starting supplies. Later tiers use the first chapter-end snapshot from the actual Iron campaign that unlocked that tier; these checks do not claim every tier is equally easy at its exact first layer. Tier five uses the immediate post-story Body Integration breakthrough, with the same acquired deck and equipment. Every school is tested at every tier.

## Earned recipes, purchases and level five

A fresh character completed two tier-one Iron commissions and forged **Black Wax Citation**. The first win was insufficient. Two wins yield sixteen Seal Jade and six Iron Essence, covering the common formula's ten and six, plus its eight-jade service fee. The resulting character had 53 jade, enough to buy a second copy directly for 45 jade. Both acquisition paths were executed and their balances checked.

The cleared Iron chronicle then ran real tier-five Iron commissions without changing its combat deck. After exactly fifteen wins it forged **Sign Against Heaven**, a tier-five legendary requiring 100 Seal Jade and 72 Iron Essence. Each win gives sixteen Seal Jade, five school essence and 33 jade, so essence is the limiting material: `ceil(72 / 5) = 15`. A tier-four legendary likewise takes fifteen targeted wins because the school-essence reward is also five. This is a material pacing statement; the card's own cultivation-level gate must also be met.

Using only its remaining earned jade and materials, that same character purchased missing ingredients and tempered the already-owned **Iron Vow** to level five. Each intermediate operation was quoted, purchased and applied legally. No million-jade fixture, granted equipment, fabricated victory or edited cultivation level is used.

## Full post-story progression

The same character continued until the final realm and its ninth layer were perfected. It required **217 total post-story tier-five commission victories**, including the fifteen used for the legendary formula. The sequence began at 1,923 lifetime essence and finished at 6,480; every win awarded exactly 21. Automatic attempts at legal breakthroughs paid the real jade costs. The final state held 5,049 jade after the legendary forge, the technique tempering and all breakthroughs, and passed ordinary save/load validation.

The measured route is somewhat shorter than an estimate of roughly 250 wins. The guaranteed story baseline of 1,842 essence would need two tier-four wins to reach the 1,870 Body Integration threshold, then 219 tier-five wins to exceed 6,470: approximately **221 wins** if the player can pay each breakthrough and consistently clear the highest tier. At tier four throughout, the essence-only projection is `ceil((6470 - 1842) / 18) = 258` wins, but it does not represent a player who moves on to tier five.

## Assessment and limits

The current numbers meet the requested common and legendary recipe cadence and preserve six viable campaign routes. No balance change was needed to complete them. The fifth material tier, level-five techniques and later cultivation realms are reachable with earned rewards. Starter Tribulation commissions are materially harder than later tiers with optimized acquired gear, so tutorial guidance on Guard, the next intent and earned consumables remains useful.

The 217-win continuation is an exact legal endurance run against one chosen tier-five school. It proves repeatable progression without injecting resources; it does not prove that repeating hundreds of battles will stay varied or engaging. The eighty-school/tier/difficulty checks provide breadth, while human pacing and deck experimentation remain separate playtesting questions. In total this suite resolves **509 actual combats**: 210 story fights, 80 commission matrix fights, two common-recipe fights and 217 post-story fights.
