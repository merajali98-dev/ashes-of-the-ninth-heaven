# The game loop: the market is the game

Design written before any market code, as the NEAR HACKATHON "Games With Real Economies" brief asks:
*what the player does every 30 seconds, every 5 minutes and every session.*

## Pitch

The Ninth Heaven ran a rigged ledger and charged the dead for tomorrow. It has fallen. You fight for materials, forge
techniques from them, and trade in a market the heavens no longer control. Every merchant has their own purse, their
own stock and their own reasons, and every price can tell you why it is what it is.

## The economic chain

```
Commissions and missions (combat) ──► materials + jade
        │                                   │
        ▼                                   ▼
Over-farmed commissions pay less     Sell to merchants  ◄──►  Buy from merchants or other players
        │                                   │
        ▼                                   ▼
Forge a technique (burns materials) ──► Deck ──► Combat (pills and talismans are used up)
        │
        ▼
Salvage (returns only 25%)    Temper (burns materials)    Ministry trade tax
```

Combat produces the goods; decks and battles consume them. The market sits in the middle, so the reason to trade
is that you will *use* what you buy.

Cultivation level already limits which techniques a player can forge. A level-20 cultivator cannot forge a legendary;
a level-60 cultivator can. High-level players therefore become forge-masters who sell to newer players, and newer
players sell raw materials upward. That is real player-to-player demand that falls out of the existing rules.

## Every 30 seconds

- Play a combat turn, **or**
- sell a stack of loot at a stall and watch the price tick down as you sell, **or**
- hover a price and read why it is that price ("I'm holding 140 Cinder Essence and only want 60, so I pay less"),
  then notice a better buyer two regions away.

Feedback: the jade count moves, the price moves in front of you, and the merchant reacts in one line.

## Every 5 minutes

- Choose a commission (school and grade) **because of a price you saw**: Storm Essence is dear at He Feng's stall
  this hour. Fight it in two to four minutes and come back with materials.
- Decide what to do with them: sell now, forge, hold, list them for other players, or leave a limit order with
  Yi Ning the broker.
- Check the price board: which essences are dear and which are cheap, in which region.
- Notice that a commission farmed over and over pays less (the spirit vein is tired), so spread out.

## Every session (20–40 minutes)

- Advance a campaign chapter. Every chapter cleared by any player adds to the shared **Collective Testimony**, and
  each threshold lowers the Ministry's trade tax for everyone.
- Rebuild your deck for this week's **Pagoda Edict**. The Endless Pagoda favours one school each week, chosen by a
  fixed rule rather than a patch, so the cards and essences of that school are in demand.
- Own a piece of the market: buy a patron's share of a merchant and collect part of its profit, help rekindle a shop
  that went broke (your name goes on its lantern), or open your own stall.
- On return, read **While you were away**: what your shares paid, which shop closed, what your orders filled.

## The first two minutes

1. Sign in with Google or email. No wallet, seed phrase or gas prompt.
2. Granny Qiu at the Ash Market buys your starter loot. Hover the price to read her reasons.
3. Run a first, short commission.
4. Sell to two merchants and see two different prices with two different reasons.
5. Forge a first technique from what you gathered and watch the materials leave your stash.
6. A notice shows a price that moved while you fought, because other cultivators were trading.

The campaign opens after that. The deep RPG is the reward for engaging with the market, not a wall in front of it.

## The merchants

Each merchant is a real account with its own stock and its own jade purse.

| Merchant | Who they are | Region | Trades in | Temperament |
|---|---|---|---|---|
| Granny Qiu | Ash Market Keeper | Ashen Prefecture | Buys almost anything, at low bids | Loyal to regulars |
| Auntie Shi | Passage Vendor | Ashen Prefecture | Pills and talismans | Cautious |
| Mu Xiao | Gate Smith of the Iron Court | Ashen Prefecture | Oathsteel Essence | Loyal to regulars |
| Lu Yan | Cinder Apothecary of Cinder House | Ashen Prefecture | Cinder Essence | Greedy |
| Elder Ya | Salt Archivist | Salt Estuary | Frosttide Essence, Seal Jade | Cautious |
| Black Bamboo | Mask Carver of the Veil | Hollow Theatre | Umbral Essence | Greedy |
| Kuang Yi | Lotus Penitent | Lotus Vault | Verdant Essence | Loyal to regulars |
| He Feng | Cable Keeper of the Storm Post | Thunder Span | Storm Essence | Greedy |
| Gao Shan | Brass Cartographer | Last Observatory | Astral Essence | Cautious |

Service characters with their own purses: **Yi Ning**, the Lost Letter Broker, fills limit orders for a fee;
**the Paper Taxman** collects the Ministry's trade tax; **General Hong** hoards Storm seals, buying dips and selling
spikes.

Rival **wandering cultivators** play alongside you. They run commissions, forge, trade and build decks for the
current Pagoda Edict, so demand comes from play rather than from a script.

## Why the economy changes without a patch

| Driver | What happens |
|---|---|
| Players selling | A merchant's stock rises above what it wants, so its price falls |
| Players buying | Stock drains and recent demand builds, so the price rises |
| Merchants learning | Stock that stays too high or too low for a market day moves what the merchant wants to hold, within limits |
| Merchant purses | A merchant that overpays runs low, stops buying, and closes at the end of a bad day until players rekindle it |
| Storerooms | A merchant flooded past five times its target refuses more, so a flood has to go elsewhere |
| Pagoda Edict | The favoured school rotates weekly by a fixed rule |
| Spirit veins | Commission rewards fall when a vein is over-farmed and recover over time |
| Market events | Shortages and gluts rotate through the material families |
| Ministry tax | Falls as players clear the campaign together |

## Faucets and sinks

**Faucets:** commission and mission rewards, and caravans that pay merchants a little for surplus stock.

**Sinks:** forging and tempering costs, the 75% lost to salvage, consumables used in battle, merchant spreads,
merchant upkeep (rent and wages every open hour), caravan restocking costs, the Ministry tax, broker fees and stall rent.

**Balance targets**, enforced by tests:

- a calm player can afford a first forged uncommon technique within 15 minutes;
- flooding one essence drops its price by at least half within a market day;
- buying and selling straight back always loses money;
- with the default cast, the total jade supply grows or shrinks by no more than 3% per market day.

## Player-owned market

1. **Listings.** List techniques or materials at your own price. Items wait in escrow in the items contract until a
   buyer fills the listing or you cancel it.
2. **Patron shares.** Own up to 49% of a merchant and receive part of its sales.
3. **Rekindling.** A closed shop reopens when players fund it, and its funders become patrons.
4. **Stalls.** Rent a stall in a region and set your own buy and sell prices within the same band merchants use.

## Fast-forward

A labelled simulation plays a week of the market in about a minute, using the same pricing rules as the live game.
Toggle the cast (an ember flooder, a speculator, a patron, a forge-master) and inject shocks to watch prices crash,
shops close and shops reopen. It needs no sign-in and sends no transactions.
