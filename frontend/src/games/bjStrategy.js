// Blackjack helpers for the table UI: totals, soft hands, basic strategy and bust odds.
// Rules this matches (see backend/src/games/blackjack.js): 6 decks, dealer hits soft 17,
// double on any first two cards (also after a split), split up to 3 hands, no surrender.

export const cardVal = (r) => (r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r) || 0);

/** { total, soft } — soft means an ace is still counted as 11. Face-down cards are skipped. */
export function handInfo(hand) {
  let v = 0, a = 0;
  hand.forEach((c) => { if (!c || c.rank === '?') return; if (c.rank === 'A') a++; v += cardVal(c.rank); });
  while (v > 21 && a) { v -= 10; a--; }
  return { total: v, soft: a > 0 };
}

/** "7 / 17" for soft hands under 21, plain number otherwise. */
export function totalLabel(hand) {
  const { total, soft } = handInfo(hand);
  if (!hand.some((c) => c && c.rank !== '?')) return '';
  return soft && total < 21 ? `${total - 10} / ${total}` : String(total);
}

/** Chance (0..1) that one more card busts this hand, assuming a fresh 6-deck shoe. */
export function bustChance(hand) {
  const { total, soft } = handInfo(hand);
  if (soft || total <= 11) return 0;
  let p = 0;
  for (let v = 1; v <= 10; v++) if (total + v > 21) p += v === 10 ? 4 / 13 : 1 / 13;
  return p;
}

/**
 * Basic strategy move for this hand vs the dealer's up card.
 * Returns { move: 'hit'|'stand'|'double'|'split', why }.
 */
export function basicStrategy(hand, upCard, { canDouble, canSplit }) {
  const up = upCard.rank === 'A' ? 11 : cardVal(upCard.rank);
  const upTxt = upCard.rank === 'A' ? 'an Ace' : `a ${up}`;
  const { total, soft } = handInfo(hand);
  const dbl = (fallback, why) => (canDouble ? { move: 'double', why } : { move: fallback, why });
  const between = (lo, hi) => up >= lo && up <= hi;

  if (canSplit && hand.length === 2) {
    const r = cardVal(hand[0].rank);
    const pairWhy = `Pros split ${hand[0].rank}s against ${upTxt}`;
    if (r === 11 || r === 8) return { move: 'split', why: r === 11 ? 'Always split Aces — two shots at 21' : 'Always split 8s — 16 is the worst hand in the game' };
    if ((r === 2 || r === 3 || r === 7) && between(2, 7)) return { move: 'split', why: pairWhy };
    if (r === 4 && between(5, 6)) return { move: 'split', why: pairWhy };
    if (r === 6 && between(2, 6)) return { move: 'split', why: pairWhy };
    if (r === 9 && (between(2, 6) || between(8, 9))) return { move: 'split', why: pairWhy };
  }

  if (soft && total < 21) {
    if (total >= 20) return { move: 'stand', why: `Soft ${total} is already strong` };
    if (total === 19) return up === 6 ? dbl('stand', 'Dealer 6 is weak — double soft 19') : { move: 'stand', why: 'Soft 19 is strong — stand' };
    if (total === 18) {
      if (between(2, 6)) return dbl('stand', `Dealer ${up} is weak — double soft 18`);
      if (between(7, 8)) return { move: 'stand', why: `Soft 18 beats what dealer ${up} usually makes` };
      return { move: 'hit', why: `Soft 18 is behind against ${upTxt} and can't bust` };
    }
    if (total <= 12) return { move: 'hit', why: 'You can\'t bust — hit' };
    const lo = total === 17 ? 3 : total >= 15 ? 4 : 5;
    if (between(lo, 6)) return dbl('hit', `Dealer ${up} is likely to bust — double your soft hand`);
    return { move: 'hit', why: `Soft ${total} can't bust with one card — hit` };
  }

  if (total >= 17) return { move: 'stand', why: `${total} is too high to risk another card` };
  if (total >= 13) return between(2, 6)
    ? { move: 'stand', why: `Dealer ${up} busts often — let them take the risk` }
    : { move: 'hit', why: `Dealer ${upTxt} usually makes 17+ — you need more` };
  if (total === 12) return between(4, 6)
    ? { move: 'stand', why: `Dealer ${up} busts often — stand on 12` }
    : { move: 'hit', why: 'Only a 10-value card busts 12 — hit' };
  if (total === 11) return dbl('hit', '11 is the best doubling hand there is');
  if (total === 10) return between(2, 9) ? dbl('hit', `10 against ${upTxt} is a great doubling spot`) : { move: 'hit', why: `Dealer ${upTxt} is strong — just hit` };
  if (total === 9) return between(3, 6) ? dbl('hit', `Dealer ${up} is weak — double 9`) : { move: 'hit', why: 'You can\'t bust — hit' };
  return { move: 'hit', why: 'You can\'t bust — hit' };
}
