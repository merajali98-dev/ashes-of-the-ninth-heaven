# Merchant agents: they decide, they hire, they haggle

The nine merchants of the Night Bazaar are AI agents with their own NEAR accounts (`m-<merchant>.ashes-ninth.testnet`).
Each holds its stock and its jade purse in the game's NEP-245 contract, earns and spends from it, and acts on its own,
within limits the contract enforces. One rule runs through all of it: **the agents choose, the rules file bounds,
the contract enforces.** The model never sets a price.

| What the agent does | How | Bounded by | Where |
|---|---|---|---|
| Decides its strategy once per market day: how much of each good it wants (60–160% of usual) and a specialty school | `merchant_set_strategy`, signed from the merchant's own account | `applyStrategy` in the rules file; once per day; refused while a deed holder runs the shop | `server/agents.js`, `contracts/items/src/lib.rs` |
| Hires players when its shelves run short: one job at a time, paid from its purse into escrow | `merchant_post_job` | `checkJob`: a good under its want, at most the shortfall and 20 units, pay between its bid and its own valuation, at most 10% of the purse, never below its stop-buying line; one open job; the wage returns after a market day | `jobOptions` / `settleJob` in `server/agents.js` |
| Answers players who haggle, in character | NEAR AI phrases the decision; the contract made it | `haggle` in the rules file; the line is used only if it states the decided price exactly and stays in the fiction | `haggleSay` in `server/agents.js` |
| Writes a public journal of what it decided and why, with the transaction | the game server's journal | | `/api/journal`, the merchant's stall, the Judge's Desk |

## Keys: what an agent can and cannot do

Each merchant account has a **function-call access key** for the items contract that can call only
`merchant_set_strategy` and `merchant_post_job` (`scripts/agents-setup.mjs`). The game server holds those agent keys,
never the merchants' full-access keys. With an agent key a merchant cannot transfer jade, attach a deposit, call
another contract, or call any other method. The relayer pays the gas for the agents and for every player.

## Two layers of decision

1. **The rules (always available).** `rulesDecision` wants less of a glut, more of a scarce good and more of the
   Pagoda Edict's school. `jobOptions` lists every job the rules allow: tier 1–3 goods under 60% of the merchant's
   want, with the pay range. `settleJob` pays a third of the way from the bid to the merchant's own valuation.
2. **NEAR AI Cloud (in character).** The merchant gets its books, the week's Edict and event, the rules' suggestions
   and its hiring options, and replies with JSON. The reply is parsed, filtered (no chain words, no breaking the
   fiction) and clamped to the same limits the contract enforces. A pay above 60% of the way to its valuation is cut
   back. Any failure (no key, timeout, bad JSON, a good it may not hire for) falls back to the rules.

## Haggling

A player names their own total for a trade (`market_haggle`). The contract computes the merchant's quote, then
`haggle` from `js/market/merchant-rules.js` (ported to `pricing.rs`, parity-tested):

- **Room** = posted total × (the temperament's `haggleBps`: cautious 4%, loyal 3%, greedy 2%), plus `HAGGLE.needBps`
  (3%) when the deal fixes the merchant's shortage (you sell what it lacks) or glut (you buy what it holds too much of).
  A merchant whose purse is thin will not pay over its price.
- An offer **within the room** is accepted at the player's price, and the trade happens in the same call.
- An offer **up to twice the room** gets **one counter**, halfway, which the player may take the same market day
  (`market_take_counter`). The counter stands while the merchant would still accept it; if prices moved in the
  player's favour the posted price is used, and otherwise the call fails with `PRICE_MOVED`.
- **Further**, the merchant **walks away**: no more haggling with that merchant until the next market day.
- One haggle per merchant per market day.

`validateRules` proves haggling cannot be farmed: twice the largest room plus the need bonus stays inside the
narrowest spread (after full loyalty), so buying low and selling straight back loses even with no tax.
`tests/haggle.test.js` checks that across every merchant and good.

## Threat model

| Attempt | What stops it |
|---|---|
| A prompt-injected or confused model sets a price | Prices come only from the rules file inside the contract. The model writes words; `haggleSay` discards any line that does not state the decided price |
| The model posts a ruinous job | `checkJob` runs in the contract: pay at most the merchant's own valuation, escrow at most 10% of its purse, never below its stop-buying line, one job at a time |
| A player probes the merchant's limit with many offers | One haggle per merchant per market day, recorded on the ledger (`HAGGLED_TODAY`) |
| Buy low by haggling, sell back high by haggling | The room is too small: `validateRules`, `haggling both ways never beats the spread` |
| Take a stale counter after prices moved | `market_take_counter` re-runs `haggle` at the current quote |
| A job's wages vanish or get spent twice | The wage moves into the contract's escrow when the job is posted. Each delivery pays from escrow; an expired job's remainder returns to the purse as capital, not profit. Jade supply is unchanged throughout (contract test) |
| An agent key does something else | It is a function-call key for two methods on one contract, with no deposit |
| A deed holder runs the shop, but the agent keeps hiring | `merchant_post_job` is refused with `DEED_HOLDER_DECIDES`, as `merchant_set_strategy` is |

## Keeping a quiet testnet bazaar alive

Merchants pay upkeep every open market hour and earn only when cultivators trade. With few players, an idle shop
shutters after about 36 market days, sooner if its agent keeps restocking. Two operator levers keep the live testnet
bazaar open for visitors. Both are visible on the ledger:

- **The live clock.** One market hour lasts 5 real minutes (`set_clock`, owner only). The contract rebases its clock so
  no market hour is skipped or repeated. The fast-forward page still shows a week in a minute.
- **Ministry relief.** If players leave a shop shuttered for two real hours, the game server (as the contract owner)
  calls `ministry_rekindle`. This mints jade in the open (an `mt_mint` event, memo "ministry relief") up to half the
  shop's starting purse, booked as capital, not profit. The merchant's journal says so. Players can rekindle a shop
  first with `patron_invest` and become its patrons.
- **Thrift.** An agent whose purse is under half its start may not ask for more stock or post a job (`thrifty` in
  `server/agents.js`).

## Tests

- `npm run contract:test` (`contracts/items/src/tests.rs`):
  - `an_offer_within_the_merchants_room_is_accepted_at_the_players_price`
  - `an_offer_worse_than_the_posted_price_gets_the_posted_price`
  - `a_bold_offer_gets_one_counter_the_player_can_take_the_same_day`
  - `an_insulting_offer_ends_haggling_with_that_merchant_until_the_next_market_day`
  - `there_is_no_counter_to_take_without_a_haggle`
  - `a_short_merchant_hires_players_and_pays_from_escrow`
  - `a_merchant_with_full_shelves_posts_no_job`
  - `a_job_never_pays_more_than_the_merchants_own_valuation`
  - `one_job_at_a_time`
  - `players_do_not_post_jobs`
  - `an_expired_job_pays_nothing`
  - `a_deed_holder_who_runs_the_shop_also_decides_its_hiring`
- `contracts/items/tests/parity.rs`: `the_contract_haggles_and_checks_jobs_exactly_like_the_rules_file` (3,456 haggles
  and 2,898 job checks from `tests/fixtures/haggle-cases.json`).
- `node --test tests/haggle.test.js tests/agents.test.js`: the rules, the farming bound, the agents' jobs, the model's
  clamps and fallbacks, and the voice that may not change a price.

## Try it

- **In the game:** Market → Quick trade → **Haggle** on any row. "Merchants hiring" appears at the top when a shop posts a job.
- **On the Judge's Desk** (`/judge`): "Haggle with Lu Yan" asks 1.5 times her room, so she counters, then takes the
  counter. "Deliver goods to a merchant's paid job" fills an open job if the judge account holds the good. The page
  lists every open job and the latest haggles with the merchant's words.
- **On the ledger:** `jobs`, `haggles_of {"account_id": …}`, and the `ashes` events `haggle`, `job_posted`,
  `job_filled`, `job_expired`.
