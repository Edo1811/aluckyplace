import { api } from '../api.js';
import { store } from '../store.js';
import { $, fmt, toast, later, sheetHTML, openSheet, closeSheets } from '../ui/core.js';
import { gameShell, fitCanvas, loop, flick, syncBalance, eOut } from '../games/shell.js';
import { w, gd, PF } from '../games/draw.js';
import { isBigWin } from '../cosmeticFx.js';
import { sfx, isMuted, setMuted } from '../games/sfx.js';

// ── table data ────────────────────────────────────────────────────────────────
const RED_N = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const SEG = (Math.PI * 2) / WHEEL.length;
const colorOf = (n) => (n === 0 ? 'green' : RED_N.has(n) ? 'red' : 'black');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Every bet on the felt: name, numbers it covers, total return multiplier (stake included). */
const ZONES = {};
range(0, 36).forEach((n) => { ZONES[`n${n}`] = { name: n === 0 ? 'Green 0' : `${n} ${colorOf(n)}`, nums: [n], pays: 36 }; });
[1, 2, 3].forEach((d) => { ZONES[`d${d}`] = { name: `${(d - 1) * 12 + 1}–${d * 12}`, nums: range((d - 1) * 12 + 1, d * 12), pays: 3 }; });
[1, 2, 3].forEach((c) => { ZONES[`c${c}`] = { name: `Column ${c}`, nums: range(0, 11).map((i) => c + i * 3), pays: 3 }; });
Object.assign(ZONES, {
  red: { name: 'Red', nums: [...RED_N], pays: 2 },
  black: { name: 'Black', nums: range(1, 36).filter((n) => !RED_N.has(n)), pays: 2 },
  odd: { name: 'Odd', nums: range(1, 36).filter((n) => n % 2), pays: 2 },
  even: { name: 'Even', nums: range(1, 36).filter((n) => !(n % 2)), pays: 2 },
  lo: { name: 'Low 1–18', nums: range(1, 18), pays: 2 },
  hi: { name: 'High 19–36', nums: range(19, 36), pays: 2 },
});
// felt zone → server bet {type, value}
const ZONE = (z) => {
  if (z[0] === 'n') return { type: 'straight', value: Number(z.slice(1)) };
  if (z[0] === 'd') return { type: 'dozen', value: Number(z.slice(1)) };
  if (z[0] === 'c') return { type: 'column', value: Number(z.slice(1)) };
  if (z === 'lo' || z === 'hi') return { type: 'half', value: z === 'lo' ? 'low' : 'high' };
  if (z === 'even' || z === 'odd') return { type: 'parity', value: z };
  return { type: 'color', value: z };
};
const chance = (z) => `${((ZONES[z].nums.length / 37) * 100).toFixed(1)}%`;

const CHIPS = [10, 100, 1000, 10000, 100000];
const CHIP_COL = { 10: '#e5e7eb', 100: '#10b981', 1000: '#3b82f6', 10000: '#a855f7', 100000: '#D4AF37' };
const short = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(n));
const chipColor = (amt) => CHIP_COL[[...CHIPS].reverse().find((c) => amt >= c) || 10];

const pref = {
  get(k, d) { try { const v = localStorage.getItem(`alp_rl_${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`alp_rl_${k}`, JSON.stringify(v)); } catch { /* storage off */ } },
};

// ── markup ────────────────────────────────────────────────────────────────────
const simpleBtn = (z, label, cls = '') => `<button class="rlb ${cls}" data-z="${z}"><span>${label}</span><small>pays ${ZONES[z].pays}× · ${chance(z)}</small></button>`;
const SIMPLE = `<div class="rlsimple">
  <div class="rlrow">${simpleBtn('red', 'Red', 'rred')}${simpleBtn('black', 'Black', 'rblack')}</div>
  <div class="rlrow">${simpleBtn('odd', 'Odd')}${simpleBtn('even', 'Even')}</div>
  <div class="rlrow">${simpleBtn('lo', 'Low 1–18')}${simpleBtn('hi', 'High 19–36')}</div>
  <div class="rlrow">${simpleBtn('d1', '1–12')}${simpleBtn('d2', '13–24')}${simpleBtn('d3', '25–36')}</div>
  <div class="rlrow">${simpleBtn('n0', 'Green 0', 'rgreen')}</div>
</div>`;

const cell = (z, label, pos, cls = '') => `<div class="rc ${cls}" data-z="${z}" style="grid-area:${pos}">${label}</div>`;
const numCls = (n) => (n === 0 ? 'cg' : RED_N.has(n) ? 'cr' : 'cb');
/** Portrait felt (phones): 0 on top, 12 rows of 3, columns at the bottom, dozens + even-money down the left. */
function feltPortrait() {
  let h = '<div class="rlfelt port">';
  h += cell('n0', '0', '1 / 3 / 2 / 6', 'cg');
  for (let r = 0; r < 12; r++) for (let c = 0; c < 3; c++) { const n = r * 3 + c + 1; h += cell(`n${n}`, n, `${r + 2} / ${c + 3} / ${r + 3} / ${c + 4}`, numCls(n)); }
  [1, 2, 3].forEach((c) => { h += cell(`c${c}`, 'Col', `14 / ${c + 2} / 15 / ${c + 3}`, 'co'); });
  [1, 2, 3].forEach((d) => { h += cell(`d${d}`, `<span>${ZONES[`d${d}`].name}</span>`, `${(d - 1) * 4 + 2} / 2 / ${d * 4 + 2} / 3`, 'co vert'); });
  [['lo', '1–18'], ['even', 'Even'], ['red', '<i class="dia r"></i>'], ['black', '<i class="dia b"></i>'], ['odd', 'Odd'], ['hi', '19–36']]
    .forEach(([z, l], i) => { h += cell(z, `<span>${l}</span>`, `${i * 2 + 2} / 1 / ${i * 2 + 4} / 2`, 'co vert'); });
  return `${h}</div>`;
}
/** Landscape felt (desktop): the classic wide layout. */
function feltLandscape() {
  let h = '<div class="rlfelt land">';
  h += cell('n0', '0', '1 / 1 / 4 / 2', 'cg');
  for (let i = 0; i < 12; i++) for (let row = 0; row < 3; row++) { const n = i * 3 + (3 - row); h += cell(`n${n}`, n, `${row + 1} / ${i + 2} / ${row + 2} / ${i + 3}`, numCls(n)); }
  [3, 2, 1].forEach((c, row) => { h += cell(`c${c}`, 'Column', `${row + 1} / 14 / ${row + 2} / 15`, 'co'); });
  [1, 2, 3].forEach((d) => { h += cell(`d${d}`, ZONES[`d${d}`].name, `4 / ${(d - 1) * 4 + 2} / 5 / ${d * 4 + 2}`, 'co'); });
  [['lo', 'Low 1–18'], ['even', 'Even'], ['red', '<i class="dia r"></i> Red'], ['black', '<i class="dia b"></i> Black'], ['odd', 'Odd'], ['hi', 'High 19–36']]
    .forEach(([z, l], i) => { h += cell(z, l, `5 / ${i * 2 + 2} / 6 / ${i * 2 + 4}`, 'co'); });
  return `${h}</div>`;
}

const RULES = `<div class="bjrules">
  <h3>How to bet</h3>
  <ul><li>Pick a chip value in the rack at the bottom</li><li>Tap any bet to put a chip on it — tap again to add more</li><li><b>Hold</b> a bet (or hover on desktop) to see what it covers and pays, without betting</li><li>Hit <b>Spin</b> — or flick the wheel</li></ul>
  <h3>Payouts (your chip included)</h3>
  <table><tr><td>Single number (incl. 0)</td><td>36×</td></tr><tr><td>Dozen 1–12 · 13–24 · 25–36</td><td>3×</td></tr><tr><td>Column</td><td>3×</td></tr><tr><td>Red · Black · Odd · Even · Low · High</td><td>2×</td></tr></table>
  <p style="margin-top:8px">The green 0 isn't red or black, odd or even, low or high — when it hits, every outside bet loses. That's the house edge (2.7%).</p>
  <h3>Hot &amp; cold</h3>
  <p>Hot/Cold shows which numbers came up most and least in the last 100 spins on the site. Fun to follow — but every spin is independent and provably fair, so past numbers don't change the odds.</p>
  <h3>Settings</h3>
  <div class="bjtog"><span>Sound</span><button id="rlSndTog"></button></div>
  <div class="bjtog"><span>Tutorial</span><button id="rlTourAgain">Replay</button></div>
</div>`;

const STYLE = `
.rlt{position:relative;padding:8px 12px 10px;gap:7px;justify-content:flex-start}
.rlbar{display:flex;align-items:center;gap:7px;min-height:30px}
.rlbar .sp{flex:1}
.rlico{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);font-family:var(--pf);font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rlico.on{border-color:rgba(251,146,60,.5);background:rgba(251,146,60,.12)}
.rlstreak{font-size:11px;font-weight:700;color:rgba(255,255,255,.3);padding:4px 9px;border-radius:10px;border:1px solid transparent;white-space:nowrap}
.rlstreak.hot{color:#fbbf24;border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.08)}
.rlstreak.fire{color:#fb923c;border-color:rgba(251,146,60,.45);background:rgba(251,146,60,.12)}
.rlhist{flex:1;display:flex;gap:4px;align-items:center;overflow:hidden;min-width:0;mask-image:linear-gradient(90deg,#000 80%,transparent)}
.rlhist span{flex-shrink:0;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff}
.rlhist span:first-child{width:28px;height:28px;font-size:12px;box-shadow:0 0 0 2px rgba(212,175,55,.6)}
.rlhist span.new{animation:rlin .45s cubic-bezier(.2,1.5,.4,1)}
@keyframes rlin{from{transform:scale(0)}}
.hr{background:#9b1c1c}.hb{background:#262626;border:1px solid rgba(255,255,255,.12)}.hg{background:#0f8a5f}
.rlwheel{height:178px;position:relative;flex-shrink:0;transition:height .3s}
.rlt.num .rlwheel{height:136px}
.rlinfo{text-align:center;font-size:12px;color:rgba(255,255,255,.5);min-height:32px;display:flex;align-items:center;justify-content:center;line-height:1.35;padding:0 6px}
.rlinfo b{color:#fff}.rlinfo .g{color:var(--gold)}.rlinfo .e{color:var(--em)}.rlinfo .r{color:#f87171}
.rltabs{display:flex;gap:4px;background:rgba(255,255,255,.04);border-radius:11px;padding:3px;flex-shrink:0}
.rltabs button{flex:1;padding:7px 0;border-radius:8px;border:none;background:none;color:rgba(255,255,255,.45);font-family:var(--pf);font-size:12.5px;font-weight:700;cursor:pointer}
.rltabs button.on{background:rgba(255,255,255,.1);color:#fff}
.rlpanels{flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;position:relative}
.rlpanels::-webkit-scrollbar{display:none}
.rlpanel{display:none}.rlpanel.on{display:block}
.rlsimple{display:flex;flex-direction:column;gap:6px}
.rlrow{display:flex;gap:6px}
.rlb{position:relative;flex:1;padding:10px 6px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-family:var(--pf);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;user-select:none;-webkit-user-select:none;touch-action:manipulation;transition:transform .1s,background .15s}
.rlb:active{transform:scale(.97)}
.rlb span{font-size:15px;font-weight:700}
.rlb small{font-size:10px;color:rgba(255,255,255,.45)}
.rlb.rred{background:rgba(185,28,28,.35);border-color:rgba(239,68,68,.35)}
.rlb.rblack{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.18)}
.rlb.rgreen{background:rgba(16,185,129,.18);border-color:rgba(16,185,129,.35)}
.rlb.peek,.rc.peek{box-shadow:0 0 0 2px var(--gold)}
.rlfelt{display:grid;gap:3px;user-select:none;-webkit-user-select:none}
.rlfelt.port{grid-template-columns:38px 38px repeat(3,1fr);grid-auto-rows:minmax(25px,1fr)}
.rlfelt.land{display:none;grid-template-columns:34px repeat(12,1fr) 52px;grid-auto-rows:34px}
.rc{position:relative;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:var(--pf);font-weight:700;font-size:12px;color:rgba(255,255,255,.85);cursor:pointer;touch-action:manipulation;transition:filter .15s,box-shadow .15s,opacity .2s}
.rc.cr{background:rgba(155,28,28,.6)}.rc.cb{background:rgba(255,255,255,.07)}.rc.cg{background:rgba(16,185,129,.38)}
.rc.co{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);font-size:10px;color:rgba(255,255,255,.6);letter-spacing:.03em}
.rc.vert span{writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap}
.dia{display:inline-block;width:12px;height:12px;transform:rotate(45deg);border-radius:2px}
.dia.r{background:#dc2626}.dia.b{background:#111;border:1px solid rgba(255,255,255,.4)}
.rc.vert .dia{transform:rotate(45deg)}
.rc.cov{box-shadow:inset 0 0 0 2px var(--gold);filter:brightness(1.35)}
.rlfelt.covering .rc[data-z^="n"]:not(.cov){opacity:.35}
.rc.hit,.rlb.hit{animation:rlhit 1s ease-in-out 2;box-shadow:0 0 0 2px var(--gold),0 0 22px rgba(212,175,55,.6);z-index:2}
@keyframes rlhit{50%{filter:brightness(1.8)}}
.rc.heat::after{content:'';position:absolute;inset:0;border-radius:6px;background:var(--hc);pointer-events:none}
.rc .hm{position:absolute;top:-2px;left:1px;font-size:8px;pointer-events:none}
.rlchip{position:absolute;right:-3px;top:-5px;min-width:22px;height:22px;padding:0 3px;border-radius:11px;background:var(--c);border:2px dashed rgba(255,255,255,.7);color:#111;font-family:var(--pf);font-size:9px;font-weight:800;font-style:normal;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.6);z-index:3;pointer-events:none;box-sizing:border-box}
.rlchip.new{animation:rldrop .28s cubic-bezier(.3,1.5,.5,1)}
@keyframes rldrop{from{transform:translateY(-18px) scale(1.3);opacity:0}}
.rlchip.won{background:var(--gold);box-shadow:0 0 14px rgba(212,175,55,.9);animation:rlhit .5s ease-in-out 3}
.rlchip.lost{transition:transform .5s cubic-bezier(.5,0,.75,0),opacity .5s;transform:translateY(-70px) scale(.5);opacity:0}
.rlplus{position:absolute;right:0;top:-18px;font-size:12px;font-weight:800;color:var(--gold);pointer-events:none;z-index:4;animation:floatup 1.4s ease-out forwards;text-shadow:0 2px 6px #000}
.rlrack{display:flex;gap:6px;justify-content:center;flex-shrink:0;padding-top:2px}
.rlrack button{width:46px;height:46px;border-radius:50%;border:3px dashed rgba(255,255,255,.65);background:var(--c);color:#111;font-family:var(--pf);font-size:11.5px;font-weight:800;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.45);transition:transform .15s,opacity .15s;opacity:.55}
.rlrack button.on{opacity:1;transform:translateY(-4px);box-shadow:0 0 0 2px #fff,0 6px 14px rgba(0,0,0,.5)}
.rlrack button:disabled{opacity:.15;cursor:default}
.rlrack button.shake{animation:bjshake .4s}
@keyframes bjshake{20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
#gactions .ga{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;line-height:1.1}
#gactions .ga small{font-size:9.5px;font-weight:400;opacity:.7;white-space:nowrap}
#gactions .ga.rlspin{flex:1.7}
.rlcoach{background:#0f1d18;border:1px solid rgba(16,185,129,.35);border-radius:12px;padding:10px 12px;font-size:12.5px;line-height:1.45;color:rgba(255,255,255,.75);display:none;flex-shrink:0;animation:feedIn .25s ease-out}
.rlcoach.on{display:block}
.rlcoach b{color:var(--em)}
.rlcoach .row{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.rlcoach button{font-family:var(--pf);font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);cursor:pointer}
.rlcoach button.go{background:var(--em);color:#03150e;border-color:transparent}
.rlfocus{position:relative;z-index:5;border-radius:12px;box-shadow:0 0 0 2px var(--em),0 0 30px rgba(16,185,129,.35)}
.bjrules h3{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);margin:16px 0 6px}
.bjrules p,.bjrules li{font-size:13px;line-height:1.55;color:rgba(255,255,255,.7)}
.bjrules ul{padding-left:18px;margin:0}
.bjrules table{width:100%;border-collapse:collapse;font-size:12.5px}
.bjrules td{padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);color:rgba(255,255,255,.7)}
.bjrules td:last-child{text-align:right;color:var(--gold);font-weight:700}
.bjtog{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px;color:rgba(255,255,255,.75)}
.bjtog button{font-family:var(--pf);font-size:12px;font-weight:700;padding:6px 14px;border-radius:9px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);cursor:pointer;min-width:58px}
.bjtog button.on{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.4);color:var(--em)}
@media(min-width:900px){
  .rlfelt.port{display:none}.rlfelt.land{display:grid}
  .rlwheel,.rlt.num .rlwheel{height:210px}
  .rlsimple{max-width:620px;margin:0 auto}
  .rlt{padding:10px 22px 12px}
}
`;

export function renderRoulette(app) {
  const shell = gameShell(app, {
    id: 'roulette', title: 'Roulette', css: STYLE,
    stage: `<div class="pad rlt" id="rlt">
      <div class="rlbar"><div class="rlstreak" id="rlStreak"></div><div class="rlhist" id="rlHist"></div>
        <button class="rlico" id="rlHeat" aria-label="Hot and cold" title="Hot & cold numbers">🔥</button>
        <button class="rlico" id="rlSnd" aria-label="Sound"></button><button class="rlico" id="rlHelp" aria-label="Rules">?</button></div>
      <div class="rlwheel" id="rlWheel"><canvas class="fill" id="cvR"></canvas></div>
      <div class="rlinfo" id="rlInfo"></div>
      <div class="rltabs" id="rlTabs"><button data-tab="simple">Simple</button><button data-tab="num">Numbers</button></div>
      <div class="rlpanels" id="rlPanels"><div class="rlpanel" id="rlSimple">${SIMPLE}</div><div class="rlpanel" id="rlNum">${feltPortrait()}${feltLandscape()}</div></div>
      <div class="rlcoach" id="rlCoach"></div>
      <div class="rlrack" id="rlRack"></div>
    </div>${sheetHTML('shRlRules', 'How to play', RULES)}`,
  });

  // ── state ──────────────────────────────────────────────────────────────────
  let bets = {};                 // zone → amount
  let undo = [];                 // stack of batches: [[zone, amount], …]
  let lastLayout = null;         // bets of the previous spin
  let chipVal = pref.get('chip', 100);
  let tab = pref.get('tab', 'simple');
  let heat = pref.get('heat', false);
  let streak = Number(pref.get('streak', 0)) || 0;
  let phase = 'bet';             // bet | spin | result
  let recent = [];               // site-wide numbers, newest first
  let peek = null;               // zone being previewed (hover / hold)
  let res = null;

  const bal = () => Number(store.ccBalance) || 0;
  const total = () => Object.values(bets).reduce((a, b) => a + b, 0);
  const zonesAt = (z) => document.querySelectorAll(`#rlPanels [data-z="${z}"]`);

  // ── info bar ───────────────────────────────────────────────────────────────
  function bestHit() {
    let best = -Infinity, t = total();
    for (let n = 0; n <= 36; n++) {
      let pay = 0;
      for (const [z, amt] of Object.entries(bets)) if (ZONES[z].nums.includes(n)) pay += amt * ZONES[z].pays;
      best = Math.max(best, pay - t);
    }
    return best;
  }
  function info(html) {
    if (html !== undefined) { $('rlInfo').innerHTML = html; return; }
    if (phase !== 'bet') return;
    if (peek) {
      const Z = ZONES[peek], on = bets[peek];
      const cover = Z.nums.length === 1 ? 'one number' : `${Z.nums.length} numbers`;
      $('rlInfo').innerHTML = `<span><b>${Z.name}</b> · ${cover} · pays <span class="g">${Z.pays}×</span> · ${chance(peek)} chance${on ? ` · <b>${fmt(on)}</b> on it` : ''}</span>`;
      return;
    }
    const t = total();
    if (t) { const b = bestHit(); $('rlInfo').innerHTML = `<span>On the table <b>${fmt(t)} CC</b> · best hit ${b > 0 ? `<span class="e">+${fmt(b)}</span>` : '<span class="r">no profit</span>'}</span>`; return; }
    if (heat && recent.length) {
      const { hot, cold } = heatSets();
      $('rlInfo').innerHTML = `<span>Last ${recent.length} spins · 🔥 <b>${hot.join(' ')}</b> · ❄️ <b>${cold.join(' ')}</b></span>`;
      return;
    }
    $('rlInfo').innerHTML = '<span>Pick a chip, then tap a bet · <b>hold</b> a bet to see what it pays</span>';
  }

  // ── coverage preview ───────────────────────────────────────────────────────
  let covered = new Set();
  function setPeek(z) {
    peek = z;
    document.querySelectorAll('#rlPanels .peek, #rlPanels .cov').forEach((e) => e.classList.remove('peek', 'cov'));
    document.querySelectorAll('.rlfelt').forEach((f) => f.classList.toggle('covering', !!z && ZONES[z].nums.length > 1));
    covered = new Set(z ? ZONES[z].nums : []);
    if (z) {
      zonesAt(z).forEach((e) => e.classList.add('peek'));
      if (ZONES[z].nums.length > 1) covered.forEach((n) => zonesAt(`n${n}`).forEach((e) => e.classList.add('cov')));
    }
    info();
  }

  // ── chips on the felt ──────────────────────────────────────────────────────
  function paintChips(fresh) {
    document.querySelectorAll('#rlPanels .rlchip').forEach((c) => c.remove());
    for (const [z, amt] of Object.entries(bets)) {
      zonesAt(z).forEach((el) => {
        const c = document.createElement('i');
        c.className = `rlchip${fresh && fresh.has(z) ? ' new' : ''}`;
        c.style.setProperty('--c', chipColor(amt));
        c.textContent = short(amt);
        el.appendChild(c);
      });
    }
    info();
    controls();
  }
  function place(z) {
    if (phase !== 'bet') return;
    if (total() + chipVal > bal()) {
      toast('Not enough CC for that chip', 'red');
      const b = $('rlRack').querySelector('.on'); if (b) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
      return;
    }
    bets[z] = (bets[z] || 0) + chipVal;
    undo.push([[z, chipVal]]);
    sfx.chip();
    paintChips(new Set([z]));
  }
  function applyBatch(batch) {
    batch.forEach(([z, a]) => { bets[z] = (bets[z] || 0) + a; });
    undo.push(batch);
    sfx.chips();
    paintChips(new Set(batch.map(([z]) => z)));
  }
  function doUndo() {
    const b = undo.pop(); if (!b) return;
    b.forEach(([z, a]) => { bets[z] -= a; if (bets[z] <= 0) delete bets[z]; });
    paintChips();
  }
  function doClear() { bets = {}; undo = []; paintChips(); }
  function doDouble() {
    const t = total();
    if (!t && lastLayout) {
      const need = Object.values(lastLayout).reduce((a, b) => a + b, 0);
      if (need > bal()) return toast('Not enough CC to repeat that bet', 'red');
      return applyBatch(Object.entries(lastLayout));
    }
    if (t * 2 > bal()) return toast('Not enough CC to double', 'red');
    applyBatch(Object.entries(bets));
  }

  // ── rack + actions ─────────────────────────────────────────────────────────
  function paintRack() {
    const b = bal();
    if (chipVal > Math.max(10, b)) chipVal = [...CHIPS].reverse().find((c) => c <= b) || 10;
    $('rlRack').innerHTML = CHIPS.map((c) => `<button data-c="${c}" style="--c:${CHIP_COL[c]}" class="${c === chipVal ? 'on' : ''}"${c > b && c !== 10 ? ' disabled' : ''}>${short(c)}</button>`).join('');
    $('rlRack').querySelectorAll('[data-c]').forEach((btn) => btn.addEventListener('click', () => {
      chipVal = Number(btn.dataset.c); pref.set('chip', chipVal); sfx.chip(); paintRack();
    }));
  }
  function controls() {
    if (phase !== 'bet') return;
    const t = total();
    const repeat = !t && lastLayout;
    shell.actions(`<button class="ga" data-a="undo"${undo.length ? '' : ' disabled'}>Undo</button>
      <button class="ga" data-a="clear"${t ? '' : ' disabled'}>Clear</button>
      <button class="ga ga-gold" data-a="x2"${t || repeat ? '' : ' disabled'}>${repeat ? 'Repeat' : '2×'}</button>
      <button class="ga ga-em rlspin" data-a="spin"${t ? '' : ' disabled'}>Spin${t ? `<small>${fmt(t)} CC</small>` : ''}</button>`)
      .querySelectorAll('[data-a]').forEach((btn) => btn.addEventListener('click', () => {
        const a = btn.dataset.a;
        if (a === 'undo') doUndo(); else if (a === 'clear') doClear(); else if (a === 'x2') doDouble(); else spin();
      }));
  }

  // ── hot / cold + history ───────────────────────────────────────────────────
  function heatSets() {
    const cnt = Array(37).fill(0); recent.forEach((n) => { cnt[n]++; });
    const order = range(0, 36).sort((a, b) => cnt[b] - cnt[a] || a - b);
    return { cnt, hot: order.slice(0, 5), cold: order.slice(-5).reverse() };
  }
  function paintHeat() {
    $('rlHeat').classList.toggle('on', heat);
    document.querySelectorAll('#rlNum .rc[data-z^="n"]').forEach((e) => { e.classList.remove('heat'); e.style.removeProperty('--hc'); e.querySelector('.hm')?.remove(); });
    if (!heat || !recent.length) return;
    const { cnt, hot, cold } = heatSets();
    const max = Math.max(...cnt) || 1;
    for (let n = 0; n <= 36; n++) {
      const k = cnt[n] / max;
      zonesAt(`n${n}`).forEach((e) => {
        if (!e.closest('#rlNum')) return;
        e.classList.add('heat');
        e.style.setProperty('--hc', k >= 0.5 ? `rgba(251,146,60,${(k - 0.4) * 0.6})` : `rgba(96,165,250,${(0.5 - k) * 0.45})`);
        if (hot.includes(n) || cold.includes(n)) { const m = document.createElement('span'); m.className = 'hm'; m.textContent = hot.includes(n) ? '🔥' : '❄️'; e.appendChild(m); }
      });
    }
  }
  function paintHist(fresh) {
    const cls = { red: 'hr', black: 'hb', green: 'hg' };
    $('rlHist').innerHTML = recent.slice(0, 20).map((n, i) => `<span class="${cls[colorOf(n)]}${fresh && i === 0 ? ' new' : ''}">${n}</span>`).join('');
  }
  api.get('/games/roulette/recent').then((r) => { recent = (r.numbers || []).slice(0, 100); paintHist(); paintHeat(); info(); }).catch(() => {});

  // ── streak ─────────────────────────────────────────────────────────────────
  function paintStreak() {
    const s = $('rlStreak');
    s.textContent = streak >= 2 ? `🔥 ${streak}` : '';
    s.style.display = streak >= 2 ? '' : 'none';
    s.className = `rlstreak${streak >= 5 ? ' fire' : streak >= 3 ? ' hot' : ''}`;
  }
  const paintSound = () => { $('rlSnd').textContent = isMuted() ? '🔇' : '🔊'; };

  // ── tabs ───────────────────────────────────────────────────────────────────
  function setTab(t) {
    tab = t; pref.set('tab', t);
    $('rlt').classList.toggle('num', t === 'num');
    $('rlTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $('rlSimple').classList.toggle('on', t === 'simple');
    $('rlNum').classList.toggle('on', t === 'num');
  }
  $('rlTabs').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

  // ── tap = bet, hold = preview, hover = preview ─────────────────────────────
  const panels = $('rlPanels');
  let hold = null;
  panels.addEventListener('pointerdown', (e) => {
    const z = e.target.closest('[data-z]'); if (!z) return;
    const key = z.dataset.z;
    hold = { key, held: false, x: e.clientX, y: e.clientY, t: later(380, () => { if (hold && hold.key === key) { hold.held = true; setPeek(key); try { navigator.vibrate?.(8); } catch { /* */ } } }) };
  });
  panels.addEventListener('pointermove', (e) => { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) { clearTimeout(hold.t); hold = null; } });
  panels.addEventListener('pointerup', (e) => {
    const h = hold; hold = null; if (!h) return;
    clearTimeout(h.t);
    if (h.held) { if (e.pointerType !== 'mouse') setPeek(null); return; }
    const z = e.target.closest('[data-z]');
    if (z && z.dataset.z === h.key) place(h.key);
  });
  panels.addEventListener('pointercancel', () => { if (hold) clearTimeout(hold.t); hold = null; });
  panels.addEventListener('contextmenu', (e) => e.preventDefault());
  panels.addEventListener('pointerover', (e) => { if (e.pointerType !== 'mouse') return; const z = e.target.closest('[data-z]'); if (z && z.dataset.z !== peek) setPeek(z.dataset.z); });
  panels.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') setPeek(null); });

  // ── tutorial ───────────────────────────────────────────────────────────────
  let tourStep = -1;
  const TOUR = [
    ['rlRack', 'Pick a <b>chip value</b> here. Every tap on a bet adds one chip.'],
    ['rlPanels', 'Tap a bet to put your chip on it. <b>Hold</b> any bet to see what it covers and pays — the wheel lights up those numbers. More numbers to choose from in the <b>Numbers</b> tab.'],
    ['gactions', 'Hit <b>Spin</b> (or flick the wheel). Winning chips get paid, losing ones are swept — then <b>Spin again</b> keeps the same bet.'],
  ];
  function coach(html, buttons) {
    const c = $('rlCoach');
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
    $('rlCoach').querySelector('[data-t="next"]').onclick = () => tour(step + 1);
    $('rlCoach').querySelector('[data-t="skip"]').onclick = () => tour(TOUR.length);
  }

  // ── wheel + ball ───────────────────────────────────────────────────────────
  let wa = 0, wv = 0.25;           // wheel angle / speed (rad/s)
  let ball = null;                 // { mode:'free'|'plan', a, v, … }
  let winGlow = 0;

  function spinStart() {
    wv = 4.6;
    ball = { mode: 'free', a: Math.random() * Math.PI * 2, v: -9, r: 1.07, rollT: 0 };
  }
  function planLanding(n) {
    const dur = 4.4;
    const rel0 = ball.a - wa;
    const pocket = WHEEL.indexOf(n) * SEG + SEG / 2;
    // match the starting speed of the eased path to the ball's current relative speed
    const TAU = Math.PI * 2, target = rel0 + ((ball.v - wv) * dur) / 3;
    let end = pocket + TAU * Math.round((target - pocket) / TAU);
    while (end > rel0 - TAU * 2) end -= TAU; // at least two more laps
    Object.assign(ball, { mode: 'plan', rel0, end, t: 0, dur, clacked: false, settled: false, lastTick: 0 });
  }
  function ballRadius(k) {
    if (k < 0.55) return 1.07;
    if (k < 0.66) return 1.07 - (0.27 * eOut((k - 0.55) / 0.11));
    if (k < 0.86) { const q = (k - 0.66) / 0.2; return 0.8 + 0.08 * Math.abs(Math.sin(q * Math.PI * 3)) * (1 - q); }
    if (k < 0.94) return 0.8 - 0.1 * eOut((k - 0.86) / 0.08);
    return 0.7;
  }
  const rattle = (k) => (k > 0.66 && k < 0.92 ? SEG * 1.1 * Math.sin((k - 0.66) * Math.PI * 6) * (1 - (k - 0.66) / 0.26) : 0);

  flick($('cvR'), (g) => { if (g.speed > 170 && phase === 'bet') spin(); });

  const cv = $('cvR');
  loop((dt) => {
    // physics
    wa += wv * dt;
    if (phase === 'spin' || phase === 'result') wv = Math.max(0.5, wv - 0.9 * dt); else wv += (0.25 - wv) * Math.min(1, dt * 0.6);
    if (ball && ball.mode === 'free') {
      ball.a += ball.v * dt;
      ball.rollT += dt; if (ball.rollT > 0.11) { ball.rollT = 0; sfx.roll(); }
    } else if (ball && ball.mode === 'plan' && !ball.settled) {
      ball.t = Math.min(ball.dur, ball.t + dt);
      const k = ball.t / ball.dur;
      ball.k = k;
      if (k < 0.55) { ball.lastTick += dt; if (ball.lastTick > 0.1 + k * 0.25) { ball.lastTick = 0; sfx.roll(1 - k); } }
      if (!ball.clacked && k >= 0.6) { ball.clacked = true; sfx.clack(); }
      if (k > 0.66 && k < 0.88) { ball.lastTick += dt; if (ball.lastTick > 0.09) { ball.lastTick = 0; sfx.tick(1 - (k - 0.66) / 0.22); } }
      if (k >= 1) { ball.settled = true; sfx.settle(); resolve(); }
    }
    if (winGlow > 0) winGlow = Math.max(0, winGlow - dt * 0.25);

    // draw
    const f = fitCanvas(cv); if (!f) return;
    const { ctx: c, W, H } = f;
    const R = Math.min(H * 0.48, W * 0.42) / 1.15, cx = W / 2, cy = H / 2;
    const now = performance.now();
    const heatC = heat && recent.length ? heatSets() : null;
    const hmax = heatC ? Math.max(...heatC.cnt) || 1 : 1;
    // rim + ball track
    const rim = c.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.16);
    rim.addColorStop(0, '#2a1d0c'); rim.addColorStop(0.7, '#3a2810'); rim.addColorStop(1, '#120c04');
    c.beginPath(); c.arc(cx, cy, R * 1.15, 0, 7); c.fillStyle = rim; c.fill();
    c.beginPath(); c.arc(cx, cy, R * 1.15, 0, 7); c.strokeStyle = gd(0.45); c.lineWidth = 1.2; c.stroke();
    c.save(); c.translate(cx, cy); c.rotate(wa);
    const resultN = res && phase === 'result' ? res.result : null;
    WHEEL.forEach((n, i) => {
      const a0 = i * SEG, a1 = (i + 1) * SEG;
      c.beginPath(); c.arc(0, 0, R, a0, a1); c.arc(0, 0, R * 0.62, a1, a0, true); c.closePath();
      c.fillStyle = n === 0 ? '#0f8a5f' : RED_N.has(n) ? '#8f1a1a' : '#161616'; c.fill();
      if (heatC) {
        const k = heatC.cnt[n] / hmax;
        c.fillStyle = k >= 0.5 ? `rgba(251,146,60,${(k - 0.4) * 0.55})` : `rgba(96,165,250,${(0.5 - k) * 0.4})`; c.fill();
      }
      if (covered.has(n)) { c.fillStyle = `rgba(212,175,55,${0.38 + 0.12 * Math.sin(now / 200)})`; c.fill(); }
      if (resultN === n) { c.fillStyle = `rgba(255,236,170,${0.25 + 0.3 * Math.abs(Math.sin(now / 180))})`; c.fill(); }
      c.strokeStyle = gd(0.28); c.lineWidth = 0.7; c.stroke();
      // number
      c.save(); c.rotate(a0 + SEG / 2); c.translate(R * 0.885, 0); c.rotate(Math.PI / 2);
      c.fillStyle = covered.has(n) || resultN === n ? '#fff8dc' : w(0.85);
      c.font = `700 ${Math.max(6, R * 0.088)}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, 0, 0);
      c.restore();
    });
    // pocket ring
    c.beginPath(); c.arc(0, 0, R * 0.78, 0, 7); c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = R * 0.006 + 1; c.stroke();
    c.restore();
    // hub
    const hub = c.createRadialGradient(cx - R * 0.15, cy - R * 0.15, R * 0.05, cx, cy, R * 0.62);
    hub.addColorStop(0, '#3a2a12'); hub.addColorStop(0.7, '#1c140a'); hub.addColorStop(1, '#0c0905');
    c.beginPath(); c.arc(cx, cy, R * 0.62, 0, 7); c.fillStyle = hub; c.fill(); c.strokeStyle = gd(0.5); c.lineWidth = 1.4; c.stroke();
    if (resultN !== null && ball && ball.settled) {
      c.font = `700 ${R * 0.42}px ${PF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = resultN === 0 ? '#34d399' : RED_N.has(resultN) ? '#f87171' : '#fff';
      c.fillText(String(resultN), cx, cy + R * 0.02);
    } else {
      c.save(); c.translate(cx, cy); c.rotate(wa);
      c.strokeStyle = gd(0.6); c.lineWidth = Math.max(2, R * 0.03); c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { c.rotate(Math.PI / 2); c.beginPath(); c.moveTo(R * 0.08, 0); c.lineTo(R * 0.3, 0); c.stroke(); }
      c.beginPath(); c.arc(0, 0, R * 0.09, 0, 7); c.fillStyle = gd(0.8); c.fill();
      c.restore();
    }
    // ball
    if (ball) {
      let ang, rad;
      if (ball.mode === 'free') { ang = ball.a; rad = ball.r; }
      else {
        const k = ball.settled ? 1 : ball.t / ball.dur;
        const rel = ball.rel0 + (ball.end - ball.rel0) * eOut(k) + rattle(k);
        ang = wa + rel; rad = ballRadius(k); ball.a = ang;
      }
      const bx = cx + Math.cos(ang) * R * rad, by = cy + Math.sin(ang) * R * rad, br = Math.max(3.5, R * 0.055);
      c.beginPath(); c.arc(bx + 1, by + 2, br, 0, 7); c.fillStyle = 'rgba(0,0,0,.45)'; c.fill();
      const g = c.createRadialGradient(bx - br * 0.4, by - br * 0.4, br * 0.1, bx, by, br);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#bdb8aa');
      c.beginPath(); c.arc(bx, by, br, 0, 7); c.fillStyle = g; c.fill();
    }
    if (phase === 'bet' && total()) {
      c.strokeStyle = `rgba(212,175,55,${0.22 + 0.15 * Math.sin(now / 380)})`; c.lineWidth = 1.5;
      c.beginPath(); c.arc(cx, cy, R * 1.2, 0, 7); c.stroke();
    }
  });

  // ── spin + result ──────────────────────────────────────────────────────────
  async function spin() {
    if (phase !== 'bet') return;
    const t = total();
    if (!t) { info('<span class="r">Put a chip on the table first</span>'); later(1500, () => info()); return; }
    if (t < 10) { toast('Minimum bet is 10 CC', 'red'); return; }
    if (t > bal()) { toast('Not enough CC for this bet', 'red'); return; }
    if (tourStep >= 0) tour(TOUR.length);
    phase = 'spin'; res = null;
    setPeek(null);
    lastLayout = { ...bets };
    shell.actions('<button class="ga" disabled>No more bets…</button>');
    info('<span>Ball is rolling…</span>');
    document.querySelectorAll('#rlPanels .hit').forEach((e) => e.classList.remove('hit'));
    spinStart();
    const payload = Object.entries(bets).map(([z, amount]) => ({ ...ZONE(z), amount }));
    const t0 = performance.now();
    try {
      res = await api.post('/games/roulette/spin', { bets: payload });
    } catch (e) {
      toast(e.message || 'Spin failed', 'red');
      ball = null; phase = 'bet'; controls(); info();
      return;
    }
    syncBalance(Number(res.cc_balance) - Number(res.totalPayout));
    const wait = Math.max(0, 1100 - (performance.now() - t0)); // let the ball run a lap or two first
    later(wait, () => planLanding(res.result));
  }

  function resolve() {
    phase = 'result';
    const r = res, n = r.result, net = Number(r.net), totalBet = Number(r.totalBet);
    syncBalance(r.cc_balance);
    recent.unshift(n); if (recent.length > 100) recent.length = 100;
    paintHist(true); paintHeat();
    zonesAt(`n${n}`).forEach((e) => e.classList.add('hit'));

    // pay or sweep each chip
    for (const [z, amt] of Object.entries(lastLayout)) {
      const won = ZONES[z].nums.includes(n);
      zonesAt(z).forEach((el) => {
        const chip = el.querySelector('.rlchip'); if (!chip) return;
        if (won) {
          chip.classList.add('won'); el.classList.add('hit');
          const p = document.createElement('span'); p.className = 'rlplus'; p.textContent = `+${short(amt * ZONES[z].pays)}`;
          el.appendChild(p); later(1500, () => p.remove());
        } else later(450, () => chip.classList.add('lost'));
      });
    }
    const col = colorOf(n);
    const head = `<b style="color:${col === 'red' ? '#f87171' : col === 'green' ? '#34d399' : '#fff'}">${n} ${col}</b>`;
    info(`<span>${head} · ${net > 0 ? `you won <span class="e">+${fmt(net)} CC</span>` : r.totalPayout > 0 ? (net === 0 ? `paid ${fmt(r.totalPayout)} · break even` : `paid ${fmt(r.totalPayout)} · <span class="r">−${fmt(-net)} CC</span>`) : '<span class="r">no win this time</span>'}</span>`);
    if (net > 0) { sfx.win(); later(250, () => sfx.chips()); } else if (net < 0) sfx.lose(); else sfx.push();

    const before = streak;
    if (net > 0) streak++; else if (net < 0) streak = 0;
    pref.set('streak', streak); paintStreak();
    if (streak > before && [3, 5, 10, 15, 20].includes(streak)) { sfx.streak(); toast(`🔥 ${streak} winning spins in a row!`, 'gold'); }

    const back = () => {
      phase = 'bet';
      document.querySelectorAll('#rlPanels .hit').forEach((e) => e.classList.remove('hit'));
      // rebet: the same layout goes straight back on the felt
      bets = {}; undo = [];
      const need = Object.values(lastLayout).reduce((a, b) => a + b, 0);
      if (need <= bal()) { bets = { ...lastLayout }; undo = [Object.entries(lastLayout)]; }
      paintRack(); paintChips(new Set(Object.keys(bets)));
    };
    if (isBigWin(net, totalBet) && (net >= totalBet * 5 || net >= 10000)) {
      later(1600, () => shell.result({
        net, sub: `${n} ${col} · paid ${fmt(r.totalPayout)} CC`, seed: r.seed, bet: totalBet,
        again: () => { shell.show('scPlay'); back(); }, againLabel: 'Back to the table', change: null,
      }));
    } else later(2200, back);
  }

  // ── wiring ─────────────────────────────────────────────────────────────────
  $('rlHeat').addEventListener('click', () => {
    heat = !heat; pref.set('heat', heat); paintHeat(); info();
    if (heat && tab === 'simple') toast('Hot & cold shown on the wheel — open Numbers for the full board');
  });
  $('rlSnd').addEventListener('click', () => { setMuted(!isMuted()); paintSound(); if (!isMuted()) sfx.chip(); });
  $('rlHelp').addEventListener('click', () => {
    const paint = () => { $('rlSndTog').textContent = isMuted() ? 'Off' : 'On'; $('rlSndTog').classList.toggle('on', !isMuted()); };
    paint();
    $('rlSndTog').onclick = () => { setMuted(!isMuted()); paint(); paintSound(); };
    $('rlTourAgain').onclick = () => { closeSheets(); tour(0); };
    openSheet('shRlRules');
  });

  shell.show('scPlay');
  setTab(tab); paintStreak(); paintSound(); paintRack(); paintChips(); paintHeat();
  if (!pref.get('tour', false)) later(500, () => tour(0));
}
