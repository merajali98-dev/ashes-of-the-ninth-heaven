# items: the Ashes of the Ninth Heaven NEP-245 contract

One multi-token contract holds every good in the game (597 techniques, 45 materials, 231 items) and the `jade`
currency, 874 token ids in all. The merchant market runs inside it.

- **NEP-245 core and metadata:** `mt_transfer`, `mt_batch_transfer`, `mt_transfer_call`, `mt_batch_transfer_call`
  (1 yoctoNEAR, as the standard requires), `mt_token`, `mt_balance_of`, `mt_batch_balance_of`, `mt_supply`,
  `mt_batch_supply`, `mt_metadata_*`, and `mt_mint` / `mt_burn` / `mt_transfer` events for every balance change.
- **Merchants are accounts.** `m-<name>.ashes-ninth.testnet`'s balances are its stock and its jade purse.
- **The market:** `market_sell` / `market_buy` (with `min_total` / `max_total`; a moved price fails with
  `PRICE_MOVED`), `patron_invest` (patrons own up to 49%, at most ten; also rekindles closed shops), and
  `merchant_set_strategy` (a merchant's own agent nudges its targets and specialty within limits, once a market day).
  These are deposit-free so a key limited to this contract can sign them and a relayer can pay the gas.
- **Lazy time:** each call catches a merchant up to the current market hour (upkeep, caravans, learning, closure,
  patron dividends). `market_advance` lets a keeper wake idle shops.
- **Minter batches:** `game_mint_batch` / `game_burn_batch` carry sequence numbers; a retried batch is ignored.

`src/pricing.rs` is a line-for-line port of `js/market/merchant-rules.js`; `src/rules_gen.rs` is generated from it
(`node scripts/gen-contract-rules.mjs`). `tests/parity.rs` replays a recorded JavaScript market week
(`tests/fixtures/market-trace.json`, 3,000+ steps) and must match every quote and daily snapshot exactly.

```bash
cargo test                                   # unit tests + parity with the JavaScript rules
npm run contract:build                       # regenerate inputs, build, copy to res/items.wasm with its SHA-256
npm run chain:deploy                         # deploy to testnet and open the shops (safe to re-run)
npm run chain:smoke                          # a no-wallet trade signed by a limited key and relayed, checked against the rules
```

On Windows, `.cargo/config.toml` sets `AWS_LC_SYS_PREBUILT_NASM=1` for the native test build, and the build skips
ABI generation (`--no-abi`).
