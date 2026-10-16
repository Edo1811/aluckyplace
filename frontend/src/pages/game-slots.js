import { api } from '../api.js';
import { $, fmt, toast, later } from '../ui/core.js';
import { gameShell, fitCanvas, loop, syncBalance, eOut } from '../games/shell.js';
import { rr, w, em, gd, cl, EM, GOLD, PF, pullGesture } from '../games/draw.js';

// Server symbols → reel glyphs. Pays: 3×Diamond 100, Star 40, Dollar 15, Bell 8, Cherry 3; 2+ Cherry 2.
const SYMS = ['Diamond', 'Star', 'Dollar', 'Bell', 'Cherry'];
const GLYPH = { Diamond: '◆', Star: '★', Dollar: '$', Bell: '🔔', Cherry: '🍒' };
const N = SYMS.length;

export function renderSlots(app) {
  const shell = gameShell(app, {
    id: 'slots', title: 'Slots',
    stage: `<canvas class="fill" id="cvS"></canvas>
      <div class="lever" id="slLev"><div class="lknob" id="slKnob"></div></div>
      <div class="hint" id="slTag">Pull the lever · tap a reel to slam it to a stop</div>`,
  });

  let bet = 0, spin = false, res = null, geo = null, ready = false;
  const pos = [0, 1, 2], from = [0, 1, 2], to = [0, 1, 2], el = [0, 0, 0], dur = [1, 1, 1], tgt = [0, 0, 0];

  const lev = $('slLev'), knob = $('slKnob');
  pullGesture(lev, 118, {
    onStart: () => ready && !spin,
    onMove: (p) => { knob.style.top = `${5 + p}px`; },
    onRelease: (p) => {
      knob.style.transition = 'top .4s cubic-bezier(.2,1.4,.4,1)'; knob.style.top = '5px';
      later(420, () => { knob.style.transition = ''; });
      if (p / 118 > 0.12) pull(p / 118);
    },
  });
  const cv = $('cvS'); cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', (e) => {
    if (!spin || !geo) return;
    const r = cv.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - geo.x0) / (geo.rw + geo.gap));
    if (i >= 0 && i < 3) slam(i);
  });

  async function pull(power) {
    ready = false;
    const tag = $('slTag'); tag.textContent = 'Spinning…'; tag.style.color = ''; tag.style.fontSize = '';
    try { res = await api.post('/games/slots/spin', { amount: bet }); } catch (e) { toast(e.message, 'red'); ready = true; tag.textContent = 'Pull the lever'; return; }
    syncBalance(Number(res.cc_balance) - Number(res.payout)); // show the stake leaving now, the win when reels land
    for (let i = 0; i < 3; i++) {
      tgt[i] = SYMS.indexOf(res.reels[i]);
      from[i] = pos[i];
      const base = Math.floor(from[i]) + Math.round(10 + power * 34) + i * 7;
      to[i] = base + (((tgt[i] - base) % N) + N) % N;
      el[i] = 0; dur[i] = 0.9 + power * 1.9 + i * 0.42 + (res.nearMiss && i === 2 ? 0.9 : 0);
    }
    spin = true;
    tag.textContent = 'Tap a reel to slam it';
  }
  function slam(i) {
    if (el[i] >= dur[i]) return;
    let e = Math.ceil(pos[i] + 1.2); e += (((tgt[i] - e) % N) + N) % N;
    from[i] = pos[i]; to[i] = e; el[i] = 0; dur[i] = 0.34;
  }
  function landed() {
    syncBalance(res.cc_balance);
    const m = Number(res.multiplier), tag = $('slTag');
    tag.textContent = m ? `${res.reels.map((s) => GLYPH[s]).join(' ')} · ${m}× · +${fmt(res.payout)} CC` : res.nearMiss ? 'So close' : 'No match this time';
    tag.style.color = m ? (m >= 40 ? GOLD : EM) : 'rgba(255,255,255,.3)'; tag.style.fontSize = '13px';
    const r = res;
    later(1600, () => shell.result({
      net: Number(r.net), sub: m ? `${m}× on ${r.reels.map((s) => GLYPH[s]).join(' ')}` : 'No match', seed: r.seed,
      again: () => start(bet), change,
    }));
  }
  function start(b) {
    bet = b; res = null; spin = false; ready = true;
    const tag = $('slTag'); tag.textContent = 'Pull the lever · tap a reel to slam it to a stop'; tag.style.color = ''; tag.style.fontSize = '';
    shell.actions(''); shell.show('scPlay');
  }
  const change = () => shell.bet({ onPlace: start });

  loop((dt) => {
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    const rw = Math.min(W * 0.22, H * 0.3), rh = rw * 1.9, gap = rw * 0.16, sh = rh / 3;
    const x0 = W / 2 - (rw * 3 + gap * 2) / 2 - W * 0.05, y0 = H * 0.5 - rh / 2;
    geo = { x0, rw, gap };
    if (spin) {
      let all = true;
      for (let i = 0; i < 3; i++) {
        el[i] += dt; const k = cl(el[i] / dur[i], 0, 1);
        pos[i] = from[i] + eOut(k) * (to[i] - from[i]);
        if (k < 1) all = false;
      }
      if (all) { spin = false; landed(); }
    }
    for (let i = 0; i < 3; i++) {
      const x = x0 + i * (rw + gap), p = pos[i], fl = Math.floor(p), fr = p - fl;
      const live = spin && el[i] < dur[i];
      c.fillStyle = w(0.05); rr(c, x, y0, rw, rh, rw * 0.12); c.fill();
      c.save(); rr(c, x, y0, rw, rh, rw * 0.12); c.clip();
      for (let r = -2; r <= 2; r++) {
        const y = y0 + rh / 2 + r * sh - fr * sh, s = SYMS[((fl + r) % N + N) % N];
        c.fillStyle = s === 'Diamond' ? EM : s === 'Star' ? GOLD : w(0.72);
        c.font = `700 ${sh * 0.44}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(GLYPH[s], x + rw / 2, y);
      }
      c.restore();
      c.strokeStyle = live ? em(0.35) : w(0.1); c.lineWidth = live ? 1.6 : 1; rr(c, x, y0, rw, rh, rw * 0.12); c.stroke();
    }
    const hit = !spin && res && Number(res.multiplier) > 0;
    c.strokeStyle = hit ? em(0.7) : em(0.16); c.lineWidth = hit ? 2 : 1;
    c.beginPath(); c.moveTo(x0 - 9, H * 0.5); c.lineTo(x0 + rw * 3 + gap * 2 + 9, H * 0.5); c.stroke();
    if (hit) { const a = 0.09 + 0.06 * Math.sin(performance.now() / 150); c.fillStyle = Number(res.multiplier) >= 40 ? gd(a) : em(a); c.fillRect(0, 0, W, H); }
  });

  change();
}
