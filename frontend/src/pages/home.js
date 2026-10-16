import { api } from '../api.js';
import { store, setUser, updateBalance } from '../store.js';
import {
  $, fmt, esc, listen, toast, dockHTML, bindNav, playerFrame, playerName, playerBadge,
  emitBalance, onLeave, bindBalance,
} from '../ui/core.js';
import { GAME_BY_ID, gameName } from '../ui/games-meta.js';

const REWARDS = [100, 200, 250, 300, 400, 500, 750, 800, 1000];
const rewardFor = (day) => REWARDS[Math.min(Math.max(day, 1), 9) - 1];

const CSS = `
.app{--ac:#10b981;--acr:16,185,129}
.app.broke{--ac:#ef4444;--acr:239,68,68}
.who{display:flex;align-items:center;gap:10px;padding:12px 14px 2px}
.who .wn{flex:1;min-width:0}
.who .wl{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.25)}
.who .wrow{display:flex;align-items:center;gap:6px;margin-top:2px}
.tok{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:20px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.22);font-size:13px;font-weight:700;color:var(--gold)}
.coin{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#D4AF37 60%,#8a6b15);color:#3a2a00;font-style:normal;font-size:9.5px;display:inline-flex;align-items:center;justify-content:center;font-weight:900}
.hero{position:relative;margin:12px 12px 0;padding:24px 18px 0;border-radius:22px;border:1px solid rgba(var(--acr),.16);background:radial-gradient(120% 80% at 50% 0%,rgba(var(--acr),.13),rgba(var(--acr),0) 70%),#070707;overflow:hidden;text-align:center;transition:border-color .5s}
.h-l{font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.odo{--dh:84px;font-variant-numeric:lining-nums tabular-nums;display:flex;justify-content:center;align-items:flex-start;margin-top:2px;font-size:62px;font-weight:700;letter-spacing:-.02em;height:var(--dh);overflow:hidden;transition:color .6s}
.odo .d{display:block;height:var(--dh);overflow:hidden}
.odo .d span{display:block;transition:transform .9s cubic-bezier(.2,.9,.25,1)}
.odo .d span b{display:block;height:var(--dh);line-height:var(--dh)}
.odo .sep{display:block;height:var(--dh);line-height:var(--dh)}
.odo .unit{font-size:18px;color:rgba(255,255,255,.3);margin-left:8px;line-height:var(--dh);padding-top:10px;font-weight:400;letter-spacing:.06em}
.app.broke .odo{color:rgba(255,255,255,.14)}
.delta{display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-size:12.5px;font-weight:700;padding:4px 11px;border-radius:14px;background:rgba(16,185,129,.1);color:var(--em)}
.delta.neg{background:rgba(239,68,68,.1);color:#f87171}
.delta.flat{background:rgba(255,255,255,.05);color:rgba(255,255,255,.4)}
.hspark{height:84px;margin:14px -18px 0;position:relative}
.hspark canvas{position:absolute;inset:0;width:100%;height:100%}
.brokeline{font-size:13px;font-style:italic;color:rgba(239,68,68,.6);margin-top:6px;display:none}
.app.broke .brokeline{display:block}
.app.broke .delta{display:none}
.daily{margin:12px 12px 0;padding:16px;border-radius:18px;border:1px solid var(--line);background:var(--card)}
.d-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.d-t{font-size:16px;font-weight:700}
.d-s{font-size:11.5px;color:rgba(255,255,255,.34);margin-top:3px}
.d-amt{font-size:22px;font-weight:700;color:var(--ac);white-space:nowrap}
.d-amt small{font-size:11px;color:rgba(255,255,255,.3);font-weight:400}
.track{display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin:16px 0 14px}
.pip{display:flex;flex-direction:column;align-items:center;gap:6px}
.pip i{width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,.07);position:relative;overflow:hidden}
.pip.done i{background:var(--ac)}
.pip.today i{background:rgba(var(--acr),.28)}
.pip.today i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:pipShine 1.8s ease-in-out infinite}
@keyframes pipShine{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.pip span{font-size:9px;color:rgba(255,255,255,.24)}
.pip.today span{color:var(--ac);font-weight:700}
.pip.done span{color:rgba(255,255,255,.45)}
.claim{width:100%;padding:15px;border-radius:14px;border:none;background:var(--ac);color:#03150e;font-size:15px;font-weight:700;cursor:pointer}
.app.broke .claim{color:#1a0303}
.claim:disabled{background:rgba(255,255,255,.05);color:rgba(255,255,255,.4);cursor:default;border:1px solid rgba(255,255,255,.08)}
.claim .cd{font-variant-numeric:tabular-nums}
.brokecard{display:none;margin:12px 12px 0;padding:22px 18px;border-radius:18px;border:1px solid rgba(239,68,68,.22);background:linear-gradient(160deg,rgba(239,68,68,.09),rgba(239,68,68,.02));text-align:center}
.app.broke .brokecard{display:block}
.brokecard h3{font-size:26px;color:#f87171}
.brokecard p{font-size:12.5px;color:rgba(255,255,255,.4);margin-top:6px;line-height:1.55}
.sgrid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.stk{border-radius:16px;border:1px solid var(--line);background:var(--card);padding:14px;position:relative;overflow:hidden}
.stk .sg{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.stk .sn{font-size:34px;font-weight:700;color:var(--ac);line-height:1;margin-top:6px}
.stk .sn small{font-size:13px;color:rgba(255,255,255,.3);font-weight:400;margin-left:3px}
.stk .sf{font-size:11px;font-style:italic;color:rgba(255,255,255,.34);margin-top:6px;line-height:1.35}
.stk .flames{position:absolute;right:-6px;top:-6px;font-size:44px;opacity:.12;transform:rotate(12deg)}
.app.broke .streakwrap{display:none}
.qp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.q{border-radius:15px;border:1px solid var(--line);background:var(--card);padding:12px 4px 10px;text-align:center;cursor:pointer;transition:border-color .15s,transform .15s;color:#fff}
.q:hover{border-color:rgba(var(--acr),.3)}
.q:active{transform:scale(.96)}
.q b{display:block;font-size:24px;margin-bottom:5px}
.q span{font-size:11.5px;font-weight:700}
.q small{display:block;font-size:9.5px;color:rgba(255,255,255,.3);margin-top:2px}
.app.broke .q{opacity:.35;pointer-events:none}
.ticker{height:40px;border-top:1px solid var(--line);overflow:hidden;display:flex;align-items:center;flex-shrink:0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)}
.tk{display:flex;gap:26px;white-space:nowrap;animation:tick 60s linear infinite;padding-left:26px}
@keyframes tick{to{transform:translateX(-50%)}}
.ti{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,.45)}
.ti b{color:#fff}
.ti b.w{color:var(--em)}
.ti b.l{color:#f87171}
.ti .gm{color:rgba(255,255,255,.28)}
.fly{position:fixed;z-index:80;font-size:20px;font-weight:700;color:var(--ac);pointer-events:none;text-shadow:0 0 14px rgba(var(--acr),.6)}
@media(min-width:900px){
  .cols{display:grid;grid-template-columns:1.15fr 1fr;gap:16px;padding:0 20px;align-items:start}
  .hero,.daily,.brokecard{margin-left:0;margin-right:0}
  .right .sec.first{margin-top:12px}
  .odo{font-size:84px;--dh:112px}
  .hspark{height:120px}
}
@media(max-width:899px){.right{padding:0 12px}}
`;

let daily = null, history = [], profile = null, rank = null, cdTimer = 0;

export async function renderHome(app) {
  app.innerHTML = `<style>${CSS}</style><div class="page-load">Loading…</div>${dockHTML('home')}`;
  bindNav(app);
  const [me, d, p, h, lb, fame, shame] = await Promise.allSettled([
    api.get('/auth/me'), api.get('/daily'),
    api.get(`/profile/${encodeURIComponent(store.user?.username || '')}`),
    api.get('/games/history?limit=50'), api.get('/social/leaderboard'),
    api.get('/social/hall-of-fame'), api.get('/social/hall-of-shame'),
  ]);
  if (me.status === 'fulfilled') setUser({ ...me.value.user });
  daily = d.status === 'fulfilled' ? d.value : null;
  profile = p.status === 'fulfilled' ? p.value : null;
  history = h.status === 'fulfilled' ? h.value.results || [] : [];
  rank = lb.status === 'fulfilled' ? lb.value.me : null;
  const moments = [
    ...(fame.status === 'fulfilled' ? fame.value.entries.map((e) => ({ ...e, win: true })) : []),
    ...(shame.status === 'fulfilled' ? shame.value.entries.map((e) => ({ ...e, win: false })) : []),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 14);

  if (!document.body.contains(app)) return;
  inject(app, moments);
}

function inject(app, moments) {
  const eq = profile?.equipped || null;
  const u = store.user || {};
  app.innerHTML = `<style>${CSS}</style>
  <div class="scroll"><div class="wrap">
    <div class="who">
      ${playerFrame(u.username, eq, 44)}
      <div class="wn"><div class="wl">Signed in as</div><div class="wrow">${playerName(u.username, eq, 18)}${playerBadge(eq)}</div></div>
      <div class="tok"><i class="coin">A</i><span data-bal-a>${fmt(store.aBalance)}</span></div>
    </div>
    <div class="cols">
      <div>
        <div class="hero">
          <div class="h-l">Credits</div>
          <div class="odo" id="odo"></div>
          <div class="delta" id="delta"></div>
          <div class="brokeline">You had it all. Now you don't.</div>
          <div class="hspark"><canvas id="spark"></canvas></div>
        </div>
        <div class="brokecard">
          <h3>You're broke.</h3>
          <p>No bets, no loans, no safety net.<br>Tomorrow's daily reward is your only way back in.</p>
        </div>
        <div class="daily" id="daily"></div>
      </div>
      <div class="right">
        <div class="streakwrap" id="streakwrap"></div>
        <div class="sec">Jump back in</div>
        <div class="qp" id="qp"></div>
        <div class="sec">Recent</div>
        <div class="sgrid" id="today"></div>
      </div>
    </div>
    <div style="height:18px"></div>
  </div></div>
  ${moments.length ? `<div class="ticker"><div class="tk">${tickerHTML(moments)}${tickerHTML(moments)}</div></div>` : ''}
  ${dockHTML('home')}`;
  bindNav(app);
  bindBalance();

  applyBroke();
  setOdo(store.ccBalance, true);
  renderDelta();
  drawSpark();
  renderDaily();
  renderSide();

  listen(window, 'resize', () => { drawSpark(); setOdo(store.ccBalance, true); });
  listen(document, 'balance:updated', () => { applyBroke(); setOdo(store.ccBalance); drawSpark(); });
  if (document.fonts) document.fonts.ready.then(() => { if ($('odo')) setOdo(store.ccBalance, true); });
  onLeave(() => clearInterval(cdTimer));
}

const isBroke = () => Number(store.ccBalance) <= 0;
function applyBroke() { document.querySelector('.app')?.classList.toggle('broke', isBroke()); }

// ── odometer ────────────────────────────────────────────────────────────────
function setOdo(v, instant) {
  const el = $('odo'); if (!el) return;
  const want = fmt(v).split('');
  if (el.dataset.len !== String(want.length)) {
    el.innerHTML = want.map((ch) => ch === ','
      ? '<span class="sep">,</span>'
      : `<span class="d"><span>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<b>${n}</b>`).join('')}</span></span>`).join('') + '<span class="unit">CC</span>';
    el.dataset.len = want.length; instant = true;
  }
  const digits = [...el.querySelectorAll('.d > span')];
  const h = el.querySelector('.d')?.offsetHeight || 84;
  let k = 0;
  want.forEach((ch) => {
    if (ch === ',') return;
    const sp = digits[k++];
    if (instant) { sp.style.transition = 'none'; requestAnimationFrame(() => { sp.style.transition = ''; }); }
    sp.style.transform = `translateY(-${Number(ch) * h}px)`;
  });
}

// ── balance history from real game results ──────────────────────────────────
// Walk back from the current balance through each result's net.
function balanceSeries() {
  const pts = [Number(store.ccBalance)];
  let b = Number(store.ccBalance);
  for (const r of history) { b -= Number(r.net) || 0; pts.unshift(Math.max(0, b)); }
  return pts.length > 1 ? pts : [b, b];
}
function renderDelta() {
  const today = new Date().toDateString();
  const net = history.filter((r) => new Date(r.created_at).toDateString() === today).reduce((s, r) => s + (Number(r.net) || 0), 0);
  const el = $('delta'); if (!el) return;
  el.className = `delta${net < 0 ? ' neg' : net === 0 ? ' flat' : ''}`;
  el.textContent = net === 0 ? 'No games today' : `${net > 0 ? '▲ +' : '▼ −'}${fmt(Math.abs(net))} CC today`;
}
function drawSpark() {
  const cv = $('spark'); if (!cv) return;
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const d = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * d; cv.height = r.height * d;
  const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
  const P = balanceSeries(), W = r.width, H = r.height, lo = Math.min(...P), hi = Math.max(...P);
  const col = isBroke() ? '239,68,68' : '16,185,129';
  const x = (i) => i / (P.length - 1) * W, y = (v) => H - 6 - ((v - lo) / ((hi - lo) || 1)) * (H - 20);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(${col},.22)`); g.addColorStop(1, `rgba(${col},0)`);
  c.beginPath(); c.moveTo(0, H); P.forEach((v, i) => c.lineTo(x(i), y(v))); c.lineTo(W, H); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); P.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v))));
  c.strokeStyle = `rgba(${col},.85)`; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
}

// ── daily reward ────────────────────────────────────────────────────────────
function renderDaily() {
  const el = $('daily'); if (!el) return;
  if (!daily) { el.style.display = 'none'; return; }
  const claimed = !daily.can_claim;
  const today = claimed ? daily.current_streak : daily.next_day;
  const reward = claimed ? rewardFor(today + 1) : daily.reward;
  el.style.display = isBroke() && claimed ? 'none' : '';
  const sub = claimed
    ? `Day ${today} claimed. Miss tomorrow and it resets to day 1.`
    : (isBroke() ? 'This is all you have left.' : `Day ${today} of your streak`);
  el.innerHTML = `<div class="d-top"><div><div class="d-t">Daily reward</div><div class="d-s">${sub}</div></div>
      <div class="d-amt">+${fmt(reward)} <small>CC</small></div></div>
    <div class="track">${REWARDS.map((r, i) => {
      const day = i + 1;
      const cls = day < today || (claimed && day === today) ? 'done' : (day === today && !claimed ? 'today' : '');
      return `<div class="pip ${cls}"><i></i><span>${r >= 1000 ? '1k' : r}</span></div>`;
    }).join('')}</div>
    <button class="claim" id="claim" ${claimed ? 'disabled' : ''}>${claimed ? 'Next reward in <span class="cd" id="cd"></span>' : `Claim ${fmt(daily.reward)} CC`}</button>`;
  clearInterval(cdTimer);
  if (claimed) {
    const tick = () => {
      const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
      let s = Math.max(0, (m - n) / 1000 | 0); const hh = s / 3600 | 0; s %= 3600; const mm = s / 60 | 0; s %= 60;
      const c = $('cd'); if (c) c.textContent = `${hh}h ${String(mm).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    };
    tick(); cdTimer = setInterval(tick, 1000);
  } else $('claim').addEventListener('click', claim);
}
async function claim() {
  const btn = $('claim'); btn.disabled = true; btn.textContent = 'Claiming…';
  try {
    const data = await api.post('/daily/claim');
    const b = btn.getBoundingClientRect(), o = $('odo').getBoundingClientRect();
    const f = document.createElement('div'); f.className = 'fly'; f.textContent = `+${fmt(data.reward)}`;
    f.style.left = `${b.left + b.width / 2 - 30}px`; f.style.top = `${b.top}px`; document.body.appendChild(f);
    f.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${o.left + o.width / 2 - b.left - b.width / 2}px,${o.top - b.top + 10}px) scale(1.4)`, opacity: 0.2 }],
    { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => {
      f.remove();
      updateBalance({ cc_balance: data.cc_balance, a_balance: data.a_balance });
      daily = { ...daily, can_claim: false, current_streak: data.new_streak };
      emitBalance(); renderDaily();
      toast(`Day ${data.new_streak} claimed · +${fmt(data.reward)} CC`, 'em');
    };
  } catch (err) {
    toast(err.message || 'Failed to claim', 'red');
    btn.disabled = false; btn.textContent = `Claim ${fmt(daily.reward)} CC`;
  }
}

// ── streaks, quick play, recent ─────────────────────────────────────────────
const FLAVOR = ['The dealer is starting to sweat.', 'Nobody tell them the odds.', 'Riding it while it lasts.'];
function renderSide() {
  const streaks = (profile?.win_streaks || []).slice(0, 2);
  $('streakwrap').innerHTML = streaks.length
    ? `<div class="sec first">Running hot</div><div class="sgrid">${streaks.map((s, i) =>
      `<div class="stk"><div class="flames">🔥</div><div class="sg">${esc(gameName(s.game))}</div><div class="sn">${s.current_streak}<small>wins</small></div><div class="sf">${FLAVOR[i]}</div></div>`).join('')}</div>`
    : '';

  // most-played games from history, padded with defaults
  const counts = {};
  history.forEach((r) => { counts[r.game] = (counts[r.game] || 0) + 1; });
  const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).filter((id) => GAME_BY_ID[id]);
  ['crash', 'blackjack', 'mines', 'slots', 'plinko'].forEach((id) => { if (!ids.includes(id)) ids.push(id); });
  $('qp').innerHTML = ids.slice(0, 4).map((id) => {
    const g = GAME_BY_ID[id], last = history.find((r) => r.game === id);
    const sub = last ? `${Number(last.net) >= 0 ? '+' : '−'}${fmt(Math.abs(Number(last.net)))}` : 'play';
    return `<button class="q" data-route="${g.route}"><b>${g.icon}</b><span>${g.name}</span><small>${sub}</small></button>`;
  }).join('');
  $('qp').querySelectorAll('[data-route]').forEach((b) => b.addEventListener('click', () => window.__navigate(b.dataset.route)));

  const wins = history.filter((r) => Number(r.net) > 0).length;
  const st = profile?.stats;
  $('today').innerHTML = `
    <div class="stk"><div class="sg">Last ${history.length} games</div><div class="sn" style="color:#fff">${wins}<small>won</small></div><div class="sf">${history.length - wins} lost${st ? ` · ${st.win_rate}% all time` : ''}</div></div>
    <div class="stk" data-go="social" style="cursor:pointer"><div class="sg">Leaderboard</div><div class="sn" style="color:#fff">${rank ? '#' + fmt(rank.rank) : '—'}</div><div class="sf">${rank?.weekly_badge ? '👑 Richest MF this week' : 'Tap to see the board'}</div></div>`;
  document.querySelector('[data-go="social"]')?.addEventListener('click', () => window.__navigate('social'));
}

function tickerHTML(list) {
  return list.map((e) => `<span class="ti"><b>${esc(e.username)}</b>${e.amount != null
    ? (e.win ? ` won <b class="w">+${fmt(Math.abs(e.amount))}</b>` : ` lost <b class="l">−${fmt(Math.abs(e.amount))}</b>`)
    : (e.win ? ' made the Hall of Fame' : ' made the Hall of Shame')}${e.game ? ` <span class="gm">on ${esc(gameName(e.game))}</span>` : ''}</span>`).join('');
}
