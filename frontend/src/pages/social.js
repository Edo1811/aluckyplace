import { api } from '../api.js';
import { store } from '../store.js';
import {
  COSMETIC_PREVIEW_KEYFRAMES,
  auraNameStyle, nameColorStyle, nameFontFamily, renderAvatarFrame,
} from '../cosmeticPreview.js';

// ── module state ──────────────────────────────────────────────────────────────
let curTab = 0;
let lbCache = null;      // { leaderboard, me }
let fameCache = null;
let shameCache = null;
let guildsCache = null;
let myGuild = null;      // { id, name, ... } | null

// ── helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function equippedMap(cosmetics) {
  const m = {};
  (cosmetics || []).forEach((c) => { m[c.category] = c; });
  return m;
}

// Render a username wearing its equipped color / font / aura — same layering
// as the profile hero, so names look identical everywhere.
function styledName(username, cosmetics) {
  const eq = equippedMap(cosmetics);
  const a = auraNameStyle(eq.name_aura || null);
  const col = nameColorStyle(eq.name_color || null);
  const font = nameFontFamily(eq.name_font || null);
  const style = `${col.style}${font.style}${a.style}`;
  const cls = `${col.className} ${font.className} ${a.className}`.trim();
  return `<span class="${cls}" style="${style}">${esc(username)}</span>`;
}

function avatarFor(cosmetics, size) {
  const eq = equippedMap(cosmetics);
  return renderAvatarFrame(eq.avatar_frame || null, size);
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const fmt = (n) => Number(n).toLocaleString('en-US');

function showToast(msg, type = 'green') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3200);
}

// ── entry ─────────────────────────────────────────────────────────────────────
export async function renderSocial(app) {
  curTab = 0;
  lbCache = fameCache = shameCache = guildsCache = null;
  myGuild = null;
  inject(app);
  bindEvents();
  go(0);
}

function inject(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      ${COSMETIC_PREVIEW_KEYFRAMES}
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .sp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif}
      .topbar{padding:16px 20px 0;flex-shrink:0}
      .tabs{display:flex;gap:2px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px}
      .tb{flex:1;padding:9px 0;background:none;border:none;border-radius:8px;color:rgba(255,255,255,.3);font-size:12.5px;cursor:pointer;font-family:'Playfair Display',Georgia,serif;letter-spacing:.03em;transition:background .18s,color .18s}
      .tb.on{background:rgba(16,185,129,.13);color:#10b981;font-weight:700}
      .tb.shame.on{background:rgba(239,68,68,.1);color:#ef4444}
      .content{flex:1;overflow-y:auto;padding:16px 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent}
      .content::-webkit-scrollbar{width:4px}
      .content::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08);border-radius:2px}
      .muted{color:rgba(255,255,255,.3);text-align:center;padding:40px 0;font-style:italic;font-size:13px}

      /* leaderboard */
      .lb-actions{display:flex;gap:8px;margin-bottom:14px}
      .lba{padding:7px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.45);font-size:11.5px;cursor:pointer;font-family:'Playfair Display',Georgia,serif;transition:all .15s}
      .lba:hover{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);color:#10b981}
      .lb-row{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:10px;margin-bottom:4px;border:1px solid transparent;transition:background .15s}
      .lb-row:hover{background:rgba(255,255,255,.03)}
      .lb-row.me{background:rgba(16,185,129,.07);border-color:rgba(16,185,129,.2)}
      .lb-row.gold .rnk{color:#D4AF37}.lb-row.silver .rnk{color:#aaa}.lb-row.bronze .rnk{color:#cd7f32}
      .rnk{width:28px;text-align:center;font-size:13px;font-weight:700;color:rgba(255,255,255,.25);flex-shrink:0}
      .pinfo{flex:1;min-width:0}
      .pname2{font-size:13.5px;color:#fff;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .badge{font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(212,175,55,.15);color:#D4AF37;border:1px solid rgba(212,175,55,.3);letter-spacing:.05em}
      .pme{font-size:9px;padding:2px 7px;border-radius:10px;background:rgba(16,185,129,.12);color:#10b981;letter-spacing:.05em}
      .pbal{font-size:14px;font-weight:700;color:#10b981;flex-shrink:0}
      .spacer{text-align:center;color:rgba(255,255,255,.15);font-size:18px;padding:4px 0;letter-spacing:.2em}

      /* hall */
      .hcard{border-radius:12px;padding:16px 18px;margin-bottom:10px;border:1px solid}
      .hcard.fame{background:rgba(212,175,55,.05);border-color:rgba(212,175,55,.15)}
      .hcard.shame{background:rgba(239,68,68,.05);border-color:rgba(239,68,68,.12)}
      .hcard-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
      .hav{width:36px;height:36px;flex-shrink:0}
      .huser{font-size:14px;font-weight:700;color:#fff}
      .htime{font-size:10px;color:rgba(255,255,255,.2);margin-top:2px}
      .htag{margin-left:auto;font-size:9px;padding:3px 9px;border-radius:10px;letter-spacing:.06em;font-weight:700;text-transform:uppercase}
      .htag.fame{background:rgba(212,175,55,.15);color:#D4AF37;border:1px solid rgba(212,175,55,.25)}
      .htag.shame{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
      .hstory{font-size:13px;color:rgba(255,255,255,.55);line-height:1.6;font-style:italic}
      .shame-note{font-size:11px;color:rgba(239,68,68,.4);text-align:center;margin-bottom:14px;font-style:italic;letter-spacing:.04em}

      /* guilds */
      .feat-label{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.2);margin-bottom:8px}
      .mine-banner{display:flex;align-items:center;gap:10px;border-radius:12px;padding:12px 16px;margin-bottom:16px;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2)}
      .mine-banner .mb-name{font-size:13.5px;font-weight:700;color:#fff}
      .mine-banner .mb-sub{font-size:10.5px;color:rgba(255,255,255,.3);margin-top:1px}
      .gfeat{border-radius:14px;padding:18px;background:linear-gradient(135deg,rgba(16,185,129,.1) 0%,rgba(16,185,129,.03) 100%);border:1px solid rgba(16,185,129,.2);margin-bottom:18px}
      .gfeat-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
      .gicon{width:42px;height:42px;border-radius:10px;background:rgba(16,185,129,.15);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
      .gtag2{font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.35);letter-spacing:.06em;margin-left:4px}
      .gname{font-size:17px;font-weight:700;color:#fff}
      .gdesc2{font-size:12px;color:rgba(255,255,255,.35);margin-top:2px}
      .gprog{height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;margin:10px 0 5px}
      .gpfill{height:100%;background:#10b981;border-radius:3px;transition:width .5s}
      .gprow{display:flex;justify-content:space-between;font-size:10.5px;color:rgba(255,255,255,.25)}
      .gbtns{display:flex;gap:8px;margin-top:12px}
      .gjoin{padding:8px 20px;background:#10b981;border:none;border-radius:8px;color:#fff;font-size:12.5px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .gview{padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:rgba(255,255,255,.45);font-size:12px;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .growtop{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .createbtn{padding:7px 14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);border-radius:8px;color:#10b981;font-size:11.5px;font-weight:700;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .gsearch{width:100%;padding:10px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:9px;color:#fff;font-size:13px;font-family:'Playfair Display',Georgia,serif;outline:none;margin-bottom:12px}
      .gsearch::placeholder{color:rgba(255,255,255,.2)}
      .gsearch:focus{border-color:rgba(16,185,129,.4)}
      .grow{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,.06);margin-bottom:6px;background:rgba(255,255,255,.025)}
      .gicon2{width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
      .ginfo{flex:1;min-width:0}
      .gname2{font-size:13.5px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px}
      .gpriv{font-size:9px;padding:2px 7px;border-radius:8px;background:rgba(255,150,0,.1);color:rgba(255,150,0,.8);border:1px solid rgba(255,150,0,.2);letter-spacing:.04em}
      .gmeta{font-size:10.5px;color:rgba(255,255,255,.25);margin-top:2px}
      .gstat{text-align:right;flex-shrink:0}
      .gstatn{font-size:13px;font-weight:700;color:#10b981}
      .gstatl{font-size:9.5px;color:rgba(255,255,255,.2);margin-top:1px}
      .gsmall{margin-top:5px;padding:4px 10px;border-radius:6px;font-size:10px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .gsmall.join{border:1px solid rgba(16,185,129,.25);background:rgba(16,185,129,.08);color:#10b981}
      .gsmall.req{border:1px solid rgba(255,150,0,.3);background:rgba(255,150,0,.08);color:rgba(255,150,0,.8)}

      /* create modal */
      .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:center;justify-content:center}
      .overlay.show{display:flex}
      .modal{background:#111;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:340px;padding:24px}
      .modal h3{font-size:17px;font-weight:700;color:#fff;margin-bottom:4px}
      .modal .sub{font-size:11.5px;color:rgba(255,255,255,.3);font-style:italic;margin-bottom:18px}
      .mfield{margin-bottom:10px}
      .mfield label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:5px;display:block}
      .mfield input{width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#fff;font-family:'Playfair Display',Georgia,serif;font-size:13px;outline:none}
      .mtoggle{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px}
      .mtoggle .tt{font-size:13px;color:#fff}.mtoggle .ts{font-size:10.5px;color:rgba(255,255,255,.28);margin-top:1px}
      .sw{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,.1);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
      .sw.on{background:rgba(16,185,129,.6)}
      .sw .thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
      .sw.on .thumb{left:18px}
      .mbtns{display:flex;gap:8px;margin-top:16px}
      .mbtns button{flex:1;padding:10px;border-radius:8px;font-family:'Playfair Display',Georgia,serif;cursor:pointer;font-size:13px}
      .mcancel{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5)}
      .mcreate{background:#10b981;border:none;color:#fff;font-weight:700}

      /* dock */
      .dock-wrap{display:flex;justify-content:center;padding:8px 0 11px;background:#050505;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0}
      .pill{display:flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:40px;padding:6px 14px;gap:2px}
      .di{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;position:relative;transition:background .15s}
      .di:hover{background:rgba(255,255,255,.07)}
      .di.on svg{opacity:1}
      .di.on::after{content:'';position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#10b981}
      .di svg{opacity:.4;transition:opacity .15s}

      .toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:#111;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px 18px;font-size:13px;color:#fff;opacity:0;pointer-events:none;transition:all .25s;z-index:300;font-family:'Playfair Display',Georgia,serif}
      .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .toast.green{border-color:rgba(16,185,129,.4)}.toast.red{border-color:rgba(239,68,68,.4)}
    </style>

    <div class="sp">
      <div class="topbar">
        <div class="tabs">
          <button class="tb on" data-tab="0">Leaderboard</button>
          <button class="tb" data-tab="1">Hall of Fame</button>
          <button class="tb shame" data-tab="2">Hall of Shame</button>
          <button class="tb" data-tab="3">Guilds</button>
        </div>
      </div>

      <div class="content" id="content"></div>

      <div class="dock-wrap">
        <div class="pill">
          <div class="di" id="nav-home"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg></div>
          <div class="di" id="nav-games"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/></svg></div>
          <div class="di on"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg></div>
          <div class="di" id="nav-shop"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/></svg></div>
          <div class="di" id="nav-profile"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg></div>
        </div>
      </div>
    </div>

    <div class="overlay" id="create-overlay">
      <div class="modal">
        <h3>Create a Guild</h3>
        <div class="sub">You'll be the owner. One guild per player.</div>
        <div class="mfield"><label>Guild Name</label><input id="cg-name" maxlength="64" placeholder="High Rollers Club"></div>
        <div class="mfield"><label>Tag (max 8)</label><input id="cg-tag" maxlength="8" placeholder="HRC"></div>
        <div class="mfield"><label>Description</label><input id="cg-desc" maxlength="256" placeholder="What's your guild about?"></div>
        <div class="mtoggle">
          <div><div class="tt">Private Guild</div><div class="ts">New members need approval</div></div>
          <div class="sw" id="cg-priv"><div class="thumb"></div></div>
        </div>
        <div class="mbtns">
          <button class="mcancel" id="cg-cancel">Cancel</button>
          <button class="mcreate" id="cg-create">Create</button>
        </div>
      </div>
    </div>

    <div class="toast" id="toast"></div>
  `;
}

function bindEvents() {
  document.querySelectorAll('.tb').forEach((b) =>
    b.addEventListener('click', () => go(Number(b.dataset.tab))));

  document.getElementById('nav-home')?.addEventListener('click', () => window.__navigate('home'));
  document.getElementById('nav-games')?.addEventListener('click', () => window.__navigate('games'));
  document.getElementById('nav-shop')?.addEventListener('click', () => window.__navigate('shop'));
  document.getElementById('nav-profile')?.addEventListener('click', () => window.__navigate('profile'));

  const ov = document.getElementById('create-overlay');
  document.getElementById('cg-cancel')?.addEventListener('click', () => ov.classList.remove('show'));
  ov?.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('show'); });
  document.getElementById('cg-priv')?.addEventListener('click', (e) =>
    e.currentTarget.classList.toggle('on'));
  document.getElementById('cg-create')?.addEventListener('click', submitCreate);
}

function go(i) {
  curTab = i;
  document.querySelectorAll('.tb').forEach((t, j) => t.classList.toggle('on', j === i));
  const c = document.getElementById('content');
  if (i === 0) renderLB(c);
  else if (i === 1) renderHall(c, 'fame');
  else if (i === 2) renderHall(c, 'shame');
  else renderGuilds(c);
}

// ── leaderboard ─────────────────────────────────────────────────────────────
async function renderLB(c) {
  c.innerHTML = `<div class="muted">Loading leaderboard…</div>`;
  try {
    if (!lbCache) lbCache = await api.get('/social/leaderboard');
  } catch (err) {
    c.innerHTML = `<div class="muted">Couldn't load the leaderboard.</div>`;
    return;
  }
  const { leaderboard, me } = lbCache;
  const myId = store.user?.id;
  const inTop = me && leaderboard.some((e) => e.user_id === me.user_id);

  let h = `<div class="lb-actions"><button class="lba" id="jump-me">↓ Jump to me</button></div>`;
  if (!leaderboard.length) h += `<div class="muted">No players ranked yet.</div>`;
  leaderboard.forEach((p) => { h += lbRow(p, p.user_id === myId); });
  if (me && !inTop) {
    h += `<div class="spacer">· · ·</div>`;
    h += lbRow(me, true);
  }
  c.innerHTML = h;

  document.getElementById('jump-me')?.addEventListener('click', () => {
    document.getElementById('merow')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function lbRow(p, isMe) {
  const medal = p.rank === 1 ? 'gold' : p.rank === 2 ? 'silver' : p.rank === 3 ? 'bronze' : '';
  return `<div class="lb-row ${isMe ? 'me' : ''} ${medal}" ${isMe ? 'id="merow"' : ''}>
    <div class="rnk">${p.rank}</div>
    <div style="flex-shrink:0">${avatarFor(p.cosmetics, 32)}</div>
    <div class="pinfo">
      <div class="pname2">${styledName(p.username, p.cosmetics)}
        ${p.weekly_badge ? '<span class="badge">👑 Richest MF</span>' : ''}
        ${isMe ? '<span class="pme">You</span>' : ''}
      </div>
    </div>
    <div class="pbal">${fmt(p.cc_balance)} CC</div>
  </div>`;
}

// ── hall ────────────────────────────────────────────────────────────────────
async function renderHall(c, type) {
  c.innerHTML = `<div class="muted">Loading…</div>`;
  const path = type === 'fame' ? '/social/hall-of-fame' : '/social/hall-of-shame';
  try {
    if (type === 'fame' && !fameCache) fameCache = await api.get(path);
    if (type === 'shame' && !shameCache) shameCache = await api.get(path);
  } catch (err) {
    c.innerHTML = `<div class="muted">Couldn't load that.</div>`;
    return;
  }
  const entries = (type === 'fame' ? fameCache : shameCache).entries || [];
  let h = '';
  if (type === 'shame') h += `<div class="shame-note">These are real losses. Opt-out exists. Nobody uses it.</div>`;
  if (!entries.length) {
    h += `<div class="muted">${type === 'fame' ? 'No legends yet. Be the first.' : 'Empty. For now.'}</div>`;
  }
  entries.forEach((e) => {
    h += `<div class="hcard ${type}">
      <div class="hcard-top">
        <div class="hav">${renderAvatarFrame(null, 36)}</div>
        <div><div class="huser">${esc(e.username)}</div><div class="htime">${timeAgo(e.created_at)}</div></div>
        ${e.game ? `<div class="htag ${type}">${esc(e.game)}</div>` : ''}
      </div>
      <div class="hstory">${esc(e.story || '')}</div>
    </div>`;
  });
  c.innerHTML = h;
}

// ── guilds ──────────────────────────────────────────────────────────────────
async function renderGuilds(c) {
  c.innerHTML = `<div class="muted">Loading guilds…</div>`;
  try {
    if (!guildsCache) {
      const [g, mine] = await Promise.all([
        api.get('/social/guilds'),
        api.get('/social/guilds/mine'),
      ]);
      guildsCache = g.guilds || [];
      myGuild = mine.guild || null;
    }
  } catch (err) {
    c.innerHTML = `<div class="muted">Couldn't load guilds.</div>`;
    return;
  }

  const list = guildsCache;
  let h = '';

  if (myGuild) {
    h += `<div class="mine-banner">
      <div class="gicon" style="width:38px;height:38px;font-size:16px">🏰</div>
      <div style="flex:1"><div class="mb-name">${esc(myGuild.name)}</div><div class="mb-sub">Your guild · ${myGuild.progress_pct}% funded</div></div>
      <button class="gview" id="go-myguild">Open</button>
    </div>`;
  } else if (list.length) {
    const f = list[0];
    h += `<div class="feat-label">✦ Featured Guild</div>
    <div class="gfeat">
      <div class="gfeat-top">
        <div class="gicon">💎</div>
        <div><div class="gname">${esc(f.name)} <span class="gtag2">${esc(f.tag)}</span></div>
        <div class="gdesc2">${esc(f.description || '')}</div></div>
      </div>
      <div class="gprog"><div class="gpfill" style="width:${f.progress_pct}%"></div></div>
      <div class="gprow"><span>${fmt(f.fund_balance)} / 15,000 CC contributed</span><span>${f.progress_pct}% ${f.unlocked ? 'unlocked' : 'funded'}</span></div>
      <div style="font-size:10.5px;color:rgba(255,255,255,.22);margin-top:6px">${f.member_count} members</div>
      <div class="gbtns">
        <button class="gjoin" data-join="${f.id}" data-priv="${f.is_private}">${f.is_private ? 'Request to Join' : 'Join Guild'}</button>
        <button class="gview" data-view="${f.id}">View</button>
      </div>
    </div>`;
  }

  h += `<div class="growtop">
    <div style="font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.18)">All Guilds</div>
    ${myGuild ? '' : '<button class="createbtn" id="open-create">+ Create Guild</button>'}
  </div>`;
  h += `<input class="gsearch" id="gsearch" placeholder="🔍  Search guilds...">`;
  h += `<div id="glist">${list.map((g) => guildRow(g)).join('') || '<div class="muted">No guilds yet.</div>'}</div>`;

  c.innerHTML = h;

  document.getElementById('go-myguild')?.addEventListener('click', () => window.__navigate('guild'));
  document.getElementById('open-create')?.addEventListener('click', () =>
    document.getElementById('create-overlay').classList.add('show'));
  c.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => window.__navigate('guild', { guildId: b.dataset.view })));
  c.querySelectorAll('[data-join]').forEach((b) =>
    b.addEventListener('click', () => joinGuild(b.dataset.join, b.dataset.priv === 'true')));
  document.getElementById('gsearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.getElementById('glist').innerHTML =
      list.filter((g) => g.name.toLowerCase().includes(q) || (g.tag || '').toLowerCase().includes(q))
          .map((g) => guildRow(g)).join('') || '<div class="muted">No matches.</div>';
    reWireRows();
  });
}

function guildRow(g) {
  const canAct = !myGuild;
  return `<div class="grow">
    <div class="gicon2">🏛</div>
    <div class="ginfo">
      <div class="gname2">${esc(g.name)} <span class="gtag2" style="font-size:10px">${esc(g.tag)}</span>${g.is_private ? '<span class="gpriv">🔒 Private</span>' : ''}</div>
      <div class="gmeta">${g.member_count} members · ${g.progress_pct}% funded${g.unlocked ? ' · unlocked' : ''}</div>
    </div>
    <div class="gstat">
      <div class="gstatn">${fmt(g.fund_balance)} CC</div>
      <div class="gstatl">guild fund</div>
      ${canAct
        ? `<button class="gsmall ${g.is_private ? 'req' : 'join'}" data-join="${g.id}" data-priv="${g.is_private}">${g.is_private ? 'Request' : 'Join'}</button>`
        : `<button class="gsmall join" data-view="${g.id}">View</button>`}
    </div>
  </div>`;
}

function reWireRows() {
  document.querySelectorAll('#glist [data-view]').forEach((b) =>
    b.addEventListener('click', () => window.__navigate('guild', { guildId: b.dataset.view })));
  document.querySelectorAll('#glist [data-join]').forEach((b) =>
    b.addEventListener('click', () => joinGuild(b.dataset.join, b.dataset.priv === 'true')));
}

async function joinGuild(guildId, isPrivate) {
  try {
    const res = await api.post(`/social/guilds/${guildId}/join`);
    if (res.status === 'requested') {
      showToast('Request sent — waiting for approval', 'green');
    } else {
      showToast('Joined! 🎉', 'green');
      guildsCache = null;
      go(3);
    }
  } catch (err) {
    showToast(err.message || 'Could not join', 'red');
  }
}

async function submitCreate() {
  const name = document.getElementById('cg-name').value.trim();
  const tag = document.getElementById('cg-tag').value.trim();
  const description = document.getElementById('cg-desc').value.trim();
  const is_private = document.getElementById('cg-priv').classList.contains('on');
  if (!name || !tag) { showToast('Name and tag are required', 'red'); return; }
  try {
    await api.post('/social/guilds', { name, tag, description, is_private });
    document.getElementById('create-overlay').classList.remove('show');
    showToast('Guild created! 🏰', 'green');
    window.__navigate('guild');
  } catch (err) {
    showToast(err.message || 'Could not create guild', 'red');
  }
}
