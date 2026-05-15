import { api } from '../api.js';
import { store, setUser, updateBalance, clearUser } from '../store.js';

const DAILY_REWARDS = [100, 200, 250, 300, 400, 500, 750, 800, 1000];
function rewardForDay(day) { return DAILY_REWARDS[Math.min(day - 1, 8)]; }

let dailyState = null;
let claimedNow = false;

const STREAKS = [
  { game: 'Blackjack', count: 6, flavor: '"Destroyed the dealer 6 times in a row!!"' },
  { game: 'Coinflip',  count: 4, flavor: '"Hasn\'t lost a coinflip in 4 matches!!"'  },
];

const TICKER_EVENTS = [
  { u:'NightRoller', g:'Crash',     a:12400, w:true  },
  { u:'br0keboy__',  g:'Slots',     a:800,   w:false },
  { u:'x_Ace_x',     g:'Blackjack', a:5500,  w:true  },
  { u:'LuckyStrike', g:'Coinflip',  a:2000,  w:false },
  { u:'GoldHands',   g:'Roulette',  a:18000, w:true  },
  { u:'tilted99',    g:'Mines',     a:3200,  w:false },
  { u:'CryptoKing',  g:'Crash',     a:45000, w:true  },
  { u:'poorguy404',  g:'Slots',     a:1200,  w:false },
  { u:'AceQueen',    g:'Duels',     a:7800,  w:true  },
  { u:'allin4ever',  g:'Dice',      a:500,   w:false },
];

export async function renderHome(app) {
  claimedNow = false;
  try {
    const [meRes, dailyRes] = await Promise.all([
      api.get('/auth/me'),
      api.get('/daily'),
    ]);
    setUser({ ...meRes.user });
    dailyState = dailyRes;
  } catch (err) {
    console.error('[home] failed to load:', err.message);
  }

  inject(app);
  bindEvents(app);
}

function inject(app) {
  const cc    = store.ccBalance;
  const broke = Number(cc) === 0;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
      body { background:#050505 }
      .hp { position:relative; height:100vh; background:#050505; overflow:hidden; display:flex; flex-direction:column;
            --ac:${broke ? '#ef4444' : '#10b981'};
            --acl:${broke ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.13)'};
            --acs:${broke ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.35)'};
            font-family:'Playfair Display',Georgia,serif }
      .body { flex:1; overflow-y:auto; padding:36px 28px 12px; display:flex; flex-direction:column; gap:18px }
      .bal { display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 0 4px }
      .bal-lbl { font-size:10.5px; letter-spacing:.16em; text-transform:uppercase; color:rgba(255,255,255,.25) }
      .bal-num  { font-size:76px; font-weight:700; color:${broke ? 'rgba(255,255,255,.28)' : '#fff'}; letter-spacing:-3px; line-height:1; font-family:'Playfair Display',Georgia,serif }
      .bal-cc   { font-size:18px; color:var(--ac); letter-spacing:.06em; font-family:'Playfair Display',Georgia,serif }
      .bal-chg  { font-size:12px; color:${broke ? 'rgba(239,68,68,.38)' : 'rgba(255,255,255,.22)'}; font-style:italic; margin-top:2px }
      .daily { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:14px; padding:16px 18px; display:flex; align-items:center; gap:18px }
      .daily.dim { opacity:.55 }
      .daily.hidden { display:none }
      .pips { display:flex; gap:5px; align-items:center; flex-shrink:0 }
      .pip  { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,.1) }
      .pip.done { background:var(--ac) }
      .pip.cur  { background:var(--ac); box-shadow:0 0 7px var(--ac) }
      .pip-label { font-size:9.5px; letter-spacing:.1em; color:rgba(255,255,255,.18); margin-top:5px; text-transform:uppercase }
      .daily-info { flex:1 }
      .daily-title { font-size:15px; font-weight:700; color:#fff; margin-bottom:3px }
      .daily-sub   { font-size:11.5px; color:rgba(255,255,255,.3) }
      .cbtn { padding:9px 18px; background:var(--ac); border:none; border-radius:8px; color:#fff; font-size:13px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer; white-space:nowrap; letter-spacing:.03em }
      .cbtn:disabled { background:rgba(255,255,255,.07); color:rgba(255,255,255,.2); cursor:not-allowed }
      .broke-card { display:${broke ? 'block' : 'none'}; background:rgba(239,68,68,.07); border:1px solid rgba(239,68,68,.18); border-radius:14px; padding:20px; text-align:center }
      .broke-t { font-size:22px; font-weight:700; color:#ef4444; margin-bottom:5px }
      .broke-s { font-size:13px; color:rgba(239,68,68,.5); font-style:italic }
      .streaks { display:${broke ? 'none' : 'grid'}; grid-template-columns:1fr 1fr; gap:12px }
      .sk { background:rgba(255,255,255,.035); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:14px 16px }
      .sk-game { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.28); margin-bottom:7px }
      .sk-n    { font-size:32px; font-weight:700; color:var(--ac); line-height:1 }
      .sk-lbl  { font-size:11px; color:rgba(255,255,255,.25); margin-top:1px }
      .sk-flav { font-size:11px; color:rgba(255,255,255,.42); font-style:italic; margin-top:9px; border-top:1px solid rgba(255,255,255,.06); padding-top:9px; line-height:1.5 }
      .ticker   { height:38px; background:rgba(255,255,255,.025); border-top:1px solid rgba(255,255,255,.05); overflow:hidden; display:flex; align-items:center; flex-shrink:0 }
      .tk-inner { display:flex; white-space:nowrap; animation:scroll 26s linear infinite }
      @keyframes scroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
      .tk-i { display:inline-flex; align-items:center; gap:8px; padding:0 24px; font-size:11.5px; color:rgba(255,255,255,.4) }
      .tw { color:#10b981 } .tl { color:#ef4444 }
      .td { width:3px; height:3px; border-radius:50%; background:rgba(255,255,255,.12); flex-shrink:0 }
      .dock-wrap { display:flex; justify-content:center; padding:9px 0 13px; background:#050505; flex-shrink:0 }
      .pill { display:flex; align-items:center; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:40px; padding:8px 16px; gap:2px }
      .di   { width:42px; height:42px; display:flex; align-items:center; justify-content:center; border-radius:50%; cursor:pointer; position:relative; transition:background .15s }
      .di:hover { background:rgba(255,255,255,.07) }
      .di.on svg { opacity:1 }
      .di.on::after { content:''; position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:var(--ac) }
      .di svg { opacity:.4; transition:opacity .15s }
      .toast { position:fixed; top:18px; left:50%; transform:translateX(-50%); padding:10px 22px; border-radius:10px; font-size:13px; font-weight:700; white-space:nowrap; z-index:200; opacity:0; transition:opacity .25s; pointer-events:none; font-family:'Playfair Display',Georgia,serif }
      .toast.green { background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.35); color:#10b981 }
      .toast.red   { background:rgba(239,68,68,.15);  border:1px solid rgba(239,68,68,.35);  color:#ef4444 }
      .toast.show  { opacity:1 }
    </style>

    <div class="hp" id="hp">
      <div class="body">
        <div class="bal">
          <span class="bal-lbl">Your balance</span>
          <span class="bal-num" id="balNum">${Number(store.ccBalance).toLocaleString()}</span>
          <span class="bal-cc">CC</span>
          <span class="bal-chg">${broke ? "You had it all. Now you don't." : 'Live balance'}</span>
        </div>

        ${renderDailyHTML()}

        <div class="broke-card">
          <div class="broke-t">You're broke.</div>
          <div class="broke-s">Tomorrow's daily reward is your only hope.</div>
        </div>

        <div class="streaks">
          ${STREAKS.map(s => `
            <div class="sk">
              <div class="sk-game">${s.game}</div>
              <div class="sk-n">${s.count}</div>
              <div class="sk-lbl">win streak</div>
              <div class="sk-flav">${s.flavor}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="ticker"><div class="tk-inner" id="ticker"></div></div>

      <div class="dock-wrap">
        <div class="pill">
          <div class="di on">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg>
          </div>
          <div class="di" id="nav-games">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/></svg>
          </div>
          <div class="di">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg>
          </div>
          <div class="di">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/></svg>
          </div>
          <div class="di" id="nav-logout">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg>
          </div>
        </div>
      </div>
      <div class="toast" id="toast"></div>
    </div>
  `;

  buildTicker();
}

function renderDailyHTML() {
  if (!dailyState) return '';
  const broke = Number(store.ccBalance) === 0;
  const { current_streak, next_day, reward, can_claim } = dailyState;
  const displayDay = can_claim ? next_day : current_streak;
  const claimed    = !can_claim || claimedNow;
  const hide       = broke && claimed;

  const pipsHTML = Array.from({ length: 9 }, (_, i) => {
    const cls = i < displayDay - 1 ? 'pip done' : i === displayDay - 1 ? 'pip cur' : 'pip';
    return `<div class="${cls}"></div>`;
  }).join('');

  return `
    <div class="daily${claimed ? ' dim' : ''}${hide ? ' hidden' : ''}" id="dailyCard">
      <div style="flex-shrink:0">
        <div class="pips">${pipsHTML}</div>
        <div class="pip-label">Day streak</div>
      </div>
      <div class="daily-info">
        <div class="daily-title" id="dailyTitle">
          ${claimed ? `Day ${displayDay} — Claimed` : `Day ${displayDay} — Claim ${reward.toLocaleString()} CC`}
        </div>
        <div class="daily-sub" id="dailySub">
          ${claimed
            ? `Come back tomorrow for ${rewardForDay(displayDay + 1).toLocaleString()} CC`
            : broke ? 'This is all you have left.' : 'Miss tomorrow and your streak resets'}
        </div>
      </div>
      <button class="cbtn" id="claimBtn" ${claimed ? 'disabled' : ''}>${claimed ? 'Claimed' : 'Claim'}</button>
    </div>`;
}

function buildTicker() {
  const el = document.getElementById('ticker');
  if (!el) return;
  const items = [...TICKER_EVENTS, ...TICKER_EVENTS];
  el.innerHTML = items.map(e => `
    <span class="tk-i">
      <span class="${e.w ? 'tw' : 'tl'}">${e.w ? '▲' : '▼'}</span>
      <span style="color:rgba(255,255,255,.65);font-weight:600">${e.u}</span>
      <span style="color:rgba(255,255,255,.22)">${e.g}</span>
      <span class="${e.w ? 'tw' : 'tl'}">${e.w ? '+' : '-'}${e.a.toLocaleString()} CC</span>
      <span class="td"></span>
    </span>`).join('');
}

function showToast(msg, type = 'green') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 2800);
}

function bindEvents(app) {
  // Claim button
  app.addEventListener('click', async (e) => {
    if (e.target.id !== 'claimBtn') return;
    const btn = e.target;
    btn.disabled = true; btn.textContent = 'Claiming…';
    try {
      const data = await api.post('/daily/claim');
      claimedNow = true;
      updateBalance({ cc_balance: data.cc_balance, a_balance: data.a_balance });
      dailyState = { ...dailyState, can_claim: false, current_streak: data.new_streak };
      document.getElementById('balNum').textContent = Number(data.cc_balance).toLocaleString();
      document.getElementById('dailyTitle').textContent = `Day ${data.new_streak} — Claimed`;
      document.getElementById('dailySub').textContent = `Come back tomorrow for ${rewardForDay(data.new_streak + 1).toLocaleString()} CC`;
      document.getElementById('dailyCard').classList.add('dim');
      btn.textContent = 'Claimed';
      showToast(`+${data.reward.toLocaleString()} CC claimed! 🎉`, 'green');
    } catch (err) {
      showToast(err.message || 'Failed to claim', 'red');
      btn.disabled = false; btn.textContent = 'Claim';
    }
  });

  // Games nav
  document.getElementById('nav-games')?.addEventListener('click', () => {
    window.__navigate('games');
  });

  // Logout
  document.getElementById('nav-logout')?.addEventListener('click', async () => {
    try { await api.post('/auth/logout'); } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearUser();
    window.__navigate('landing');
  });

  // Live balance
  document.addEventListener('balance:updated', ({ detail }) => {
    const el = document.getElementById('balNum');
    if (el) el.textContent = Number(detail.cc_balance).toLocaleString();
  });
}
