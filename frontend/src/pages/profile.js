import { api } from '../api.js';
import { store, updateBalance, clearUser } from '../store.js';
import { renderAvatarFrame, renderCosmeticPreview, CATEGORY_LABELS } from '../cosmeticPreview.js';
import {
  $, fmt, esc, hexA, timeAgo, toast, dockHTML, bindNav, onLeave, listen,
  playerFrame, playerName, playerBadge, RARITY_COLORS, rarityPill,
  sheetHTML, openSheet, closeSheets, emitBalance, amountOf,
} from '../ui/core.js';
import { mountScene } from '../ui/scenes.js';
import { gameName, GAME_BY_ID } from '../ui/games-meta.js';

const RAR_LV = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Exotic: 5, Unique: 6 };
const CAT_ORDER = ['avatar_frame', 'name_aura', 'name_color', 'name_font', 'chat_badge', 'status_title', 'custom_emoji'];

const CSS = `
.hero{position:relative;margin:12px 12px 0;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,.07);background:#070707}
.hero canvas{position:absolute;inset:0;width:100%;height:100%}
.hero-in{position:relative;z-index:2;padding:24px 18px 16px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:3px}
.avslot{position:relative;margin-bottom:12px}
.av-badge{position:absolute;bottom:4px;right:4px;z-index:6}
.av-badge .badge{width:26px;height:26px;font-size:13px;border-radius:9px;background:#0a0a0a!important}
.ptitle-big{font-size:12.5px;font-style:italic;color:rgba(255,255,255,.4)}
.pbadge{display:inline-block;margin-top:7px;padding:3px 11px;border-radius:20px;font-size:10.5px;font-weight:700;letter-spacing:.04em}
.bals{display:flex;gap:22px;margin-top:14px}
.bal-v{font-size:21px;font-weight:700;line-height:1}
.bal-v.cc{color:var(--em)}.bal-v.a{color:var(--gold)}
.bal-l{font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.24);margin-top:4px}
.acts{display:flex;gap:8px;margin-top:16px;width:100%;max-width:340px}
.acts .btn{flex:1}
.since{font-size:10.5px;color:rgba(255,255,255,.22);margin-top:10px}
.wr{margin:12px 12px 0;padding:14px 16px;border-radius:16px;background:var(--card);border:1px solid var(--line)}
.wr-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px}
.wr-pct{font-size:22px;font-weight:700}
.wr-lbl{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.24)}
.wr-bar{height:7px;border-radius:4px;overflow:hidden;display:flex;background:rgba(255,255,255,.06)}
.wr-bar i{display:block;height:100%}
.wr-legend{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:rgba(255,255,255,.3)}
.wr-legend b.g{color:var(--em)}.wr-legend b.r{color:var(--red)}
.ptabs{padding:18px 12px 4px}
.content{padding:14px 12px 24px}
.streaks{display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.streaks::-webkit-scrollbar{display:none}
.sk{position:relative;flex:0 0 152px;height:104px;border-radius:14px;overflow:hidden;border:1px solid var(--line);background:#080808}
.sk canvas{position:absolute;inset:0;width:100%;height:100%}
.sk-scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(5,5,5,.95) 12%,rgba(5,5,5,.45) 60%,rgba(5,5,5,.05))}
.sk-in{position:absolute;inset:0;padding:12px;display:flex;flex-direction:column;justify-content:flex-end;z-index:2}
.sk-n{font-size:29px;font-weight:700;color:var(--em);line-height:1}
.sk-g{font-size:12px;font-weight:700;margin-top:2px}
.sk-l{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.26)}
.spark{border-radius:16px;border:1px solid var(--line);background:var(--card);padding:14px 4px 10px}
.spark-top{display:flex;justify-content:space-between;align-items:baseline;padding:0 12px 8px}
.spark-v{font-size:20px;font-weight:700}
.spark-d{font-size:12px;font-weight:700}
.spark-c{height:88px;position:relative}
.spark-c canvas{position:absolute;inset:0;width:100%;height:100%}
.spark-foot{display:flex;justify-content:space-between;padding:6px 12px 0;font-size:10px;color:rgba(255,255,255,.22)}
.quad{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.q{border-radius:14px;border:1px solid var(--line);background:var(--card);padding:15px 14px}
.q-v{font-size:21px;font-weight:700;line-height:1.1}
.q-l{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.24);margin-top:5px}
.g{color:var(--em)}.r{color:var(--red)}
.abar{height:5px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden;margin:0 4px 14px}
.abar i{display:block;height:100%;background:var(--em)}
.agrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.ach{border-radius:14px;border:1px solid rgba(255,255,255,.07);background:var(--card);padding:14px 8px 11px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;position:relative}
.ach .ae{font-size:26px;line-height:1}
.ach-n{font-size:11px;font-weight:700;line-height:1.25}
.ach-d{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.22)}
.ach.locked{opacity:.34;filter:grayscale(1)}
.lockg{position:absolute;top:9px;right:9px;width:11px;height:11px;stroke:rgba(255,255,255,.45);fill:none;stroke-width:1.6}
.chal{border-radius:14px;border:1px solid rgba(255,255,255,.07);background:var(--card);padding:14px;margin-bottom:9px}
.chal-t{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:10px}
.chal-n{font-size:13.5px;font-weight:700}
.chal-r{font-size:11.5px;font-weight:700;color:var(--gold);white-space:nowrap}
.chal-d{font-size:11.5px;font-style:italic;color:rgba(255,255,255,.32);margin-bottom:10px}
.chal-b{height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
.chal-b i{display:block;height:100%;border-radius:3px}
.chal-p{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.25);margin-top:6px}
.chal.done{border-color:rgba(212,175,55,.26);background:rgba(212,175,55,.05)}
.chal-badge{font-size:10px;padding:2px 9px;border-radius:9px;background:rgba(212,175,55,.14);color:var(--gold);border:1px solid rgba(212,175,55,.25)}
.cgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.ci{border-radius:14px;border:1px solid rgba(255,255,255,.07);background:var(--card);overflow:hidden;position:relative}
.ci.eq{border-color:rgba(16,185,129,.35)}
.ci-prev{height:86px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.ci-body{padding:10px 12px 12px}
.ci-n{font-size:12.5px;font-weight:700;line-height:1.2}
.ci-c{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.24);margin-top:3px}
.ci-r{font-size:10px;font-weight:700;margin-top:6px;letter-spacing:.04em}
.ci-btns{display:flex;gap:6px;margin-top:10px}
.ci-btns .btn{flex:1;padding:8px 0;font-size:11.5px}
.ci-tag{position:absolute;top:8px;left:8px;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:7px;background:rgba(16,185,129,.18);color:var(--em);z-index:3}
.fh{border-radius:14px;border:1px solid var(--line);background:var(--card);padding:13px 14px;margin-bottom:8px}
.fh-t{display:flex;justify-content:space-between;align-items:baseline}
.fh-g{font-size:13.5px;font-weight:700}
.fh-r{font-size:14px;font-weight:700}
.fh-m{font-size:10.5px;color:rgba(255,255,255,.26);margin-top:2px}
.fh-h{display:flex;align-items:center;gap:8px;margin-top:9px;padding-top:9px;border-top:1px solid var(--line)}
.hash{flex:1;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:rgba(255,255,255,.3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp{padding:5px 10px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.45);font-size:10px;cursor:pointer;flex-shrink:0}
.cp.ok{color:var(--em);border-color:rgba(16,185,129,.3)}
.sell-prev{display:flex;align-items:center;justify-content:center;height:90px;border-radius:14px;margin-bottom:14px}
.receipt{margin-top:12px;border-radius:13px;border:1px solid var(--line);padding:12px 14px;font-size:12.5px}
.receipt div{display:flex;justify-content:space-between;padding:3px 0;color:rgba(255,255,255,.5)}
@media(min-width:900px){
  .cols{display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:start;padding:0 16px}
  .hero,.wr{margin-left:0;margin-right:0}
  .ptabs{padding:12px 0 4px}
  .content{padding:14px 0 30px}
  .agrid{grid-template-columns:repeat(4,1fr)}
  .cgrid{grid-template-columns:repeat(3,1fr)}
  .quad{grid-template-columns:repeat(4,1fr)}
  .sk{flex:0 0 180px;height:120px}
}
`;

let P = null, viewing = '', tab = 'overview', cache = {};

export async function renderProfile(app, data) {
  viewing = (data && data.username) || store.user?.username || '';
  tab = (data && data.tab) || 'overview';
  cache = {};
  app.innerHTML = `<style>${CSS}</style><div class="page-load">Loading…</div>${dockHTML(isOwn() ? 'profile' : 'social')}`;
  bindNav(app);
  try { P = await api.get(`/profile/${encodeURIComponent(viewing)}`); }
  catch (err) {
    app.innerHTML = `<style>${CSS}</style><div class="empty" style="flex:1;display:flex;align-items:center;justify-content:center">${esc(err.message || "Couldn't load this profile")}</div>${dockHTML('profile')}`;
    bindNav(app); return;
  }
  if (isOwn()) { try { cache.history = (await api.get('/games/history?limit=50')).results || []; } catch { cache.history = []; } }
  inject(app);
}

const isOwn = () => viewing === store.user?.username;

function inject(app) {
  const tabs = [['overview', 'Overview'], ...(isOwn() ? [['achievements', 'Achievements']] : []), ['cosmetics', isOwn() ? 'Cosmetics' : 'Loadout'], ...(isOwn() ? [['history', 'Fair history']] : [])];
  if (!tabs.find((t) => t[0] === tab)) tab = 'overview';
  app.innerHTML = `<style>${CSS}</style>
  <div class="scroll" id="pscroll"><div class="wrap">
    <div class="cols">
      <div><div class="hero" id="hero"></div><div class="wr" id="wr"></div></div>
      <div>
        <div class="tabs ptabs" id="ptabs">${tabs.map(([k, n]) => `<button class="tb${k === tab ? ' on' : ''}" data-t="${k}">${n}</button>`).join('')}</div>
        <div class="content" id="content"></div>
      </div>
    </div>
  </div></div>
  ${dockHTML(isOwn() ? 'profile' : 'social')}
  ${sheetHTML('shSell', 'List for sale', '<div id="sellBody"></div>', '<button class="btn" data-close>Cancel</button><button class="btn em" id="sellGo">List it</button>')}`;
  bindNav(app);
  document.querySelectorAll('#ptabs [data-t]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.t;
    document.querySelectorAll('#ptabs [data-t]').forEach((x) => x.classList.toggle('on', x === b));
    renderTab();
  }));
  renderHero(); renderWr(); renderTab();
  listen(document, 'balance:updated', () => { if (isOwn()) { P.cc_balance = store.ccBalance; P.a_balance = store.aBalance; renderHero(); } });
}

function rarest() {
  const items = Object.values(P.equipped || {}).filter((x) => x && x.rarity);
  return items.sort((a, b) => (RAR_LV[b.rarity] || 0) - (RAR_LV[a.rarity] || 0))[0] || null;
}

function renderHero() {
  const eq = P.equipped || {};
  const r = rarest(), rc = r ? (RARITY_COLORS[r.rarity] || '#10b981') : '#10b981';
  const title = eq.status_title ? eq.status_title.name : '';
  $('hero').innerHTML = `<canvas id="heroCv"></canvas><div class="hero-in">
    <div class="avslot">${playerFrame(P.username, eq, 117)}<div class="av-badge">${playerBadge(eq)}</div></div>
    <div style="line-height:1.1">${playerName(P.username, eq, 31)}</div>
    ${title ? `<div class="ptitle-big">"${esc(title)}"</div>` : ''}
    ${r ? `<div class="pbadge" style="background:${hexA(rc, .14)};color:${rc};border:1px solid ${hexA(rc, .28)}">${esc(r.name)} <span style="opacity:.6;font-weight:400">${esc(r.rarity)}</span></div>` : ''}
    <div class="bals"><div><div class="bal-v cc">${fmt(P.cc_balance)}</div><div class="bal-l">Credits</div></div>
      <div><div class="bal-v a">${fmt(P.a_balance)}</div><div class="bal-l">Tokens</div></div></div>
    <div class="acts">${isOwn()
      ? '<button class="btn em" id="toListings">My listings</button><button class="btn" id="logout">Log out</button>'
      : '<button class="btn" id="back">Back</button>'}</div>
    <div class="since">Member since ${new Date(P.member_since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
  </div>`;
  heroBackdrop(rc);
  $('toListings')?.addEventListener('click', () => window.__navigate('shop', { filterMine: true }));
  $('back')?.addEventListener('click', () => window.__navigate('social'));
  $('logout')?.addEventListener('click', async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('token'); localStorage.removeItem('user'); clearUser();
    window.__navigate('landing');
  });
}

// slow drifting glow tinted by the rarest equipped item
let heroTimer = 0;
function heroBackdrop(col) {
  clearTimeout(heroTimer);
  const cv = $('heroCv'), c = cv.getContext('2d');
  const step = (now) => {
    const t = now / 1000, r = cv.getBoundingClientRect();
    if (r.width) {
      const d = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * d; cv.height = r.height * d; c.setTransform(d, 0, 0, d, 0, 0);
      const W = r.width, H = r.height;
      [[0.24, 0.3, 0.55], [0.78, 0.24, 0.42], [0.55, 0.85, 0.6]].forEach((b, i) => {
        const x = W * (b[0] + Math.sin(t * 0.22 + i * 2) * 0.07), y = H * (b[1] + Math.cos(t * 0.19 + i * 1.4) * 0.12), rad = H * b[2];
        const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, hexA(col, .2)); g.addColorStop(1, hexA(col, 0));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
    }
    if (cv.isConnected) heroTimer = setTimeout(() => requestAnimationFrame(step), 50);
  };
  requestAnimationFrame(step);
  onLeave(() => clearTimeout(heroTimer));
}

function renderWr() {
  const s = P.stats || {}, games = Number(s.total_games) || 0, won = Number(s.total_wins) || 0, pct = games ? Math.round(won / games * 100) : 0;
  $('wr').innerHTML = `<div class="wr-top"><div class="wr-pct">${pct}%</div><div class="wr-lbl">Win rate · ${fmt(games)} games</div></div>
    <div class="wr-bar"><i style="width:${pct}%;background:var(--em)"></i><i style="width:${100 - pct}%;background:rgba(239,68,68,.55)"></i></div>
    <div class="wr-legend"><span><b class="g">${fmt(won)}</b> won</span><span><b class="r">${fmt(games - won)}</b> lost</span></div>`;
}

async function renderTab() {
  const c = $('content'); if (!c) return;
  if (tab === 'overview') return overview(c);
  if (tab === 'achievements') return achievements(c);
  if (tab === 'cosmetics') return cosmetics(c);
  return fairHistory(c);
}

// ── overview ────────────────────────────────────────────────────────────────
function overview(c) {
  const s = P.stats || {};
  const streaks = P.win_streaks || [];
  c.innerHTML = `
    ${streaks.length ? `<div class="sec first">Running hot</div><div class="streaks">${streaks.map((k) => {
      const g = GAME_BY_ID[k.game];
      return `<div class="sk"><canvas data-sc="${g ? g.scene : 'coin'}"></canvas><div class="sk-scrim"></div>
        <div class="sk-in"><div class="sk-n">${k.current_streak}</div><div class="sk-g">${esc(gameName(k.game))}</div><div class="sk-l">win streak</div></div></div>`;
    }).join('')}</div>` : ''}
    ${isOwn() && cache.history?.length ? `<div class="sec${streaks.length ? '' : ' first'}">Last ${cache.history.length} games</div>
      <div class="spark"><div class="spark-top"><div class="spark-v">${fmt(P.cc_balance)} <span style="font-size:11px;color:rgba(255,255,255,.25)">CC</span></div><div class="spark-d" id="sparkD"></div></div>
      <div class="spark-c"><canvas id="sparkCv"></canvas></div><div class="spark-foot"><span id="sparkLo"></span><span id="sparkHi"></span></div></div>` : ''}
    <div class="sec">All time</div>
    <div class="quad">
      <div class="q"><div class="q-v g">${fmt(s.biggest_win)} CC</div><div class="q-l">Biggest win</div></div>
      <div class="q"><div class="q-v r">${fmt(Math.abs(Number(s.biggest_loss) || 0))} CC</div><div class="q-l">Biggest loss</div></div>
      <div class="q"><div class="q-v${Number(s.bankruptcy_count) ? ' r' : ''}">${fmt(s.bankruptcy_count)}</div><div class="q-l">Bankruptcies</div></div>
      <div class="q"><div class="q-v">${fmt(s.best_streak_overall)}</div><div class="q-l">Best streak</div></div>
    </div>`;
  c.querySelectorAll('[data-sc]').forEach((cv) => mountScene(cv, cv.dataset.sc, { fps: 24 }));
  if ($('sparkCv')) spark();
}
function spark() {
  const H0 = cache.history, pts = [Number(P.cc_balance)];
  let b = Number(P.cc_balance);
  for (const r of H0) { b -= Number(r.net) || 0; pts.unshift(Math.max(0, b)); }
  const lo = Math.min(...pts), hi = Math.max(...pts), d = pts[pts.length - 1] - pts[0];
  $('sparkD').textContent = `${d >= 0 ? '+' : '−'}${fmt(Math.abs(d))} CC`;
  $('sparkD').style.color = d >= 0 ? 'var(--em)' : 'var(--red)';
  $('sparkLo').textContent = `Low ${fmt(lo)} CC`; $('sparkHi').textContent = `Peak ${fmt(hi)} CC`;
  const cv = $('sparkCv'), r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height, up = d >= 0, col = up ? '16,185,129' : '239,68,68', pad = 12;
  const x = (i) => pad + i / (pts.length - 1) * (W - pad * 2), y = (v) => H - 10 - ((v - lo) / ((hi - lo) || 1)) * (H - 26);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `rgba(${col},.22)`); g.addColorStop(1, `rgba(${col},0)`);
  c.beginPath(); c.moveTo(x(0), H); pts.forEach((v, i) => c.lineTo(x(i), y(v))); c.lineTo(x(pts.length - 1), H); c.closePath(); c.fillStyle = g; c.fill();
  c.beginPath(); pts.forEach((v, i) => (i ? c.lineTo(x(i), y(v)) : c.moveTo(x(i), y(v)))); c.strokeStyle = `rgba(${col},.9)`; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
  const L = pts.length - 1;
  c.beginPath(); c.arc(x(L), y(pts[L]), 4, 0, 7); c.fillStyle = `rgb(${col})`; c.fill();
  c.beginPath(); c.arc(x(L), y(pts[L]), 9, 0, 7); c.fillStyle = `rgba(${col},.16)`; c.fill();
}

// ── achievements + challenges ───────────────────────────────────────────────
async function achievements(c) {
  c.innerHTML = '<div class="page-load" style="padding:30px">Loading…</div>';
  try {
    if (!cache.ach) cache.ach = (await api.get('/achievements')).achievements;
    if (!cache.chal) cache.chal = (await api.get('/challenges')).challenges;
  } catch (err) { c.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  const A = cache.ach, u = A.filter((a) => a.unlocked).length;
  const lock = '<svg class="lockg" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>';
  c.innerHTML = `<div class="sec first">Achievements <span>${u} of ${A.length}</span></div>
    <div class="abar"><i style="width:${A.length ? u / A.length * 100 : 0}%"></i></div>
    <div class="agrid">${A.map((a) => `<div class="ach${a.unlocked ? '' : ' locked'}" title="${esc(a.description)}">${a.unlocked ? '' : lock}
      <div class="ae">${a.emoji || '🏅'}</div><div class="ach-n">${esc(a.name)}</div>
      <div class="ach-d">${a.unlocked && a.unlocked_at ? new Date(a.unlocked_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : 'Locked'}</div></div>`).join('')}</div>
    <div class="sec">Challenges</div>
    ${cache.chal.map((ch) => {
      const pct = Math.min(100, ch.progress / ch.target * 100), col = ch.completed ? 'var(--gold)' : 'var(--em)';
      const right = ch.reward_claimed ? '<span class="chal-badge">Claimed</span>'
        : ch.completed ? `<button class="btn gold sm" data-claim="${ch.id}">Claim +${ch.reward_a} A</button>`
          : `<span class="chal-r">+${ch.reward_a} A</span>`;
      return `<div class="chal${ch.completed ? ' done' : ''}"><div class="chal-t"><span class="chal-n">${esc(ch.name)}</span>${right}</div>
        <div class="chal-d">${esc(ch.description)}</div>
        <div class="chal-b"><i style="width:${pct}%;background:${col}"></i></div>
        <div class="chal-p"><span>${fmt(Math.min(ch.progress, ch.target))} / ${fmt(ch.target)}</span><span>${Math.round(pct)}%</span></div></div>`;
    }).join('')}`;
  c.querySelectorAll('[data-claim]').forEach((b) => b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = '…';
    try {
      const res = await api.post(`/challenges/${b.dataset.claim}/claim`);
      updateBalance({ a_balance: res.a_balance }); emitBalance();
      toast(`+${res.reward_a} A claimed`, 'gold');
      cache.chal = null; achievements(c);
    } catch (err) { toast(err.message || 'Failed to claim', 'red'); b.disabled = false; b.textContent = 'Claim'; }
  }));
}

// ── cosmetics ───────────────────────────────────────────────────────────────
function cosmeticPreview(item, size = 1) {
  if (item.category === 'avatar_frame') return renderAvatarFrame(item, 62 * size, `<span class="av-initial" style="font-size:${18 * size}px">${esc(P.username.slice(0, 1).toUpperCase())}</span>`);
  if (['name_aura', 'name_color', 'name_font'].includes(item.category)) return playerName(P.username, [item], 20 * size);
  if (item.category === 'status_title') return `<span style="font-size:${14 * size}px;font-style:italic;color:rgba(255,255,255,.62)">"${esc(item.name)}"</span>`;
  const p = renderCosmeticPreview(item);
  return `<div style="transform:scale(${1.2 * size})">${p.innerHTML}</div>`;
}
async function cosmetics(c) {
  c.innerHTML = '<div class="page-load" style="padding:30px">Loading…</div>';
  try { if (!cache.cos) cache.cos = (await api.get(`/profile/${encodeURIComponent(viewing)}/cosmetics`)).cosmetics; }
  catch (err) { c.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  const list = cache.cos;
  if (!list.length) { c.innerHTML = `<div class="empty">${isOwn() ? 'No cosmetics yet. Packs in the shop are where they come from.' : 'Nothing equipped.'}</div>`; return; }
  const cats = CAT_ORDER.filter((k) => list.some((i) => i.category === k));
  c.innerHTML = cats.map((cat, ci) => `<div class="sec${ci ? '' : ' first'}">${CATEGORY_LABELS[cat] || cat}</div><div class="cgrid">${
    list.filter((i) => i.category === cat).sort((a, b) => (b.is_equipped - a.is_equipped) || ((RAR_LV[b.rarity] || 0) - (RAR_LV[a.rarity] || 0))).map((it) => {
      const rc = RARITY_COLORS[it.rarity] || '#9ca3af';
      return `<div class="ci${it.is_equipped ? ' eq' : ''}">${it.is_equipped ? '<div class="ci-tag">Equipped</div>' : ''}
        <div class="ci-prev" style="background:linear-gradient(160deg,${hexA(rc, .13)},${hexA(rc, .02)})">${cosmeticPreview(it)}</div>
        <div class="ci-body"><div class="ci-n">${esc(it.name)}</div><div class="ci-c">${CATEGORY_LABELS[it.category] || ''}</div>
        <div class="ci-r" style="color:${rc}">${esc(it.rarity)}</div>
        ${isOwn() ? `<div class="ci-btns"><button class="btn ${it.is_equipped ? 'red' : 'em'}" data-eq="${it.cosmetic_id}" data-on="${it.is_equipped}">${it.is_equipped ? 'Unequip' : 'Equip'}</button>
          ${it.is_equipped ? '' : `<button class="btn gold" data-sell="${it.user_cosmetic_id}">Sell</button>`}</div>` : ''}
        </div></div>`;
    }).join('')}</div>`).join('');
  c.querySelectorAll('[data-eq]').forEach((b) => b.addEventListener('click', async () => {
    const on = b.dataset.on === 'true'; b.disabled = true;
    try {
      await api.post(`/cosmetics/${b.dataset.eq}/${on ? 'unequip' : 'equip'}`);
      toast(on ? 'Unequipped' : 'Equipped', 'em');
      cache.cos = null;
      P = await api.get(`/profile/${encodeURIComponent(viewing)}`);
      renderHero(); cosmetics(c);
    } catch (err) { toast(err.message || 'Failed to update', 'red'); b.disabled = false; }
  }));
  c.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => openSell(list.find((i) => i.user_cosmetic_id === b.dataset.sell))));
}
const TYPICAL = { Common: 6, Rare: 18, Epic: 45, Legendary: 140, Exotic: 520 };
function openSell(it) {
  const rc = RARITY_COLORS[it.rarity] || '#9ca3af';
  $('sellBody').innerHTML = `<div class="sell-prev" style="background:radial-gradient(80% 90% at 50% 100%,${hexA(rc, .18)},transparent 70%)">${cosmeticPreview(it, 1.2)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><b>${esc(it.name)}</b>${rarityPill(it.rarity)}</div>
    <div class="lbl">You receive (A)</div><input class="inp" id="sellPrice" inputmode="numeric" value="${TYPICAL[it.rarity] || 10}" style="font-size:22px;font-weight:700">
    <div class="receipt" id="sellRc"></div>
    <p style="font-size:11px;color:rgba(255,255,255,.28);margin-top:10px;font-style:italic">The house adds 15% on top for the buyer. You always get exactly what you list.</p>`;
  const paint = () => {
    const p = amountOf($('sellPrice').value);
    $('sellRc').innerHTML = `<div><span>You receive</span><span>${fmt(p)} A</span></div><div><span>Buyer pays</span><span>${fmt(Math.ceil(p * 1.15))} A</span></div>`;
    $('sellGo').disabled = !p;
  };
  openSheet('shSell');
  $('sellPrice').addEventListener('input', paint); paint();
  $('sellGo').onclick = async () => {
    const p = amountOf($('sellPrice').value); if (!p) return;
    $('sellGo').disabled = true;
    try {
      await api.post('/shop/listings', { user_cosmetic_id: it.user_cosmetic_id, price_a: p });
      closeSheets(); toast(`Listed ${it.name} for ${fmt(p)} A`, 'gold');
    } catch (err) { toast(err.message || 'Failed to list', 'red'); $('sellGo').disabled = false; }
  };
}

// ── fair history ────────────────────────────────────────────────────────────
function fairHistory(c) {
  const H0 = cache.history || [];
  c.innerHTML = H0.length ? `<div class="sec first">Fair history <span>last ${H0.length} rounds</span></div>
    ${H0.map((h, i) => {
      const net = Number(h.net) || 0;
      return `<div class="fh"><div class="fh-t"><span class="fh-g">${esc(gameName(h.game))}</span>
        <span class="fh-r" style="color:${net > 0 ? 'var(--em)' : net < 0 ? 'var(--red)' : 'rgba(255,255,255,.5)'}">${net > 0 ? '+' : net < 0 ? '−' : ''}${fmt(Math.abs(net))} CC</span></div>
        <div class="fh-m">${timeAgo(h.created_at)} · staked ${fmt(h.bet_amount)} CC · nonce ${esc(h.nonce)}</div>
        <div class="fh-h"><span class="hash">${esc(h.server_hash || '—')}</span><button class="cp" data-h="${i}">Copy hash</button></div></div>`;
    }).join('')}
    <div style="font-size:11px;color:rgba(255,255,255,.22);padding:8px 4px;font-style:italic">Every round is committed to a hash before it starts. Verify any of them yourself.</div>`
    : '<div class="empty">No rounds yet. Go lose some money.</div>';
  c.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => {
    const t = H0[Number(b.dataset.h)].server_hash || '';
    navigator.clipboard?.writeText(t).catch(() => {});
    b.textContent = 'Copied'; b.classList.add('ok');
    setTimeout(() => { b.textContent = 'Copy hash'; b.classList.remove('ok'); }, 1400);
  }));
}
