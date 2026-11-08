# Shop Deeds: NFTs that are the shops

Each of the nine merchants in the Night Bazaar has one deed, an NEP-171 token in the game's contract
(`items.ashes-ninth.testnet`, token ids `deed:<merchant>`). Holding the deed means owning that shop.

| The deed gives its holder | How it works | Where |
|---|---|---|
| The owner's share of profit | At the end of each market day on which the shop made a profit, `DEED.ownerShareBps` (10%) of it moves from the shop's purse into the deed's **vault**. The vault is jade the contract holds for the deed | `simulated()` / `caught_up()` in `contracts/items/src/lib.rs` |
| The vault | `deed_claim` pays the vault to the current holder. An unclaimed vault stays with the deed when it changes hands | `deed_claim` |
| Control of the shop | The holder runs the shop's daily strategy (`deed_set_strategy`, the same limits as the agent: targets 60–160%, once per market day) or appoints the merchant's AI agent (`deed_appoint_agent`). While the holder runs it, the agent's `merchant_set_strategy` is refused with `DEED_HOLDER_DECIDES` | `deed_set_strategy`, `merchant_set_strategy` |
| A picture of the shop | `metadata.media` is `/deeds/<merchant>.svg`, drawn on request from the ledger: portrait, purse, open or shuttered, vault, holder, and who decides | `deedSvg()` in `server/api.js` |
| A history anyone can read | The contract keeps each deed's record: every holder and how they got it (minted, bought, transferred, returned), what the deed earned and paid out while they held it, each profitable market day's share, each sale's price, and what holders did (claims, listings, running the shop, appointing the agent) | `deed_history` in `lib.rs`; the page `/deed/<merchant>` |
| A room only the holder can enter | The deed's **counting room**: the merchant's private letter to its owner, the shop's full books, the agent's journal, and the vault to claim | `server/room.js`; the page `/deed/<merchant>` |

The numbers (`ownerShareBps`, `priceCents`, `maxPerAccount`) are in the game's one rules file,
`js/market/merchant-rules.js` (`DEED`). They are generated into `contracts/items/src/rules_gen.rs` like every other rule.

## The history

`deed_history {"token_id": "deed:lu-yan"}` returns `{deed, history}`. The history is written by the same calls that
change the deed, so it cannot disagree with it:

| Field | Written by |
|---|---|
| `holdings`: owner, `how`, `price`, `since_ms`, and `earned` and `claimed` while they held it | `move_deed` (every change of hands); the end-of-day share in `caught_up`; `deed_claim` |
| `days`: market day, share, holder | `caught_up`, one entry per profitable day |
| `events`: claims, listings, unlistings, running the shop, appointing the agent, changes of hands | each holder method |
| `earned`, `claimed`, `sales`, `sold_for`, `holders` | totals, never trimmed |

- **The invariant:** `opening_vault + earned - claimed = vault`, always. `opening_vault` is the vault when the record
  began. Deeds minted after this upgrade start with the Ministry at zero; deeds that already existed start with their
  holder and vault at that moment ("held when the record began"). `npm run chain:verify` checks the invariant live for all
  nine deeds, along with "the shares by day add up to the earnings" and "the last holder is the owner".
- **Days earned before a sale belong to the seller.** `move_deed` catches the shop up before the deed moves, so a profitable
  day that nobody had looked at yet is credited to the holder who held it then. The vault still travels with the deed:
  the history shows who earned it, and the vault shows who may claim it.
- **Bounded storage.** The history keeps the newest 24 holders, 60 days and 40 events. The totals are never trimmed.

## The counting room: a page only the current holder can open

The page `/deed/<merchant>` shows the history to anyone. Its counting room opens only for the deed's current holder:

1. The page asks the server for a challenge (`POST /api/deeds/room/challenge`). This is a NEP-413 message,
   `Open the counting room of deed:<merchant>`, with a fresh 32-byte nonce and the site as recipient. It is valid once,
   for five minutes.
2. The visitor signs it as a standard NEP-413 signed message. In the game, the browser's device key signs it with no
   prompt. Anyone else can sign with any key of the holding account, for example a wallet's `signMessage`, and paste the
   result into the page.
3. The server (`server/room.js`) checks three things before it opens the room:
   - the ed25519 signature is valid for exactly that challenge;
   - the key is an access key of the account right now (`view_access_key` on the ledger);
   - that account holds the deed right now (`nft_token`).
4. The server then gives a 30-minute pass, an HMAC over the account, the deed and the expiry. **Every** request with the
   pass checks the holder on the ledger again.

The room holds:
- the merchant's private letter to its owner. NEAR AI writes it in the merchant's voice from the ledger's figures, and
  the letter is used only if it states the vault exactly; otherwise the rules write it;
- the shop's full books (each good on the shelf against what the shop wants);
- the agent's journal, with links to its transactions;
- buttons to claim the vault and to choose who runs the shop.

Function-call keys are accepted as proof as well as full-access keys. The game's device key is one, and only the account
itself can add a key to the account.

### Threat model: getting into a room that is not yours

| Attempt | What stops it |
|---|---|
| Keep using the room after selling the deed | The pass is checked against `nft_token` on every request: the old holder gets `NOT_HOLDER` on their next visit. Tests: `tests/deed-room.test.js` (a sale between two checks of one pass) and `tests/api.test.js` (a sale between two visits) |
| Sign with your own key but claim the holder's account | The key must be an access key of the claimed account on the ledger: `NOT_THEIR_KEY` |
| Replay someone's signed challenge | Each nonce works once and expires in five minutes: `STALE_CHALLENGE` |
| Reuse a signature for another deed or another site | The message names the deed, and the recipient is part of the signed bytes: `BAD_SIGNATURE` or `STALE_CHALLENGE` |
| Forge or edit a pass | It is an HMAC with the server's secret, compared in constant time, and bound to one deed and an expiry: `NO_PASS` |
| A signature that only looks right | The bytes are the NEP-413 standard, `sha256(borsh(2^31 + 413, message, nonce, recipient, callbackUrl))`. The test signs with near-api-js's own NEP-413 signer, and our verifier must accept it |

What the room shows is not secret from the ledger: the books are public data. The room is the holder's private view (the
letter is written only for them) and the place where they act on their deed.

## How a deed changes hands

- **From the Ministry:** all nine deeds are minted to `ministry.ashes-ninth.testnet` (`deed_mint_all`). The Ministry sells each
  deed at `DEED.priceCents` (100 jade) to whoever calls `deed_buy` first. The price goes **into the shop's purse as new capital**,
  so it is not counted as profit.
- **Between players, in the game:** the holder lists the deed (`deed_list`); a buyer pays the listed price (`deed_buy`, with
  `max_price` as a limit). The seller is paid at once, less the Ministry's trade tax. Both calls are deposit-free, so the
  player's limited browser key signs them and the relayer pays the gas: no wallet appears.
- **With any NEAR wallet:** the standard `nft_transfer` and `nft_transfer_call` (1 yoctoNEAR, with `nft_resolve_transfer`
  returning the deed if the receiver asks).

## Threat model: every way a seller might try to keep the shop

| Attempt | What stops it |
|---|---|
| Keep claiming the vault after selling | `deed_claim` pays only `owner == predecessor`. Ownership moves in the same call as the payment (`move_deed`), so there is no gap. Test: `a_former_holder_cannot_claim` |
| Drain the vault just before the sale | The buyer sees the vault (`deeds`, `nft_token`) before buying. The listed price is what they agree to pay, and `max_price` protects them if the seller changes the price |
| Keep deciding the shop's strategy | `deed_set_strategy` checks the current owner. `move_deed` also resets `agent` to true, so a new holder starts with the merchant's agent appointed, never with the seller's choice |
| Sell the deed twice | A deed is one record with one owner. `deed_buy` and `nft_transfer` both require `owner == from`, and listing is cleared on every transfer |
| A sale in the middle of a payout | The day's share is computed in the same lazy catch-up that every call runs first, and paid into the **deed's** vault, not to an account. Whoever holds the deed when it is claimed gets it. Test: `the_holder_earns_the_owners_share_into_the_deeds_vault_and_it_moves_with_the_deed` (a profitable day, then a transfer, then the new holder claims) |
| The shop owns its own deed, or one player corners the market | `move_deed` refuses merchant accounts and caps holders at `DEED.maxPerAccount` (3) |
| A forged transfer from a limited key | `nft_transfer` needs 1 yoctoNEAR, which a function-call key cannot attach. Test: `the_standard_transfer_needs_one_yocto` |

## Tests

`npm run contract:test` (`contracts/items/src/tests.rs`) runs these deed tests:
- `the_ministry_sells_a_deed_once_and_the_price_becomes_the_shops_capital`
- `the_holder_earns_the_owners_share_into_the_deeds_vault_and_it_moves_with_the_deed`
- `a_former_holder_cannot_claim`
- `a_holder_who_runs_the_shop_overrules_the_agent_and_can_hand_it_back`
- `a_holder_resells_at_their_price_and_the_ministry_takes_its_tax`
- `an_unlisted_deed_cannot_be_bought_from_its_holder`
- `the_standard_transfer_needs_one_yocto`
- `a_deeds_history_starts_at_its_minting_with_the_ministry`
- `the_history_records_each_holder_how_they_got_it_and_what_it_earned_and_paid_them`
- `the_vault_always_equals_the_opening_vault_plus_earnings_minus_claims`
- `days_earned_before_a_sale_belong_to_the_seller_even_if_nobody_looked`
- `holders_decisions_are_in_the_history`
- `the_history_keeps_its_newest_events_and_never_loses_its_totals`

`tests/deed-room.test.js` checks the NEP-413 encoding and signatures against near-api-js, and tests the gate: holder,
key, replay, expiry and a sale between visits. `npm run chain:e2e` buys a deed live, opens its counting room, and is
refused at another deed's room.

## Try it

- **In the game:** Market → **Shop deeds**: buy a deed, claim its vault, sell it, run the shop or appoint the agent.
- **On the Judge's Desk** (`/judge`): one button buys a deed and lists it again, so the next visitor can buy it, with links
  to both transactions. The next button opens that deed's counting room, then tries a deed the judge does not hold and is
  refused.
- **The Deed Registry:** `https://ashes-ninth.duckdns.org/deed/lu-yan` (any merchant): the history and the counting room.
- **On the ledger:** `nft_token {"token_id":"deed:lu-yan"}`, `nft_tokens`, `deeds`, `deed_history`, and the picture at
  `https://ashes-ninth.duckdns.org/deeds/lu-yan.svg`.
