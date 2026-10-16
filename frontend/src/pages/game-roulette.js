import { api } from '../api.js';
import { $, fmt, toast, later } from '../ui/core.js';
import { gameShell, fitCanvas, loop, flick, syncBalance, eOut } from '../games/shell.js';
import { w, em, gd, cl, EM, PF } from '../games/draw.js';

const RED_N = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const SEG = (Math.PI * 2) / WHEEL.length;

// felt zone → server bet {type, value}
const ZONE = (z) => {
  if (z[0] === 'n') return { type: 'straight', value: Number(z.slice(1)) };
  if (z[0] === 'd') return { type: 'dozen', value: Number(z.slice(1)) };
  if (z[0] === 'c') return { type: 'column', value: Number(z.slice(1)) };
  if (z === 'lo' || z === 'hi') return { type: 'half', value: z === 'lo' ? 'low' : 'high' };
  if (z === 'even' || z === 'odd') return { type: 'parity', value: z };
  return { type: 'color', value: z };
};

const STYLE = `
.rtable{grid-template-columns:22px repeat(12,1fr) 24px}
.rz.col{background:rgba(255,255,255,.05);font-size:8.5px}
`;

export function renderRoulette(app) {
  const shell = gameShell(app, {
    id: 'roulette', title: 'Roulette', css: STYLE,
    stage: `<div class="pad" style="justify-content:flex-start;gap:9px">
      <div class="rwheel"><canvas class="fill" id="cvR"></canvas></div>
      <div class="ghint" id="rlHint"></div>
      <div class="statrow">
        <div><div class="stat-v" id="rlPlaced">0</div><div class="stat-l">Placed</div></div>
        <div><div class="stat-v" id="rlChip">0</div><div class="stat-l">Chip size</div></div>
        <div><div class="stat-v" id="rlLeft">0</div><div class="stat-l">Chips left</div></div>
      </div>
      <div id="rlTable"></div>
    </div>`,
  });

  let bet = 0, chip = 10, chips = 5, left = 5, bets = {};
  let phase = 0, wa = 0, wv = 0, br = 1.04, res = null, ball = null, lastLayout = null;

  // felt
  let h = '<div class="rtable"><div class="rz grn" data-z="n0">0</div>';
  for (let row = 2; row >= 0; row--) {
    for (let i = 0; i < 12; i++) { const n = i * 3 + row + 1; h += `<div class="rz ${RED_N.has(n) ? 'red' : 'blk'}" data-z="n${n}">${n}</div>`; }
    h += `<div class="rz col" data-z="c${row + 1}">2:1</div>`;
  }
  h += `</div><div class="routrow"><div class="rz out" data-z="d1">1st 12</div><div class="rz out" data-z="d2">2nd 12</div><div class="rz out" data-z="d3">3rd 12</div></div>
    <div class="routrow2"><div class="rz out" data-z="lo">1–18</div><div class="rz out" data-z="even">Even</div><div class="rz out" data-z="red">Red</div><div class="rz out" data-z="black">Black</div><div class="rz out" data-z="odd">Odd</div><div class="rz out" data-z="hi">19–36</div></div>`;
  $('rlTable').innerHTML = h;
  $('rlTable').querySelectorAll('[data-z]').forEach((z) => z.addEventListener('click', () => place(z)));

  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
  const hint = (t) => { $('rlHint').textContent = t; };
  function stats() { $('rlPlaced').textContent = fmt(total()); $('rlChip').textContent = fmt(chip); $('rlLeft').textContent = left; }
  function place(z) {
    if (phase || left <= 0) return;
    const k = z.dataset.z;
    bets[k] = (bets[k] || 0) + chip; left--;
    let tag = z.querySelector('b'); if (!tag) { tag = document.createElement('b'); z.appendChild(tag); }
    tag.textContent = bets[k] / chip;
    stats();
    hint(left ? 'Flick the wheel when you\'re ready' : 'All chips down · flick the wheel to spin it');
    $('rlClear').disabled = false;
  }
  function clear() {
    if (phase) return;
    bets = {}; left = chips; stats();
    $('rlTable').querySelectorAll('b').forEach((b) => b.remove());
    $('rlTable').querySelectorAll('.hit').forEach((b) => b.classList.remove('hit'));
    hint('Tap the felt to place chips · then flick the wheel to spin it');
    $('rlClear').disabled = true;
  }

  flick($('cvR'), async (g) => {
    if (g.speed < 170) return;
    if (phase === 0) {
      if (!total()) { hint('Place a chip first'); return; }
      wv = cl(g.speed / 70, 6, 22); phase = 1; $('rlClear').disabled = true;
      hint('Wheel is turning · flick again to release the ball');
    } else if (phase === 1) {
      phase = 2; hint('Ball is in');
      lastLayout = Object.fromEntries(Object.entries(bets).map(([k, v]) => [k, Math.round(v / chip)]));
      const power = cl(g.speed / 900, 0.5, 1.6);
      const payload = Object.entries(bets).map(([z, amount]) => ({ ...ZONE(z), amount }));
      try { res = await api.post('/games/roulette/spin', { bets: payload }); } catch (e) { toast(e.message, 'red'); phase = 0; hint('Flick the wheel to try again'); $('rlClear').disabled = false; return; }
      syncBalance(Number(res.cc_balance) - Number(res.totalPayout));
      // ball angle relative to the wheel: ease onto the result pocket after a few laps against the spin
      const pocket = WHEEL.indexOf(res.result) * SEG + SEG / 2;
      const start = Math.random() * Math.PI * 2;
      const laps = Math.round(3 + power * 3);
      let end = pocket - laps * Math.PI * 2; while (end > start - Math.PI * 2 * laps) end -= Math.PI * 2;
      ball = { start, end, t: 0, dur: 3.2 + power * 1.4 };
    }
  });

  function resolve() {
    const n = res.result;
    syncBalance(res.cc_balance);
    $('rlTable').querySelectorAll(`[data-z="n${n}"]`).forEach((z) => z.classList.add('hit'));
    hint(`${n} · ${res.color}`);
    const r = res;
    later(1400, () => shell.result({
      net: Number(r.net), sub: `${n} ${r.color}${r.totalPayout ? ` · paid ${fmt(r.totalPayout)} CC` : ''}`, seed: r.seed,
      again: () => start(bet, lastLayout), change,
    }));
  }

  function start(b, layout) {
    bet = b; chips = Math.max(1, Math.min(5, Math.floor(b / 10))); chip = Math.floor(b / chips);
    phase = 0; res = null; ball = null; br = 1.04; wv = 0;
    shell.actions('<button class="ga" id="rlClear" disabled>Clear chips</button>');
    $('rlClear').onclick = clear;
    shell.show('scPlay');
    clear();
    // one-tap replay keeps the same chips on the felt
    if (layout) Object.entries(layout).forEach(([z, cnt]) => { const el = $('rlTable').querySelector(`[data-z="${z}"]`); for (let i = 0; i < cnt && left > 0; i++) place(el); });
  }
  const change = () => shell.bet({ onPlace: (b) => start(b), note: 'Your bet is split into chips you place on the felt' });

  const cv = $('cvR');
  loop((dt) => {
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    const R = Math.min(H * 0.46, W * 0.3), cx = W / 2, cy = H * 0.5;
    wa += wv * dt;
    if (wv > 0) wv = Math.max(phase >= 2 && ball ? 0.6 : 0, wv - wv * 0.35 * dt - 0.05 * dt);
    c.save(); c.translate(cx, cy); c.rotate(wa);
    WHEEL.forEach((n, i) => {
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, i * SEG, (i + 1) * SEG); c.closePath();
      c.fillStyle = n === 0 ? em(0.55) : RED_N.has(n) ? 'rgba(150,25,25,.65)' : 'rgba(20,20,20,.95)'; c.fill();
      c.strokeStyle = w(0.06); c.lineWidth = 0.6; c.stroke();
      if (R > 60) {
        c.save(); c.rotate(i * SEG + SEG / 2); c.translate(R * 0.84, 0); c.rotate(Math.PI / 2);
        c.fillStyle = w(0.75); c.font = `700 ${Math.max(6, R * 0.075)}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, 0, 0);
        c.restore();
      }
    });
    c.beginPath(); c.arc(0, 0, R * 0.5, 0, 7); c.fillStyle = '#0a0a0a'; c.fill();
    c.strokeStyle = gd(0.35); c.lineWidth = 1.4; c.stroke();
    c.restore();
    if (ball) {
      const done = ball.t >= ball.dur;
      ball.t = Math.min(ball.dur, ball.t + dt);
      const k = ball.t / ball.dur, e = eOut(k);
      const rel = ball.start + (ball.end - ball.start) * e;
      br = k < 0.6 ? 1.04 : 1.04 - (0.34 * (k - 0.6)) / 0.4;
      c.beginPath(); c.arc(cx + Math.cos(wa + rel) * R * br, cy + Math.sin(wa + rel) * R * br, Math.max(4, R * 0.06), 0, 7);
      c.fillStyle = '#f5f2e8'; c.fill();
      if (!done && ball.t >= ball.dur) resolve();
      if (done && res) {
        c.font = `700 ${R * 0.42}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = res.result === 0 ? EM : RED_N.has(res.result) ? '#e05555' : '#fff';
        c.fillText(String(res.result), cx, cy);
      }
    }
    if (phase === 0 && total()) {
      c.strokeStyle = `rgba(212,175,55,${0.25 + 0.15 * Math.sin(performance.now() / 380)})`; c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx, cy, R * 1.12, 0, 7); c.stroke();
    }
  });

  change();
}
