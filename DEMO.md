# A three-minute demo

Everything below runs on the hosted game at https://ashes-ninth.duckdns.org (NEAR testnet). It is also the outline of
the submission video.

## 0:00 · The pitch (15 s)

"Ashes of the Ninth Heaven is a deckbuilding RPG whose market is a real economy. Nine merchants are AI agents with their
own NEAR accounts and purses. Every item is a NEP-245 token, every price comes from one readable rules file, and you
play it without ever seeing a wallet."

## 0:15 · Sign in like any game (20 s)

Front page → **Begin your journey** → the **Sign in** chip at the top → Google, email or a guest name. Behind it: a new
`<name>.ashes-ninth.testnet` account, a browser key that can only trade, and a welcome pack from the minter. No wallet,
no recovery words, no gas.

## 0:35 · A price that explains itself (25 s)

Market → **Quick trade**. Hover any price: the merchant says why ("Only 12 left and I like to keep 40, so it's dear… The
Pagoda Edict favours Cinder this week…"). Sell one. The jade that lands is exactly that quote, because the contract runs
the same rules file (`js/market/merchant-rules.js`).

## 1:00 · Haggle with an agent (30 s)

Press **Haggle** and ask about 5% over the posted price. The contract decides by the rules file: within the merchant's
room it accepts; a little further and it **counters once**; too far and it walks away until tomorrow. The merchant
answers in character through NEAR AI ("Not a breath more…"), and the line is used only if it states the decided price.
Take the counter. **See the record** opens the transaction.

## 1:30 · Merchants hire you (20 s)

**Merchants hiring** at the top of the market: a merchant short of a good has posted a paid job, with the wages already
in escrow on the ledger. Commissions in the Expeditions bring those goods back. Deliver them and the pay arrives at once.
Each merchant decided this itself, once a market day, signing with a key that can do nothing else.

## 1:50 · Own a shop (25 s)

**Shop deeds**: nine NEP-171 NFTs, one per shop, with a picture drawn live from the shop's books. Buy one and 10% of every
profitable day fills the deed's vault, which moves with the deed. Run the shop yourself and its agent stands down, or
appoint the agent again. Open **its history** (`/deed/<merchant>`): every holder and what the deed paid them. Then press
your seal at the **counting room**: the merchant's private letter to you, which only the current holder can read.

## 2:15 · A week in a minute (20 s)

**Watch a week of the market** (`/#market-sim`): simulated traders play seven days under the same rules. Try the flood
scenario and watch a shop go under, then get rekindled by its patrons.

## 2:35 · For judges (25 s)

`/judge`: one click makes a throwaway account. Each button is a real transaction with a link: a trade at the exact
quote, a haggle and its counter, a job delivery, a deed bought and relisted, its counting room opened (and another deed's refused), and a forbidden transfer refused. Then
`npm run verify` (everything offline) and `npm run chain:verify` (the live contract is the committed binary, and live
quotes match the rules file).
