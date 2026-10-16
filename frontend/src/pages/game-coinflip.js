import socket from '../socket.js';
import { $, later } from '../ui/core.js';
import { fitCanvas, loop, flick, on, eOut } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';
import { w, gd, cl, GOLD } from '../games/draw.js';

// Server assigns sides; the flip comes in pvp:round_result ~4.5s after start.
// The player tosses the coin with a flick — the coin lands on the server's flip.
export function renderCoinflip(app, md) {
  const p = pvpShell(app, md, {
    game: 'coinflip', title: 'Coinflip',
    stage: `<div class="pad">
      <div style="flex:1;position:relative;min-height:170px"><canvas class="fill" id="cvF"></canvas></div>
      <div class="cfrow"><div class="cfp"><div class="n">You</div><div class="b" id="cfMe">—</div></div>
        <div class="cfp"><div class="s" id="cfMsg">Your toss</div></div>
        <div class="cfp"><div class="n" id="cfOppN"></div><div class="b" id="cfOpp">—</div></div></div>
      <div class="ghint" id="cfHint">Flick the coin upwards to toss it</div>
    </div>`,
  });
  if (!p) return;
  const side = (r) => (r === 'heads' ? 'Heads' : 'Tails');
  const mine = md.your_role || 'heads';
  $('cfMe').textContent = side(mine); $('cfOpp').textContent = side(mine === 'heads' ? 'tails' : 'heads');
  $('cfOppN').textContent = md.opponent || 'Opponent';

  let flip = null, tossed = false, t = 0, dur = 2.4, power = 1, landed = false, result = null, auto = 0;

  function toss(pw) {
    if (tossed) return;
    tossed = true; power = pw; t = 0; dur = 1.5 + power * 1.3;
    $('cfHint').textContent = 'In the air';
  }
  function land() {
    landed = true;
    const won = flip === mine;
    $('cfMsg').textContent = won ? 'You win' : 'You lose';
    $('cfHint').textContent = side(flip);
    if (result) later(900, () => p.finish({ won: result.you_won, seed: result.seed, sub: `${side(flip)} · ${result.you_won ? 'pot is yours' : `${md.opponent} takes the pot`}` }));
  }

  flick($('cvF'), (g) => {
    if (tossed) return;
    if (g.dy > -40 || g.speed < 180) { $('cfHint').textContent = 'Flick it upwards — harder'; return; }
    toss(cl(g.speed / 900, 0.45, 1.7));
  });

  on(socket, {
    'pvp:round_result': ({ flip: f }) => {
      flip = f;
      // nobody likes waiting on a shy flicker
      auto = later(3500, () => { if (!tossed) { $('cfHint').textContent = 'Tossed for you'; toss(1); } });
    },
    'pvp:result': (r) => {
      result = r;
      if (landed) later(900, () => p.finish({ won: r.you_won, seed: r.seed, sub: `${side(flip)} · ${r.you_won ? 'pot is yours' : `${md.opponent} takes the pot`}` }));
    },
  });
  void auto;

  const cv = $('cvF');
  loop((dt) => {
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    const R = Math.min(H * 0.34, W * 0.22, 130);
    let a = 0, k = 0;
    if (tossed) {
      t += dt;
      // keep spinning until the server's flip is known, then settle on it
      if (!flip && t > dur * 0.6) t = dur * 0.6;
      k = cl(t / dur, 0, 1);
      const turns = 4 + Math.round(power * 5) + (flip === 'tails' ? 0.5 : 0);
      a = eOut(k) * Math.PI * 2 * turns;
      if (k >= 1 && !landed && flip) land();
    }
    const sx = Math.cos(a), face = sx >= 0 ? 'H' : 'T';
    const lift = Math.sin(k * Math.PI) * H * (0.16 + power * 0.08);
    c.save(); c.translate(W / 2, H * 0.5 - lift);
    c.beginPath(); c.ellipse(0, R * 1.45 + lift, R * 0.6, R * 0.13, 0, 0, 7); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
    c.scale(Math.max(Math.abs(sx), 0.05), 1);
    c.beginPath(); c.arc(0, 0, R, 0, 7); c.fillStyle = face === 'H' ? '#c9a227' : '#161616'; c.fill();
    c.lineWidth = 2.5; c.strokeStyle = face === 'H' ? gd(0.9) : w(0.16); c.stroke();
    c.beginPath(); c.arc(0, 0, R * 0.78, 0, 7); c.lineWidth = 1; c.strokeStyle = face === 'H' ? 'rgba(255,235,170,.45)' : gd(0.3); c.stroke();
    c.font = `700 ${R * 0.85}px "Playfair Display",Georgia,serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = face === 'H' ? '#2a1f00' : GOLD; c.fillText(face, 0, R * 0.04);
    c.restore();
    if (!tossed) {
      const pa = 0.2 + 0.12 * Math.sin(performance.now() / 400), y = H * 0.5 - R * 1.25;
      c.strokeStyle = `rgba(16,185,129,${pa})`; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(W / 2, y); c.lineTo(W / 2, y - 14); c.stroke();
      c.beginPath(); c.moveTo(W / 2 - 6, y - 8); c.lineTo(W / 2, y - 16); c.lineTo(W / 2 + 6, y - 8); c.stroke();
    }
  });
}
