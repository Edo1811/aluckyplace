import { api } from '../api.js';
import { store, updateBalance } from '../store.js';
import socket from '../socket.js';
import {
  $, fmt, esc, hexA, toast, dockHTML, bindNav, onLeave, amountOf,
  playerFrame, playerName, playerBadge, sheetHTML, openSheet, closeSheets, holdButton, emitBalance,
} from '../ui/core.js';

const GOAL = 15000;
const PVP = [['coinflip', '🪙', 'Coinflip'], ['rps', '✊', 'RPS'], ['uno', '🟥', 'Uno'], ['highlow', '🔢', 'High/Low'], ['duels', '⚔️', 'Duels']];
const ICONS = ['🏰', '🎰', '🃏', '🎲', '💎', '👑', '🔥', '🐉', '⚡', '🍀', '💀', '🌙'];
const BGS = ['#10b981', '#D4AF37', '#3b82f6', '#a855f7', '#ef4444', '#f97316', '#0ea5e9', '#64748b'];

/** Guild crest tile — shared with the social guild browser. */
export function guildIcon(g, size) {
  const bg = (g && g.icon_bg) || '#10b981';
  return `<div class="gicon" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.29)}px;font-size:${Math.round(size * 0.5)}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12),0 8px 22px rgba(0,0,0,.45);background:linear-gradient(145deg,${hexA(bg, .55)},${hexA(bg, .14)})">${esc((g && g.icon) || '🏰')}</div>`;
}

const STYLE = `
.gl{display:flex;flex-direction:column;flex:1;min-height:0}
.ghead{display:flex;align-items:center;gap:12px;padding:14px 14px 10px}
.gmeta{flex:1;min-width:0}
.gname{display:flex;align-items:center;gap:7px;font-size:19px;font-weight:700;line-height:1.1}
.gname span.n{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gtag{font-size:10px;font-weight:700;letter-spacing:.1em;padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55);flex-shrink:0}
.glock{width:12px;height:12px;stroke:var(--amber);fill:none;stroke-width:1.8;flex-shrink:0}
.gsub{font-size:11.5px;color:rgba(255,255,255,.34);margin-top:4px;display:flex;align-items:center;gap:6px}
.odot{width:6px;height:6px;border-radius:50%;background:var(--em);box-shadow:0 0 6px var(--em)}
.hbtn{width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.hbtn svg{width:17px;height:17px;stroke:rgba(255,255,255,.65);fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.gdesc{font-size:12px;font-style:italic;color:rgba(255,255,255,.36);padding:0 16px 10px;line-height:1.45}
.fund{margin:0 12px;padding:13px 14px;border-radius:16px;border:1px solid var(--line);background:var(--card)}
.fund.done{border-color:rgba(16,185,129,.22);background:linear-gradient(120deg,rgba(16,185,129,.08),rgba(16,185,129,.02))}
.fund-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}
.fund-t{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3);white-space:nowrap}
.fund-v{font-size:17px;font-weight:700;color:var(--em);white-space:nowrap}
.fund-v small{font-size:11px;color:rgba(255,255,255,.28);font-weight:400}
.fund-bot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px}
.fund-note{font-size:11.5px;color:rgba(255,255,255,.38)}
.fund.done .bar i{background:linear-gradient(90deg,#059669,#10b981,#6ee7b7,#10b981);background-size:200% 100%;animation:fundShine 3s linear infinite}
@keyframes fundShine{to{background-position:200% 0}}
#fundBtn{white-space:nowrap}
.reqbar{margin:10px 12px 0;padding:10px 13px;border-radius:13px;border:1px solid rgba(245,158,11,.28);background:rgba(245,158,11,.07);display:flex;align-items:center;gap:10px;cursor:pointer;font-size:12.5px;color:#fcd34d;width:calc(100% - 24px);text-align:left}
.reqbar b{flex:1}
.gbody{flex:1;min-height:0;display:flex;margin-top:10px;border-top:1px solid var(--line)}
.chatcol{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
.msgs{flex:1;overflow-y:auto;padding:14px 12px 8px 16px;scrollbar-width:none;display:flex;flex-direction:column;gap:12px}
.msgs::-webkit-scrollbar{display:none}
.vanish{align-self:center;font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.2);padding:4px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.05)}
.m{display:flex;gap:9px;align-items:flex-end;max-width:88%}
.m .mav{cursor:pointer;flex-shrink:0;margin-bottom:-2px}
.m .mcol{min-width:0}
.m .mwho{display:flex;align-items:center;gap:6px;margin:0 0 4px 3px}
.m .mtime{font-size:9.5px;color:rgba(255,255,255,.22)}
.m .bub{padding:9px 13px;border-radius:16px 16px 16px 5px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);font-size:13.5px;line-height:1.45;overflow-wrap:anywhere;color:rgba(255,255,255,.88)}
.m.me{align-self:flex-end;flex-direction:row-reverse}
.m.me .mwho{justify-content:flex-end;margin:0 3px 4px 0}
.m.me .bub{background:rgba(16,185,129,.16);border-color:rgba(16,185,129,.25);border-radius:16px 16px 5px 16px;color:#eafff6}
.m.cont .mav{visibility:hidden}
.m.cont .mwho{display:none}
.sys{align-self:center;padding:7px 13px;border-radius:14px;font-size:12px;color:rgba(255,255,255,.5);background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.05);max-width:92%;text-align:center}
.sys.gold{color:#e9d27e;border-color:rgba(212,175,55,.2);background:rgba(212,175,55,.05)}
.sys.em{color:#6ee7b7;border-color:rgba(16,185,129,.2);background:rgba(16,185,129,.05)}
.compose{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line);align-items:center}
.compose .inp{border-radius:22px;padding:11px 16px;font-size:13.5px}
.send{width:42px;height:42px;border-radius:50%;background:var(--em);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0}
.send svg{width:17px;height:17px;stroke:#03150e;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.lockveil{position:absolute;inset:0;z-index:5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:linear-gradient(to bottom,rgba(5,5,5,.55),rgba(5,5,5,.92) 55%)}
.lockveil svg{width:40px;height:40px;stroke:rgba(255,255,255,.55);fill:none;stroke-width:1.3}
.lockveil h3{font-size:20px}
.lockveil p{font-size:12.5px;color:rgba(255,255,255,.42);max-width:290px;line-height:1.55}
.chatcol.locked .msgs{filter:blur(3px) grayscale(.7);opacity:.45;pointer-events:none}
.chatcol.locked .compose{opacity:.3;pointer-events:none}
.mem{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:13px;cursor:pointer;transition:background .15s}
.mem:hover{background:rgba(255,255,255,.035)}
.mem .mi{flex:1;min-width:0}
.mem .mrow{display:flex;align-items:center;gap:6px;min-width:0}
.mem .mrow .pname{overflow:hidden;text-overflow:ellipsis}
.mem .mbal{font-size:11px;color:rgba(255,255,255,.3);margin-top:2px}
.role{font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;padding:2px 6px;border-radius:6px;font-weight:700;flex-shrink:0}
.role.owner{background:rgba(212,175,55,.14);color:var(--gold);border:1px solid rgba(212,175,55,.3)}
.role.you{background:rgba(16,185,129,.12);color:var(--em);border:1px solid rgba(16,185,129,.28)}
.on-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.on-dot.on{background:var(--em);box-shadow:0 0 6px var(--em)}
.on-dot.off{background:rgba(255,255,255,.14)}
.memhead{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.22);padding:14px 10px 6px}
.memdesc{font-size:12px;font-style:italic;color:rgba(255,255,255,.4);line-height:1.5;padding:0 10px 4px}
.side{display:none}
.mc-top{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;padding:6px 0 4px}
.mc-stats{display:flex;justify-content:center;gap:26px;margin:16px 0 4px}
.mc-v{font-size:17px;font-weight:700}
.mc-l{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.26);margin-top:3px}
.panel{margin-top:16px;padding:14px;border-radius:14px;border:1px solid var(--line);background:var(--card)}
.panel h4{font-size:13px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:baseline}
.panel h4 small{font-size:10.5px;font-weight:400;color:rgba(255,255,255,.32)}
.panel p{font-size:11.5px;color:rgba(255,255,255,.34);margin-bottom:11px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer}
.chip.on{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.35);color:var(--em)}
.gamegrid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px}
.gg{padding:9px 2px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);font-size:10.5px;text-align:center;cursor:pointer;color:rgba(255,255,255,.55)}
.gg b{display:block;font-size:17px;margin-bottom:3px}
.gg.on{background:rgba(16,185,129,.13);border-color:rgba(16,185,129,.35);color:var(--em)}
.uses{display:inline-flex;gap:4px;vertical-align:middle}
.uses i{width:16px;height:5px;border-radius:3px;background:rgba(255,255,255,.1)}
.uses i.used{background:var(--gold)}
.iconpick{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}
.ip{aspect-ratio:1;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:21px;cursor:pointer;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07)}
.ip.on{border-color:var(--em);box-shadow:0 0 0 2px rgba(16,185,129,.25)}
.swatches{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.sw{width:30px;height:30px;border-radius:50%;cursor:pointer;border:2px solid transparent}
.sw.on{border-color:#fff}
.fld{margin-top:16px}
.tog{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;border:1px solid var(--line);background:var(--card);margin-top:16px;cursor:pointer}
.tog .tx{flex:1}.tog .tx b{font-size:13.5px;display:block}.tog .tx span{font-size:11px;color:rgba(255,255,255,.34)}
.switch{width:44px;height:26px;border-radius:13px;background:rgba(255,255,255,.12);position:relative;transition:background .2s;flex-shrink:0}
.switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.switch.on{background:var(--em)}.switch.on::after{transform:translateX(18px)}
.danger{margin-top:22px;padding:14px;border-radius:13px;border:1px solid rgba(239,68,68,.22);background:rgba(239,68,68,.04)}
.danger h5{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#f87171;margin-bottom:6px}
.danger p{font-size:11.5px;color:rgba(255,255,255,.36);margin-bottom:11px}
.holdbtn{position:relative;overflow:hidden;touch-action:none;user-select:none}
.holdbtn i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(239,68,68,.35)}
.holdbtn span{position:relative}
.preview-g{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--line)}
.rq{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--line)}
.rq:last-child{border-bottom:none}
.rq .mi{flex:1;min-width:0}
.noguild{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;padding:24px}
.noguild h2{font-size:22px}
.noguild p{font-size:13px;color:rgba(255,255,255,.4);max-width:280px;line-height:1.5}
@media(max-width:899px){
  .gdesc{display:none}
  .fund.done{display:grid;grid-template-columns:1fr auto;grid-template-areas:'top btn' 'bar bar';column-gap:10px;row-gap:7px;padding:10px 12px;align-items:center}
  .fund.done .fund-top{grid-area:top;margin:0}
  .fund.done .bar{grid-area:bar;height:4px}
  .fund.done .fund-bot{display:contents}
  .fund.done .fund-note{display:none}
  .fund.done #fundBtn{grid-area:btn}
  .fund.done .fund-v{font-size:15px}
}
@media(min-width:900px){
  .ghead{padding:18px 20px 10px}
  .gdesc{padding:0 22px 12px}
  .fund{margin:0 20px}
  .reqbar{margin:10px 20px 0;width:calc(100% - 40px)}
  #memBtn{display:none}
  .side{display:flex;flex-direction:column;width:300px;flex-shrink:0;border-left:1px solid var(--line);overflow-y:auto;padding:6px 10px 14px;scrollbar-width:none}
  .msgs{padding:18px 22px 10px}
  .compose{padding:12px 20px}
}
`;

let guildId = null, G = null, log = [], draft = {}, pick = { game: 0, bet: 1000, don: 1000 };
const LOCK_SVG = '<svg class="glock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>';
const mem = (name) => G?.members.find((m) => m.username === name);
const isMe = (m) => m && m.user_id === store.user?.id;

export async function renderGuild(app, data) {
  G = null; log = [];
  app.innerHTML = `<style>${STYLE}</style><div class="page-load">Loading…</div>${dockHTML('social')}`;
  bindNav(app);
  try {
    guildId = data && data.guildId ? data.guildId : null;
    if (!guildId) guildId = (await api.get('/social/guilds/mine')).guild?.id || null;
  } catch { guildId = null; }
  if (!guildId) {
    app.innerHTML = `<style>${STYLE}</style><div class="noguild"><div style="font-size:42px">🏰</div><h2>You're not in a guild yet</h2>
      <p>Join one or start your own. Fund it to 15,000 CC together and chat, donations and friendly matches open up.</p>
      <button class="btn em" id="browse">Browse guilds</button></div>${dockHTML('social')}`;
    bindNav(app); $('browse').addEventListener('click', () => window.__navigate('social', { tab: 'guilds' }));
    return;
  }
  shell(app);
  bindSocket();
  await load();
}

function shell(app) {
  app.innerHTML = `<style>${STYLE}</style>
  <div class="gl wrap">
    <div class="ghead" id="ghead"></div>
    <div class="gdesc" id="gdesc"></div>
    <div class="fund" id="fund"></div>
    <div id="reqslot"></div>
    <div class="gbody">
      <div class="chatcol" id="chatcol">
        <div class="msgs" id="msgs"><div class="vanish">⏳ Messages vanish after 24 hours</div></div>
        <div class="compose"><input class="inp" id="msgIn" placeholder="Say something…" maxlength="500" autocomplete="off">
          <button class="send" id="sendBtn" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/></svg></button></div>
      </div>
      <aside class="side" id="side"></aside>
    </div>
  </div>
  ${dockHTML('social')}
  ${sheetHTML('shMembers', 'Members', '<div id="memList"></div>')}
  ${sheetHTML('shMember', 'Member', '<div id="mcBody"></div>')}
  ${sheetHTML('shFund', 'Contribute to the fund', `
    <div class="lbl">Amount</div>
    <input class="inp" id="fundIn" inputmode="numeric" value="1,000" style="font-size:24px;font-weight:700;text-align:center;padding:16px">
    <div class="chips" style="margin-top:10px" id="fundChips"></div>
    <div class="panel"><h4>After this <small id="fundAfterPct"></small></h4><div class="bar" style="margin-top:9px"><i id="fundAfterBar"></i></div><p style="margin:9px 0 0" id="fundAfterTx"></p></div>
    <p style="font-size:11px;color:rgba(255,255,255,.26);margin-top:12px;font-style:italic">Contributions are permanent. The fund belongs to the guild, not to you.</p>`,
    '<button class="btn" data-close>Cancel</button><button class="btn em" id="fundGo">Contribute</button>')}
  ${sheetHTML('shSettings', 'Guild settings', `
    <div class="preview-g" id="setPreview"></div>
    <div class="fld"><div class="lbl">Icon</div><div class="iconpick" id="iconPick"></div><div class="swatches" id="swatches"></div></div>
    <div class="fld"><div class="lbl">Name</div><input class="inp" id="setName" maxlength="64"></div>
    <div class="fld"><div class="lbl">Tag · up to 8 letters</div><input class="inp" id="setTag" maxlength="8" style="text-transform:uppercase;letter-spacing:.12em"></div>
    <div class="fld"><div class="lbl">Description</div><textarea class="inp" id="setDesc" rows="3" maxlength="256" style="resize:none;line-height:1.45"></textarea></div>
    <div class="tog" id="setPriv"><div class="tx"><b>Private guild</b><span>New members need your approval</span></div><div class="switch" id="privSw"></div></div>
    <div class="danger"><h5>Danger zone</h5><p>Disbanding deletes the guild, its chat and its fund. Members are kicked. This cannot be undone.</p>
      <button class="btn red block holdbtn" id="disband"><i></i><span>Hold to disband</span></button></div>`,
    '<button class="btn" data-close>Cancel</button><button class="btn em" id="setSave">Save changes</button>')}
  ${sheetHTML('shReq', 'Join requests', '<div id="reqList"></div>')}`;
  bindNav(app);
  $('sendBtn').addEventListener('click', send);
  $('msgIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  wireFund(); wireSettings();
}

async function load() {
  try { G = (await api.get(`/social/guilds/${guildId}`)).guild; }
  catch (err) {
    $('ghead').innerHTML = `<div class="empty" style="flex:1">${esc(err.message || "Couldn't load this guild")}</div>`;
    return;
  }
  renderAll();
  if (G.is_member && G.unlocked) socket.emit('guild:enter');
}
function renderAll() { renderHead(); renderFund(); renderReqs(); renderChatState(); renderMembers($('side')); }

// ── header / fund / requests ────────────────────────────────────────────────
function renderHead() {
  const on = G.members.filter((m) => m.online).length;
  $('ghead').innerHTML = `${guildIcon(G, 52)}
    <div class="gmeta"><div class="gname"><span class="n">${esc(G.name)}</span><span class="gtag">${esc(G.tag)}</span>${G.is_private ? LOCK_SVG : ''}</div>
      <div class="gsub"><span class="odot"></span>${on} online · ${G.member_count} members</div></div>
    <button class="hbtn" id="memBtn" aria-label="Members"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="7.5" r="2.5"/><path d="M21 17.5c0-2.6-1.8-4.6-4-4.6"/></svg></button>
    ${G.is_owner ? `<button class="hbtn" id="setBtn" aria-label="Settings"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>` : ''}`;
  $('gdesc').textContent = G.description || '';
  $('gdesc').style.display = G.description ? '' : 'none';
  $('memBtn').addEventListener('click', () => { renderMembers($('memList')); openSheet('shMembers'); });
  $('setBtn')?.addEventListener('click', openSettings);
}
function renderFund() {
  const f = Number(G.fund_balance), done = G.unlocked, pct = Math.min(100, f / GOAL * 100);
  const el = $('fund'); el.className = `fund${done ? ' done' : ''}`;
  el.innerHTML = `<div class="fund-top"><div class="fund-t">Guild fund</div><div class="fund-v">${fmt(f)} <small>/ ${fmt(GOAL)} CC</small></div></div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="fund-bot"><div class="fund-note">${done ? 'Unlocked · keep stacking it to flex' : `${fmt(Math.max(0, GOAL - f))} CC until chat, donations and challenges unlock`}</div>
    ${G.is_member ? `<button class="btn ${done ? '' : 'em '}sm" id="fundBtn">+ Contribute</button>` : ''}</div>`;
  $('fundBtn')?.addEventListener('click', openFund);
}
function renderReqs() {
  const n = G.is_owner && G.pending_count;
  $('reqslot').innerHTML = n ? `<button class="reqbar" id="reqBar"><b>${n} join request${n > 1 ? 's' : ''} waiting</b><span>Review →</span></button>` : '';
  $('reqBar')?.addEventListener('click', openRequests);
}

// ── chat ────────────────────────────────────────────────────────────────────
function renderChatState() {
  const col = $('chatcol');
  const locked = !G.is_member || !G.unlocked;
  col.classList.toggle('locked', locked);
  col.querySelector('.lockveil')?.remove();
  if (!locked) return;
  const v = document.createElement('div'); v.className = 'lockveil';
  if (!G.is_member) {
    v.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="7.5" r="2.5"/><path d="M21 17.5c0-2.6-1.8-4.6-4-4.6"/></svg>
      <h3>${G.is_private ? 'Invite-only guild' : 'Join to chat'}</h3><p>${G.is_private ? 'The owner approves every new member.' : 'Members chat, donate to each other and play friendly matches.'}</p>
      <button class="btn ${G.is_private ? 'amber' : 'em'}" id="joinThis">${G.is_private ? 'Request to join' : 'Join guild'}</button>`;
  } else {
    v.innerHTML = `<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>
      <h3>Chat is locked</h3><p>Fund the guild to ${fmt(GOAL)} CC and chat, donations and friendly challenges all open up.</p>
      <button class="btn em" id="veilFund">Contribute to unlock</button>`;
  }
  col.appendChild(v);
  $('veilFund')?.addEventListener('click', openFund);
  $('joinThis')?.addEventListener('click', joinThis);
}
const hhmm = (ts) => { const d = ts ? new Date(ts) : new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function msgHTML(e, prev) {
  if (e.sys) return `<div class="sys ${e.kind || ''}">${e.html}</div>`;
  const m = mem(e.username), cos = m ? m.cosmetics : null, me = e.username === store.user?.username;
  const cont = prev && !prev.sys && prev.username === e.username;
  const t = `<span class="mtime">${hhmm(e.ts)}</span>`;
  return `<div class="m${me ? ' me' : ''}${cont ? ' cont' : ''}"><div class="mav" data-mem="${esc(e.username)}">${playerFrame(e.username, cos, 34)}</div>
    <div class="mcol"><div class="mwho">${me ? t : ''}${playerName(e.username, cos, 13)}${playerBadge(cos)}${me ? '' : t}</div>
    <div class="bub">${esc(e.text)}</div></div></div>`;
}
function push(e) {
  const box = $('msgs'); if (!box) return;
  const prev = log[log.length - 1]; log.push(e);
  const d = document.createElement('div'); d.innerHTML = msgHTML(e, prev);
  const el = d.firstElementChild; box.appendChild(el);
  el.querySelectorAll('[data-mem]').forEach((a) => a.addEventListener('click', () => openMember(a.dataset.mem)));
  el.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'ease-out' });
  box.scrollTop = box.scrollHeight;
}
function send() {
  const inp = $('msgIn'), text = inp.value.trim();
  if (!text || !G?.unlocked || !G.is_member) return;
  socket.emit('guild:chat:send', { text }); inp.value = '';
}

// ── socket (removed again when the page is left) ────────────────────────────
function bindSocket() {
  const H = {
    'guild:chat:history': ({ messages }) => {
      const box = $('msgs'); if (!box) return;
      box.innerHTML = '<div class="vanish">⏳ Messages vanish after 24 hours</div>'; log = [];
      (messages || []).forEach(push);
      if (document.fonts) document.fonts.ready.then(() => { if ($('msgs')) $('msgs').scrollTop = 1e6; });
    },
    'guild:chat:message': (m) => push(m),
    'guild:fund:update': ({ guild_id, fund_balance, unlocked }) => {
      if (!G || guild_id !== G.id) return;
      const was = G.unlocked; G.fund_balance = fund_balance; G.unlocked = unlocked;
      if (!was && unlocked) { toast('Guild unlocked 🎉', 'em'); load(); } else renderFund();
    },
    'guild:member:online': ({ user_id, online }) => {
      const m = G?.members.find((x) => x.user_id === user_id); if (!m) return;
      m.online = online; renderHead(); renderMembers($('side'));
    },
    'guild:disbanded': () => { toast('This guild was disbanded', 'red'); setTimeout(() => window.__navigate('social', { tab: 'guilds' }), 1500); },
  };
  Object.entries(H).forEach(([ev, fn]) => { socket.off(ev); socket.on(ev, fn); });
  onLeave(() => Object.keys(H).forEach((ev) => socket.off(ev)));
}

// ── members ─────────────────────────────────────────────────────────────────
function memberRow(m) {
  return `<div class="mem" data-mem="${esc(m.username)}">${playerFrame(m.username, m.cosmetics, 40)}
    <div class="mi"><div class="mrow">${playerName(m.username, m.cosmetics, 14)}${playerBadge(m.cosmetics)}
      ${m.is_owner ? '<span class="role owner">Owner</span>' : ''}${isMe(m) ? '<span class="role you">You</span>' : ''}</div>
    <div class="mbal">${fmt(m.cc_balance)} CC</div></div>
    <span class="on-dot ${m.online ? 'on' : 'off'}"></span></div>`;
}
function renderMembers(host) {
  if (!host || !G) return;
  const on = G.members.filter((m) => m.online), off = G.members.filter((m) => !m.online);
  host.innerHTML = (host.id === 'memList' && G.description ? `<div class="memdesc">${esc(G.description)}</div>` : '')
    + `<div class="memhead">Online — ${on.length}</div>${on.map(memberRow).join('')}`
    + `<div class="memhead">Offline — ${off.length}</div>${off.map(memberRow).join('')}`
    + `<div style="font-size:11px;color:rgba(255,255,255,.22);font-style:italic;padding:12px 10px 0">${!G.is_member ? 'Join to donate and play' : G.unlocked ? 'Tap a member to donate or challenge' : 'Donations and challenges unlock with the fund'}</div>`;
  host.querySelectorAll('[data-mem]').forEach((r) => r.addEventListener('click', () => openMember(r.dataset.mem)));
}
function openMember(name) {
  const m = mem(name); if (!m) return;
  const you = isMe(m), canAct = G.is_member && G.unlocked && !you;
  const left = Math.max(0, 2 - (m.donations_today || 0));
  let h = `<div class="mc-top">${playerFrame(m.username, m.cosmetics, 100)}<div style="display:flex;align-items:center;gap:7px;margin-top:8px">${playerName(m.username, m.cosmetics, 24)}${playerBadge(m.cosmetics)}</div></div>
    <div class="mc-stats"><div><div class="mc-v" style="color:var(--em)">${fmt(m.cc_balance)}</div><div class="mc-l">Credits</div></div>
    <div><div class="mc-v">${m.online ? '<span style="color:var(--em)">Online</span>' : '<span style="color:rgba(255,255,255,.4)">Away</span>'}</div><div class="mc-l">Status</div></div></div>`;
  if (you) h += '<div class="panel" style="text-align:center"><p style="margin:0">That\'s you. Tap someone else to donate or challenge them.</p></div>';
  else if (!canAct) h += `<div class="panel" style="text-align:center"><p style="margin:0">${G.is_member ? `Donations and friendly challenges open once the fund hits ${fmt(GOAL)} CC.` : 'Join the guild to donate or play.'}</p></div>`;
  else {
    h += `<div class="panel"><h4>Donate CC <small><span class="uses">${[0, 1].map((i) => `<i class="${i < (m.donations_today || 0) ? 'used' : ''}"></i>`).join('')}</span></small></h4>
      <p>${left ? `They can receive ${left} more today · 10% house cut` : 'They\'ve hit their 2 donations for today'}</p>
      <div class="chips" id="donChips">${[500, 1000, 5000, 10000].map((v) => `<button class="chip${v === pick.don ? ' on' : ''}" data-v="${v}">${fmt(v)}</button>`).join('')}</div>
      <button class="btn gold block" style="margin-top:11px" id="donGo" ${left ? '' : 'disabled'}>${left ? `Send ${fmt(pick.don)} CC · they get ${fmt(Math.floor(pick.don * 0.9))}` : 'Daily limit reached'}</button></div>
      <div class="panel"><h4>Friendly challenge <small>skips matchmaking</small></h4><p>No bet cap between guildmates. Minimum 10 CC.</p>
      <div class="gamegrid" id="gameGrid">${PVP.map((g, i) => `<div class="gg${i === pick.game ? ' on' : ''}" data-g="${i}"><b>${g[1]}</b>${g[2]}</div>`).join('')}</div>
      <div class="chips" id="betChips">${[10, 1000, 5000, 25000].map((v) => `<button class="chip${v === pick.bet ? ' on' : ''}" data-v="${v}">${fmt(v)}</button>`).join('')}</div>
      <button class="btn em block" style="margin-top:11px" id="chGo" ${m.online ? '' : 'disabled'}>${m.online ? `Challenge to ${PVP[pick.game][2]} · ${fmt(pick.bet)} CC` : 'They\'re offline'}</button></div>`;
  }
  $('mcBody').innerHTML = h;
  if (canAct) {
    $('donChips').querySelectorAll('[data-v]').forEach((c) => c.addEventListener('click', () => { pick.don = Number(c.dataset.v); openMember(name); }));
    $('betChips').querySelectorAll('[data-v]').forEach((c) => c.addEventListener('click', () => { pick.bet = Number(c.dataset.v); openMember(name); }));
    $('gameGrid').querySelectorAll('[data-g]').forEach((c) => c.addEventListener('click', () => { pick.game = Number(c.dataset.g); openMember(name); }));
    $('donGo').addEventListener('click', async () => {
      $('donGo').disabled = true;
      try {
        const r = await api.post(`/social/guilds/${guildId}/donate`, { to_user_id: m.user_id, amount: pick.don });
        if (r.cc_balance !== undefined) { updateBalance({ cc_balance: r.cc_balance }); emitBalance(); }
        closeSheets(); toast(`Sent ${fmt(r.net ?? pick.don)} CC to ${m.username}`, 'gold');
        push({ sys: 1, kind: 'em', html: `<b>${esc(store.user.username)}</b> donated <b>${fmt(pick.don)} CC</b> to <b>${esc(m.username)}</b>` });
        m.donations_today = (m.donations_today || 0) + 1;
      } catch (err) { toast(err.message || 'Donation failed', 'red'); $('donGo').disabled = false; }
    });
    $('chGo').addEventListener('click', () => {
      socket.emit('friendly:challenge', { opponent_id: m.user_id, game: PVP[pick.game][0], bet: pick.bet });
      closeSheets(); // friendly:sent / :error / :launch are handled app-wide in socket.js
    });
  }
  $('shMember').querySelector('h2').textContent = you ? 'Your card' : 'Member';
  openSheet('shMember');
}

// ── fund ────────────────────────────────────────────────────────────────────
function wireFund() {
  $('fundIn').addEventListener('input', (e) => { const v = amountOf(e.target.value); e.target.value = v ? fmt(v) : ''; fundPreview(); });
  $('fundGo').addEventListener('click', async () => {
    const a = amountOf($('fundIn').value); if (!a) return;
    $('fundGo').disabled = true;
    const was = G.unlocked;
    try {
      const r = await api.post(`/social/guilds/${guildId}/contribute`, { amount: a });
      if (r.cc_balance !== undefined) updateBalance({ cc_balance: r.cc_balance }); else updateBalance({ cc_balance: Number(store.ccBalance) - a });
      emitBalance(); closeSheets();
      G.fund_balance = r.fund_balance ?? Number(G.fund_balance) + a; G.unlocked = r.unlocked ?? G.unlocked;
      toast(!was && G.unlocked ? 'Guild unlocked 🎉' : `Contributed ${fmt(a)} CC`, 'em');
      if (!was && G.unlocked) await load(); else { renderFund(); push({ sys: 1, kind: 'gold', html: `<b>${esc(store.user.username)}</b> put <b>${fmt(a)} CC</b> into the guild fund` }); }
    } catch (err) { toast(err.message || 'Contribution failed', 'red'); }
    $('fundGo').disabled = false;
  });
}
function fundPreview() {
  const cur = Number(G.fund_balance), a = amountOf($('fundIn').value), after = cur + a;
  $('fundAfterBar').style.width = `${Math.min(100, after / GOAL * 100)}%`;
  $('fundAfterPct').textContent = `${Math.floor(Math.min(after / GOAL * 100, 9999))}%`;
  $('fundAfterTx').textContent = after >= GOAL ? (cur < GOAL ? 'This unlocks the guild. Everyone will see your name on it.' : 'Already unlocked — this is pure flex.') : `${fmt(GOAL - after)} CC still to go after this`;
  const tooMuch = a > Number(store.ccBalance);
  $('fundGo').disabled = !a || tooMuch;
  $('fundGo').textContent = tooMuch ? 'Not enough CC' : `Contribute ${fmt(a)} CC`;
}
function openFund() {
  const cur = Number(G.fund_balance);
  $('fundChips').innerHTML = [500, 1000, 5000].map((v) => `<button class="chip" data-v="${v}">${fmt(v)}</button>`).join('') + '<button class="chip" data-v="max">Max</button>';
  $('fundChips').querySelectorAll('[data-v]').forEach((c) => c.addEventListener('click', () => {
    const bal = Number(store.ccBalance);
    const v = c.dataset.v === 'max' ? (cur < GOAL ? Math.min(bal, GOAL - cur) : bal) : Number(c.dataset.v);
    $('fundIn').value = fmt(v); fundPreview();
  }));
  fundPreview(); openSheet('shFund');
}

// ── settings ────────────────────────────────────────────────────────────────
function setPreview() {
  $('setPreview').innerHTML = `${guildIcon(draft, 46)}<div style="min-width:0"><div class="gname" style="font-size:16px"><span class="n">${esc(draft.name || 'Unnamed')}</span><span class="gtag">${esc(draft.tag || '—')}</span>${draft.is_private ? LOCK_SVG : ''}</div>
    <div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:3px">How everyone sees it</div></div>`;
}
function openSettings() {
  draft = { name: G.name, tag: G.tag, description: G.description || '', is_private: G.is_private, icon: G.icon || '🏰', icon_bg: G.icon_bg || '#10b981' };
  $('iconPick').innerHTML = ICONS.map((i) => `<div class="ip${i === draft.icon ? ' on' : ''}" data-i="${i}">${i}</div>`).join('');
  $('swatches').innerHTML = BGS.map((b) => `<div class="sw${b === draft.icon_bg ? ' on' : ''}" data-b="${b}" style="background:${b}"></div>`).join('');
  $('iconPick').querySelectorAll('[data-i]').forEach((e) => e.addEventListener('click', () => { draft.icon = e.dataset.i; $('iconPick').querySelectorAll('.ip').forEach((x) => x.classList.toggle('on', x === e)); setPreview(); }));
  $('swatches').querySelectorAll('[data-b]').forEach((e) => e.addEventListener('click', () => { draft.icon_bg = e.dataset.b; $('swatches').querySelectorAll('.sw').forEach((x) => x.classList.toggle('on', x === e)); setPreview(); }));
  $('setName').value = draft.name; $('setTag').value = draft.tag; $('setDesc').value = draft.description;
  $('privSw').classList.toggle('on', draft.is_private);
  setPreview(); openSheet('shSettings');
}
function wireSettings() {
  $('setName').addEventListener('input', (e) => { draft.name = e.target.value; setPreview(); });
  $('setTag').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s/g, ''); draft.tag = e.target.value; setPreview(); });
  $('setDesc').addEventListener('input', (e) => { draft.description = e.target.value; });
  $('setPriv').addEventListener('click', () => { draft.is_private = !draft.is_private; $('privSw').classList.toggle('on', draft.is_private); setPreview(); });
  $('setSave').addEventListener('click', async () => {
    if (!draft.name.trim() || !draft.tag.trim()) return toast('Name and tag are required', 'red');
    $('setSave').disabled = true;
    try {
      await api.patch(`/social/guilds/${guildId}`, { name: draft.name.trim(), tag: draft.tag.trim(), description: draft.description.trim(), is_private: draft.is_private, icon: draft.icon, icon_bg: draft.icon_bg });
      closeSheets(); toast('Guild updated', 'em'); await load();
    } catch (err) { toast(err.message || 'Failed to save', 'red'); }
    $('setSave').disabled = false;
  });
  holdButton($('disband'), 1600, async () => {
    try {
      await api.post(`/social/guilds/${guildId}/disband`);
      closeSheets(); toast('Guild disbanded', 'red');
      setTimeout(() => window.__navigate('social', { tab: 'guilds' }), 1000);
    } catch (err) { toast(err.message || 'Failed to disband', 'red'); }
  }, 'Keep holding…');
}

// ── requests + joining ──────────────────────────────────────────────────────
async function openRequests() {
  $('reqList').innerHTML = '<div class="page-load" style="padding:24px">Loading…</div>';
  openSheet('shReq');
  try {
    const r = await api.get(`/social/guilds/${guildId}/requests`);
    $('reqList').innerHTML = r.requests.length ? r.requests.map((rq) => `<div class="rq">${playerFrame(rq.username, null, 40)}
      <div class="mi"><div>${playerName(rq.username, null, 14)}</div><div style="font-size:11px;color:rgba(255,255,255,.3);margin-top:2px">asked ${new Date(rq.created_at).toLocaleDateString()}</div></div>
      <button class="btn sm red" data-act="reject" data-id="${rq.id}">Decline</button><button class="btn sm em" data-act="approve" data-id="${rq.id}">Accept</button></div>`).join('')
      : '<div class="empty">No one is waiting.</div>';
    $('reqList').querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      try {
        await api.post(`/social/guilds/${guildId}/requests/${b.dataset.id}/${b.dataset.act}`);
        toast(b.dataset.act === 'approve' ? 'Accepted' : 'Declined', b.dataset.act === 'approve' ? 'em' : '');
        await load(); openRequests();
      } catch (err) { toast(err.message || 'Failed', 'red'); b.disabled = false; }
    }));
  } catch (err) { $('reqList').innerHTML = `<div class="empty">${esc(err.message)}</div>`; }
}
async function joinThis() {
  try {
    const r = await api.post(`/social/guilds/${guildId}/join`);
    toast(r.status === 'requested' ? 'Request sent — waiting for approval' : 'Joined 🎉', r.status === 'requested' ? 'amber' : 'em');
    if (r.status !== 'requested') await load();
  } catch (err) { toast(err.message || 'Could not join', 'red'); }
}

