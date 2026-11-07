# Shop Deeds: NFTs that are the shops

Each of the nine merchants in the Night Bazaar has one deed, an NEP-171 token in the game's contract
(`items.ashes-ninth.testnet`, token ids `deed:<merchant>`). Holding the deed means owning that shop.

| The deed gives its holder | How it works | Where |
|---|---|---|
| The owner's share of profit | At the end of each market day on which the shop made a profit, `DEED.ownerShareBps` (10%) of it moves from the shop's purse into the deed's **vault**. The vault is jade the contract holds for the deed | `simulated()` / `caught_up()` in `contracts/items/src/lib.rs` |
| The vault | `deed_claim` pays the vault to the current holder. An unclaimed vault stays with the deed when it changes hands | `deed_claim` |
| Control of the shop | The holder runs the shop's daily strategy (`deed_set_strategy`, the same limits as the agent: targets 60–160%, once per market day) or appoints the merchant's AI agent (`deed_appoint_agent`). While the holder runs it, the agent's `merchant_set_strategy` is refused with `DEED_HOLDER_DECIDES` | `deed_set_strategy`, `merchant_set_strategy` |
| A picture of the shop | `metadata.media` is `/deeds/<merchant>.svg`, drawn on request from the ledger: portrait, purse, open or shuttered, vault, holder, and who decides | `deedSvg()` in `server/api.js` |

The numbers (`ownerShareBps`, `priceCents`, `maxPerAccount`) are in the game's one rules file,
`js/market/merchant-rules.js` (`DEED`). They are generated into `contracts/items/src/rules_gen.rs` like every other rule.

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

## Try it

- **In the game:** Market → **Shop deeds**: buy a deed, claim its vault, sell it, run the shop or appoint the agent.
- **On the Judge's Desk** (`/judge`): one button buys a deed and lists it again, so the next visitor can buy it, with links
  to both transactions.
- **On the ledger:** `nft_token {"token_id":"deed:lu-yan"}`, `nft_tokens`, `deeds`, and the picture at
  `https://ashes-ninth.duckdns.org/deeds/lu-yan.svg`.
