import { api } from '../api.js';
import { store } from '../store.js';
import { $, fmt, toast } from '../ui/core.js';
import { gameShell, fitCanvas, loop, syncBalance } from '../games/shell.js';
import { rr, w, em, gd, GOLD, EM, PF } from '../games/draw.js';

// Server: 12 rows, path of 'L'/'R', slot 0–12.
const ROWS = 12;
const MULT = [250, 30, 6, 2, 0.5, 0.3, 0.2, 0.3, 0.5, 2, 6, 30, 250];
const MAX_IN_FLIGHT = 30;

export function renderPlinko(app) {
  const shell = gameShell(app, {
    id: 'plinko', title: 'Plinko',
    stage: '<canvas class="fill" id="cvP"></canvas><div class="tag" id="plTag">0 balls</div><div class="hint">Every ball costs your bet — drop as many as you like</div>',
  });

  let bet = 0, n = 0, net = 0, best = 0, balls = [], pops = [], waiting = 0, latest = { nonce: -1, bal: null }, seed = null;

  const hud = () => {
    const t = $('plTag'); if (!t) return;
    t.textContent = `${n} ${n === 1 ? 'ball' : 'balls'} · ${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))} CC`;
    t.style.color = net > 0 ? EM : net < 0 ? 'rgba(239,68,68,.75)' : 'rgba(255,255,255,.26)';
    const d = $('plDrop'); if (d) d.disabled = Number(store.ccBalance) < bet || waiting + balls.length >= MAX_IN_FLIGHT;
  };
  const localBal = (delta) => { store.ccBalance = Number(store.ccBalance) + delta; syncBalance(store.ccBalance); };
  const settle = () => { if (!waiting && !balls.length && latest.bal !== null) syncBalance(latest.bal); };

  async function drop() {
    if (Number(store.ccBalance) < bet || waiting + balls.length >= MAX_IN_FLIGHT) return;
    waiting++; n++; net -= bet; localBal(-bet); hud();
    try {
      const r = await api.post('/games/plinko/drop', { amount: bet });
      waiting--;
      if (r.nonce > latest.nonce) latest = { nonce: r.nonce, bal: r.cc_balance };
      seed = r.seed;
      // offset from centre (in peg gaps) before each row; lands on slot - ROWS/2
      const base = [], dirs = []; let pos = 0;
      r.path.forEach((p, i) => { base.push(pos - i / 2); dirs.push(p === 'R' ? 0.5 : -0.5); if (p === 'R') pos++; });
      balls.push({ t: 0, base, dirs, slot: r.slot, mult: Number(r.multiplier), payout: Number(r.payout) });
    } catch (e) {
      waiting--; n--; net += bet; localBal(bet); toast(e.message, 'red');
    }
    hud();
  }
  function land(b) {
    net += b.payout; localBal(b.payout);
    if (b.mult > best) best = b.mult;
    pops.push({ i: b.slot, t: 0, m: b.mult });
    hud(); settle();
  }
  function done() {
    const finish = () => {
      if (waiting || balls.length) return setTimeout(finish, 120);
      settle();
      shell.result({
        net, sub: `${n} ${n === 1 ? 'ball' : 'balls'}${best ? ` · best ${best}×` : ''}`, seed,
        again: () => start(bet), change,
      });
    };
    $('plDrop').disabled = true; $('plDone').disabled = true;
    finish();
  }
  function start(b) {
    bet = b; n = 0; net = 0; best = 0; pops = [];
    shell.actions('<button class="ga" id="plDone">Done</button><button class="ga ga-em" id="plDrop">Drop</button>');
    $('plDrop').onclick = drop; $('plDone').onclick = done;
    shell.show('scPlay'); hud();
  }
  const change = () => shell.bet({ onPlace: (b) => start(b) });

  const cv = $('cvP');
  loop((dt) => {
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    const gy = (H * 0.66) / ROWS, gx = Math.min(W * 0.068, gy * 1.08), top = H * 0.08, cx = W / 2;
    c.fillStyle = w(0.2);
    for (let r = 0; r < ROWS; r++) for (let i = 0; i <= r + 2; i++) {
      c.beginPath(); c.arc(cx + (i - (r + 2) / 2) * gx, top + r * gy, Math.max(1.8, gy * 0.1), 0, 7); c.fill();
    }
    const sy = top + ROWS * gy + gy * 0.2, sw = gx * 0.9, sh = Math.min(H * 0.1, 30);
    pops.forEach((p) => { p.t += dt; }); pops = pops.filter((p) => p.t < 1.1);
    for (let i = 0; i <= ROWS; i++) {
      const x = cx + (i - ROWS / 2) * gx - sw / 2, m = MULT[i], hot = m >= 6;
      const p = pops.find((q) => q.i === i), glow = p ? Math.max(0, 1 - p.t / 1.1) : 0;
      c.fillStyle = hot ? gd(0.16 + glow * 0.5) : m >= 1 ? em(0.09 + glow * 0.45) : w(0.05 + glow * 0.3);
      rr(c, x, sy, sw, sh, 4); c.fill();
      c.fillStyle = glow > 0.4 ? '#0a0a0a' : hot ? gd(0.9) : m >= 1 ? em(0.65) : w(0.4);
      c.font = `700 ${Math.min(sh * 0.36, sw * 0.34, 12)}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`${m}×`, x + sw / 2, sy + sh / 2);
      if (p && glow > 0) {
        c.globalAlpha = glow; c.font = `700 ${Math.min(H * 0.045, 15)}px ${PF}`;
        c.fillStyle = hot ? GOLD : p.m >= 1 ? EM : 'rgba(239,68,68,.8)';
        c.fillText(`${p.m}×`, x + sw / 2, sy - 13 - (1 - glow) * 18); c.globalAlpha = 1;
      }
    }
    for (let k = balls.length - 1; k >= 0; k--) {
      const b = balls[k];
      b.t += dt * 7.5;
      const r = Math.floor(b.t);
      if (r >= ROWS) { balls.splice(k, 1); land(b); continue; }
      const fr = b.t - r, off = b.base[r] + b.dirs[r] * fr;
      const x = cx + off * gx, y = top + (b.t - 1) * gy - Math.abs(Math.sin(fr * Math.PI)) * gy * 0.18;
      if (y < -gy) continue;
      c.beginPath(); c.arc(x, y, Math.max(3.5, gy * 0.2), 0, 7); c.fillStyle = GOLD; c.fill();
      c.beginPath(); c.arc(x, y, Math.max(8, gy * 0.42), 0, 7); c.fillStyle = gd(0.14); c.fill();
    }
  });

  change();
}
