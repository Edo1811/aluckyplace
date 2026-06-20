import { api } from '../api.js';
import { store, updateBalance, clearUser } from '../store.js';

const RARITY_COLORS = {
  Common:    '#9ca3af',
  Rare:      '#3b82f6',
  Epic:      '#a855f7',
  Legendary: '#D4AF37',
  Exotic:    '#f97316',
};

let curTab = 0;
let profileData = null;
let achievementsCache = null;
let challengesCache = null;
let cosmeticsCache = null;
let historyCache = null;
let listingPriceFor = null; // user_cosmetic_id currently showing the inline "list for sale" form

export async function renderProfile(app) {
  curTab = 0;
  achievementsCache = null;
  challengesCache = null;
  cosmeticsCache = null;
  historyCache = null;
  listingPriceFor = null;

  inject(app);
  bindEvents(app);
  await loadProfile();
}

function inject(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .pp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif}

      .hero{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .hero-top{display:flex;align-items:flex-start;gap:14px;margin-bottom:14px}
      .av-wrap{position:relative;flex-shrink:0}
      .av{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:28px;border:2px solid transparent}
      .hero-info{flex:1;min-width:0}
      .hero-name{font-size:22px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .hero-aura{display:inline-block;padding:1px 10px;border-radius:12px;font-size:11px;font-weight:700;letter-spacing:.04em}
      .hero-title{font-size:12px;font-style:italic;margin-top:3px;color:rgba(255,255,255,.4)}
      .hero-bal{font-size:13px;color:rgba(255,255,255,.35);margin-top:4px;display:flex;gap:12px}
      .hb{color:#10b981;font-weight:700}
      .hba{color:#D4AF37;font-weight:700}
      .hero-actions{display:flex;gap:7px;margin-top:8px;flex-wrap:wrap}
      .ha{padding:6px 14px;border-radius:8px;font-size:11.5px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:none;transition:all .15s}
      .ha.pri{background:#10b981;color:#fff}
      .ha.pri:hover{background:#0ea472}
      .ha.sec{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5)}
      .ha.sec:hover{background:rgba(255,255,255,.1)}
      .ha.danger{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);color:#ef4444}
      .ha.danger:hover{background:rgba(239,68,68,.15)}

      .qstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      .qs{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 12px;text-align:center}
      .qs-n{font-size:18px;font-weight:700;color:#fff}
      .qs-l{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.22);margin-top:2px}

      .tabs{display:flex;gap:2px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:3px;margin:12px 20px 0;flex-shrink:0}
      .tb{flex:1;padding:8px 0;background:none;border:none;border-radius:7px;color:rgba(255,255,255,.3);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif;transition:background .18s,color .18s}
      .tb.on{background:rgba(16,185,129,.12);color:#10b981;font-weight:700}

      .tcontent{flex:1;overflow-y:auto;padding:16px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.07) transparent}
      .tcontent::-webkit-scrollbar{width:3px}
      .tcontent::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08)}

      .sec-title{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.2);margin-bottom:10px}
      .streaks-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px}
      .sk{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px}
      .sk-game{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:5px}
      .sk-n{font-size:26px;font-weight:700;color:#10b981;line-height:1}
      .sk-lbl{font-size:10px;color:rgba(255,255,255,.25);margin-top:1px}
      .stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
      .strow{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center}
      .stlbl{font-size:12px;color:rgba(255,255,255,.35)}
      .stval{font-size:14px;font-weight:700;color:#fff}
      .stval.red{color:#ef4444}
      .stval.grn{color:#10b981}
      .empty-note{font-size:12px;color:rgba(255,255,255,.25);text-align:center;padding:30px 10px;font-style:italic}

      .ach-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:20px}
      .ach{width:100%;aspect-ratio:1;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;position:relative}
      .ach.unlocked{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
      .ach.locked{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.04);opacity:.4;filter:grayscale(1)}
      .ach-em{font-size:22px}
      .ach-name{font-size:8.5px;color:rgba(255,255,255,.4);text-align:center;line-height:1.3;padding:0 3px}
      .chal{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:13px 14px;margin-bottom:8px}
      .chal-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:8px}
      .chal-name{font-size:13px;font-weight:700;color:#fff}
      .chal-rew{font-size:11px;color:#D4AF37;font-weight:700;flex-shrink:0}
      .chal-desc{font-size:11.5px;color:rgba(255,255,255,.32);margin-bottom:8px;font-style:italic}
      .chal-bar{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin-bottom:4px}
      .chal-fill{height:100%;border-radius:3px;transition:width .5s}
      .chal-prog{font-size:10px;color:rgba(255,255,255,.25);display:flex;justify-content:space-between}
      .chal.done{border-color:rgba(212,175,55,.25);background:rgba(212,175,55,.05)}
      .chal-claim{font-size:10px;padding:4px 10px;border-radius:8px;background:rgba(212,175,55,.18);color:#D4AF37;border:1px solid rgba(212,175,55,.3);cursor:pointer;font-family:'Playfair Display',Georgia,serif;font-weight:700}
      .chal-done-badge{font-size:10px;padding:2px 9px;border-radius:8px;background:rgba(212,175,55,.15);color:#D4AF37;border:1px solid rgba(212,175,55,.25)}

      .owned-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .citem{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:11px;position:relative}
      .citem.equipped{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.06)}
      .citem-eq{position:absolute;top:7px;right:7px;font-size:8px;padding:2px 6px;border-radius:6px;background:rgba(16,185,129,.2);color:#10b981;font-weight:700;letter-spacing:.04em}
      .citem-prev{height:52px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:8px;position:relative}
      .citem-rbar{position:absolute;bottom:0;left:0;right:0;height:2px}
      .citem-name{font-size:11.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .citem-cat{font-size:9.5px;color:rgba(255,255,255,.25);margin-top:1px}
      .citem-rar{font-size:9px;font-weight:700;margin-top:5px;margin-bottom:8px}
      .citem-btns{display:flex;gap:5px}
      .cbtn{flex:1;padding:6px;border-radius:7px;font-size:10.5px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:none}
      .cbtn.eq{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.22)}
      .cbtn.uneq{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
      .cbtn.list{background:rgba(212,175,55,.1);color:#D4AF37;border:1px solid rgba(212,175,55,.2)}
      .list-form{display:flex;gap:5px;margin-top:6px}
      .list-input{flex:1;width:0;padding:6px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#fff;font-size:11px;font-family:'Playfair Display',Georgia,serif}
      .list-confirm{padding:6px 9px;background:#D4AF37;color:#000;border:none;border-radius:6px;font-size:10.5px;font-weight:700;cursor:pointer;font-family:'Playfair Display',Georgia,serif}

      .hist-row{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:10px;border:1px solid rgba(255,255,255,.06);margin-bottom:6px;background:rgba(255,255,255,.025)}
      .hist-game{font-size:12px;font-weight:700;color:#fff;flex:1;text-transform:capitalize}
      .hist-seed{font-family:monospace;font-size:9.5px;color:rgba(255,255,255,.2);flex:2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .hist-verify{padding:5px 10px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.15);border-radius:7px;color:#10b981;font-size:10px;font-family:'Playfair Display',Georgia,serif;cursor:pointer;white-space:nowrap;border:1px solid rgba(16,185,129,.15)}
      .hist-res{font-size:11px;font-weight:700;flex-shrink:0}
      .hist-res.w{color:#10b981}
      .hist-res.l{color:#ef4444}

      .dock-wrap{display:flex;justify-content:center;padding:8px 0 11px;background:#050505;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0}
      .pill{display:flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:40px;padding:6px 14px;gap:2px}
      .di{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;position:relative;transition:background .15s}
      .di:hover{background:rgba(255,255,255,.07)}
      .di.on svg{opacity:1}
      .di.on::after{content:'';position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#10b981}
      .di svg{opacity:.4;transition:opacity .15s}
      .toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap;z-index:200;opacity:0;transition:opacity .25s;pointer-events:none;font-family:'Playfair Display',Georgia,serif}
      .toast.green{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);color:#10b981}
      .toast.red{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:#ef4444}
      .toast.gold{background:rgba(212,175,55,.15);border:1px solid rgba(212,175,55,.35);color:#D4AF37}
      .toast.show{opacity:1}
    </style>

    <div class="pp">
      <div class="hero" id="hero"><div class="empty-note">Loading…</div></div>
      <div class="tabs">
        <button class="tb on" id="tab0">Overview</button>
        <button class="tb" id="tab1">Achievements</button>
        <button class="tb" id="tab2">Cosmetics</button>
        <button class="tb" id="tab3">Fair History</button>
      </div>
      <div class="tcontent" id="tcontent"></div>
      <div class="dock-wrap">
        <div class="pill">
          <div class="di" id="nav-home"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg></div>
          <div class="di" id="nav-games"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/></svg></div>
          <div class="di"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg></div>
          <div class="di" id="nav-shop"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/></svg></div>
          <div class="di on"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg></div>
        </div>
      </div>
      <div class="toast" id="toast"></div>
    </div>
  `;
}

function showToast(msg, type = 'green') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3200);
}

async function loadProfile() {
  try {
    profileData = await api.get(`/profile/${store.user.username}`);
  } catch (err) {
    showToast(err.message || 'Failed to load profile', 'red');
    profileData = null;
  }
  renderHero();
  await renderTab();
}

function renderHero() {
  const el = document.getElementById('hero');
  if (!profileData) { el.innerHTML = `<div class="empty-note">Couldn't load this profile.</div>`; return; }

  const p = profileData;
  const aura = p.equipped.name_aura;
  const frame = p.equipped.avatar_frame;
  const title = p.equipped.status_title;
  const auraCol = aura ? (RARITY_COLORS[aura.rarity] || '#10b981') : null;

  el.innerHTML = `
    <div class="hero-top">
      <div class="av-wrap">
        <div class="av" style="${frame ? `border-color:${RARITY_COLORS[frame.rarity] || '#fff'}` : ''}">👤</div>
      </div>
      <div class="hero-info">
        <div class="hero-name">
          <span style="${auraCol ? `color:${auraCol}` : ''}">${p.username}</span>
          ${aura ? `<span class="hero-aura" style="background:${auraCol}22;color:${auraCol}">${aura.name}</span>` : ''}
        </div>
        ${title ? `<div class="hero-title">"${title.name}"</div>` : ''}
        <div class="hero-bal"><span>CC <span class="hb">${Number(p.cc_balance).toLocaleString()}</span></span><span>A <span class="hba">${Number(p.a_balance).toLocaleString()}</span></span></div>
        <div class="hero-actions">
          <button class="ha pri" id="editProfileBtn">Edit Profile</button>
          <button class="ha sec" id="myListingsBtn">My Listings</button>
          <button class="ha danger" id="logoutBtn">Log Out</button>
        </div>
      </div>
    </div>
    <div class="qstats">
      <div class="qs"><div class="qs-n">${p.stats.total_games.toLocaleString()}</div><div class="qs-l">Games</div></div>
      <div class="qs"><div class="qs-n" style="color:#10b981">${p.stats.total_wins}</div><div class="qs-l">Won</div></div>
      <div class="qs"><div class="qs-n" style="color:#ef4444">${Math.max(p.stats.total_games - p.stats.total_wins, 0)}</div><div class="qs-l">Lost</div></div>
      <div class="qs"><div class="qs-n">${p.stats.win_rate}%</div><div class="qs-l">Win Rate</div></div>
    </div>`;
}

async function renderTab() {
  const c = document.getElementById('tcontent');
  if (curTab === 0) return renderOverview(c);
  if (curTab === 1) return renderAchievements(c);
  if (curTab === 2) return renderCosmetics(c);
  return renderHistory(c);
}

function renderOverview(c) {
  if (!profileData) { c.innerHTML = `<div class="empty-note">Nothing to show.</div>`; return; }
  const p = profileData;

  c.innerHTML = `
    <div class="sec-title">Active Win Streaks</div>
    <div class="streaks-grid">
      ${p.win_streaks.length === 0
        ? `<div class="empty-note" style="grid-column:1/-1;padding:14px">No active streaks right now — go win some games.</div>`
        : p.win_streaks.map(s => `<div class="sk">
            <div class="sk-game">${s.game}</div>
            <div class="sk-n">${s.current_streak}</div>
            <div class="sk-lbl">win streak</div>
          </div>`).join('')}
    </div>
    <div class="sec-title">All-Time Stats</div>
    <div class="stats-grid">
      <div class="strow"><span class="stlbl">Biggest win</span><span class="stval grn">${Number(p.stats.biggest_win).toLocaleString()} CC</span></div>
      <div class="strow"><span class="stlbl">Biggest loss</span><span class="stval red">${Number(p.stats.biggest_loss).toLocaleString()} CC</span></div>
      <div class="strow"><span class="stlbl">Bankruptcies</span><span class="stval${p.stats.bankruptcy_count > 0 ? ' red' : ''}">${p.stats.bankruptcy_count}</span></div>
      <div class="strow"><span class="stlbl">Best streak</span><span class="stval">${p.stats.best_streak_overall} wins</span></div>
    </div>`;
}

async function renderAchievements(c) {
  c.innerHTML = `<div class="empty-note">Loading…</div>`;
  try {
    if (!achievementsCache) achievementsCache = (await api.get('/achievements')).achievements;
    if (!challengesCache) challengesCache = (await api.get('/challenges')).challenges;
  } catch (err) {
    c.innerHTML = `<div class="empty-note">Failed to load achievements.</div>`;
    return;
  }

  const unlockedCount = achievementsCache.filter(a => a.unlocked).length;

  c.innerHTML = `
    <div class="sec-title">Achievements <span style="text-transform:none;letter-spacing:0;color:rgba(255,255,255,.18)">${unlockedCount} / ${achievementsCache.length} unlocked</span></div>
    <div class="ach-grid">
      ${achievementsCache.map(a => `<div class="ach ${a.unlocked ? 'unlocked' : 'locked'}" title="${a.description}">
        <span class="ach-em">${a.emoji}</span>
        <span class="ach-name">${a.name}</span>
      </div>`).join('')}
    </div>
    <div class="sec-title">Challenges</div>
    ${challengesCache.map(ch => {
      const pct = Math.min((ch.progress / ch.target) * 100, 100);
      const col = ch.completed ? '#D4AF37' : '#10b981';
      const canClaim = ch.completed && !ch.reward_claimed;
      return `<div class="chal${ch.completed ? ' done' : ''}">
        <div class="chal-top">
          <span class="chal-name">${ch.name}</span>
          ${ch.reward_claimed
            ? '<span class="chal-done-badge">✓ Claimed</span>'
            : canClaim
              ? `<button class="chal-claim" data-claim="${ch.id}">Claim +${ch.reward_a} A</button>`
              : `<span class="chal-rew">+${ch.reward_a} A</span>`}
        </div>
        <div class="chal-desc">${ch.description}</div>
        <div class="chal-bar"><div class="chal-fill" style="width:${pct}%;background:${col}"></div></div>
        <div class="chal-prog"><span>${Math.min(ch.progress, ch.target).toLocaleString()} / ${ch.target.toLocaleString()}</span><span>${Math.round(pct)}%</span></div>
      </div>`;
    }).join('')}`;
}

async function renderCosmetics(c) {
  c.innerHTML = `<div class="empty-note">Loading…</div>`;
  try {
    cosmeticsCache = (await api.get(`/profile/${store.user.username}/cosmetics`)).cosmetics;
  } catch (err) {
    c.innerHTML = `<div class="empty-note">Failed to load cosmetics.</div>`;
    return;
  }

  if (cosmeticsCache.length === 0) {
    c.innerHTML = `<div class="sec-title">Your Cosmetics</div><div class="empty-note">Nothing yet — open a pack or buy from the Shop.</div>`;
    return;
  }

  c.innerHTML = `
    <div class="sec-title">Your Cosmetics</div>
    <div class="owned-grid">
      ${cosmeticsCache.map(it => {
        const col = RARITY_COLORS[it.rarity] || '#9ca3af';
        const showForm = listingPriceFor === it.user_cosmetic_id;
        return `<div class="citem${it.is_equipped ? ' equipped' : ''}">
          ${it.is_equipped ? '<div class="citem-eq">Equipped</div>' : ''}
          <div class="citem-prev" style="background:${col}18">
            <span>🎨</span>
            <div class="citem-rbar" style="background:${col}"></div>
          </div>
          <div class="citem-name">${it.name}</div>
          <div class="citem-cat">${it.category.replace('_', ' ')}</div>
          <div class="citem-rar" style="color:${col}">${it.rarity}</div>
          <div class="citem-btns">
            <button class="cbtn ${it.is_equipped ? 'uneq' : 'eq'}" data-equip="${it.cosmetic_id}" data-state="${it.is_equipped}">${it.is_equipped ? 'Unequip' : 'Equip'}</button>
            <button class="cbtn list" data-list="${it.user_cosmetic_id}">${showForm ? 'Cancel' : 'List'}</button>
          </div>
          ${showForm ? `<div class="list-form">
            <input class="list-input" type="number" min="1" placeholder="Price in A" id="priceInput">
            <button class="list-confirm" data-confirm-list="${it.user_cosmetic_id}">Confirm</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="empty-note" style="padding-top:6px">Equip, unequip, or list an item for sale on the Player Shop.</div>`;
}

async function renderHistory(c) {
  c.innerHTML = `<div class="empty-note">Loading…</div>`;
  try {
    if (!historyCache) historyCache = (await api.get('/games/history?limit=30')).results;
  } catch (err) {
    c.innerHTML = `<div class="empty-note">Failed to load history.</div>`;
    return;
  }

  if (historyCache.length === 0) {
    c.innerHTML = `<div class="sec-title">Provably Fair Game History</div><div class="empty-note">No games played yet.</div>`;
    return;
  }

  c.innerHTML = `
    <div class="sec-title">Provably Fair Game History</div>
    <div style="font-size:11.5px;color:rgba(255,255,255,.25);font-style:italic;margin-bottom:14px;line-height:1.65">Every game outcome is tied to a server seed revealed after the round ends. Verify any result independently.</div>
    ${historyCache.map(h => `<div class="hist-row">
      <span class="hist-game">${h.game}</span>
      <span class="hist-seed">${h.server_hash.slice(0, 16)}…</span>
      <span class="hist-res ${h.net >= 0 ? 'w' : 'l'}">${h.net >= 0 ? '+' : ''}${Number(h.net).toLocaleString()} CC</span>
      <button class="hist-verify" data-verify="${h.id}">Verify</button>
    </div>`).join('')}`;
}

function bindEvents(app) {
  document.getElementById('nav-home').addEventListener('click', () => window.__navigate('home'));
  document.getElementById('nav-games').addEventListener('click', () => window.__navigate('games'));
  document.getElementById('nav-shop').addEventListener('click', () => window.__navigate('shop'));

  document.querySelectorAll('.tabs .tb').forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      curTab = i;
      document.querySelectorAll('.tabs .tb').forEach((t, j) => t.classList.toggle('on', j === i));
      await renderTab();
    });
  });

  app.addEventListener('click', async (e) => {
    if (e.target.id === 'logoutBtn') {
      try { await api.post('/auth/logout'); } catch (_) {}
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearUser();
      return window.__navigate('landing');
    }

    if (e.target.id === 'editProfileBtn') {
      return showToast('Profile editing is coming soon', 'gold');
    }

    if (e.target.id === 'myListingsBtn') {
      return window.__navigate('shop', { filterMine: true });
    }

    const equipBtn = e.target.closest('[data-equip]');
    if (equipBtn) {
      const id = equipBtn.dataset.equip;
      const isEquipped = equipBtn.dataset.state === 'true';
      equipBtn.disabled = true;
      try {
        await api.post(`/cosmetics/${id}/${isEquipped ? 'unequip' : 'equip'}`);
        showToast(isEquipped ? 'Unequipped' : 'Equipped!', 'green');
        await renderCosmetics(document.getElementById('tcontent'));
        renderHero(); // re-fetch isn't needed for equip state, but hero shows equipped cosmetics — reload it
        loadProfile();
      } catch (err) {
        showToast(err.message || 'Failed to update', 'red');
        equipBtn.disabled = false;
      }
      return;
    }

    const listBtn = e.target.closest('[data-list]');
    if (listBtn) {
      const id = listBtn.dataset.list;
      listingPriceFor = listingPriceFor === id ? null : id;
      return renderCosmetics(document.getElementById('tcontent'));
    }

    const confirmBtn = e.target.closest('[data-confirm-list]');
    if (confirmBtn) {
      const id = confirmBtn.dataset.confirmList;
      const price = parseInt(document.getElementById('priceInput').value) || 0;
      if (price <= 0) return showToast('Enter a price first', 'red');
      confirmBtn.disabled = true; confirmBtn.textContent = '…';
      try {
        await api.post('/shop/listings', { user_cosmetic_id: id, price_a: price });
        showToast('Listed on the Player Shop!', 'gold');
        listingPriceFor = null;
        await renderCosmetics(document.getElementById('tcontent'));
      } catch (err) {
        showToast(err.message || 'Failed to list', 'red');
        confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm';
      }
      return;
    }

    const claimBtn = e.target.closest('[data-claim]');
    if (claimBtn) {
      const id = claimBtn.dataset.claim;
      claimBtn.disabled = true; claimBtn.textContent = '…';
      try {
        const res = await api.post(`/challenges/${id}/claim`);
        updateBalance({ a_balance: res.a_balance });
        showToast(`+${res.reward_a} A claimed!`, 'gold');
        challengesCache = null;
        await renderAchievements(document.getElementById('tcontent'));
      } catch (err) {
        showToast(err.message || 'Failed to claim', 'red');
        claimBtn.disabled = false; claimBtn.textContent = `Claim`;
      }
      return;
    }

    const verifyBtn = e.target.closest('[data-verify]');
    if (verifyBtn) {
      const row = historyCache.find(h => h.id === verifyBtn.dataset.verify);
      if (row) showToast(`Hash: ${row.server_hash.slice(0, 24)}… · nonce ${row.nonce}`, 'green');
    }
  });
}
