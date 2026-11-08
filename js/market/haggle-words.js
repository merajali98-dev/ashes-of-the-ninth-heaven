// What a merchant says when you haggle: the words only. The numbers come from `haggle` in merchant-rules.js.
import * as R from './merchant-rules.js';

/** The merchant's reasons for its answer, in its own voice (the tooltip and the fallback when no model speaks). */
export function haggleLines(merchant, token, h, {side, posted, offer, helps = false, struggling = false}) {
  const n = token.name ?? token.id, lines = [];
  if (h.outcome === 'accepted' && h.price === posted) lines.push(`That's my posted price. Done.`);
  else if (h.outcome === 'accepted') lines.push(`${R.jade(offer)} jade? You drive a fair bargain. Done.`);
  else if (h.outcome === 'countered') lines.push(`Not ${R.jade(offer)}. Meet me at ${R.jade(h.price)} jade and it's yours.`);
  else lines.push(`${R.jade(offer)} jade? That's an insult. Come back tomorrow.`);
  const why = {cautious: 'A sure sale beats a better one, so I bend a little.', loyal: 'I bend for those who bargain honestly.',
    greedy: 'Every coin counts with me; I barely bend.'}[merchant.temperament];
  if (why) lines.push(why);
  if (helps) lines.push(side === 'sell' ? `I'm short of ${n}, so I give more room.` : `I hold too much ${n}, so I give more room.`);
  if (side === 'sell' && struggling) lines.push(`My purse is thin: I can't pay over my price.`);
  lines.push(`Posted ${R.jade(posted)} · I'd move ${h.bendBps / 100}% (${R.jade(h.room)} jade) today.`);
  return lines;
}
