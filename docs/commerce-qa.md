# Treasury and future wallet QA

Scope: the disconnected purchase preview, currency catalogue, adapter trust boundary, and compatibility with the existing local campaign. This build must never request accounts, signatures, network switches, or payments. Real-money fulfillment requires a future authenticated backend; local saves are not payment records.

## Acceptance checks

- Existing Shop exposes the Treasury without changing earned jade or campaign state.
- Proposed pack amounts, USD prices, and their fixed exchange rate are visible before review. Jade and Star Silk offers can be filtered independently.
- Checkout and connection remain disabled; no backend request or injected wallet-provider access occurs when browsing, reviewing, or closing.
- Review distinguishes a proposal from an actual order and does not manufacture a transaction, receipt, premium balance, or owned entitlement.
- Economy guidance explains earnable jade, cultivation gates, free progression, and separate future cosmetic currency.
- Dialog keyboard focus, narrow 390-pixel layout, save reload, and active encounters remain functional.
- Adapter tests cover malformed data, idempotency, stale asynchronous responses, verification boundaries, and immutable caller snapshots.

## Verified results · 5 November 2026

`node tests/treasury-browser.mjs` passed in native Microsoft Edge against its own isolated server on port 4183. The process closes the browser and server after verification; the user's port 4173 is untouched.

- Eight offers across five Jade and three Star Silk packs display the catalogue's integer USD-cent prices and fixed 100 units per USD. All eight review dialogs retain the disabled checkout.
- Synthetic clicks on checkout and connection controls do not cause payment behavior. An injected `window.ethereum` getter and provider request spy recorded **zero accesses and zero requests**. No payment/RPC/backend HTTP request occurred.
- Browsing, filtering, reviewing, and closing preserve the entire local chronicle byte-for-byte. Save download and import preserve the same game data after JSON parsing; import intentionally normalizes object property order.
- The initial economy guide derives the actual 13-Jade commission reward and correctly compares 500 Jade with **39 tier-1 wins**. It discloses that this comparison excludes material/essence rewards and does not estimate time saved. It also identifies indirect paid pet-growth advantage and retained hero progression gates.
- Dialog close restores focus to the offer button. History presents a disconnected-service explanation rather than fake records. An active encounter reloads as battle and exposes no Treasury entry.
- All three Treasury categories fit a **390 × 844** viewport without horizontal page overflow. The review dialog fits the viewport and has no horizontal content overflow. Screenshots of the desktop guide, mobile catalogue, and mobile offer were inspected visually; pricing, badges, actions, and disclosures remain readable.
- **Zero JavaScript errors and zero HTTP errors** occurred.

Screenshots are under `tmp/treasury-browser/`. The browser script uses the bundled Playwright module and installed Edge path specified in its imports and starts its own local server. Run it with Node.js 22 or newer; no wallet extension, credentials, or crypto are needed.

## Adapter review

The adapter imports without provider discovery, storage, or network activity. Every operation that could reach a wallet or backend requires explicit complete dependency injection and `enabled: true`; the application uses the disabled default. It never mutates a game or credits a local save. Server fulfillment receipts are presentation data from the configured trusted backend, not cryptographic proof checked by the client.

The eleven tests in `tests/payments.test.js` independently pass, including the final callback/disconnection regression. They cover disabled calls, the pack rate, decimal quantities, fulfillment binding, invalid/expired quotes, order-key retries, cancellation races, wallet changes, ambiguous sends, notification failures, and provider disconnection serialization.

Review identified callback binding and asynchronous disconnection concerns, which the implementation addresses with a lexical cancellation function and a disconnection lock. A wallet broadcast cannot be treated as fulfillment; ambiguous sends retain a reconciliation path and block automatic resend for that order in the same adapter session. The future server remains responsible for durable idempotency, settlement checks, account ownership, signed webhook verification, ledger uniqueness, and validation after reload. These controls are an architectural requirement, not a deployed payment service.
