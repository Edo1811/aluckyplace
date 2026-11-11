import { api } from '../api.js';
import { store } from '../store.js';
import { $, fmt, toast, later, listen, amountOf, sheetHTML, openSheet, closeSheets } from '../ui/core.js';
import { gameShell, fitCanvas, loop, syncBalance, maybeWinFx } from '../games/shell.js';
import { rr, w, gd, GOLD, PF } from '../games/draw.js';
import { sfx, isMuted, setMuted, pegTick, bucket } from '../games/sfx.js';

// Same tables as backend/src/games/plinko.js — the server's multiplier is what gets paid.
const HALF = {
  8: { low: [5.6, 2.1, 1.1, 1, 0.5], medium: [13, 3, 1.3, 0.7, 0.4], high: [29, 4, 1.5, 0.3, 0.2] },
  9: { low: [5.6, 2, 1.6, 1, 0.7], medium: [18, 4, 1.7, 0.9, 0.5], high: [43, 7, 2, 0.6, 0.2] },
  10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5], medium: [22, 5, 2, 1.4, 0.6, 0.4], high: [76, 10, 3, 0.9, 0.3, 0.2] },
  11: { low: [8.4, 3, 1.9, 1.3, 1, 0.7], medium: [24, 6, 3, 1.8, 0.7, 0.5], high: [120, 14, 5.2, 1.4, 0.4, 0.2] },
  12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5], medium: [33, 11, 4, 2, 1.1, 0.6, 0.3], high: [250, 30, 6, 2, 0.5, 0.3, 0.2] },
  13: { low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7], medium: [43, 13, 6, 3, 1.3, 0.7, 0.4], high: [260, 37, 11, 4, 1, 0.2, 0.2] },
  14: { low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5], medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2], high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2] },
  15: { low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7], medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3], high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2] },
  16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2] },
};
const table = (rows, risk) => Array.from({ length: rows + 1 }, (_, i) => HALF[rows][risk][Math.min(i, rows - i)]);
const binom = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
const odds = (rows) => Array.from({ length: rows + 1 }, (_, k) => binom(rows, k) / 2 ** rows);
const tierOf = (m) => (m >= 100 ? 4 : m >= 10 ? 3 : m >= 2 ? 2 : m >= 1 ? 1 : 0);
const TIER_COL = ['rgba(255,255,255,.07)', 'rgba(16,185,129,.22)', 'rgba(16,185,129,.42)', 'rgba(212,175,55,.5)', 'rgba(251,113,60,.75)'];
const TIER_TXT = ['rgba(255,255,255,.5)', '#6ee7b7', '#a7f3d0', '#fde68a', '#fff'];
const mtxt = (m) => (m >= 100 ? `${m}` : `${m}×`);
const pct = (p) => (p >= 0.01 ? `${(p * 100).toFixed(1)}%` : p >= 0.0001 ? `${(p * 100).toFixed(2)}%` : `${(p * 100).toFixed(4)}%`);
const MAX_IN_FLIGHT = 30;

const pref = {
  get(k, d) { try { const v = localStorage.getItem(`alp_pl_${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`alp_pl_${k}`, JSON.stringify(v)); } catch { /* storage off */ } },
};

const RULES = `<div class="bjrules">
  <h3>How it works</h3>
  <p>Each ball costs your bet. It bounces left or right off every row of pegs and lands in a bucket — you win your bet times the bucket's multiplier.</p>
  <p>Balls land near the middle most of the time and rarely reach the edges. That's why the edge buckets pay the most.</p>
  <h3>Risk</h3>
  <ul><li><b>Low</b> — most buckets pay around 1×, small edges. Slow and steady.</li><li><b>Medium</b> — a middle ground.</li><li><b>High</b> — the middle pays almost nothing, the edges pay huge (up to 1000× on 16 rows).</li></ul>
  <h3>Rows</h3>
  <p>More rows = more buckets and bigger edge prizes, but they get even harder to reach. Every board returns about 99% of what's bet over time.</p>
  <h3>Odds</h3>
  <p>The bars under the buckets show how likely each one is. Hold (or hover) a bucket for its exact chance.</p>
  <h3>Settings</h3>
  <div class="bjtog"><span>Sound</span><button id="plSndTog"></button></div>
  <div class="bjtog"><span>Tutorial</span><button id="plTourAgain">Replay</button></div>
</div>`;

const STYLE = `
.plt{position:relative;padding:8px 12px 8px;gap:7px;justify-content:flex-start}
.plbar{display:flex;align-items:center;gap:8px;min-height:30px}
.plstats{display:flex;gap:12px;font-size:11px;color:rgba(255,255,255,.35);white-space:nowrap}
.plstats b{color:#fff;font-size:12.5px}
.plstats b.e{color:var(--em)}.plstats b.r{color:#f87171}.plstats b.g{color:var(--gold)}
.plhist{flex:1;display:flex;gap:3px;overflow:hidden;min-width:0;justify-content:flex-end;mask-image:linear-gradient(270deg,#000 80%,transparent)}
.plhist span{flex-shrink:0;font-size:9.5px;font-weight:700;padding:3px 5px;border-radius:6px;font-family:var(--pf)}
.plhist span.new{animation:rlin .4s cubic-bezier(.2,1.5,.4,1)}
@keyframes rlin{from{transform:scale(0)}}
.plico{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-family:var(--pf);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.plinfo{text-align:center;font-size:12px;color:rgba(255,255,255,.5);min-height:18px}
.plinfo b{color:#fff}.plinfo .g{color:var(--gold)}
.plboard{flex:1;min-height:0;position:relative;touch-action:none}
.plset{display:flex;flex-direction:column;gap:7px;flex-shrink:0}
.plrow{display:flex;gap:7px;align-items:center}
.plseg{display:flex;gap:3px;background:rgba(255,255,255,.04);border-radius:10px;padding:3px;flex:1}
.plseg button{flex:1;padding:7px 0;border-radius:7px;border:none;background:none;color:rgba(255,255,255,.45);font-family:var(--pf);font-size:12px;font-weight:700;cursor:pointer}
.plseg button.on{background:rgba(255,255,255,.1);color:#fff}
.plseg button.on[data-r="high"]{background:rgba(251,113,60,.22);color:#fdba74}
.plseg button.on[data-r="low"]{background:rgba(16,185,129,.18);color:#6ee7b7}
.plrows{display:flex;align-items:center;gap:8px;flex:1.1;font-size:11px;color:rgba(255,255,255,.4)}
.plrows input{flex:1;accent-color:var(--em)}
.plrows b{color:#fff;font-size:13px;min-width:18px;text-align:right}
.plset.locked .plseg,.plset.locked .plrows{opacity:.4;pointer-events:none}
.plbet{display:flex;gap:6px;align-items:center}
.plbet input{flex:1;min-width:0;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px;color:#fff;font-family:var(--pf);font-size:16px;font-weight:700;text-align:center;outline:none}
.plbet input:focus{border-color:rgba(16,185,129,.5)}
.plbet button{padding:9px 11px;border-radius:10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-family:var(--pf);font-size:12px;font-weight:700;cursor:pointer}
.plauto{display:none;gap:6px;align-items:center;font-size:11px;color:rgba(255,255,255,.4)}
.plauto.on{display:flex}
.plauto input{width:0;flex:1;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px;color:#fff;font-family:var(--pf);font-size:12px;text-align:center;outline:none}
#gactions .ga{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.1}
#gactions .ga small{font-size:9.5px;font-weight:400;opacity:.7;white-space:nowrap}
#gactions .ga.pldrop{flex:1.6}
#gactions .ga.plstop{background:rgba(239,68,68,.2);border-color:rgba(239,68,68,.45);color:#fca5a5}
.plflash{position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 85%,rgba(255,220,140,.55),transparent 70%);opacity:0;z-index:3}
.plflash.go{animation:plflash 1.1s ease-out}
@keyframes plflash{10%{opacity:1}}
.rlcoach{background:#0f1d18;border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.75);display:none;flex-shrink:0;animation:feedIn .25s ease-out}
.rlcoach.on{display:block}
.rlcoach b{color:var(--em)}
.rlcoach .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.rlcoach button{font-family:var(--pf);font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);cursor:pointer}
.rlcoach button.go{background:var(--em);color:#03150e;border-color:transparent}
.rlfocus{position:relative;z-index:5;border-radius:12px;box-shadow:0 0 0 2px var(--em),0 0 30px rgba(16,185,129,.35)}
.bjrules h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);margin:16px 0 6px}
.bjrules p,.bjrules li{font-size:13px;line-height:1.55;color:rgba(255,255,255,.7)}
.bjrules p+p{margin-top:6px}
.bjrules ul{padding-left:18px;margin:0}
.bjtog{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:rgba(255,255,255,.75)}
.bjtog button{font-family:var(--pf);font-size:12px;font-weight:700;padding:6px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);cursor:pointer;min-width:58px}
.bjtog button.on{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.4);color:var(--em)}
@media(min-width:900px){.plset{max-width:620px;margin:0 auto;width:100%}}
`;

export function renderPlinko(app) {
  const shell = gameShell(app, {
    id: 'plinko', title: 'Plinko', css: STYLE,
    stage: `<div class="pad plt" id="plt">
      <div class="plbar">
        <div class="plstats"><span>Balls <b id="plN">0</b></span><span>Profit <b id="plNet">0</b></span><span>Best <b id="plBest" class="g">–</b></span></div>
        <div class="plhist" id="plHist"></div>
        <button class="plico" id="plSnd" aria-label="Sound"></button><button class="plico" id="plHelp" aria-label="Rules">?</button>
      </div>
      <div class="plinfo" id="plInfo"></div>
      <div class="plboard" id="plBoard"><canvas class="fill" id="cvP"></canvas><div class="plflash" id="plFlash"></div></div>
      <div class="rlcoach" id="plCoach"></div>
      <div class="plset" id="plSet">
        <div class="plrow">
          <div class="plseg" id="plRisk"><button data-r="low">Low</button><button data-r="medium">Medium</button><button data-r="high">High</button></div>
          <label class="plrows">Rows <input type="range" id="plRows" min="8" max="16" step="1"><b id="plRowsV"></b></label>
        </div>
        <div class="plbet"><button data-b="half">½</button><input id="plBet" inputmode="numeric" autocomplete="off"><button data-b="dbl">2×</button><button data-b="max">Max</button></div>
        <div class="plauto" id="plAuto">Auto stops at profit <input id="plWin" inputmode="numeric" placeholder="none"> or loss <input id="plLoss" inputmode="numeric" placeholder="none"></div>
      </div>
    </div>${sheetHTML('shPlRules', 'How to play', RULES)}`,
  });

  // ── state ──────────────────────────────────────────────────────────────────
  let rows = pref.get('rows', 12), risk = pref.get('risk', 'high');
  if (!HALF[rows]) rows = 12; if (!['low', 'medium', 'high'].includes(risk)) risk = 'high';
  let mult = table(rows, risk), prob = odds(rows);
  let bet = Math.max(10, Number(pref.get('bet', 100)) || 100);
  let n = 0, net = 0, best = 0, hist = [];
  let balls = [], pops = [], flashes = [], sparks = [], dips = new Array(17).fill(0);
  let waiting = 0, latest = { nonce: -1, bal: null };
  let auto = false, autoNet = 0;
  let shake = 0, peekBucket = -1;

  const bal = () => Number(store.ccBalance) || 0;
  const inFlight = () => waiting + balls.length;

  // ── HUD ────────────────────────────────────────────────────────────────────
  function hud() {
    $('plN').textContent = fmt(n);
    const e = $('plNet'); e.textContent = `${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))}`; e.className = net > 0 ? 'e' : net < 0 ? 'r' : '';
    $('plBest').textContent = best ? mtxt(best).replace(/^(\d+)$/, '$1×') : '–';
    $('plSet').classList.toggle('locked', inFlight() > 0);
    controls();
  }
  function paintHist(fresh) {
    $('plHist').innerHTML = hist.slice(0, 20).map((m, i) => {
      const t = tierOf(m);
      return `<span class="${fresh && i === 0 ? 'new' : ''}" style="background:${TIER_COL[t]};color:${TIER_TXT[t]}">${m}×</span>`;
    }).join('');
  }
  function info() {
    if (peekBucket >= 0 && peekBucket <= rows) {
      const p = prob[peekBucket], m = mult[peekBucket];
      $('plInfo').innerHTML = `<b>${m}×</b> · ${pct(p)} chance · about 1 in ${fmt(Math.round(1 / p))}${bet ? ` · pays <span class="g">${fmt(Math.floor(bet * m))} CC</span>` : ''}`;
      return;
    }
    const top = mult[0];
    $('plInfo').innerHTML = `${risk[0].toUpperCase() + risk.slice(1)} risk · ${rows} rows · edges pay <span class="g">${top}×</span> · hold a bucket for its odds`;
  }

  // ── board settings ─────────────────────────────────────────────────────────
  function setBoard(r, k) {
    if (inFlight()) return;
    rows = r; risk = k; pref.set('rows', r); pref.set('risk', k);
    mult = table(rows, risk); prob = odds(rows); pops = []; flashes = []; dips = new Array(17).fill(0);
    $('plRisk').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.r === risk));
    $('plRows').value = rows; $('plRowsV').textContent = rows;
    info();
  }
  $('plRisk').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { setBoard(rows, b.dataset.r); sfx.chip(); }));
  $('plRows').addEventListener('input', (e) => setBoard(Number(e.target.value), risk));

  // ── bet ────────────────────────────────────────────────────────────────────
  function setBet(v) {
    bet = Math.max(10, Math.floor(v) || 10);
    pref.set('bet', bet);
    $('plBet').value = fmt(bet);
    info(); controls();
  }
  $('plBet').addEventListener('input', (e) => { const v = amountOf(e.target.value); e.target.value = v ? fmt(v) : ''; if (v >= 10) { bet = v; pref.set('bet', bet); controls(); } });
  $('plBet').addEventListener('blur', () => setBet(amountOf($('plBet').value)));
  document.querySelectorAll('.plbet [data-b]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.b;
    setBet(k === 'half' ? bet / 2 : k === 'dbl' ? Math.min(bet * 2, Math.max(10, bal())) : Math.max(10, bal()));
    sfx.chip();
  }));

  // ── actions ────────────────────────────────────────────────────────────────
  let lastCtl = '';
  function controls() {
    const canAfford = bal() >= bet;
    const key = `${auto}|${canAfford}|${bet}|${inFlight() >= MAX_IN_FLIGHT}`;
    if (key === lastCtl) return; lastCtl = key;
    const dis = !canAfford || inFlight() >= MAX_IN_FLIGHT ? ' disabled' : '';
    const a = shell.actions(auto
      ? `<button class="ga plstop" data-a="stop">Stop auto<small>${fmt(autoNet >= 0 ? autoNet : -autoNet)} ${autoNet >= 0 ? 'up' : 'down'}</small></button>`
      : `<button class="ga" data-a="auto"${dis}>Auto<small>until you stop</small></button>
         <button class="ga" data-a="x5"${dis}>×5<small>${fmt(bet * 5)}</small></button>
         <button class="ga" data-a="x10"${dis}>×10<small>${fmt(bet * 10)}</small></button>
         <button class="ga ga-em pldrop" data-a="drop"${dis}>Drop<small>${fmt(bet)} CC</small></button>`);
    a.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.a;
      if (k === 'drop') drop();
      else if (k === 'x5' || k === 'x10') { for (let i = 0; i < (k === 'x5' ? 5 : 10); i++) later(i * 110, drop); }
      else if (k === 'auto') startAuto();
      else stopAuto();
    }));
  }
  function refreshAutoLabel() {
    const s = document.querySelector('#gactions .plstop small');
    if (s) s.textContent = `${fmt(Math.abs(autoNet))} ${autoNet >= 0 ? 'up' : 'down'}`;
  }

  // ── auto ───────────────────────────────────────────────────────────────────
  function startAuto() {
    if (bal() < bet) return;
    if (tourStep >= 0) tour(TOUR.length);
    auto = true; autoNet = 0; lastCtl = '';
    $('plAuto').classList.add('on');
    controls();
    const tick = () => {
      if (!auto) return;
      const winLim = amountOf($('plWin').value), lossLim = amountOf($('plLoss').value);
      if (winLim && autoNet >= winLim) { stopAuto(`Auto stopped: +${fmt(autoNet)} profit reached`); return; }
      if (lossLim && -autoNet >= lossLim) { stopAuto(`Auto stopped: loss limit of ${fmt(lossLim)} hit`); return; }
      if (bal() < bet) { stopAuto('Auto stopped: not enough CC for another ball'); return; }
      if (inFlight() < MAX_IN_FLIGHT) drop();
      later(330, tick);
    };
    tick();
  }
  function stopAuto(msg) {
    if (!auto) return;
    auto = false; lastCtl = '';
    $('plAuto').classList.remove('on');
    if (msg) toast(msg, 'amber');
    controls();
  }

  // ── dropping ───────────────────────────────────────────────────────────────
  const localBal = (delta) => { store.ccBalance = Number(store.ccBalance) + delta; syncBalance(store.ccBalance); };
  const settle = () => { if (!inFlight() && latest.bal !== null) syncBalance(latest.bal); };

  async function drop() {
    if (bal() < bet || inFlight() >= MAX_IN_FLIGHT) return;
    if (tourStep >= 0) tour(TOUR.length);
    const b = bet, r = rows, k = risk;
    waiting++; n++; net -= b; if (auto) autoNet -= b; localBal(-b); hud();
    try {
      const res = await api.post('/games/plinko/drop', { amount: b, rows: r, risk: k });
      waiting--;
      if (res.nonce > latest.nonce) latest = { nonce: res.nonce, bal: res.cc_balance };
      // offset from centre (in peg gaps) before each row; lands on slot - rows/2
      const base = [], dirs = []; let pos = 0;
      res.path.forEach((p, i) => { base.push(pos - i / 2); dirs.push(p === 'R' ? 0.5 : -0.5); if (p === 'R') pos++; });
      balls.push({ t: -0.9, base, dirs, rows: r, slot: res.slot, mult: Number(res.multiplier), payout: Number(res.payout), bet: b, trail: [], lastRow: -1 });
    } catch (e) {
      waiting--; n--; net += b; if (auto) autoNet += b; localBal(b); toast(e.message, 'red');
      if (auto) stopAuto();
    }
    hud();
  }

  function land(b) {
    net += b.payout; if (auto) autoNet += b.payout; localBal(b.payout);
    if (b.mult > best) best = b.mult;
    hist.unshift(b.mult); if (hist.length > 20) hist.length = 20;
    paintHist(true);
    if (b.rows !== rows) { hud(); settle(); return; } // board was changed (can't normally happen while in flight)
    const t = tierOf(b.mult);
    pops.push({ i: b.slot, t: 0, m: b.mult, tier: t });
    dips[b.slot] = 1;
    bucket(t);
    if (t >= 3) {
      shake = t === 4 ? 0.5 : 0.25;
      for (let i = 0; i < (t === 4 ? 46 : 22); i++) sparks.push({ slot: b.slot, a: Math.random() * Math.PI - Math.PI, v: 60 + Math.random() * 180, t: 0, life: 0.6 + Math.random() * 0.6 });
    }
    if (b.slot === 0 || b.slot === b.rows) { const f = $('plFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    if (b.mult >= 10) maybeWinFx(b.payout - b.bet, b.bet);
    refreshAutoLabel();
    hud(); settle();
  }

  // ── hold / hover a bucket ──────────────────────────────────────────────────
  let geo = null; // last frame's geometry, for hit-testing
  const bucketAt = (x, y) => {
    if (!geo) return -1;
    if (y < geo.sy - geo.gy * 0.6) return -1;
    const i = Math.round((x - geo.cx) / geo.gx + rows / 2);
    return i >= 0 && i <= rows ? i : -1;
  };
  const cvEl = $('cvP');
  let holdT = null;
  const local = (e) => { const r = cvEl.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cvEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { const i = bucketAt(...local(e)); if (i !== peekBucket) { peekBucket = i; info(); } } });
  cvEl.addEventListener('pointerleave', () => { peekBucket = -1; info(); });
  cvEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const i = bucketAt(...local(e)); if (i < 0) return;
    holdT = later(200, () => { peekBucket = i; info(); });
  });
  ['pointerup', 'pointercancel'].forEach((k) => cvEl.addEventListener(k, (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(holdT);
    if (peekBucket >= 0) later(1600, () => { peekBucket = -1; info(); });
  }));

  // ── tutorial ───────────────────────────────────────────────────────────────
  let tourStep = -1;
  const TOUR = [
    ['plSet', 'Choose your <b>risk</b> and <b>rows</b>, and your bet per ball. High risk = tiny middle, huge edges. <b>Hold</b> any bucket to see its odds.'],
    ['gactions', '<b>Drop</b> one ball, a handful with ×5 / ×10, or let <b>Auto</b> keep dropping until you stop it.'],
  ];
  function coach(html, buttons) {
    const c = $('plCoach');
    document.querySelectorAll('.rlfocus').forEach((e) => e.classList.remove('rlfocus'));
    if (!html) { c.classList.remove('on'); c.innerHTML = ''; return; }
    c.innerHTML = html + (buttons ? `<div class="row">${buttons}</div>` : '');
    c.classList.add('on');
  }
  function tour(step) {
    tourStep = step;
    if (step >= TOUR.length) { tourStep = -1; pref.set('tour', true); coach(null); return; }
    const [target, text] = TOUR[step];
    coach(text, `<button data-t="skip">Skip</button><button class="go" data-t="next">${step === TOUR.length - 1 ? 'Got it' : 'Next'}</button>`);
    $(target)?.classList.add('rlfocus');
    $('plCoach').querySelector('[data-t="next"]').onclick = () => tour(step + 1);
    $('plCoach').querySelector('[data-t="skip"]').onclick = () => tour(TOUR.length);
  }

  // ── render loop ────────────────────────────────────────────────────────────
  const pegFlash = new Map(); // "row:i" → glow 0..1
  loop((dt) => {
    const f = fitCanvas(cvEl); if (!f) return;
    const { ctx: c, W, H } = f;
    const top = H * 0.05, oddsH = Math.min(18, H * 0.05);
    const avail = H - top - oddsH - 8;
    const gy = avail / (rows + 1.45);
    const gx = Math.min(W / (rows + 2.4), gy * 1.18);
    const cx = W / 2, sy = top + rows * gy + gy * 0.05, sw = gx * 0.92, sh = Math.min(gy * 0.95, 32);
    geo = { cx, gx, gy, sy };

    c.save();
    if (shake > 0) { shake = Math.max(0, shake - dt); const s = shake * 14; c.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }

    // pegs
    const pr = Math.max(1.8, Math.min(gx, gy) * 0.1);
    for (let r = 0; r < rows; r++) for (let i = 0; i <= r + 2; i++) {
      const key = `${r}:${i}`, gl = pegFlash.get(key) || 0;
      const x = cx + (i - (r + 2) / 2) * gx, y = top + r * gy;
      if (gl > 0) { c.beginPath(); c.arc(x, y, pr * (2.6 + gl), 0, 7); c.fillStyle = gd(gl * 0.25); c.fill(); }
      c.beginPath(); c.arc(x, y, pr * (1 + gl * 0.5), 0, 7); c.fillStyle = gl > 0 ? `rgba(255,236,170,${0.35 + gl * 0.65})` : w(0.22); c.fill();
    }
    for (const [k, v] of pegFlash) { const nv = v - dt * 3.5; if (nv <= 0) pegFlash.delete(k); else pegFlash.set(k, nv); }

    // buckets
    pops.forEach((p) => { p.t += dt; }); pops = pops.filter((p) => p.t < 1.2);
    const maxP = Math.max(...prob);
    for (let i = 0; i <= rows; i++) {
      dips[i] = Math.max(0, dips[i] - dt * 3);
      const x = cx + (i - rows / 2) * gx - sw / 2, m = mult[i], t = tierOf(m);
      const dy = Math.sin(dips[i] * Math.PI) * sh * 0.28;
      const p = pops.find((q) => q.i === i), glow = p ? Math.max(0, 1 - p.t / 1.2) : 0;
      const peek = i === peekBucket;
      c.fillStyle = TIER_COL[t]; rr(c, x, sy + dy, sw, sh, 5); c.fill();
      if (glow > 0 || peek) { c.fillStyle = `rgba(255,255,255,${peek ? 0.18 : glow * 0.4})`; rr(c, x, sy + dy, sw, sh, 5); c.fill(); }
      if (peek) { c.strokeStyle = GOLD; c.lineWidth = 1.5; rr(c, x, sy + dy, sw, sh, 5); c.stroke(); }
      c.fillStyle = TIER_TXT[t];
      c.font = `700 ${Math.min(sh * 0.4, sw * (m >= 100 ? 0.3 : 0.32), 12.5)}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(m >= 100 ? `${m}` : `${m}×`, x + sw / 2, sy + dy + sh / 2);
      // odds bar
      const ph = Math.max(1.5, (prob[i] / maxP) * oddsH);
      c.fillStyle = peek ? gd(0.8) : w(0.13);
      rr(c, x + sw * 0.2, sy + sh + 6 + (oddsH - ph), sw * 0.6, ph, 2); c.fill();
      if (p && glow > 0) {
        c.globalAlpha = glow; c.font = `800 ${Math.min(H * 0.05, p.tier >= 3 ? 20 : 14)}px ${PF}`;
        c.fillStyle = p.tier >= 3 ? GOLD : p.tier >= 1 ? '#6ee7b7' : 'rgba(248,113,113,.9)';
        c.fillText(`${p.m}×`, x + sw / 2, sy - 12 - (1 - glow) * 22); c.globalAlpha = 1;
      }
    }

    // sparks
    for (let k = sparks.length - 1; k >= 0; k--) {
      const s = sparks[k]; s.t += dt; if (s.t > s.life) { sparks.splice(k, 1); continue; }
      const x0 = cx + (s.slot - rows / 2) * gx, y0 = sy;
      const x = x0 + Math.cos(s.a) * s.v * s.t, y = y0 + Math.sin(s.a) * s.v * s.t + 160 * s.t * s.t;
      c.globalAlpha = 1 - s.t / s.life; c.fillStyle = s.slot % 2 ? GOLD : '#fff7d6';
      c.fillRect(x - 1.5, y - 1.5, 3, 3); c.globalAlpha = 1;
    }

    // balls
    const br = Math.max(3.5, Math.min(gx, gy) * 0.2);
    for (let k = balls.length - 1; k >= 0; k--) {
      const b = balls[k];
      b.t += dt * (b.rows / 1.75);
      const r = Math.floor(b.t);
      if (r >= b.rows) { balls.splice(k, 1); land(b); continue; }
      if (r >= 0 && r !== b.lastRow) {
        // the ball touches a peg in row r at each whole t — flash it and tick
        b.lastRow = r;
        if (b.rows === rows) { pegFlash.set(`${r}:${Math.round(b.base[r] + (r + 2) / 2)}`, 1); pegTick(r / rows); }
      }
      const contact = pr + br * 0.9;
      let x, y;
      if (r < 0) { x = cx + b.base[0] * gx; y = top - contact + b.t * gy * 1.4; } // falling in from above
      else {
        const fr = b.t - r;
        const ease = fr < 0.5 ? 2 * fr * fr : 1 - (-2 * fr + 2) ** 2 / 2;
        x = cx + (b.base[r] + b.dirs[r] * (0.15 * fr + 0.85 * ease)) * gx;
        y = top + b.t * gy - contact - Math.sin(fr * Math.PI) * gy * 0.38;
      }
      b.trail.push([x, y]); if (b.trail.length > 6) b.trail.shift();
      if (y < -gy) continue;
      b.trail.forEach(([tx, ty], j) => { c.beginPath(); c.arc(tx, ty, br * (0.4 + j * 0.08), 0, 7); c.fillStyle = gd(0.05 + j * 0.03); c.fill(); });
      c.beginPath(); c.arc(x, y, br * 1.9, 0, 7); c.fillStyle = gd(0.12); c.fill();
      const g = c.createRadialGradient(x - br * 0.35, y - br * 0.35, br * 0.1, x, y, br);
      g.addColorStop(0, '#fff6d5'); g.addColorStop(1, GOLD);
      c.beginPath(); c.arc(x, y, br, 0, 7); c.fillStyle = g; c.fill();
    }
    c.restore();
  });

  // ── wiring ─────────────────────────────────────────────────────────────────
  const paintSound = () => { $('plSnd').textContent = isMuted() ? '🔇' : '🔊'; };
  $('plSnd').addEventListener('click', () => { setMuted(!isMuted()); paintSound(); if (!isMuted()) sfx.chip(); });
  $('plHelp').addEventListener('click', () => {
    const paint = () => { $('plSndTog').textContent = isMuted() ? 'Off' : 'On'; $('plSndTog').classList.toggle('on', !isMuted()); };
    paint();
    $('plSndTog').onclick = () => { setMuted(!isMuted()); paint(); paintSound(); };
    $('plTourAgain').onclick = () => { closeSheets(); tour(0); };
    openSheet('shPlRules');
  });
  listen(document, 'balance:updated', () => controls());

  shell.show('scPlay');
  setBoard(rows, risk); setBet(Math.min(bet, Math.max(10, bal()))); paintSound(); paintHist(); hud();
  if (!pref.get('tour', false)) later(500, () => tour(0));
}
