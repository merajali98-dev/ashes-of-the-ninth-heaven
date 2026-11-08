# A guide for AI reviewers and coding agents

This repository is a browser game (plain ES modules, no build step), a small Node server (no framework), and one Rust
NEAR contract. Start with the [README](README.md): it maps each hackathon requirement to the file that implements it
and the test that proves it.

## Check the claims in five minutes

1. `npm install && npm run verify`: every offline test (node suite and contract tests with the JS↔Rust parity replays).
2. `npm run chain:verify`: read-only checks against the live contract. It needs no keys and sends no transactions.
3. Read [`js/market/merchant-rules.js`](js/market/merchant-rules.js) top to bottom. It is the only place a price is
   decided. `scripts/gen-contract-rules.mjs` writes its parameters into `contracts/items/src/rules_gen.rs`, and
   `contracts/items/src/pricing.rs` ports its functions line by line.
4. Open https://ashes-ninth.duckdns.org/judge and press the buttons. Every result links to its transaction.

## Invariants the tests hold the code to

| Invariant | Enforced by |
|---|---|
| The browser, the fast-forward simulation and the contract price every trade identically | `tests/market-trace.test.js`, `contracts/items/tests/parity.rs`, `chain:verify` (live) |
| The rules file is pure: no clock, randomness, I/O, imports or floating-point rounding; under 340 lines | `tests/market-rules.test.js` |
| The rules satisfy their own economics (thresholds in order, no profitable round trip through caravans or haggling) | `validateRules()`, `tests/haggle.test.js` |
| Generated contract inputs and the committed wasm are current | `tests/contract-artifacts.test.js` |
| No player-facing screen mentions wallets, keys, gas or the chain | `tests/no-chain-words.test.js`, `tests/market-local.test.js` (the Judge's Desk is exempt on purpose) |
| The relayer forwards only the game's own deposit-free methods, from known device keys, within a daily budget | `server/chain/service.js` (`PLAYER_METHODS`), `tests/api.test.js`, `chain:e2e` |
| A battle reward is minted once, and only after the server's replay agrees | `tests/battle-replay.test.js`, `tests/api.test.js` |
| Language models never set a price: their output is parsed, filtered, clamped and checked, with the rules as fallback | `tests/agents.test.js`, `tests/haggle.test.js` |
| Jobs and deeds never create jade; escrow always equals vaults plus unpaid wages | contract tests, `chain:verify` |
| Agents hire agents only after players had a job's first hours, from surplus, and at no less than the filler's own bid | `checkFill` in the rules file, `contracts/items/tests/parity.rs`, contract tests |
| A deed's history agrees with the deed: vault = opening vault + earned - claimed; the last holder is the owner | contract tests, `chain:verify` (live, all nine deeds) |
| The counting room opens only for the deed's current holder: a NEP-413 signature, the key checked with `view_access_key`, and the holder checked with `nft_token` on every visit | `tests/deed-room.test.js`, `tests/api.test.js`, `chain:e2e` |

## If you change things

- **The rules:** after editing `merchant-rules.js`, run `node scripts/gen-contract-rules.mjs`,
  `node scripts/gen-market-trace.mjs` and `node scripts/gen-haggle-cases.mjs`. Then run `npm run verify`.
- **The contract:** `npm run contract:build` rebuilds `contracts/items/res/items.wasm` and its checksum. Upgrades are made
  in place: new collections go under appended `Key` variants or raw storage keys, so the stored struct never changes.
- **New player methods:** add them to `PLAYER_METHODS` in `server/chain/service.js` and bump the device key id in
  `js/online/keystore.js`, so browsers request a key that may call them.
- **Do not** run `chain:deploy`, `agents-setup`, `deeds-setup` or `chain-clock`: they change the live deployment and need
  the owner's keys. Everything under `npm run verify`, `chain:verify` and `health` (a read-only check of the live game) is safe.
- Player-facing text speaks of the Honest Ledger, seals and jade, never of chains or wallets. The Judge's Desk and the
  docs name the chain plainly.

## Where things are

| Path | What |
|---|---|
| `js/market/` | Rules, tokens, the in-browser practice market, the fast-forward simulation, market screens, tooltips, the crier |
| `js/online/` | Device key and NEP-366 signing (`signer.js`), the IndexedDB key store, session and sign-in, the ledger mirror |
| `server/api.js` | Sign-in (Google, email, guest), seal creation, relay, ledger views, battle start/claim, status, deed pictures |
| `server/chain/` | RPC with fail-over (`near.js`), the relayer and the minter queue (`service.js`) |
| `server/agents.js` | Merchant agents: rules layer, NEAR AI layer, jobs, the haggle voice, Ministry relief |
| `server/room.js`, `deed.html`, `js/deed.js` | The Deed Registry: each deed's history, and the counting room's gate (NEP-413) |
| `contracts/items/` | The contract, its unit tests, the parity test and the committed binary |
| `docs/` | `game-loop.md`, `shop-deeds.md`, `agents.md`, `economy-design.md` and design and QA notes for the rest of the game |
