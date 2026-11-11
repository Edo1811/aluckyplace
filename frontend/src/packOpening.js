// Pack opening: a case-opening reel, synthesized sound + haptics, reveals that
// escalate with rarity, and Open ×5 with a summary.
//
// Honesty rules: the reel always lands on the item the server rolled, and the
// filler cards are drawn with the pack's real odds from the real catalog, so
// what flies past the marker is exactly as rare as the odds say. Spin length
// never depends on the result, so it can't give the rarity away early.

import { RARITY_COLORS, CATEGORY_LABELS } from './cosmeticPreview.js';
import { flash, rays, sparkle, coin3d, invalidateMyEquipped } from './cosmeticFx.js';

const LV = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Exotic: 5 };
const RARS = ['Common', 'Rare', 'Epic', 'Legendary', 'Exotic'];
const GLYPH = {
  avatar_frame: '◎', name_aura: '✺', name_color: '●', name_font: 'Aa', chat_badge: '⬢',
  status_title: '❝', custom_emoji: '☺', win_effect: '✸', profile_backdrop: '▣',
};
const CARD = 96, GAP = 8, CW = CARD + GAP; // reel card width and pitch
const TAU = Math.PI * 2;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const col = (r) => RARITY_COLORS[r] || '#9ca3af';
const rgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(','); };
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

/* ================= sound + haptics ================= */
const MUTE_KEY = 'alp_pack_mute';
const isMuted = () => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } };
const setMuted = (m) => { try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* storage off */ } };
let ac = null;
function audio() {
  if (isMuted()) return null;
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(f, dur, { type = 'triangle', vol = 0.06, at = 0, slide = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, { vol = 0.06, at = 0, from = 800, to = 4000, type = 'bandpass' } = {}) {
  const a = audio(); if (!a) return;
  const t = a.currentTime + at, n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = b; f.type = type; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}
const vib = (p) => { try { if (!isMuted() && navigator.vibrate) navigator.vibrate(p); } catch { /* unsupported */ } };
const SFX = {
  start() { hiss(0.55, { from: 250, to: 3200, vol: 0.05 }); },
  tick(slow) { tone(650 + slow * 750, 0.04, { type: 'square', vol: 0.022 + slow * 0.018 }); },
  boom() { tone(52, 1.3, { type: 'sine', vol: 0.3, slide: 0.45 }); hiss(1.1, { from: 180, to: 50, type: 'lowpass', vol: 0.18 }); },
  reveal(lv) {
    if (lv === 1) { tone(660, 0.12, { vol: 0.06 }); tone(880, 0.16, { at: 0.08, vol: 0.06 }); return; }
    if (lv === 2) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { at: i * 0.06, vol: 0.06 })); return; }
    if (lv === 3) {
      tone(98, 0.6, { type: 'sine', vol: 0.22, slide: 0.5 }); hiss(0.4, { from: 3000, to: 200, type: 'lowpass', vol: 0.12 });
      [392, 494, 587, 784].forEach((f) => tone(f, 0.7, { type: 'sawtooth', vol: 0.022 })); return;
    }
    if (lv === 4) {
      tone(65, 0.9, { type: 'sine', vol: 0.25, slide: 0.6 });
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.5, { at: i * 0.07, vol: 0.06 }));
      for (let i = 0; i < 8; i++) tone(2000 + Math.random() * 2000, 0.15, { at: 0.45 + i * 0.07, type: 'sine', vol: 0.025 });
      hiss(1.2, { from: 1500, to: 9000, vol: 0.04, at: 0.3 }); return;
    }
    [261, 329, 392, 523, 659, 784, 1047].forEach((f) => tone(f, 1.6, { type: 'sawtooth', vol: 0.018 }));
    [1047, 1319, 1568, 2093, 2637].forEach((f, i) => tone(f, 0.4, { at: 0.15 + i * 0.08, vol: 0.05 }));
    for (let i = 0; i < 14; i++) tone(2400 + Math.random() * 2600, 0.18, { at: 0.5 + i * 0.06, type: 'sine', vol: 0.022 });
    hiss(1.6, { from: 400, to: 12000, vol: 0.06 });
  },
};

/* ================= styles ================= */
const CSS = `
.po{position:fixed;inset:0;z-index:80;background:#040404;display:none;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;color:#fff;-webkit-user-select:none;user-select:none;touch-action:manipulation}
.po.on{display:flex}
.po.shake{animation:poShake .45s cubic-bezier(.36,.07,.19,.97)}
@keyframes poShake{10%,90%{transform:translate(-2px,1px)}20%,80%{transform:translate(4px,-2px)}30%,50%,70%{transform:translate(-7px,3px)}40%,60%{transform:translate(7px,-3px)}}
.po-bg{position:absolute;inset:0;background:radial-gradient(60% 42% at 50% 46%,var(--tint,rgba(255,255,255,.05)),transparent 72%);transition:background .18s}
.po-black{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:6;transition:opacity .25s}
.po-black.on{opacity:1}
.po-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
.po-top{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;padding:14px 16px;z-index:7}
.po-title{font-family:var(--pf,Georgia,serif);font-weight:700;font-size:18px}
.po-sub{font-size:10px;color:rgba(255,255,255,.38);letter-spacing:.16em;text-transform:uppercase;margin-top:2px}
.po-ib{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.po-main{position:relative;z-index:4;width:100%;display:flex;flex-direction:column;align-items:center}
.po-reel{position:relative;width:100%;max-width:680px;height:156px;overflow:hidden;transition:opacity .3s,transform .3s;-webkit-mask-image:linear-gradient(90deg,transparent,#000 16%,#000 84%,transparent);mask-image:linear-gradient(90deg,transparent,#000 16%,#000 84%,transparent)}
.po-reel.hide{opacity:0;transform:scale(.94);pointer-events:none}
.po-strip{position:absolute;left:0;top:16px;display:flex;gap:${GAP}px;will-change:transform}
.po-card{flex:0 0 ${CARD}px;height:124px;border-radius:14px;border:1px solid;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 8px;text-align:center}
.po-card::after{content:'';position:absolute;left:0;right:0;bottom:0;height:4px;background:var(--c);box-shadow:0 0 12px var(--c)}
.po-card .g{font-size:30px;line-height:1;text-shadow:0 0 14px var(--c)}
.po-card .n{font-size:10.5px;font-weight:700;line-height:1.25;color:rgba(255,255,255,.85);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.po-card.win{animation:poWin .5s cubic-bezier(.2,1.6,.4,1)}
@keyframes poWin{0%{transform:scale(1)}40%{transform:scale(1.14)}100%{transform:scale(1.06)}}
.po-mark{position:absolute;left:50%;top:4px;bottom:4px;width:3px;margin-left:-1.5px;border-radius:2px;background:var(--mk,#fff);box-shadow:0 0 14px var(--mk,#fff),0 0 4px var(--mk,#fff);z-index:3;transition:background .15s,box-shadow .15s}
.po-mark::before,.po-mark::after{content:'';position:absolute;left:50%;margin-left:-8px;border:8px solid transparent}
.po-mark::before{top:-4px;border-top-color:var(--mk,#fff)}
.po-mark::after{bottom:-4px;border-bottom-color:var(--mk,#fff)}
.po-hint{margin-top:18px;font-size:12px;color:rgba(255,255,255,.36);font-style:italic;min-height:16px}
.po-prog{display:flex;gap:6px;margin-bottom:18px;min-height:8px}
.po-prog i{width:22px;height:5px;border-radius:3px;background:rgba(255,255,255,.12)}
.po-prog i.on{background:var(--c,#fff);box-shadow:0 0 8px var(--c,#fff)}
.po-res{position:absolute;inset:0;z-index:5;display:none;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:70px 20px 24px;text-align:center}
.po-res.on{display:flex}
.po-big{width:220px;min-height:200px;border-radius:22px;border:1px solid var(--c);background:linear-gradient(165deg,var(--c2),#0b0b0b 62%);box-shadow:0 0 50px var(--c3),0 24px 60px rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px 12px;position:relative}
.po-big.l1,.po-big.l2,.po-big.l3{animation:poIn .6s cubic-bezier(.2,1.5,.4,1) both}
.po-big.l4{animation:poSlow 1.25s cubic-bezier(.16,1,.3,1) both}
.po-big.l5{animation:poExo 1.4s cubic-bezier(.16,1,.3,1) both}
@keyframes poIn{0%{transform:scale(.3) rotateY(160deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes poSlow{0%{transform:scale(.25) rotate(-8deg);opacity:0;filter:brightness(3)}55%{transform:scale(1.12) rotate(1deg);opacity:1}100%{transform:none;filter:none}}
@keyframes poExo{0%{transform:scale(0);opacity:0;filter:blur(12px) brightness(4) hue-rotate(0deg)}50%{transform:scale(1.15);opacity:1;filter:blur(0) brightness(1.6) hue-rotate(180deg)}100%{transform:none;filter:none}}
.po-big.l5::before{content:'';position:absolute;inset:-3px;border-radius:24px;padding:3px;background:linear-gradient(90deg,#f97316,#ec4899,#8b5cf6,#22d3ee,#f97316);background-size:300% 100%;animation:poRb 2.4s linear infinite;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
@keyframes poRb{to{background-position:-300% 0}}
.po-tier{font-size:34px;font-weight:800;letter-spacing:.03em;margin-top:14px;text-shadow:0 0 22px currentColor;opacity:0;animation:poUp .45s .25s ease-out forwards}
.po-tier.l5{background:linear-gradient(90deg,#f97316,#ec4899,#8b5cf6,#22d3ee,#f97316);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;animation:poUp .45s .25s ease-out forwards,poRb 2.4s linear infinite}
.po-name{font-size:18px;font-weight:700;opacity:0;animation:poUp .4s .4s ease-out forwards}
.po-cat{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.35);opacity:0;animation:poUp .4s .45s ease-out forwards}
.po-dupe{font-size:12px;font-style:italic;color:rgba(255,255,255,.5);min-height:16px;opacity:0;animation:poUp .4s .5s ease-out forwards}
@keyframes poUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.po-acts{display:flex;flex-direction:column;gap:9px;width:100%;max-width:340px;margin-top:14px;opacity:0;animation:poUp .4s .65s ease-out forwards}
.po-acts .row{display:flex;gap:9px}.po-acts .row .btn{flex:1}
.po-again{font-size:16px!important;padding:16px!important}
.po-sum{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:100%;max-width:640px}
.po-sc{border-radius:14px;border:1px solid var(--c);background:linear-gradient(165deg,var(--c2),#0b0b0b 70%);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;opacity:0;animation:poIn .5s cubic-bezier(.2,1.5,.4,1) forwards}
.po-sc.best{box-shadow:0 0 24px var(--c3)}
.po-sc .pv{height:64px;display:flex;align-items:center;justify-content:center;transform:scale(.62);transform-origin:center}
.po-sc .n{font-size:10.5px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.po-sc .r{font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.po-sc .d{font-size:9px;color:rgba(255,255,255,.4)}
@media(max-width:560px){.po-sum{grid-template-columns:repeat(3,1fr)}}
`;

/* ================= the opener ================= */
let catalog = null, catalogReq = null;

/**
 * deps: { api, preview(item, big) → html, getA() → number, setA(a), onClose(), toast(msg, tone) }
 * Returns { open(pack, count), destroy() } where pack = { type, name, price, odds: {Rarity: percent} }.
 */
export function createPackOpener(deps) {
  if (!document.getElementById('po-css')) document.head.insertAdjacentHTML('beforeend', `<style id="po-css">${CSS}</style>`);
  const root = document.createElement('div');
  root.className = 'po';
  root.innerHTML = `<div class="po-bg"></div><canvas class="po-fx"></canvas><div class="po-black"></div>
    <div class="po-top"><div><div class="po-title"></div><div class="po-sub"></div></div>
      <div style="display:flex;gap:8px"><button class="po-ib" data-mute aria-label="Sound"></button><button class="po-ib" data-close aria-label="Close">✕</button></div></div>
    <div class="po-main"><div class="po-prog"></div><div class="po-reel"><div class="po-strip"></div><div class="po-mark"></div></div><div class="po-hint"></div></div>
    <div class="po-res"></div>`;
  document.body.appendChild(root);
  const $ = (s) => root.querySelector(s);
  const reel = $('.po-reel'), strip = $('.po-strip'), hint = $('.po-hint'), res = $('.po-res'), prog = $('.po-prog'), fxCv = $('.po-fx'), fx = fxCv.getContext('2d');
  const muteBtn = $('[data-mute]');
  const paintMute = () => { muteBtn.textContent = isMuted() ? '🔇' : '🔊'; };
  paintMute();
  muteBtn.addEventListener('click', (e) => { e.stopPropagation(); setMuted(!isMuted()); paintMute(); });
  $('[data-close]').addEventListener('click', (e) => { e.stopPropagation(); close(); });

  let busy = false, spinCtl = null, advance = null, alive = true;
  root.addEventListener('click', () => { if (spinCtl) spinCtl.skip(); else if (advance) advance(); });

  if (!catalog && !catalogReq) catalogReq = deps.api.get('/shop/catalog').then((r) => { catalog = r.items || []; }).catch(() => { catalog = []; }).finally(() => { catalogReq = null; });

  /* ---------- reveal particles (fx canvas) ---------- */
  const parts = [], rings = [], coins = [];
  let flashA = 0, flashRgb = '255,255,255', rayState = null, ambient = null, fxRaf = 0;
  function fxStart() { if (!fxRaf) fxRaf = requestAnimationFrame(fxStep); }
  function fxStep(now) {
    fxRaf = 0; if (!alive) return;
    const d = Math.min(2, devicePixelRatio || 1), W = root.clientWidth, H = root.clientHeight;
    if (fxCv.width !== Math.round(W * d)) { fxCv.width = Math.round(W * d); fxCv.height = Math.round(H * d); }
    fx.setTransform(d, 0, 0, d, 0, 0); fx.clearRect(0, 0, W, H); fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
    const t = now / 1000, cx = W / 2, cy = H * 0.42, dt = 1 / 60;
    if (rayState) { const k = Math.min(1, (t - rayState.t0) * 1.5); rays(fx, cx, cy, 20, Math.max(W, H) * 0.75, t * 0.25, rayState.rainbow ? `${Math.round(128 + 127 * Math.sin(t * 2))},${Math.round(128 + 127 * Math.sin(t * 2 + 2))},${Math.round(128 + 127 * Math.sin(t * 2 + 4))}` : rayState.rgb, 0.16 * k); }
    if (flashA > 0.01) { flash(fx, cx, cy, Math.max(W, H) * 0.6, flashRgb, flashA); flashA *= 0.9; }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.age += dt; if (r.age < 0) continue;
      const rad = r.age * r.speed, a = Math.max(0, 1 - r.age / r.life); if (a <= 0) { rings.splice(i, 1); continue; }
      fx.save(); fx.globalCompositeOperation = 'lighter'; fx.strokeStyle = r.hue != null ? `hsla(${r.hue + t * 120},95%,65%,${a})` : `rgba(${r.rgb},${a})`; fx.lineWidth = r.w * a + 0.5;
      fx.beginPath(); fx.arc(cx, cy, rad, 0, TAU); fx.stroke(); fx.restore();
    }
    fx.save(); fx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt; if (p.age < 0) continue;
      if (p.age > p.life) { parts.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const a = 1 - p.age / p.life;
      fx.globalAlpha = a; fx.fillStyle = p.hue != null ? `hsl(${(p.hue + t * 90) % 360},95%,65%)` : p.c;
      if (p.star) { fx.restore(); sparkle(fx, p.x, p.y, p.s * (0.6 + 0.4 * Math.sin(p.age * 20)), p.c || '#fff', a); fx.save(); fx.globalCompositeOperation = 'lighter'; }
      else { fx.beginPath(); fx.arc(p.x, p.y, p.s, 0, TAU); fx.fill(); }
    }
    fx.restore(); fx.globalAlpha = 1;
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i]; c.age += dt; if (c.age < 0) continue; if (c.y > H + 30) { coins.splice(i, 1); continue; }
      c.vy += 600 * dt; c.x += c.vx * dt; c.y += c.vy * dt; coin3d(fx, c.x, c.y, c.r, c.age * c.spin, 1);
    }
    if (ambient && Math.random() < ambient.rate) {
      const a = Math.random() * TAU, rr = 130 + Math.random() * 70;
      parts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.9, vx: 0, vy: -12, g: 0, drag: 1, s: 4 + Math.random() * 4, life: 0.9, age: 0, star: true, c: ambient.c });
    }
    if (parts.length || rings.length || coins.length || flashA > 0.01 || rayState || ambient) fxRaf = requestAnimationFrame(fxStep);
    else fx.clearRect(0, 0, W, H);
  }
  function fxClear() { parts.length = 0; rings.length = 0; coins.length = 0; flashA = 0; rayState = null; ambient = null; }
  function burst(lv, rarity, small) {
    const W = root.clientWidth, H = root.clientHeight, cx = W / 2, cy = H * 0.42, c = col(rarity), cr = rgb(c), k = small ? 0.55 : 1;
    const spray = (n, sp0, sp1, opts = {}) => {
      for (let i = 0; i < n * k; i++) {
        const a = Math.random() * TAU, sp = sp0 + Math.random() * (sp1 - sp0);
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: opts.g ?? 260, drag: 0.965, s: (opts.s ?? 2.4) * (0.6 + Math.random() * 0.8), life: (opts.life ?? 1.1) * (0.7 + Math.random() * 0.6), age: -(opts.delay || 0) * Math.random(), c: Math.random() < 0.3 ? '#fff' : c, hue: opts.rainbow ? Math.random() * 360 : null, star: opts.star && Math.random() < 0.25 });
      }
    };
    flashRgb = cr;
    if (lv === 1) { spray(26, 120, 300, { life: 0.7 }); flashA = 0.25; }
    if (lv === 2) { spray(55, 180, 480); rings.push({ age: 0, speed: 520, life: 0.7, w: 4, rgb: cr }); flashA = 0.45; }
    if (lv === 3) { spray(90, 220, 620, { star: true }); [0, 0.1, 0.2].forEach((d) => rings.push({ age: -d, speed: 640, life: 0.85, w: 6, rgb: cr })); flashA = 0.7; }
    if (lv === 4) {
      spray(110, 220, 700, { star: true, life: 1.5 }); [0, 0.12].forEach((d) => rings.push({ age: -d, speed: 700, life: 0.9, w: 7, rgb: cr }));
      for (let i = 0; i < 60 * k; i++) coins.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * 760, vy: -260 - Math.random() * 520, r: 6 + Math.random() * 6, spin: 6 + Math.random() * 8, age: -Math.random() * 0.25 });
      flashA = 0.95; if (!small) { rayState = { t0: performance.now() / 1000, rgb: '255,214,120' }; ambient = { rate: 0.25, c: '#fff1b8' }; }
    }
    if (lv === 5) {
      spray(240, 200, 900, { rainbow: true, star: true, life: 1.8, g: 120 }); [0, 0.08, 0.16, 0.24].forEach((d) => rings.push({ age: -d, speed: 760, life: 1, w: 8, hue: d * 900 }));
      flashA = 1; flashRgb = '255,255,255'; if (!small) { rayState = { t0: performance.now() / 1000, rainbow: true }; ambient = { rate: 0.4, c: '#ffffff' }; }
    }
    fxStart();
  }

  /* ---------- the reel ---------- */
  const rollRarity = (odds) => {
    const tot = Object.values(odds).reduce((a, b) => a + b, 0); let x = Math.random() * tot;
    for (const r of RARS) { if (!odds[r]) continue; x -= odds[r]; if (x < 0) return r; }
    return RARS.filter((r) => odds[r]).pop();
  };
  const filler = (odds) => {
    const r = rollRarity(odds), pool = (catalog || []).filter((i) => i.rarity === r);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : { name: r, category: '', rarity: r };
  };
  const cardHTML = (it) => { const c = col(it.rarity); return `<div class="po-card" style="--c:${c};border-color:${c}66;background:linear-gradient(170deg,${c}45,#0d0d0d 72%)"><div class="g" style="color:${c}">${GLYPH[it.category] || '✦'}</div><div class="n">${esc(it.name)}</div></div>`; };
  const setTint = (r) => { const c = col(r); root.style.setProperty('--tint', `${c}33`); root.style.setProperty('--mk', c); };

  /** Starts free-spinning immediately; land(result) decelerates onto the rolled item. */
  function spin(pack, fast) {
    const cards = []; const add = (n) => { let h = ''; for (let i = 0; i < n; i++) { const it = filler(pack.odds); cards.push(it); h += cardHTML(it); } strip.insertAdjacentHTML('beforeend', h); };
    strip.innerHTML = ''; add(fast ? 90 : 130);
    const v0 = fast ? 3200 : 2700, startAt = performance.now();
    let x = Math.random() * CW, phase = 'free', xs = 0, D = 0, T = 1, ts = 0, last = performance.now(), lastIdx = -1, skipped = false, raf = 0, done;
    const landed = new Promise((r) => { done = r; });
    const half = () => reel.clientWidth / 2;
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; let slow = 0;
      if (phase === 'free') { x += v0 * dt; if (x + half() > (cards.length - 30) * CW) add(40); }
      else {
        const p = skipped ? 1 : Math.min(1, (now - ts) / 1000 / T);
        x = xs + D * (1 - Math.pow(1 - p, 3)); slow = 1 - Math.pow(1 - p, 2);
        if (p >= 1) phase = 'done';
      }
      strip.style.transform = `translate3d(${-x}px,0,0)`;
      const idx = Math.floor((x + half() + GAP / 2) / CW);
      if (idx !== lastIdx && cards[idx]) {
        lastIdx = idx;
        if (!skipped) { SFX.tick(slow); if (phase !== 'free' && slow > 0.55) vib(slow > 0.85 ? 12 : 6); }
        if (phase !== 'free' && slow > 0.35) setTint(cards[idx].rarity);
      }
      if (phase === 'done') { strip.children[lastIdx]?.classList.add('win'); done(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return {
      landed,
      skip() { if (phase === 'decel') skipped = true; },
      cancel() { cancelAnimationFrame(raf); },
      async land(result) {
        const minFree = fast ? 250 : 550, waited = performance.now() - startAt;
        if (waited < minFree) await new Promise((r) => setTimeout(r, minFree - waited));
        const dist = v0 * (fast ? 2.3 : 4.3) / 3;
        let k = Math.round((x + dist + half() - CARD / 2) / CW);
        while (k > cards.length - 8) add(40);
        cards[k] = { ...result.item, rarity: result.rarity || result.item.rarity };
        strip.children[k].outerHTML = cardHTML(cards[k]);
        const jitter = (Math.random() - 0.5) * CARD * 0.72;
        xs = x; D = k * CW + CARD / 2 - half() + jitter - x; T = (3 * D) / v0; ts = performance.now(); phase = 'decel';
        return landed;
      },
    };
  }

  /* ---------- flow ---------- */
  function resetStage(pack, count) {
    fxClear(); fx.clearRect(0, 0, fxCv.width, fxCv.height);
    root.style.setProperty('--tint', 'rgba(255,255,255,.05)'); root.style.setProperty('--mk', '#fff');
    $('.po-title').textContent = pack.name; $('.po-sub').textContent = count > 1 ? `Opening ×${count}` : `${pack.price} A`;
    res.className = 'po-res'; res.innerHTML = ''; reel.classList.remove('hide'); hint.textContent = '';
    prog.innerHTML = count > 1 ? Array.from({ length: count }, () => '<i></i>').join('') : '';
  }
  function close() {
    alive = false; spinCtl && spinCtl.cancel(); spinCtl = null; advance = null; busy = false; fxClear();
    cancelAnimationFrame(fxRaf); fxRaf = 0; root.classList.remove('on'); deps.onClose && deps.onClose();
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function pull(pack, fast) {
    const req = deps.api.post('/shop/packs/open', { pack_type: pack.type });
    spinCtl = spin(pack, fast); SFX.start(); hint.textContent = 'Tap to skip';
    let r;
    try { r = await req; } catch (err) { spinCtl.cancel(); spinCtl = null; throw err; }
    deps.setA(r.a_balance);
    await spinCtl.land(r);
    spinCtl = null; hint.textContent = '';
    return r;
  }

  function resultCard(r, lv) {
    const c = col(r.rarity);
    return `<div class="po-big l${lv}" style="--c:${c};--c2:${c}40;--c3:${c}88">${deps.preview(r.item, true)}</div>
      <div class="po-tier l${lv}"${lv === 5 ? '' : ` style="color:${c}"`}>${esc(r.rarity)}</div>
      <div class="po-name">${esc(r.item.name)}</div><div class="po-cat">${esc(CATEGORY_LABELS[r.item.category] || '')}</div>
      <div class="po-dupe">${r.duplicate ? `Already yours, so you got ${fmt(r.refund_a)} A back` : ''}</div>`;
  }
  async function reveal(r, small) {
    const lv = LV[r.rarity] || 1;
    await sleep(small ? 120 : 260);
    if (lv === 5) { $('.po-black').classList.add('on'); SFX.boom(); vib([60, 40, 160]); await sleep(small ? 450 : 850); $('.po-black').classList.remove('on'); }
    reel.classList.add('hide');
    SFX.reveal(lv); burst(lv, r.rarity, small);
    if (lv >= 3) { root.classList.remove('shake'); void root.offsetWidth; root.classList.add('shake'); }
    if (lv >= 4) vib(lv === 5 ? [30, 30, 30, 30, 200] : [40, 30, 120]); else if (lv >= 2) vib(25);
    setTint(r.rarity);
    res.innerHTML = resultCard(r, lv); res.classList.add('on');
  }

  function actionsHTML(pack, count, canEquip) {
    const A = deps.getA(), one = A >= pack.price, five = A >= pack.price * 5;
    return `<div class="po-acts">
      <button class="btn ${one ? 'gold' : ''} po-again" data-again="1" ${one ? '' : 'disabled'}>${one ? `Open another · ${pack.price} A` : `Need ${fmt(pack.price - A)} more A`}</button>
      <div class="row">${canEquip ? '<button class="btn em" data-equip>Equip it</button>' : ''}
        <button class="btn ${five ? '' : ''}" data-again="5" ${five ? '' : 'disabled'}>Open ×5 · ${pack.price * 5} A</button>
        <button class="btn" data-done>Done</button></div></div>`;
  }
  function bindActions(pack, item) {
    res.querySelectorAll('[data-again]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); open(pack, Number(b.dataset.again)); }));
    res.querySelector('[data-done]')?.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    res.querySelector('[data-equip]')?.addEventListener('click', async (e) => {
      e.stopPropagation(); const b = e.currentTarget; b.disabled = true;
      try { await deps.api.post(`/cosmetics/${item.id}/equip`); invalidateMyEquipped(); deps.toast(`${item.name} equipped`, 'em'); b.textContent = 'Equipped ✓'; }
      catch (err) { deps.toast(err.message || 'Could not equip', 'red'); b.disabled = false; }
    });
  }

  async function open(pack, count = 1) {
    if (busy) return;
    if (deps.getA() < pack.price * count) { deps.toast('Not enough A for that', 'red'); return; }
    busy = true; alive = true; root.classList.add('on'); resetStage(pack, count);
    if (catalogReq) await Promise.race([catalogReq, sleep(1200)]);
    const got = [];
    try {
      for (let i = 0; i < count; i++) {
        if (!alive) return;
        if (i) { fxClear(); res.className = 'po-res'; res.innerHTML = ''; reel.classList.remove('hide'); root.style.setProperty('--tint', 'rgba(255,255,255,.05)'); root.style.setProperty('--mk', '#fff'); }
        let r;
        try { r = await pull(pack, count > 1); }
        catch (err) { deps.toast(err.message || 'Could not open the pack', 'red'); if (!got.length) { busy = false; close(); return; } break; }
        if (!alive) return;
        got.push(r);
        if (count > 1) { const dot = prog.children[i]; dot.classList.add('on'); dot.style.setProperty('--c', col(r.rarity)); }
        await reveal(r, count > 1);
        if (count > 1 && i < count - 1) {
          hint.textContent = '';
          await new Promise((resolve) => { advance = resolve; setTimeout(resolve, (LV[r.rarity] || 1) >= 4 ? 2200 : 1300); });
          advance = null;
        }
      }
    } finally { busy = false; }
    if (!alive) return;
    if (count === 1) {
      const r = got[0];
      res.insertAdjacentHTML('beforeend', actionsHTML(pack, 1, !r.duplicate));
      bindActions(pack, r.item);
      return;
    }
    // ×5 summary
    await sleep(900);
    fxClear(); reel.classList.add('hide');
    const sorted = [...got].sort((a, b) => (LV[b.rarity] || 0) - (LV[a.rarity] || 0));
    const refunds = got.reduce((s, r) => s + (r.duplicate ? Number(r.refund_a) || 0 : 0), 0);
    const best = sorted[0], bc = col(best.rarity);
    setTint(best.rarity);
    prog.innerHTML = '';
    res.innerHTML = `<div class="po-tier l${LV[best.rarity]}" style="${LV[best.rarity] === 5 ? '' : `color:${bc};`}margin:0 0 4px">Best: ${esc(best.rarity)}</div>
      <div class="po-sum">${sorted.map((r, i) => { const c = col(r.rarity); return `<div class="po-sc${i ? '' : ' best'}" style="--c:${c};--c2:${c}40;--c3:${c}99;animation-delay:${i * 0.09}s">
        <div class="pv">${deps.preview(r.item, false)}</div><div class="n">${esc(r.item.name)}</div><div class="r" style="color:${c}">${esc(r.rarity)}</div>
        <div class="d">${r.duplicate ? `dupe · +${fmt(r.refund_a)} A` : 'new'}</div></div>`; }).join('')}</div>
      <div class="po-dupe" style="margin-top:8px">${refunds ? `Duplicates refunded ${fmt(refunds)} A in total` : 'No duplicates'}</div>
      ${actionsHTML(pack, 5, false)}`;
    res.className = 'po-res on';
    if ((LV[best.rarity] || 1) >= 4) { SFX.reveal(LV[best.rarity]); burst(LV[best.rarity], best.rarity, true); }
    bindActions(pack, best.item);
  }

  return { open, destroy() { close(); root.remove(); } };
}
