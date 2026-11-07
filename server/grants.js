// What the minter gives a player when their ledger seal is first made: enough jade to buy a few goods and a handful
// of Cinder Essence so the first sale to Lu Yan can happen in the first minute. Amounts are in token units
// (jade in cents: 100 = 1 jade). Commission rewards are added on Day 7, after the battle is replayed.
export const WELCOME = [
  {tokenId: 'jade', amount: 15_000},
  {tokenId: 'mat:essence-ember-1', amount: 8},
  {tokenId: 'mat:essence-iron-1', amount: 4},
];
