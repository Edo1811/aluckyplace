import { api } from '../api.js';
import { store } from '../store.js';
import socket from '../socket.js';
import {
  COSMETIC_PREVIEW_KEYFRAMES,
  auraNameStyle, nameColorStyle, nameFontFamily, renderAvatarFrame,
} from '../cosmeticPreview.js';

// ── module state ──────────────────────────────────────────────────────────────
let guildId = null;
let detail = null;
let socketBound = false;

const PVP_GAMES = [
  { id: 'coinflip', name: 'Coinflip' },
  { id: 'rps', name: 'Rock Paper Scissors' },
  { id: 'highlow', name: 'Higher or Lower' },
  { id: 'duels', name: 'Duels' },
  { id: 'uno', name: 'Uno' },
];

// ── helpers ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const fmt = (n) => Number(n).toLocaleString('en-US');

function equippedMap(cosmetics) {
  const m = {};
  (cosmetics || []).forEach((c) => { m[c.category] = c; });
  return m;
}
function styledName(username, cosmetics) {
  const eq = equippedMap(cosmetics);
  const a = auraNameStyle(eq.name_aura || null);
  const col = nameColorStyle(eq.name_color || null);
  const font = nameFontFamily(eq.name_font || null);
  return `<span class="${`${col.className} ${font.className} ${a.className}`.trim()}" style="${col.style}${font.style}${a.style}">${esc(username)}</span>`;
}
function avatarFor(cosmetics, size) {
  return renderAvatarFrame(equippedMap(cosmetics).avatar_frame || null, size);
}

function toast(msg, type = 'green') {
  const el = document.getElementById('gtoast');
  if (!el) return;
  el.textContent = msg;
  el.className = `gtoast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3200);
}

// ── entry ─────────────────────────────────────────────────────────────────────
export async function renderGuild(app, data) {
  detail = null;
  socketBound = false;
  inject(app);

  try {
    guildId = data && data.guildId ? data.guildId : null;
    if (!guildId) {
      const mine = await api.get('/social/guilds/mine');
      guildId = mine.guild ? mine.guild.id : null;
    }
  } catch { guildId = null; }

  if (!guildId) { renderNoGuild(); return; }
  bindGlobalSocket();
  await loadGuild();
}

function inject(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/cinzel@5/index.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/dancing-script@5/index.css">
    <style>
      ${COSMETIC_PREVIEW_KEYFRAMES}
      *,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .gp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif}
      .gh{padding:14px 18px 12px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;display:flex;align-items:center;gap:14px}
      .ghi{width:42px;height:42px;border-radius:10px;background:rgba(212,175,55,.12);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
      .ghinfo{flex:1;min-width:0}
      .ghname{font-size:17px;font-weight:700;color:#fff;display:flex;align-items:center;gap:8px}
      .ghtag{font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.35);letter-spacing:.06em}
      .ghdesc{font-size:11.5px;color:rgba(255,255,255,.28);margin-top:2px;font-style:italic}
      .hbtn{padding:5px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:7px;color:rgba(255,255,255,.4);font-size:11px;cursor:pointer;font-family:'Playfair Display',Georgia,serif;white-space:nowrap}
      .hbtn:hover{background:rgba(255,255,255,.09);color:rgba(255,255,255,.7)}
      .hbtn.req{background:rgba(212,175,55,.1);border-color:rgba(212,175,55,.3);color:#D4AF37}

      .gbody{display:flex;flex:1;overflow:hidden}
      .gleft{flex:1;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,.05);overflow:hidden}

      .prog-hero{padding:18px 20px 14px;border-bottom:1px solid rgba(255,255,255,.05);flex-shrink:0}
      .ph-top{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px}
      .ph-title{font-size:13px;font-weight:700;color:#fff}
      .ph-sub{font-size:11px;color:rgba(255,255,255,.28);font-style:italic;margin-top:2px}
      .ph-big{font-size:20px;font-weight:700;color:#10b981;text-align:right}
      .ph-of{font-size:11px;color:rgba(255,255,255,.28);margin-top:1px;text-align:right}
      .pbar-big{height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden;margin-bottom:8px}
      .pbfill-big{height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width .6s}
      .ph-row{display:flex;justify-content:space-between;font-size:10.5px;color:rgba(255,255,255,.22)}
      .contrib-btn{width:100%;margin-top:12px;padding:11px;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);border-radius:9px;color:#10b981;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .contrib-btn:hover{background:rgba(16,185,129,.2)}

      .locked-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:24px;opacity:.3;user-select:none;text-align:center}
      .locked-area .li{font-size:32px}
      .locked-area .lt{font-size:15px;font-weight:700;color:#fff}
      .locked-area .ls{font-size:12px;color:rgba(255,255,255,.5);line-height:1.7}

      /* chat */
      .chat-note{font-size:9px;color:rgba(255,255,255,.13);text-align:center;padding:6px 0;letter-spacing:.06em;flex-shrink:0}
      .cmsg-area{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.06) transparent}
      .cmsg-area::-webkit-scrollbar{width:4px}.cmsg-area::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08)}
      .cm{display:flex;gap:10px;align-items:flex-start}
      .cm.me{flex-direction:row-reverse}
      .cmav{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px}
      .cmb{max-width:78%}
      .cmuser{font-size:10px;color:rgba(255,255,255,.28);margin-bottom:3px}
      .cm.me .cmuser{text-align:right}
      .cmtxt{padding:9px 12px;font-size:12.5px;line-height:1.55;color:rgba(255,255,255,.82)}
      .cm:not(.me) .cmtxt{background:rgba(255,255,255,.05);border-radius:3px 10px 10px 10px}
      .cm.me .cmtxt{background:rgba(16,185,129,.14);border-radius:10px 3px 10px 10px}
      .cinput-wrap{padding:10px 12px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:8px;align-items:center;flex-shrink:0}
      .cinput{flex:1;padding:9px 13px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:9px;color:#fff;font-size:13px;font-family:'Playfair Display',Georgia,serif;outline:none}
      .cinput:focus{border-color:rgba(16,185,129,.35)}
      .csend{padding:9px 16px;background:#10b981;border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;flex-shrink:0}

      /* members */
      .gside{width:220px;flex-shrink:0;display:flex;flex-direction:column;overflow:hidden}
      .shead{padding:12px 14px 8px;border-bottom:1px solid rgba(255,255,255,.05);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.2);display:flex;justify-content:space-between;flex-shrink:0}
      .smcount{font-size:11px;color:rgba(255,255,255,.35);letter-spacing:0;text-transform:none}
      .mlist{flex:1;overflow-y:auto;padding:8px 0;scrollbar-width:none}
      .mlist::-webkit-scrollbar{display:none}
      .mrow{position:relative;display:flex;align-items:center;gap:9px;padding:8px 14px}
      .mrow.act{cursor:pointer;transition:background .15s}
      .mrow.act:hover{background:rgba(255,255,255,.03)}
      .mdot{position:absolute;left:30px;top:12px;width:8px;height:8px;border-radius:50%;border:2px solid #050505}
      .mdot.on{background:#10b981}.mdot.off{background:rgba(255,255,255,.15)}
      .minfo{flex:1;min-width:0}
      .mname{font-size:12.5px;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
      .mtag{font-size:8px;padding:1px 5px;border-radius:4px;letter-spacing:.05em}
      .mtag.own{background:rgba(212,175,55,.12);color:#D4AF37}
      .mtag.you{background:rgba(16,185,129,.1);color:#10b981}
      .mbal{font-size:10.5px;color:rgba(255,255,255,.28)}
      .view-note{padding:10px 14px;font-size:10px;color:rgba(255,255,255,.18);text-align:center;font-style:italic;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0;line-height:1.5}

      /* hovercard */
      .hcard{position:absolute;right:100%;top:50%;transform:translateY(-50%);width:190px;background:#141414;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:13px;z-index:100;box-shadow:0 8px 32px rgba(0,0,0,.7);opacity:0;pointer-events:none;transition:opacity .15s;margin-right:6px}
      .mrow.act:hover .hcard{opacity:1;pointer-events:all}
      .hc-top{display:flex;align-items:center;gap:10px;margin-bottom:10px}
      .hc-name{font-size:13px;font-weight:700;color:#fff}
      .hc-bal{font-size:11px;color:#10b981;margin-top:1px}
      .hcb{width:100%;padding:8px;border-radius:8px;font-size:12px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:none;margin-bottom:5px}
      .hcb.donate{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.25)}
      .hcb.play{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.1)}
      .hcb:disabled{opacity:.4;cursor:not-allowed}
      .hc-note{font-size:9.5px;color:rgba(255,255,255,.2);text-align:center;margin-top:3px}

      /* modal shell */
      .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;align-items:center;justify-content:center}
      .overlay.show{display:flex}
      .modal{background:#111;border:1px solid rgba(255,255,255,.1);border-radius:16px;width:330px;padding:22px}
      .modal h3{font-size:16px;font-weight:700;color:#fff;margin-bottom:12px}
      .mfield{margin-bottom:10px}
      .mfield label{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:5px;display:block}
      .mfield input,.mfield select{width:100%;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:#fff;font-family:'Playfair Display',Georgia,serif;font-size:13px;outline:none}
      .mtoggle{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;margin-bottom:10px}
      .sw{width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,.1);cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
      .sw.on{background:rgba(16,185,129,.6)}
      .sw .thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s}
      .sw.on .thumb{left:18px}
      .danger{padding:10px 12px;background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.15);border-radius:8px;margin-top:6px}
      .danger button{width:100%;padding:8px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:7px;color:#ef4444;font-size:12px;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .mbtns{display:flex;gap:8px;margin-top:14px}
      .mbtns button{flex:1;padding:10px;border-radius:8px;font-family:'Playfair Display',Georgia,serif;cursor:pointer;font-size:13px}
      .mcancel{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.5)}
      .mok{background:#10b981;border:none;color:#fff;font-weight:700}
      .reqrow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06)}
      .reqrow .rn{flex:1;font-size:13px;color:#fff}
      .reqrow button{padding:6px 12px;border-radius:7px;font-size:11px;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:none}
      .rapprove{background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.25)}
      .rreject{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}

      .center-state{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:40px;color:rgba(255,255,255,.5);font-family:'Playfair Display',Georgia,serif}
      .center-state button{padding:11px 24px;background:#10b981;border:none;border-radius:10px;color:#fff;font-weight:700;font-family:inherit;font-size:14px;cursor:pointer}

      .dock-wrap{display:flex;justify-content:center;padding:8px 0 11px;background:#050505;border-top:1px solid rgba(255,255,255,.05);flex-shrink:0}
      .pill{display:flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:40px;padding:6px 14px;gap:2px}
      .di{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;position:relative}
      .di:hover{background:rgba(255,255,255,.07)}
      .di.on svg{opacity:1}
      .di.on::after{content:'';position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#10b981}
      .di svg{opacity:.4}

      .gtoast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:#111;border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:11px 18px;font-size:13px;color:#fff;opacity:0;pointer-events:none;transition:all .25s;z-index:3000;font-family:'Playfair Display',Georgia,serif}
      .gtoast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .gtoast.green{border-color:rgba(16,185,129,.4)}.gtoast.red{border-color:rgba(239,68,68,.4)}
    </style>

    <div class="gp">
      <div id="ghead"></div>
      <div class="gbody" id="gbody"></div>
      <div class="dock-wrap">
        <div class="pill">
          <div class="di" id="nav-home"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg></div>
          <div class="di" id="nav-games"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/></svg></div>
          <div class="di on" id="nav-social"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg></div>
          <div class="di" id="nav-shop"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/></svg></div>
          <div class="di" id="nav-profile"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg></div>
        </div>
      </div>
    </div>

    <div class="overlay" id="modal-slot"></div>
    <div class="gtoast" id="gtoast"></div>
  `;

  document.getElementById('nav-home').addEventListener('click', () => window.__navigate('home'));
  document.getElementById('nav-games').addEventListener('click', () => window.__navigate('games'));
  document.getElementById('nav-social').addEventListener('click', () => window.__navigate('social'));
  document.getElementById('nav-shop').addEventListener('click', () => window.__navigate('shop'));
  document.getElementById('nav-profile').addEventListener('click', () => window.__navigate('profile'));
}

function renderNoGuild() {
  document.getElementById('gbody').innerHTML = `
    <div class="center-state">
      <div style="font-size:40px">🏰</div>
      <div style="font-size:16px;color:#fff;font-weight:700">You're not in a guild yet</div>
      <div style="font-size:13px">Join one or start your own from the Guilds tab.</div>
      <button id="browse-guilds">Browse Guilds</button>
    </div>`;
  document.getElementById('ghead').innerHTML = '';
  document.getElementById('browse-guilds').addEventListener('click', () => window.__navigate('social'));
}

async function loadGuild() {
  try {
    const res = await api.get(`/social/guilds/${guildId}`);
    detail = res.guild;
  } catch (err) {
    document.getElementById('gbody').innerHTML = `<div class="center-state"><div>Couldn't load this guild.</div><button id="bk">Back</button></div>`;
    document.getElementById('bk')?.addEventListener('click', () => window.__navigate('social'));
    return;
  }
  renderHeader();
  renderBody();
  if (detail.is_member && detail.unlocked) enterChat();
}

function renderHeader() {
  const g = detail;
  document.getElementById('ghead').innerHTML = `
    <div class="ghi">🏰</div>
    <div class="ghinfo">
      <div class="ghname">${esc(g.name)} <span class="ghtag">${esc(g.tag)}</span></div>
      <div class="ghdesc">${esc(g.description || '')}</div>
    </div>
    ${g.is_owner && g.pending_count > 0 ? `<button class="hbtn req" id="reqBtn">${g.pending_count} pending</button>` : ''}
    ${g.is_owner ? `<button class="hbtn" id="setBtn">⚙ Settings</button>` : ''}`;
  document.getElementById('setBtn')?.addEventListener('click', openSettings);
  document.getElementById('reqBtn')?.addEventListener('click', openRequests);
}

function renderBody() {
  const g = detail;
  const pct = g.progress_pct;
  const needed = Math.max(0, 15000 - g.fund_balance);

  const heroHTML = `
    <div class="prog-hero">
      <div class="ph-top">
        <div><div class="ph-title">Guild Fund</div><div class="ph-sub">${g.unlocked ? 'Unlocked — keep contributing to flex' : 'Reach the goal to unlock all features'}</div></div>
        <div><div class="ph-big">${fmt(g.fund_balance)} CC</div><div class="ph-of">of 15,000 CC</div></div>
      </div>
      <div class="pbar-big"><div class="pbfill-big" style="width:${Math.min(100, pct)}%"></div></div>
      <div class="ph-row"><span>${g.unlocked ? 'Goal reached 🎉' : fmt(needed) + ' CC still needed'}</span><span style="color:rgba(255,255,255,.45)">${pct}% funded</span></div>
      ${g.is_member ? `<button class="contrib-btn" id="contribBtn">+ Contribute CC to the Guild Fund</button>` : ''}
    </div>`;

  let leftInner;
  if (!g.is_member) {
    leftInner = heroHTML + `<div class="center-state" style="flex:1">
      <div style="font-size:13px">You're viewing this guild from the outside.</div>
      <button id="join-this">${g.is_private ? 'Request to Join' : 'Join Guild'}</button>
    </div>`;
  } else if (!g.unlocked) {
    leftInner = heroHTML + `
      <div class="locked-area">
        <div class="li">🔒</div>
        <div class="lt">Features locked</div>
        <div class="ls">Chat, donations, and friendly games unlock<br>once the guild reaches 15,000 CC.</div>
      </div>`;
  } else {
    leftInner = heroHTML + `
      <div class="chat-note">💬 Messages auto-delete after 24 hours</div>
      <div class="cmsg-area" id="msgs"></div>
      <div class="cinput-wrap">
        <input class="cinput" id="cinput" placeholder="Say something..." maxlength="500">
        <button class="csend" id="csend">Send</button>
      </div>`;
  }

  document.getElementById('gbody').innerHTML = `
    <div class="gleft">${leftInner}</div>
    <div class="gside">
      <div class="shead">Members <span class="smcount">${g.member_count}</span></div>
      <div class="mlist" id="mlist">${g.members.map(memberRow).join('')}</div>
      <div class="view-note">${g.is_member ? (g.unlocked ? 'Hover a member to donate or challenge' : '🔒 Donate & challenge unlock at the goal') : 'Join to chat, donate, and play'}</div>
    </div>`;

  // wire
  document.getElementById('contribBtn')?.addEventListener('click', openContribute);
  document.getElementById('join-this')?.addEventListener('click', joinThis);
  if (g.is_member && g.unlocked) {
    document.getElementById('csend')?.addEventListener('click', sendChat);
    document.getElementById('cinput')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    wireMemberActions();
  }
}

function memberRow(m) {
  const g = detail;
  const isMe = m.user_id === store.user?.id;
  const canAct = g.is_member && g.unlocked && !isMe;
  const canDonate = canAct && m.donations_today < 2;
  return `<div class="mrow ${canAct ? 'act' : ''}" data-uid="${m.user_id}" data-name="${esc(m.username)}">
    <div style="position:relative;flex-shrink:0">${avatarFor(m.cosmetics, 30)}<div class="mdot ${m.online ? 'on' : 'off'}"></div></div>
    <div class="minfo">
      <div class="mname">${styledName(m.username, m.cosmetics)}${m.is_owner ? '<span class="mtag own">Owner</span>' : ''}${isMe ? '<span class="mtag you">You</span>' : ''}</div>
      <div class="mbal">${fmt(m.cc_balance)} CC</div>
    </div>
    ${canAct ? `<div class="hcard">
      <div class="hc-top">${avatarFor(m.cosmetics, 34)}<div><div class="hc-name">${esc(m.username)}</div><div class="hc-bal">${fmt(m.cc_balance)} CC</div></div></div>
      <button class="hcb donate" data-donate="${m.user_id}" ${canDonate ? '' : 'disabled'}>💸 Donate CC</button>
      <button class="hcb play" data-play="${m.user_id}">⚔ Play with Guild Member</button>
      <div class="hc-note">${m.donations_today}/2 received today</div>
    </div>` : ''}
  </div>`;
}

function wireMemberActions() {
  document.querySelectorAll('[data-donate]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); openDonate(b.dataset.donate); }));
  document.querySelectorAll('[data-play]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); openPlay(b.dataset.play); }));
}

// ── chat ────────────────────────────────────────────────────────────────────
function chatAvatar(username) {
  // opponents in chat: we only have username from the socket message
  return `<div class="cmav">${esc((username || '?').slice(0, 1).toUpperCase())}</div>`;
}
function appendMsg(m) {
  const area = document.getElementById('msgs');
  if (!area) return;
  const isMe = m.username === store.user?.username;
  const div = document.createElement('div');
  div.className = `cm${isMe ? ' me' : ''}`;
  div.innerHTML = `${chatAvatar(m.username)}<div class="cmb"><div class="cmuser">${esc(m.username)}</div><div class="cmtxt">${esc(m.text)}</div></div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}
function enterChat() {
  socket.emit('guild:enter');
}
function sendChat() {
  const inp = document.getElementById('cinput');
  const text = inp.value.trim();
  if (!text) return;
  socket.emit('guild:chat:send', { text });
  inp.value = '';
}

// ── socket wiring (idempotent) ──────────────────────────────────────────────
function bindGlobalSocket() {
  if (socketBound) return;
  socketBound = true;
  ['guild:chat:history', 'guild:chat:message', 'guild:fund:update', 'guild:member:online', 'guild:disbanded']
    .forEach((e) => socket.off(e));

  socket.on('guild:chat:history', ({ messages }) => {
    const area = document.getElementById('msgs');
    if (!area) return;
    area.innerHTML = '';
    (messages || []).forEach(appendMsg);
  });
  socket.on('guild:chat:message', (m) => appendMsg(m));
  socket.on('guild:fund:update', ({ guild_id, fund_balance, unlocked }) => {
    if (!detail || guild_id !== detail.id) return;
    const wasUnlocked = detail.unlocked;
    detail.fund_balance = fund_balance;
    detail.unlocked = unlocked;
    detail.progress_pct = Math.min(100, Math.round((fund_balance / 15000) * 100));
    if (!wasUnlocked && unlocked) { toast('Guild unlocked! 🎉', 'green'); loadGuild(); }
    else renderBody();
  });
  socket.on('guild:member:online', ({ user_id, online }) => {
    if (!detail) return;
    const m = detail.members.find((x) => x.user_id === user_id);
    if (m) { m.online = online; renderBody(); }
  });
  socket.on('guild:disbanded', () => { toast('This guild was disbanded', 'red'); setTimeout(() => window.__navigate('social'), 1500); });
}

// ── modals ──────────────────────────────────────────────────────────────────
function openModal(html) {
  const ov = document.getElementById('modal-slot');
  ov.innerHTML = `<div class="modal">${html}</div>`;
  ov.classList.add('show');
  ov.onclick = (e) => { if (e.target === ov) closeModal(); };
}
function closeModal() {
  const ov = document.getElementById('modal-slot');
  ov.classList.remove('show');
  ov.innerHTML = '';
}

function openContribute() {
  openModal(`<h3>Contribute to the Fund</h3>
    <div class="mfield"><label>Amount (CC)</label><input id="ct-amt" type="number" min="1" placeholder="e.g. 500"></div>
    <div class="mbtns"><button class="mcancel" id="ct-x">Cancel</button><button class="mok" id="ct-ok">Contribute</button></div>`);
  document.getElementById('ct-x').onclick = closeModal;
  document.getElementById('ct-ok').onclick = async () => {
    const amt = Math.floor(Number(document.getElementById('ct-amt').value));
    if (!amt || amt <= 0) return toast('Enter a valid amount', 'red');
    try {
      const r = await api.post(`/social/guilds/${guildId}/contribute`, { amount: amt });
      closeModal();
      toast('Contributed! 🙌', 'green');
      detail.fund_balance = r.fund_balance; detail.unlocked = r.unlocked;
      detail.progress_pct = Math.min(100, Math.round((r.fund_balance / 15000) * 100));
      loadGuild();
    } catch (err) { toast(err.message || 'Failed', 'red'); }
  };
}

function openDonate(uid) {
  const m = detail.members.find((x) => x.user_id === uid);
  openModal(`<h3>Donate to ${esc(m.username)}</h3>
    <div class="mfield"><label>Amount (CC) — 10% house cut applies</label><input id="dn-amt" type="number" min="1" placeholder="e.g. 1000"></div>
    <div class="mbtns"><button class="mcancel" id="dn-x">Cancel</button><button class="mok" id="dn-ok">Send</button></div>`);
  document.getElementById('dn-x').onclick = closeModal;
  document.getElementById('dn-ok').onclick = async () => {
    const amt = Math.floor(Number(document.getElementById('dn-amt').value));
    if (!amt || amt <= 0) return toast('Enter a valid amount', 'red');
    try {
      const r = await api.post(`/social/guilds/${guildId}/donate`, { to_user_id: uid, amount: amt });
      closeModal();
      toast(`Sent ${fmt(r.net)} CC to ${m.username} 💸`, 'green');
      loadGuild();
    } catch (err) { toast(err.message || 'Failed', 'red'); }
  };
}

function openPlay(uid) {
  const m = detail.members.find((x) => x.user_id === uid);
  openModal(`<h3>Play with ${esc(m.username)}</h3>
    <div class="mfield"><label>Game</label><select id="pl-game">${PVP_GAMES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}</select></div>
    <div class="mfield"><label>Bet (CC) — no cap between guildmates</label><input id="pl-bet" type="number" min="10" placeholder="min 10"></div>
    <div class="mbtns"><button class="mcancel" id="pl-x">Cancel</button><button class="mok" id="pl-ok">Send Challenge</button></div>`);
  document.getElementById('pl-x').onclick = closeModal;
  document.getElementById('pl-ok').onclick = () => {
    const game = document.getElementById('pl-game').value;
    const bet = Math.floor(Number(document.getElementById('pl-bet').value));
    if (!bet || bet < 10) return toast('Minimum bet is 10 CC', 'red');
    socket.emit('friendly:challenge', { opponent_id: uid, game, bet });
    closeModal();
    // friendly:sent / friendly:error / friendly:launch handled globally in socket.js
  };
}

function openSettings() {
  const g = detail;
  openModal(`<h3>Guild Settings</h3>
    <div class="mfield"><label>Name</label><input id="st-name" maxlength="64" value="${esc(g.name)}"></div>
    <div class="mfield"><label>Tag</label><input id="st-tag" maxlength="8" value="${esc(g.tag)}"></div>
    <div class="mfield"><label>Description</label><input id="st-desc" maxlength="256" value="${esc(g.description || '')}"></div>
    <div class="mtoggle"><div><div style="font-size:13px;color:#fff">Private Guild</div><div style="font-size:10.5px;color:rgba(255,255,255,.28)">New members need approval</div></div><div class="sw ${g.is_private ? 'on' : ''}" id="st-priv"><div class="thumb"></div></div></div>
    <div class="danger"><button id="st-disband">Disband Guild</button></div>
    <div class="mbtns"><button class="mcancel" id="st-x">Cancel</button><button class="mok" id="st-save">Save</button></div>`);
  document.getElementById('st-x').onclick = closeModal;
  document.getElementById('st-priv').onclick = (e) => e.currentTarget.classList.toggle('on');
  document.getElementById('st-save').onclick = async () => {
    const body = {
      name: document.getElementById('st-name').value.trim(),
      tag: document.getElementById('st-tag').value.trim(),
      description: document.getElementById('st-desc').value.trim(),
      is_private: document.getElementById('st-priv').classList.contains('on'),
    };
    try {
      await api.patch(`/social/guilds/${guildId}`, body);
      closeModal(); toast('Saved', 'green'); loadGuild();
    } catch (err) { toast(err.message || 'Failed', 'red'); }
  };
  document.getElementById('st-disband').onclick = async () => {
    if (!confirm('Disband this guild permanently? This cannot be undone.')) return;
    try {
      await api.post(`/social/guilds/${guildId}/disband`);
      closeModal(); toast('Guild disbanded', 'red');
      setTimeout(() => window.__navigate('social'), 1200);
    } catch (err) { toast(err.message || 'Failed', 'red'); }
  };
}

async function openRequests() {
  openModal(`<h3>Pending Requests</h3><div id="req-list" style="max-height:300px;overflow-y:auto"><div style="color:rgba(255,255,255,.3);font-style:italic;padding:12px 0">Loading…</div></div><div class="mbtns"><button class="mcancel" id="rq-x">Close</button></div>`);
  document.getElementById('rq-x').onclick = closeModal;
  await refreshRequests();
}
async function refreshRequests() {
  const list = document.getElementById('req-list');
  if (!list) return;
  try {
    const r = await api.get(`/social/guilds/${guildId}/requests`);
    if (!r.requests.length) { list.innerHTML = `<div style="color:rgba(255,255,255,.3);font-style:italic;padding:12px 0">No pending requests.</div>`; return; }
    list.innerHTML = r.requests.map((rq) => `<div class="reqrow" data-rid="${rq.id}">
      <div class="rn">${esc(rq.username)}</div>
      <button class="rapprove" data-approve="${rq.id}">Approve</button>
      <button class="rreject" data-reject="${rq.id}">Reject</button>
    </div>`).join('');
    list.querySelectorAll('[data-approve]').forEach((b) => b.onclick = () => resolveReq(b.dataset.approve, 'approve'));
    list.querySelectorAll('[data-reject]').forEach((b) => b.onclick = () => resolveReq(b.dataset.reject, 'reject'));
  } catch (err) { list.innerHTML = `<div style="color:#ef4444;padding:12px 0">Couldn't load requests.</div>`; }
}
async function resolveReq(rid, action) {
  try {
    await api.post(`/social/guilds/${guildId}/requests/${rid}/${action}`);
    toast(action === 'approve' ? 'Approved' : 'Rejected', 'green');
    await refreshRequests();
    loadGuild();
  } catch (err) { toast(err.message || 'Failed', 'red'); }
}

async function joinThis() {
  try {
    const res = await api.post(`/social/guilds/${guildId}/join`);
    toast(res.status === 'requested' ? 'Request sent' : 'Joined! 🎉', 'green');
    loadGuild();
  } catch (err) { toast(err.message || 'Could not join', 'red'); }
}
