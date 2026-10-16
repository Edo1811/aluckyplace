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
.crctl{display:flex;flex-direction:column;gap:9px;width:100%;max-width:620px;margin:0 auto}
.seg{display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:3px}
.seg button{flex:1;padding:8px 0;border:none;background:none;border-radius:9px;color:rgba(255,255,255,.45);font-family:var(--pf);font-weight:700;font-size:13px;cursor:pointer}
.seg button.on{background:rgba(255,255,255,.1);color:#fff}
.seg.sm{padding:2px;border-radius:9px}.seg.sm button{padding:6px 0;font-size:11.5px;border-radius:7px}
.cg{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cf{display:flex;flex-direction:column;gap:4px;min-width:0}
.cf label{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.cf .row2{display:flex;gap:6px;align-items:center}
.ci{width:100%;min-width:0;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 10px;color:#fff;font-family:var(--pf);font-size:14px;font-weight:700;outline:none}
.ci:focus{border-color:rgba(16,185,129,.5)}
.ci:disabled{opacity:.4}
.csess{display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,.4);padding:0 2px}
.csess b{color:#fff}.csess b.pos{color:var(--em)}.csess b.neg{color:#f87171}
.cbtns{display:flex;gap:8px}
.cmore{background:none;border:none;color:rgba(255,255,255,.4);font-family:var(--pf);font-size:12px;cursor:pointer;padding:2px;text-align:left}
@media(max-width:899px){.crctl .cg.adv{grid-template-columns:1fr 1fr}}
`;
const SETTINGS_KEY = 'alp.crash.auto';
const loadSettings = () => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; } };
const saveSettings = (v) => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); } catch { /* private mode */ } };
const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? n : 0; };

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
  let myBet = 0, cashedAt = 0, queued = 0, pts = [], myTarget = null;
  const hist = [];
  // manual / auto
  let mode = 'manual', manualTarget = '';
  const cfg = { bet: 100, target: 2, rounds: 0, winMode: 'reset', winPct: 0, lossMode: 'reset', lossPct: 0, stopProfit: 0, stopLoss: 0, ...loadSettings() };
  const auto = { running: false, cur: 0, left: 0, played: 0, profit: 0, adv: false };

  const setActions = (html) => shell.actions(html);
  const me = () => {
    const el = $('crMe'); if (!el) return;
    el.innerHTML = myBet ? (cashedAt ? `Cashed at <b>${cashedAt.toFixed(2)}×</b> · +${fmt(Math.floor(myBet * cashedAt))} CC` : `In for <b>${fmt(myBet)} CC</b>${myTarget ? ` · auto at <b>${myTarget.toFixed(2)}×</b>` : ''}`)
      : queued ? `Next round: <b>${fmt(queued)} CC</b>` : '';
  };

  const seg = () => `<div class="seg" id="crSeg"><button data-mode="manual" class="${mode === 'manual' ? 'on' : ''}">Manual</button><button data-mode="auto" class="${mode === 'auto' ? 'on' : ''}">Auto</button></div>`;
  function bindSeg() {
    document.querySelectorAll('#crSeg [data-mode]').forEach((b) => b.addEventListener('click', () => {
      if (auto.running || b.dataset.mode === mode) return;
      mode = b.dataset.mode; paintActions(); me();
    }));
  }
  // Re-render only when something visible changed, so typing in a field isn't interrupted.
  let lastPanel = '';
  function panel(inner) {
    const html = `<div class="crctl">${auto.running ? '' : seg()}${inner}</div>`;
    if (html === lastPanel && $('crSeg') !== undefined && document.querySelector('.crctl')) return false;
    lastPanel = html;
    setActions(html);
    bindSeg();
    return true;
  }

  function paintActions() {
    if (mode === 'auto') return paintAuto();
    const cashRow = `<div class="cf"><label>Auto cash-out (optional)</label><div class="row2"><input class="ci" id="crMT" inputmode="decimal" placeholder="e.g. 2.00" value="${manualTarget}"${myBet || queued ? ' disabled' : ''}><span style="color:rgba(255,255,255,.4)">×</span></div></div>`;
    let btn;
    if (phase === 'active' && myBet && !cashedAt) btn = '<button class="ga ga-em holdpad" id="crHold">Riding — let go to cash out</button>';
    else if (myBet) btn = `<button class="ga" disabled>${cashedAt ? `Cashed out · ${cashedAt.toFixed(2)}×` : `Bet in · ${fmt(myBet)} CC`}</button>`;
    else if (queued) btn = '<button class="ga" id="crUnq">Cancel next-round bet</button>';
    else btn = '<button class="ga ga-em" id="crBet">Place a bet</button>';
    if (!panel(`${cashRow}<div class="cbtns">${btn}</div>`)) return;
    $('crMT').addEventListener('input', (e) => { manualTarget = e.target.value.replace(/[^0-9.]/g, ''); });
    if ($('crHold')) { const b = $('crHold'); pressPad(b, { down: () => b.classList.add('held'), up: () => { b.classList.remove('held'); cashout(); } }); }
    if ($('crUnq')) $('crUnq').onclick = () => { queued = 0; paintActions(); me(); };
    if ($('crBet')) $('crBet').onclick = () => openBet();
  }

  // ── auto mode ─────────────────────────────────────────────────────────────
  const adj = (k) => `<div class="cf"><label>On ${k === 'win' ? 'win' : 'loss'}</label>
    <div class="seg sm" data-adj="${k}"><button data-v="reset" class="${cfg[`${k}Mode`] === 'reset' ? 'on' : ''}">Reset</button><button data-v="inc" class="${cfg[`${k}Mode`] === 'inc' ? 'on' : ''}">Increase</button></div>
    <div class="row2"><input class="ci" data-f="${k}Pct" inputmode="decimal" value="${cfg[`${k}Pct`] || ''}" placeholder="0"${cfg[`${k}Mode`] === 'inc' ? '' : ' disabled'}><span style="color:rgba(255,255,255,.4)">%</span></div></div>`;
  const field = (f, label, ph, suffix = '') => `<div class="cf"><label>${label}</label><div class="row2"><input class="ci" data-f="${f}" inputmode="decimal" value="${cfg[f] || ''}" placeholder="${ph}">${suffix ? `<span style="color:rgba(255,255,255,.4)">${suffix}</span>` : ''}</div></div>`;
  function sessLine() {
    const p = auto.profit;
    return `<div class="csess"><span>Rounds <b>${auto.played}${cfg.rounds ? `/${cfg.rounds}` : ''}</b></span><span>Next bet <b>${fmt(auto.cur || cfg.bet)}</b></span><span>Profit <b class="${p > 0 ? 'pos' : p < 0 ? 'neg' : ''}">${p > 0 ? '+' : p < 0 ? '−' : ''}${fmt(Math.abs(p))}</b></span></div>`;
  }
  function paintAuto() {
    if (auto.running) {
      const cashNow = phase === 'active' && myBet && !cashedAt ? '<button class="ga ga-gold" id="crNow">Cash out now</button>' : '';
      if (!panel(`${sessLine()}<div class="cbtns">${cashNow}<button class="ga ga-red" id="crStop">Stop auto</button></div>`)) return;
      $('crStop').onclick = () => stopAuto('Auto stopped');
      if ($('crNow')) $('crNow').onclick = cashout;
      return;
    }
    if (!panel(`<div class="cg">${field('bet', 'Bet', '100', 'CC')}${field('target', 'Cash out at', '2.00', '×')}</div>
      <div class="cg">${field('rounds', 'Rounds (0 = ∞)', '0')}<div class="cf"><label>&nbsp;</label><button class="cmore" id="crMore">${auto.adv ? '▾' : '▸'} Win / loss rules &amp; limits</button></div></div>
      ${auto.adv ? `<div class="cg adv">${adj('win')}${adj('loss')}</div><div class="cg">${field('stopProfit', 'Stop at profit', 'off', 'CC')}${field('stopLoss', 'Stop at loss', 'off', 'CC')}</div>` : ''}
      ${auto.played ? sessLine() : ''}
      <div class="cbtns"><button class="ga ga-em" id="crStart">Start auto</button></div>`)) return;
    document.querySelectorAll('.crctl [data-f]').forEach((inp) => inp.addEventListener('input', () => { cfg[inp.dataset.f] = num(inp.value); saveSettings(cfg); }));
    document.querySelectorAll('.crctl [data-adj]').forEach((g) => g.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => {
      cfg[`${g.dataset.adj}Mode`] = b.dataset.v; saveSettings(cfg); paintAuto();
    })));
    $('crMore').onclick = () => { auto.adv = !auto.adv; paintAuto(); };
    $('crStart').onclick = startAuto;
  }
  function startAuto() {
    const bet = Math.floor(cfg.bet), target = Math.floor(cfg.target * 100) / 100;
    if (bet < 10) return toast('Minimum bet is 10 CC', 'red');
    if (!(target >= 1.01 && target <= 1000)) return toast('Cash out between 1.01× and 1000×', 'red');
    if (bet > Number(store.ccBalance)) return toast('You don\'t have that much', 'red');
    Object.assign(auto, { running: true, cur: bet, played: 0, profit: 0, left: Math.floor(cfg.rounds) || 0 });
    queued = 0;
    paintActions(); me();
    autoBet();
  }
  function stopAuto(msg, kind = 'amber') {
    if (!auto.running) return;
    auto.running = false;
    if (msg) toast(msg, kind);
    paintActions(); me();
  }
  function autoBet() {
    if (!auto.running || myBet || phase !== 'betting' || !roundId) return;
    if (auto.cur > Number(store.ccBalance)) return stopAuto('Auto stopped — not enough balance', 'red');
    myTarget = Math.floor(cfg.target * 100) / 100;
    socket.emit('crash:bet', { round_id: roundId, amount: auto.cur, auto_cashout: myTarget });
  }
  // Called a moment after the crash so a last-tick auto cash-out has landed.
  function settleAuto(bet, crashPoint) {
    if (!auto.running) return;
    const won = cashedAt > 0 || (myTarget && crashPoint > myTarget);
    const at = cashedAt || myTarget;
    auto.played++;
    auto.profit += won ? Math.floor(bet * at) - bet : -bet;
    const rule = won ? ['winMode', 'winPct'] : ['lossMode', 'lossPct'];
    auto.cur = cfg[rule[0]] === 'inc' ? Math.max(10, Math.floor(auto.cur * (1 + cfg[rule[1]] / 100))) : Math.floor(cfg.bet);
    if (auto.left && auto.played >= auto.left) return stopAuto(`Auto done · ${auto.played} rounds`, 'em');
    if (cfg.stopProfit && auto.profit >= cfg.stopProfit) return stopAuto('Profit target hit — auto stopped', 'em');
    if (cfg.stopLoss && -auto.profit >= cfg.stopLoss) return stopAuto('Loss limit hit — auto stopped', 'red');
    paintActions();
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
    const t = Math.floor(num(manualTarget) * 100) / 100;
    myTarget = t >= 1.01 ? t : null;
    socket.emit('crash:bet', { round_id: roundId, amount: queued, ...(myTarget ? { auto_cashout: myTarget } : {}) });
  }
  function cashout() {
    if (phase !== 'active' || !myBet || cashedAt) return;
    socket.emit('crash:cashout', { round_id: roundId });
  }

  function resetRound() { t = 0; mult = 1; crashAt = null; flash = 0; pts = []; myBet = 0; cashedAt = 0; myTarget = null; }

  on(socket, {
    'crash:state': ({ phase: p, round_id, multiplier, betting_ms_left, my_bet, cashed_out }) => {
      roundId = round_id;
      resetRound();
      myBet = Number(my_bet) || 0; cashedAt = Number(cashed_out) || 0;
      if (p === 'active') { phase = 'active'; mult = multiplier || 1; t = Math.log(mult) / RATE; }
      else if (p === 'betting') { phase = 'betting'; bettingEnds = performance.now() + (betting_ms_left ?? 3000); placeQueued(); autoBet(); }
      else phase = 'crashed';
      paintActions(); me();
    },
    'crash:betting_open': ({ round_id }) => {
      resetRound(); roundId = round_id; phase = 'betting'; bettingEnds = performance.now() + 6000;
      placeQueued(); autoBet(); paintActions(); me();
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
      if (myBet && auto.running) {
        const bet = myBet;
        later(900, () => settleAuto(bet, crash_point));
      } else if (myBet) {
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
    'crash:bet:confirm': ({ amount, auto_cashout, cc_balance }) => { myBet = Number(amount); myTarget = auto_cashout ? Number(auto_cashout) : null; queued = 0; syncBalance(cc_balance); paintActions(); me(); },
    'crash:cashout:confirm': ({ multiplier, payout, cc_balance }) => {
      cashedAt = Number(multiplier); syncBalance(cc_balance); paintActions(); me();
      if (!auto.running) toast(`Cashed out at ${cashedAt.toFixed(2)}× · +${fmt(payout)} CC`, 'em');
    },
    'crash:cashout:broadcast': ({ username, multiplier }) => {
      if (username === store.user?.username) return;
      const f = $('crFeed'); if (!f) return;
      const s = document.createElement('span'); s.textContent = `${username} ${Number(multiplier).toFixed(2)}×`;
      f.prepend(s); while (f.children.length > 4) f.lastChild.remove();
      later(3500, () => s.remove());
    },
    'crash:error': ({ message }) => { toast(message || 'Crash error', 'red'); queued = 0; if (auto.running) stopAuto(); paintActions(); me(); },
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
