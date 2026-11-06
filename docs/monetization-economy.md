# Economy and microtransaction design

This is a design for the future connected game, audited against the current 597-card local game. Checkout and wallet connection remain disabled. The price examples below are **draft product settings**, not live offers, market research, token valuations, or a promise of launch pricing. No gameplay balance, mission reward, cultivation threshold, or existing save has been changed by this report.

## Currency contract

| Resource | Earned source | Spending role | Real-money policy |
| --- | --- | --- | --- |
| Jade | Story rewards, successful repeatable commissions, first-time Pagoda records, item resale | Cards, raw materials, forging fees, shared card-quality upgrades, equipment and supplies, hero breakthroughs, additional pets and pet evolution | Future direct purchase at a published fixed product price. Paid and earned jade have the same spending power. Server bookkeeping retains separate origins. |
| Hero cultivation essence | Story, commissions and first-time Pagoda records | Lifetime experience through ten realms and ninety layers; never consumed | Not sold. No purchasable XP multiplier, breakthrough bypass or instant realm. |
| Raw materials | Targeted commissions and card salvage; existing Jade shop | Exact deterministic forge and upgrade recipes | Indirectly purchasable with jade at existing prices, subject to the same cultivation gates. No paid-only recipes. |
| Pet nourishment | Feeding unreserved owned cards, which are destroyed | Pet lifetime experience; evolution remains capped by the hero realm | **Indirectly purchasable** because jade can buy spare cards. This must be disclosed instead of describing monetization as cosmetic-only or asserting all XP is earned. |
| Star Silk | Reserved future cosmetic premium balance | Explicitly described portrait treatments, alternative card backs, board ornaments and pet habitat decoration | Future direct purchase, separate from jade. No combat stats or conversion to jade/materials/essence. Do not enable sales until an actual cosmetic catalog and entitlement delivery exist. |

No currency is a player-owned blockchain token. In-game balances are nontransferable consumable game credits with no cash-out, staking, yield, speculative price, secondary marketplace, NFTs or player trading. A crypto wallet is a future payment/authentication interface, not the game inventory. Chain, accepted token, treasury and provider remain unconfigured.

## Reproducible baseline

Run `node scripts/economy-audit.mjs`. It imports the real registries, recipe formulas, material prices, cultivation definitions and public quote methods. It audits all 597 cards, all 32 equipment/alchemy recipes, and cultivation gates. Its JSON is deterministic. It does not create battles or claim to measure human play time.

| Rarity | Cards | Acquisition level | Buy one, jade | Forge one with every input bought, jade | Targeted commission wins for forge materials | All four upgrades with inputs bought, jade |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Common | 241 | 1–9 | 45 | 30 | 2 | 547 |
| Uncommon | 198 | 10–27 | 150 | 108 | 4 | 1,248 |
| Rare | 119 | 28–45 | 495–760 | 364–561 | 7–8 | 2,881–3,168 |
| Legendary | 39 | 46–63 | 1,700–2,515 | 1,258–1,860 | 15 | 7,036–8,664 |

Upgrade totals exclude acquiring the original copy. Quality is shared by every owned copy of a technique, so the displayed total is per technique rather than per physical card. Forge-win counts concern the limiting ingredients in the correct school and recipe tier; jade fees and actual level gates still apply. Direct purchase has approximately a 35% convenience premium over all-retail forging inputs, rounded up to five jade. Players who earn the ingredients instead pay only the forge fee. Salvage returns one quarter of base ingredients rounded down, minimum one each; it returns no jade and no upgrade investment.

The audit proves direct purchase costs more than all-retail forging, salvage input value is less than acquisition cost for all cards, and all 32 legacy craft/resale cycles lose value even with maximum input discounts and undiscounted output resale. This is a finite static loop audit, not a proof against every future exploit or online fraud.

| Commission tier | Unlock level | Jade/win | Hero essence/win | Seal Jade/win | Chosen school essence/win | Retail ingredient value/win | Wins to earn 500 cash jade |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mortal 1 | 1 | 13 | 9 | 8 | 3 | 14 | 39 |
| Spirit 2 | 10 | 18 | 12 | 10 | 4 | 32 | 28 |
| Earth 3 | 28 | 23 | 15 | 12 | 4 | 56 | 22 |
| Heaven 4 | 37 | 28 | 18 | 14 | 5 | 110 | 18 |
| Immortal 5 | 55 | 33 | 21 | 16 | 5 | 188 | 16 |

Ingredient value is shop replacement cost, not sale proceeds or real money. The commission also advances the hero and awards materials, so a jade pack is never described as replacing a fixed number of complete battles or hours of gameplay. Defeats cost at most five jade; resting remains free. Repeat Pagoda clears below the personal record do not award jade/essence again.

The 49 story missions guarantee 3,766 jade and 1,842 hero essence, plus approximately 284–298 choice jade across the registered decisions. Optional equipment spending, consumables, technique upgrades and choices affect final balances. All nine hero breakthroughs together cost 2,605 jade. A pet's nine realm evolutions cost 1,303 jade, in addition to its consumed cards. The first hatch is free; each additional species costs 250 jade, twelve Mortal Seal Jade and eight Mortal school essence.

Existing action-level evidence in `docs/workshop-balance.md` demonstrates six campaign routes completing without optional commission grind. A real post-story route perfected cultivation after 217 further successful tier-five commissions. The new audit's essence-only projection is 221 tier-five wins from the guaranteed story baseline; it assumes tier five is already available and is not a legal step-by-step route. Neither figure establishes engaging pacing or a novice's clear rate. Money can accelerate collection but cannot remove the hero essence requirement: the audit gives a level-one fixture one million jade and verifies 571 of 597 cards remain gated, then verifies hero and pet breakthrough restrictions.

## Draft products and value communication

Use one stable baseline of **100 jade per USD 1.00** (one USD cent per jade), with integer unit counts and integer reference-price cents. A five-product draft ladder can offer 100/$1, 500/$5, 1,000/$10, 2,500/$25 and 5,000/$50. Keep the same unit value across sizes: no bonus multipliers, hidden first-purchase doubling, rotating countdowns, paid random packs or VIP stat advantages. The adapter's checked-in catalog is the authoritative draft if product IDs differ. Star Silk can use the same explicit baseline for easy comparison, but it is a different balance and must never be silently substituted.

At this illustrative jade rate, a common card is $0.45 equivalent, an uncommon $1.50, rare $4.95–$7.60, and legendary $17.00–$25.15. The four legendary upgrades together equal $70.36–$86.64 at full-retail input prices. These high collection costs need real player research before launch; the original grind-oriented economy was not calibrated as a paid live-service economy. Do not silently increase free grind or reduce rewards to force conversion. Keep products in preview until playtests demonstrate acceptable collection cost and value. The small initial live experiment should favor the $1–$10 products; hide larger packs if spending controls cannot be enforced.

Every product card should display exact delivered currency, full reference price, unit value, paid benefits and limitations. At order confirmation show token, network, exact token amount, quote expiry, receiving merchant identity, network fee handling, delivery currency, tax treatment and cancellation/refund help. A stale quote requires a new review rather than a silent price replacement. Stablecoins still require chain-specific token allowlists and exact base-unit amounts; a token symbol alone is not sufficient identification. Never ask a player to approve an unlimited token allowance by default.

## Economy operations and spending policy

The launch server should version prices, recipes and rewards together. An order snapshots its product version, amount and delivered units. Never change a confirmed entitlement because a later catalog was published. Cultivation checks run at every spend, not only when listing an item. Do not sell essence, material-gate removal, reserved-deck consumption exceptions or paid-only combat techniques. Four-copy ownership and deck protections remain in force. Paid acquisitions can accelerate pet feeding and card quality; a future competitive mode must normalize paid quality/collection or use a separately earned format before claiming fair competition.

Recommended initial server policy is an explicit opt-in spending limit of $10 per account per rolling 24 hours and $50 per rolling 30 days, lower configurable personal limits, one open payment order, and no repeat order while a previous payment is unresolved. These are design targets, not guarantees and not a substitute for jurisdiction/platform requirements. Aggregate limits by account across linked wallets; wallet replacement must not reset limits. Do not collect payment before account, supported region, age/parental policy and refund support are resolved. The disabled local preview does not enforce these future account-level policies and must not represent that it does.

Track sources and sinks using integer reason-coded ledger entries: mission, commission, item sale, confirmed purchase, purchased-card spend, materials, forge fee, card upgrade, hero breakthrough, hatch, evolution, cosmetic entitlement and refund adjustment. Retain paid and earned origins for reconciliation/support while presenting one spendable jade balance. Define and publish consumption order; a conservative policy spends earned jade first, then purchased jade, with separate server lot records and no locally editable payment provenance.

Track median jade/hero-level, material bottlenecks by tier/school, duplicate availability, deck reservation failures, weekly earn/spend ratios, upgrade/forge/buy distribution, pet nourishment waste, free and paying progression separately, purchase failure/delivery latency and refund rate. Rate-limit automated online reward claims and validate combat/action outcomes on the server; the current deterministic client campaign and editable saves cannot protect a paid economy. Avoid turning telemetry into pressure targeting based on distress or failed battles.

Long-term infinite jade earnings are acceptable in this non-trading single-player model: increasing spending sinks must remain optional collection and cosmetics rather than maintenance taxes. Keep free rest, guaranteed breakthroughs after meeting requirements, mission rewards, all forge recipes, and earned-card access. Economy events should add choices rather than invalidate existing materials or paid goods.

## Trust boundary and release requirements

Current browser saves are player-controlled offline chronicles. They are neither proof of payment nor an authoritative paid balance. Importing a save, receiving a transaction hash, or reporting a wallet success must never grant purchasable currency. Do not merge a local jade total into an online paid wallet. A launch migration needs a separately defined verified account progression policy; offline play can remain independent.

The future server owns account authentication, quotes, orders, allowlisted token/network/recipient verification, confirmation policy, fulfillment, an immutable double-entry purchase ledger, currency spends, inventory and cosmetics. It must atomically record each provider event/chain transfer once and apply exactly one entitlement per order. Repeated refreshes, duplicate webhooks, retries, process crashes, multiple tabs and wallet replacement must not duplicate funds. Underpayments, wrong network/token/recipient, expired quotes, overpayments, failed/reverted/reorganized transfers and refunds need explicit reconciliation states. A UI success animation cannot decide settlement. See `docs/payment-architecture.md` for adapter/server detail.

Before enabling live payment: implement a persistent authenticated backend and audited ledger, server-owned gameplay balances/spends, verified settlement and fulfillment, support/refund handling, enforceable spend limits, supported-region and platform review, clear terms and payment disclosure, security tests, provider sandbox tests and small controlled rollout. Until then the game's treasury should remain a polished catalog preview with a visible disabled state and zero wallet prompts or transfers.

## Short in-game guide text

“Jade buys cards, materials and services. Cultivation gates still apply. Hero essence is earned in expeditions. Buying spare cards can accelerate pet feeding. Star Silk is reserved for cosmetics and cannot be converted to jade. Wallet payments are not available yet.”
