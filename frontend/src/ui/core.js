// Shared UI primitives used by every page.
//   - page lifecycle (onLeave cleanups run on every navigation)
//   - dock, balance pill, toasts, bottom sheets
//   - formatting + escaping helpers
//   - player rendering (frame, styled name, badge) on top of cosmeticPreview.js

import { store } from '../store.js';
import {
  COSMETIC_PREVIEW_KEYFRAMES, RARITY_COLORS,
  auraNameStyle, nameColorStyle, nameFontFamily, renderAvatarFrame,
} from '../cosmeticPreview.js';

// ── lifecycle ────────────────────────────────────────────────────────────────
let cleanups = [];
/** Register something to undo when the user navigates away (socket.off, timers, listeners). */
export function onLeave(fn) { cleanups.push(fn); }
/** Called by the router before rendering the next page. */
export function runLeave() {
  const fns = cleanups; cleanups = [];
  fns.forEach((f) => { try { f(); } catch (e) { console.warn('[leave]', e); } });
  closeSheets();
  document.querySelectorAll('body > .sheet').forEach((s) => s.remove());
}
/** setInterval that is cleared automatically on navigation. */
export function every(ms, fn) { const id = setInterval(fn, ms); onLeave(() => clearInterval(id)); return id; }
/** setTimeout that is cleared automatically on navigation. */
export function later(ms, fn) { const id = setTimeout(fn, ms); onLeave(() => clearTimeout(id)); return id; }
/** document/window listener that is removed automatically on navigation. */
export function listen(target, ev, fn, opts) { target.addEventListener(ev, fn, opts); onLeave(() => target.removeEventListener(ev, fn, opts)); }

// Cosmetic keyframes once, globally (pages used to each inline a copy).
if (!document.getElementById('cosmetic-kf')) {
  const st = document.createElement('style');
  st.id = 'cosmetic-kf';
  st.textContent = COSMETIC_PREVIEW_KEYFRAMES;
  document.head.appendChild(st);
}

// ── formatting ───────────────────────────────────────────────────────────────
export const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (id) => document.getElementById(id);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hexA(c, a) {
  const n = parseInt(String(c).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
export const amountOf = (s) => Math.max(0, parseInt(String(s ?? '').replace(/[^0-9]/g, ''), 10) || 0);
export { RARITY_COLORS };
export function rarityPill(r) {
  const c = RARITY_COLORS[r] || '#9ca3af';
  return `<span class="rar" style="color:${c};background:${hexA(c, .12)};border:1px solid ${hexA(c, .25)}">${esc(r)}</span>`;
}

// ── players ──────────────────────────────────────────────────────────────────
/** cosmetics: array [{category, rarity, preview_key}] (social/guild) or map {category: {...}} (profile). */
export function equippedMap(cosmetics) {
  if (!cosmetics) return {};
  if (!Array.isArray(cosmetics)) return cosmetics;
  const m = {};
  cosmetics.forEach((c) => { if (c && c.category) m[c.category] = c; });
  return m;
}
const initial = (u, px) => `<span class="av-initial" style="font-size:${Math.round(px)}px">${esc(String(u || '?').slice(0, 1).toUpperCase())}</span>`;
/** Avatar with the equipped frame; the face is the username's initial. */
export function playerFrame(username, cosmetics, size) {
  const eq = equippedMap(cosmetics);
  return renderAvatarFrame(eq.avatar_frame || null, size, initial(username, size * 0.29));
}
/** Username wearing its equipped colour, font and aura — identical layering everywhere. */
export function playerName(username, cosmetics, size) {
  const eq = equippedMap(cosmetics);
  const a = auraNameStyle(eq.name_aura || null);
  const col = nameColorStyle(eq.name_color || null);
  const font = nameFontFamily(eq.name_font || null);
  const cls = `pname ${col.className} ${font.className} ${a.className}`.trim();
  return `<span class="${cls}" style="font-size:${size || 14}px;${col.style}${font.style}${a.style}">${esc(username)}</span>`;
}
const BADGE_ICONS = {
  badge_lucky_clover: ['🍀', '#22c55e'], badge_dice_pip: ['🎲', '#e5e7eb'], badge_poker_chip: ['🪙', '#dc2626'],
  badge_ace_card: ['🃏', '#e5e7eb'], badge_neon_skull: ['💀', '#84cc16'], badge_cherry_bomb: ['💣', '#dc2626'],
  badge_crystal_ball: ['🔮', '#a855f7'], badge_black_diamond: ['♦️', '#1e3a8a'], badge_flame_sigil: ['🔥', '#f97316'],
  badge_golden_skull: ['💀', '#D4AF37'], badge_royal_seal: ['🛡️', '#4338ca'], badge_void_sigil: ['🌀', '#581c87'],
};
export function playerBadge(cosmetics) {
  const b = equippedMap(cosmetics).chat_badge;
  if (!b) return '';
  const [icon, tint] = BADGE_ICONS[b.preview_key] || ['🏷️', RARITY_COLORS[b.rarity] || '#9ca3af'];
  return `<span class="badge" style="background:${hexA(tint, .14)};border-color:${hexA(tint, .35)}">${icon}</span>`;
}
/** Status title text, if the source includes its name (profile does; aggregates don't). */
export function playerTitle(cosmetics) {
  const t = equippedMap(cosmetics).status_title;
  return t && t.name ? t.name : '';
}

// ── dock ─────────────────────────────────────────────────────────────────────
const DOCK = [
  ['home', 'Home', '<path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/>'],
  ['games', 'Games', '<rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/>'],
  ['social', 'Social', '<circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/>'],
  ['shop', 'Shop', '<path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/>'],
  ['profile', 'Profile', '<circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/>'],
];
const ADMIN_ITEM = ['admin', 'Admin', '<path d="M9 1.8l6 2.4v4.3c0 3.6-2.5 6.6-6 7.7-3.5-1.1-6-4.1-6-7.7V4.2l6-2.4z"/><path d="M6.5 9l1.8 1.8L11.8 7"/>'];
export function dockHTML(active) {
  const items = store.user?.is_admin ? [...DOCK, ADMIN_ITEM] : DOCK;
  return `<nav class="dock"><div class="pill">${items.map(([k, label, svg]) =>
    `<button class="di${k === active ? ' on' : ''}" data-nav="${k}" title="${label}" aria-label="${label}" style="background:none;border:none">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${svg}</svg></button>`).join('')}</div></nav>`;
}
/** Wires every [data-nav] inside root to the router. */
export function bindNav(root) {
  root.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => {
    if (!b.classList.contains('on')) window.__navigate(b.dataset.nav);
  }));
}

// ── balance pill (live via socket balance:update) ───────────────────────────
export function balanceHTML() {
  return `<div class="balpill" data-bal><span class="cc"><b data-bal-cc>${fmt(store.ccBalance)}</b><small>CC</small></span><span class="a"><b data-bal-a>${fmt(store.aBalance)}</b><small>A</small></span></div>`;
}
/** Re-renders every balance readout on the page whenever the store changes. */
export function bindBalance() {
  const paint = () => {
    document.querySelectorAll('[data-bal-cc]').forEach((e) => { e.textContent = fmt(store.ccBalance); });
    document.querySelectorAll('[data-bal-a]').forEach((e) => { e.textContent = fmt(store.aBalance); });
  };
  listen(document, 'balance:updated', paint);
  paint();
}
/** After a REST call returns new balances. */
export function emitBalance() { document.dispatchEvent(new CustomEvent('balance:updated', { detail: { cc_balance: store.ccBalance, a_balance: store.aBalance } })); }

// ── toasts ───────────────────────────────────────────────────────────────────
export function toast(msg, kind = '') {
  let host = document.querySelector('.toasts');
  if (!host) { host = document.createElement('div'); host.className = 'toasts'; document.body.appendChild(host); }
  const map = { green: 'em', red: 'red', gold: 'gold', amber: 'amber', em: 'em' };
  const t = document.createElement('div');
  t.className = `toast ${map[kind] || ''}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2800);
}

// ── sheets ───────────────────────────────────────────────────────────────────
// Every page renders its own <div class="sheet" id="..."> markup; these open/close them.
function backdrop() {
  let b = document.querySelector('.backdrop');
  if (!b) { b = document.createElement('div'); b.className = 'backdrop'; document.body.appendChild(b); b.addEventListener('click', closeSheets); }
  return b;
}
export function openSheet(id) {
  closeSheets(true);
  const s = $(id); if (!s) return;
  if (s.parentElement !== document.body) document.body.appendChild(s);
  backdrop().classList.add('show');
  requestAnimationFrame(() => s.classList.add('open'));
  s.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => closeSheets(); });
}
export function closeSheets(keepBackdrop) {
  document.querySelectorAll('.sheet.open').forEach((s) => s.classList.remove('open'));
  if (!keepBackdrop) document.querySelector('.backdrop')?.classList.remove('show');
}
export function sheetHTML(id, title, body = '', foot = '') {
  return `<div class="sheet" id="${id}"><div class="grab"></div>
    <div class="sh-head"><h2>${title}</h2><button class="sh-x" data-close aria-label="Close">×</button></div>
    <div class="sh-body">${body}</div>${foot ? `<div class="sh-foot">${foot}</div>` : ''}</div>`;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheets(); });

// ── hold-to-confirm buttons ──────────────────────────────────────────────────
/** Turns a button into hold-to-confirm. Button needs an <i> fill and a <span> label. */
export function holdButton(btn, ms, onDone, holdingLabel) {
  const bar = btn.querySelector('i'), lab = btn.querySelector('span');
  const base = lab.textContent;
  let t0 = 0, raf = 0;
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    bar.style.width = `${k * 100}%`;
    if (k >= 1) { raf = 0; bar.style.width = '0'; lab.textContent = base; onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  btn.addEventListener('pointerdown', (e) => {
    if (btn.disabled) return;
    e.preventDefault(); t0 = performance.now();
    if (holdingLabel) lab.textContent = holdingLabel;
    raf = requestAnimationFrame(step);
  });
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; bar.style.width = '0'; lab.textContent = base; } };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((k) => btn.addEventListener(k, stop));
}
