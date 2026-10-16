// Canvas palette + helpers shared by the game pages.
export const EM = '#10b981', GOLD = '#D4AF37', RED = '#ef4444';
export const PF = '"Playfair Display",Georgia,serif';
export const w = (a) => `rgba(255,255,255,${a})`;
export const em = (a) => `rgba(16,185,129,${a})`;
export const rd = (a) => `rgba(239,68,68,${a})`;
export const gd = (a) => `rgba(212,175,55,${a})`;
export const cl = (v, a, b) => Math.max(a, Math.min(b, v));

export function rr(c, x, y, ww, hh, r) {
  r = Math.min(r, ww / 2, hh / 2);
  c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + ww - r, y); c.arcTo(x + ww, y, x + ww, y + r, r);
  c.lineTo(x + ww, y + hh - r); c.arcTo(x + ww, y + hh, x + ww - r, y + hh, r); c.lineTo(x + r, y + hh);
  c.arcTo(x, y + hh, x, y + hh - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}

const RED_SUITS = new Set(['♥', '♦', 'hearts', 'diamonds']);
const SUIT_GLYPH = { hearts: '♥', diamonds: '♦', spades: '♠', clubs: '♣' };
/** Playing card markup. Server cards are {rank, suit}; '?' means face down. */
export function cardHTML(card) {
  if (!card || card.rank === '?' || card.hidden) return '<div class="pc2 back"></div>';
  const s = SUIT_GLYPH[card.suit] || card.suit;
  const r = card.rank;
  return `<div class="pc2${RED_SUITS.has(card.suit) ? ' red' : ''}"><div>${r}</div><div class="mid">${s}</div><div class="bot">${r}</div></div>`;
}

/** Pointer press/release on an element (hold pads). */
export function pressPad(el, { down, up }) {
  el.style.touchAction = 'none';
  let held = false;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); held = true; try { el.setPointerCapture(e.pointerId); } catch { /* */ } down && down(); });
  const rel = () => { if (!held) return; held = false; up && up(); };
  ['pointerup', 'pointercancel'].forEach((k) => el.addEventListener(k, rel));
}

/** Vertical pull gesture (lever, throw pad). onMove(pull), onRelease(pull). */
export function pullGesture(el, max, { onStart, onMove, onRelease }) {
  el.style.touchAction = 'none';
  let down = false, y0 = 0, pull = 0;
  el.addEventListener('pointerdown', (e) => {
    if (onStart && onStart() === false) return;
    down = true; y0 = e.clientY; pull = 0;
    try { el.setPointerCapture(e.pointerId); } catch { /* */ }
  });
  el.addEventListener('pointermove', (e) => { if (!down) return; pull = cl(e.clientY - y0, 0, max); onMove && onMove(pull); });
  const up = () => { if (!down) return; down = false; onRelease && onRelease(pull); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
