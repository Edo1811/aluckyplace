import socket from '../socket.js';
import { store } from '../store.js';
import { $, fmt, toast, later, every } from '../ui/core.js';
import { gameShell, fitCanvas, loop, on, syncBalance } from '../games/shell.js';
import { pressPad, EM, RED, w } from '../games/draw.js';

// Shared round run by the server:
//   crash:betting_open (6s) → crash:start → crash:tick every 100ms → crash:crash → 2s pause
// The curve is exp(t * 0.35). Bets can only be placed during the betting window,
// so "Play again" queues the same bet for the next window.
const RATE = 0.35;
const STYLE = `
.crwrap{position:absolute;inset:0}
.crcd{position:absolute;left:0;right:0;top:44%;text-align:center;pointer-events:none}
.crcd b{display:block;font-size:46px;font-weight:700;color:#fff}
.crcd span{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.crme{position:absolute;left:14px;bottom:12px;font-size:12px;color:rgba(255,255,255,.4);z-index:3}
.crme b{color:var(--em)}
.crhist{position:absolute;top:34px;left:14px;display:flex;gap:5px;z-index:3;flex-wrap:wrap;max-width:60%}
.crhist span{font-size:10.5px;padding:2px 7px;border-radius:8px;background:rgba(255,255,255,.05);color:rgba(255,255,255,.5)}
.crhist span.hi{color:var(--em);background:rgba(16,185,129,.1)}
.crhist span.lo{color:#f87171;background:rgba(239,68,68,.08)}
`;

export function renderCrash(app) {
  const shell = gameShell(app, {
    id: 'crash', title: 'Crash', css: STYLE,
    stage: `<div class="crwrap"><canvas class="fill" id="cvC"></canvas></div>
      <div class="phase" id="crPhase">Connecting</div>
      <div class="crhist" id="crHist"></div>
      <div class="feed" id="crFeed"></div>
      <div class="bigmul" id="crM" style="display:none">1.00×</div>
      <div class="crcd" id="crCd"><b id="crCdN">—</b><span>until launch</span></div>
      <div class="crme" id="crMe"></div>`,
  });

  // round state
  let phase = 'waiting', roundId = null, t = 0, mult = 1, crashAt = null, flash = 0, bettingEnds = 0;
  // my state for the current round
  let myBet = 0, cashedAt = 0, queued = 0, pts = [];
  const hist = [];

  const setActions = (html) => shell.actions(html);
  const me = () => {
    const el = $('crMe'); if (!el) return;
    el.innerHTML = myBet ? (cashedAt ? `Cashed at <b>${cashedAt.toFixed(2)}×</b> · +${fmt(Math.floor(myBet * cashedAt))} CC` : `In for <b>${fmt(myBet)} CC</b>`)
      : queued ? `Next round: <b>${fmt(queued)} CC</b>` : '';
  };

  function paintActions() {
    if (phase === 'active' && myBet && !cashedAt) {
      const b = setActions('<button class="ga ga-em holdpad" id="crHold">Riding — let go to cash out</button>').firstChild;
      pressPad(b, { down: () => b.classList.add('held'), up: () => { b.classList.remove('held'); cashout(); } });
      return;
    }
    if (myBet) { setActions(`<button class="ga" disabled>${cashedAt ? `Cashed out · ${cashedAt.toFixed(2)}×` : `Bet in · ${fmt(myBet)} CC`}</button>`); return; }
    if (queued) { setActions(`<button class="ga" id="crUnq">Cancel next-round bet</button>`); $('crUnq').onclick = () => { queued = 0; paintActions(); me(); }; return; }
    setActions('<button class="ga ga-em" id="crBet">Place a bet</button>');
    $('crBet').onclick = () => openBet();
  }

  function openBet() {
    shell.bet({
      cta: phase === 'betting' ? 'Bet this round' : 'Bet next round',
      note: phase === 'betting' ? 'Round is open — your bet goes in now' : 'Your bet goes in when the next round opens',
      onPlace: (b) => { queued = b; shell.show('scPlay'); if (phase === 'betting') placeQueued(); paintActions(); me(); },
    });
  }

  function placeQueued() {
    if (!queued || myBet || phase !== 'betting' || !roundId) return;
    socket.emit('crash:bet', { round_id: roundId, amount: queued });
  }
  function cashout() {
    if (phase !== 'active' || !myBet || cashedAt) return;
    socket.emit('crash:cashout', { round_id: roundId });
  }

  function resetRound() { t = 0; mult = 1; crashAt = null; flash = 0; pts = []; myBet = 0; cashedAt = 0; }

  on(socket, {
    'crash:state': ({ phase: p, round_id, multiplier, betting_ms_left, my_bet, cashed_out }) => {
      roundId = round_id;
      resetRound();
      myBet = Number(my_bet) || 0; cashedAt = Number(cashed_out) || 0;
      if (p === 'active') { phase = 'active'; mult = multiplier || 1; t = Math.log(mult) / RATE; }
      else if (p === 'betting') { phase = 'betting'; bettingEnds = performance.now() + (betting_ms_left ?? 3000); placeQueued(); }
      else phase = 'crashed';
      paintActions(); me();
    },
    'crash:betting_open': ({ round_id }) => {
      resetRound(); roundId = round_id; phase = 'betting'; bettingEnds = performance.now() + 6000;
      placeQueued(); paintActions(); me();
    },
    'crash:start': ({ round_id }) => { roundId = round_id; phase = 'active'; t = 0; mult = 1; paintActions(); },
    'crash:tick': ({ multiplier }) => {
      if (phase !== 'active') { phase = 'active'; paintActions(); }
      // keep the local clock honest without jumping backwards
      const tt = Math.log(multiplier) / RATE; if (Math.abs(tt - t) > 0.25) t = tt;
    },
    'crash:crash': ({ crash_point, seed }) => {
      phase = 'crashed'; crashAt = crash_point; mult = crash_point; t = Math.log(crash_point) / RATE;
      hist.unshift(crash_point); hist.length = Math.min(hist.length, 8);
      $('crHist').innerHTML = hist.map((m) => `<span class="${m >= 2 ? 'hi' : m < 1.3 ? 'lo' : ''}">${m.toFixed(2)}×</span>`).join('');
      if ('vibrate' in navigator && myBet && !cashedAt) navigator.vibrate(60);
      paintActions();
      if (myBet) {
        const bet = myBet, ca = cashedAt;
        later(1400, () => shell.result({
          net: ca ? Math.floor(bet * ca) - bet : -bet,
          sub: ca ? `Cashed out at ${ca.toFixed(2)}× · crashed at ${crash_point.toFixed(2)}×` : `Crashed at ${crash_point.toFixed(2)}×`,
          seed,
          againLabel: 'Bet again', again: () => { queued = bet; shell.show('scPlay'); placeQueued(); paintActions(); me(); },
          change: () => openBet(),
        }));
      }
    },
    'crash:bet:confirm': ({ amount, cc_balance }) => { myBet = Number(amount); queued = 0; syncBalance(cc_balance); paintActions(); me(); },
    'crash:cashout:confirm': ({ multiplier, payout, cc_balance }) => {
      cashedAt = Number(multiplier); syncBalance(cc_balance); paintActions(); me();
      toast(`Cashed out at ${cashedAt.toFixed(2)}× · +${fmt(payout)} CC`, 'em');
    },
    'crash:cashout:broadcast': ({ username, multiplier }) => {
      if (username === store.user?.username) return;
      const f = $('crFeed'); if (!f) return;
      const s = document.createElement('span'); s.textContent = `${username} ${Number(multiplier).toFixed(2)}×`;
      f.prepend(s); while (f.children.length > 4) f.lastChild.remove();
      later(3500, () => s.remove());
    },
    'crash:error': ({ message }) => { toast(message || 'Crash error', 'red'); queued = 0; paintActions(); me(); },
  });

  // Ask for the current round (the server only pushes it on connect).
  socket.emit('crash:sync');

  every(250, () => {
    const p = $('crPhase'); if (!p) return;
    const left = Math.max(0, Math.ceil((bettingEnds - performance.now()) / 1000));
    p.textContent = phase === 'betting' ? `Betting open · ${left}s` : phase === 'active' ? 'In flight' : phase === 'crashed' ? 'Crashed' : 'Waiting for round';
    $('crCd').style.display = phase === 'betting' ? '' : 'none';
    $('crCdN').textContent = `${left}s`;
    $('crM').style.display = phase === 'betting' ? 'none' : '';
  });

  const cv = $('cvC');
  loop((dt) => {
    if (phase === 'active') { t += dt; mult = Math.exp(t * RATE); pts.push([t, mult]); if (pts.length > 600) pts = pts.filter((_, i) => i % 2 === 0); }
    if (phase === 'crashed') flash += dt;
    const el = $('crM');
    if (el) {
      el.textContent = `${(crashAt || mult).toFixed(2)}×`;
      el.style.color = phase === 'crashed' ? RED : cashedAt ? EM : '#fff';
    }
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    c.strokeStyle = w(0.03); c.lineWidth = 1;
    for (let i = 0; i < 5; i++) { const y = H * 0.18 + i * (H * 0.72 / 4); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (phase === 'betting' || phase === 'waiting') return;
    const span = Math.max(4, t * 1.12), top = Math.max(1.8, mult * 1.4);
    const px = (x) => W * 0.06 + (x / span) * (W * 0.88);
    const py = (m) => H * 0.9 - ((m - 1) / (top - 1)) * (H * 0.72);
    const col = phase === 'crashed' ? '239,68,68' : '16,185,129';
    const N = 64, curve = [];
    for (let i = 0; i <= N; i++) { const x = (t * i) / N; curve.push([px(x), py(Math.exp(x * RATE))]); }
    const g = c.createLinearGradient(0, H * 0.15, 0, H * 0.9);
    g.addColorStop(0, `rgba(${col},.18)`); g.addColorStop(1, `rgba(${col},0)`);
    c.beginPath(); c.moveTo(px(0), H * 0.9); curve.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(px(t), H * 0.9); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath(); curve.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = `rgba(${col},.95)`; c.lineWidth = 3; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    if (cashedAt) {
      const ct = Math.log(cashedAt) / RATE;
      c.beginPath(); c.arc(px(ct), py(cashedAt), 6, 0, 7); c.fillStyle = EM; c.fill();
      c.font = '700 12px "Playfair Display",Georgia,serif'; c.fillStyle = 'rgba(16,185,129,.9)'; c.textAlign = 'center';
      c.fillText(`${cashedAt.toFixed(2)}×`, px(ct), py(cashedAt) - 14);
    }
    const hx = px(t), hy = py(mult);
    c.beginPath(); c.arc(hx, hy, 5.5, 0, 7); c.fillStyle = phase === 'crashed' ? RED : EM; c.fill();
    c.beginPath(); c.arc(hx, hy, 15 + (phase === 'active' ? Math.sin(performance.now() / 140) * 3 : 0), 0, 7); c.fillStyle = `rgba(${col},.14)`; c.fill();
    if (phase === 'crashed') { c.fillStyle = `rgba(239,68,68,${0.16 * Math.max(0, 1 - flash)})`; c.fillRect(0, 0, W, H); }
  });

  shell.show('scPlay');
  paintActions();
  me();
}
