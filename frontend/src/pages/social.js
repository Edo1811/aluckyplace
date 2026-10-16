import { api } from '../api.js';
import { store } from '../store.js';
import {
  $, fmt, esc, timeAgo, toast, dockHTML, bindNav, balanceHTML, bindBalance,
  playerFrame, playerName, playerBadge, sheetHTML, openSheet, closeSheets,
} from '../ui/core.js';
import { gameName } from '../ui/games-meta.js';
import { guildIcon } from './guild.js';

const STYLE = `
.top2{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px}
.top2 h1{font-size:24px}
.pane{display:none}.pane.on{display:block}
.podium{display:grid;grid-template-columns:1fr 1.18fr 1fr;align-items:end;gap:8px;margin:8px 12px 0;padding:22px 8px 0;border-radius:22px;background:radial-gradient(90% 70% at 50% 100%,rgba(212,175,55,.12),rgba(212,175,55,0) 70%),#070707;border:1px solid rgba(212,175,55,.14);overflow:hidden}
.pod{display:flex;flex-direction:column;align-items:center;text-align:center;gap:5px;cursor:pointer;min-width:0}
.pod .nm{display:flex;align-items:center;gap:4px;max-width:100%;justify-content:center;overflow:hidden}
.pod .nm .pname{overflow:hidden;text-overflow:ellipsis}
.pod .bl{font-size:12px;font-weight:700;color:var(--em)}
.pod .step{width:100%;border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;font-size:22px;font-weight:700}
.pod.p1 .step{height:74px;background:linear-gradient(180deg,rgba(212,175,55,.32),rgba(212,175,55,.06));color:var(--gold)}
.pod.p2 .step{height:50px;background:linear-gradient(180deg,rgba(203,213,225,.2),rgba(203,213,225,.04));color:#cbd5e1}
.pod.p3 .step{height:36px;background:linear-gradient(180deg,rgba(184,115,51,.26),rgba(184,115,51,.05));color:#e0a370}
.weekly{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:10px;background:rgba(212,175,55,.14);border:1px solid rgba(212,175,55,.3);font-size:9.5px;font-weight:700;color:var(--gold);white-space:nowrap}
.lbtools{display:flex;gap:8px;margin:14px 12px 4px}
.lbtools .inp{padding:10px 14px;font-size:13px;border-radius:12px}
.rows{margin:6px 12px 0;border-radius:16px;border:1px solid var(--line);background:var(--card);overflow:hidden}
.row{display:flex;align-items:center;gap:11px;padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer;transition:background .15s}
.row:last-child{border-bottom:none}
.row:hover{background:rgba(255,255,255,.03)}
.row .rk{width:28px;font-size:13px;font-weight:700;color:rgba(255,255,255,.35);text-align:center;flex-shrink:0}
.row .ri{flex:1;min-width:0}
.row .rn{display:flex;align-items:center;gap:6px;min-width:0}
.row .rn .pname{overflow:hidden;text-overflow:ellipsis}
.row .rv{font-size:13.5px;font-weight:700;color:var(--em);white-space:nowrap}
.row .rv.zero{color:#f87171}
.row.me{background:rgba(16,185,129,.07);box-shadow:inset 3px 0 0 var(--em)}
.row.flash{animation:rowFlash 1.4s ease-out}
@keyframes rowFlash{0%,30%{background:rgba(16,185,129,.25)}100%{background:rgba(16,185,129,.07)}}
.pin{position:sticky;bottom:0;z-index:4;padding:10px 12px 12px;background:linear-gradient(to top,var(--bg) 70%,rgba(5,5,5,0))}
.pin .rows{margin:0;border-color:rgba(16,185,129,.28)}
.gapdots{text-align:center;color:rgba(255,255,255,.2);letter-spacing:.4em;padding:6px 0;font-size:13px}
.hallnote{margin:4px 14px 12px;font-size:12px;font-style:italic;color:rgba(255,255,255,.34);line-height:1.5}
.hallnote.red{color:rgba(248,113,113,.62)}
.story{margin:0 12px 10px;padding:16px;border-radius:18px;position:relative;overflow:hidden}
.story.fame{border:1px solid rgba(212,175,55,.22);background:linear-gradient(150deg,rgba(212,175,55,.1),rgba(212,175,55,.015) 60%),#080808}
.story.shame{border:1px solid rgba(239,68,68,.22);background:linear-gradient(150deg,rgba(239,68,68,.1),rgba(239,68,68,.015) 60%),#080808}
.st-top{display:flex;align-items:center;gap:10px;cursor:pointer}
.st-who{flex:1;min-width:0}
.st-when{font-size:10px;color:rgba(255,255,255,.28);white-space:nowrap}
.story .big{font-size:34px;font-weight:700;line-height:1;margin:14px 0 6px;letter-spacing:-.01em}
.story.fame .big{color:var(--gold)}
.story.shame .big{color:#f87171}
.story .kind{font-size:9.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:700}
.story.fame .kind{color:rgba(212,175,55,.75)}
.story.shame .kind{color:rgba(248,113,113,.75)}
.story .tale{font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.72);margin-top:4px}
.story .foot{display:flex;align-items:center;gap:8px;margin-top:12px}
.gchip{font-size:10.5px;padding:3px 9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.09);color:rgba(255,255,255,.55)}
.story .ghost{position:absolute;right:-10px;bottom:-24px;font-size:110px;opacity:.06;pointer-events:none}
.featured{margin:6px 12px 0;padding:18px;border-radius:20px;border:1px solid rgba(16,185,129,.22);background:radial-gradient(100% 90% at 100% 0%,rgba(16,185,129,.14),rgba(16,185,129,0) 60%),#070707}
.featured .fl{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--em);margin-bottom:12px}
.ftop{display:flex;align-items:center;gap:13px}
.gt{font-size:10px;font-weight:700;letter-spacing:.1em;padding:2px 7px;border-radius:6px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.55)}
.fname{font-size:20px;font-weight:700;display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.fsub{font-size:11.5px;color:rgba(255,255,255,.35);margin-top:3px}
.fdesc{font-size:12.5px;font-style:italic;color:rgba(255,255,255,.45);margin:12px 0;line-height:1.5}
.glist{margin:6px 12px 0}
.gr{display:flex;align-items:center;gap:12px;padding:12px;border-radius:15px;border:1px solid var(--line);background:var(--card);margin-bottom:8px;cursor:pointer}
.gr .gi{flex:1;min-width:0}
.gr .gn{display:flex;align-items:center;gap:6px;font-size:14.5px;font-weight:700}
.gr .gn span.t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gr .gs{font-size:11px;color:rgba(255,255,255,.32);margin-top:3px}
.gr .bar{height:4px;margin-top:8px}
.glock{width:11px;height:11px;stroke:var(--amber);fill:none;stroke-width:1.8;flex-shrink:0}
.unl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--em);font-weight:700}
.btn.state{min-width:78px}
.create{margin:4px 12px 0;padding:14px;border-radius:15px;border:1px dashed rgba(255,255,255,.14);display:flex;align-items:center;gap:12px;cursor:pointer;color:rgba(255,255,255,.55);font-size:13px;width:calc(100% - 24px);background:none;text-align:left}
.create b{width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,.05);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:400}
.ps-top{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:4px 0 6px}
.ps-stats{display:flex;justify-content:center;gap:28px;margin:14px 0 4px}
.ps-v{font-size:18px;font-weight:700}
.ps-l{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.26);margin-top:3px}
.tog{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:13px;border:1px solid var(--line);background:var(--card);margin-top:14px;cursor:pointer}
.tog .tx{flex:1}.tog .tx b{font-size:13.5px;display:block}.tog .tx span{font-size:11px;color:rgba(255,255,255,.34)}
.switch{width:44px;height:26px;border-radius:13px;background:rgba(255,255,255,.12);position:relative;transition:background .2s;flex-shrink:0}
.switch::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}
.switch.on{background:var(--em)}.switch.on::after{transform:translateX(18px)}
.fld{margin-top:14px}
@media(min-width:900px){
  .twocol{column-count:2;column-gap:14px;padding:0 12px}
  .twocol .story{margin:0 0 14px;break-inside:avoid;display:inline-block;width:100%}
  .podium{max-width:620px;margin-left:auto;margin-right:auto}
  .lbwrap{max-width:620px;margin:0 auto}
  .gwrap{max-width:760px;margin:0 auto}
}
`;

let tab = 'lb', lb = null, fame = null, shame = null, guilds = null, mine = null;
const cosByName = {};

export function renderSocial(app, data) {
  if (data && data.tab) tab = data.tab;
  lb = fame = shame = guilds = null; mine = undefined;
  app.innerHTML = `<style>${STYLE}</style>
  <div class="scroll" id="sscroll"><div class="wrap">
    <div class="top2"><h1>Social</h1>${balanceHTML()}</div>
    <div class="tabs" id="stabs">
      <button class="tb" data-t="lb">Leaderboard</button>
      <button class="tb gold" data-t="fame">Hall of Fame</button>
      <button class="tb red" data-t="shame">Hall of Shame</button>
      <button class="tb" data-t="guilds">Guilds</button>
    </div>
    <section class="pane" id="p-lb"></section>
    <section class="pane" id="p-fame"></section>
    <section class="pane" id="p-shame"></section>
    <section class="pane" id="p-guilds"></section>
    <div style="height:14px"></div>
  </div></div>
  ${dockHTML('social')}
  ${sheetHTML('shPlayer', 'Player', '<div id="psBody"></div>', '<span id="psFoot" style="display:contents"></span>')}
  ${sheetHTML('shCreate', 'Start a guild', `
    <div class="lbl">Name</div><input class="inp" id="cgName" maxlength="64" placeholder="High Rollers Club">
    <div class="fld"><div class="lbl">Tag · up to 8 letters</div><input class="inp" id="cgTag" maxlength="8" placeholder="HRC" style="text-transform:uppercase;letter-spacing:.12em"></div>
    <div class="fld"><div class="lbl">Description</div><textarea class="inp" id="cgDesc" rows="3" maxlength="256" style="resize:none;line-height:1.45" placeholder="What you're about"></textarea></div>
    <div class="tog" id="cgPriv"><div class="tx"><b>Private guild</b><span>New members need your approval</span></div><div class="switch" id="cgSw"></div></div>
    <p style="font-size:11.5px;color:rgba(255,255,255,.32);margin-top:12px;line-height:1.5">Chat, donations and friendly challenges unlock once members fund the guild to 15,000 CC.</p>`,
    '<button class="btn" data-close>Cancel</button><button class="btn em" id="cgGo">Create guild</button>')}`;
  bindNav(app); bindBalance();
  document.querySelectorAll('#stabs [data-t]').forEach((b) => b.addEventListener('click', () => go(b.dataset.t)));
  $('cgPriv').addEventListener('click', () => $('cgSw').classList.toggle('on'));
  $('cgTag').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s/g, ''); });
  $('cgGo').addEventListener('click', createGuild);
  go(tab);
}

function go(t) {
  tab = t;
  document.querySelectorAll('#stabs [data-t]').forEach((x) => {
    x.classList.toggle('on', x.dataset.t === t);
    if (x.dataset.t === t) x.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === `p-${t}`));
  if ($('sscroll')) $('sscroll').scrollTop = 0;
  if (t === 'lb') return renderLB();
  if (t === 'fame' || t === 'shame') return renderHall(t);
  return renderGuilds();
}
const loading = (el) => { el.innerHTML = '<div class="page-load" style="padding:40px">Loading…</div>'; };

// ── leaderboard ─────────────────────────────────────────────────────────────
async function renderLB() {
  const host = $('p-lb');
  if (!lb) {
    loading(host);
    try { lb = await api.get('/social/leaderboard'); } catch (err) { host.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
    lb.leaderboard.forEach((r) => { cosByName[r.username] = r.cosmetics; });
    if (lb.me) cosByName[lb.me.username] = lb.me.cosmetics;
  }
  if (tab !== 'lb') return;
  host.innerHTML = `<div class="podium" id="podium"></div>
    <div class="lbwrap">
      <div class="lbtools"><input class="inp" id="lbq" placeholder="Search a player…" autocomplete="off"><button class="btn sm" id="jump" style="white-space:nowrap">Jump to me</button></div>
      <div class="rows" id="lbrows"></div>
      <div class="gapdots" id="gap">· · ·</div>
      ${lb.me ? '<div class="pin"><div class="rows" id="merow"></div></div>' : ''}
    </div>`;
  paintLB('');
  $('lbq').addEventListener('input', (e) => paintLB(e.target.value));
  $('jump').addEventListener('click', () => {
    const inList = document.querySelector(`#lbrows .row[data-u="${CSS.escape(store.user?.username || '')}"]`);
    const r = inList || $('merow')?.querySelector('.row');
    if (!r) return;
    r.classList.remove('flash'); void r.offsetWidth; r.classList.add('flash');
    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function podCell(p, cls) {
  if (!p) return '<div></div>';
  return `<div class="pod ${cls}" data-u="${esc(p.username)}">${p.weekly_badge ? '<span class="weekly">👑 Richest MF This Week</span>' : ''}
    ${playerFrame(p.username, p.cosmetics, cls === 'p1' ? 88 : 66)}
    <div class="nm">${playerName(p.username, p.cosmetics, cls === 'p1' ? 16 : 13.5)}</div><div class="bl">${fmt(p.cc_balance)}</div>
    <div class="step">${p.rank}</div></div>`;
}
function rowHTML(p, me) {
  return `<div class="row${me ? ' me' : ''}" data-u="${esc(p.username)}"><div class="rk">${p.rank}</div>${playerFrame(p.username, p.cosmetics, 38)}
    <div class="ri"><div class="rn">${playerName(p.username, p.cosmetics, 14)}${playerBadge(p.cosmetics)}${p.weekly_badge ? '<span title="Richest MF This Week">👑</span>' : ''}</div></div>
    <div class="rv${Number(p.cc_balance) ? '' : ' zero'}">${fmt(p.cc_balance)}</div></div>`;
}
function paintLB(q) {
  q = q.trim().toLowerCase();
  const all = lb.leaderboard, myName = store.user?.username;
  $('podium').style.display = q ? 'none' : '';
  $('gap').style.display = q ? 'none' : '';
  if (!q) $('podium').innerHTML = podCell(all[1], 'p2') + podCell(all[0], 'p1') + podCell(all[2], 'p3');
  const list = q ? all.filter((p) => p.username.toLowerCase().includes(q)) : all.slice(3);
  $('lbrows').innerHTML = list.length ? list.map((p) => rowHTML(p, p.username === myName)).join('')
    : `<div class="empty">No one in the top ${all.length} called “${esc(q)}”.</div>`;
  if ($('merow')) $('merow').innerHTML = rowHTML(lb.me, true);
  document.querySelectorAll('#p-lb [data-u]').forEach((r) => r.addEventListener('click', () => openPlayer(r.dataset.u)));
}

// ── halls ───────────────────────────────────────────────────────────────────
const TRIGGER = {
  big_win: ['Biggest single win', (e) => `+${fmt(e.amount)} CC`, '💰'],
  win_streak: ['Ten in a row', () => '10 wins', '🔥'],
  balance_milestone: ['Milestone', (e) => `${fmt(e.amount)} CC`, '🏆'],
  bankruptcy_from_high: ['Bankrupt', (e) => `${fmt(e.amount)} → 0`, '💀'],
  big_loss: ['Brutal round', (e) => `−${fmt(Math.abs(e.amount))} CC`, '📉'],
};
async function renderHall(type) {
  const host = $(`p-${type}`);
  let entries = type === 'fame' ? fame : shame;
  if (!entries) {
    loading(host);
    try {
      entries = (await api.get(type === 'fame' ? '/social/hall-of-fame' : '/social/hall-of-shame')).entries;
      if (type === 'fame') fame = entries; else shame = entries;
      if (!lb) { lb = await api.get('/social/leaderboard').catch(() => null); lb?.leaderboard.forEach((r) => { cosByName[r.username] = r.cosmetics; }); }
    } catch (err) { host.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  }
  if (tab !== type) return;
  const note = type === 'fame'
    ? '<div class="hallnote">The biggest moments on A Lucky Place. Written the moment they happened.</div>'
    : '<div class="hallnote red">These are real losses. Opt-out exists. Nobody uses it.</div>';
  host.innerHTML = note + (entries.length ? `<div class="twocol">${entries.map((e) => storyHTML(e, type)).join('')}</div>`
    : `<div class="empty">${type === 'fame' ? 'Nobody has done anything legendary yet.' : 'Nobody has embarrassed themselves yet. Give it time.'}</div>`);
  host.querySelectorAll('[data-u]').forEach((r) => r.addEventListener('click', () => openPlayer(r.dataset.u)));
}
function storyHTML(e, type) {
  const [kind, big, ghost] = TRIGGER[e.trigger] || ['Moment', (x) => (x.amount != null ? `${fmt(x.amount)} CC` : ''), '✦'];
  const cos = cosByName[e.username] || null;
  let tale = esc(e.story || '');
  const nm = esc(e.username);
  if (tale.startsWith(nm)) tale = playerName(e.username, cos, 13.5) + tale.slice(nm.length);
  return `<div class="story ${type}"><div class="ghost">${ghost}</div>
    <div class="st-top" data-u="${nm}">${playerFrame(e.username, cos, 42)}
      <div class="st-who"><div style="display:flex;align-items:center;gap:6px">${playerName(e.username, cos, 15)}${playerBadge(cos)}</div></div>
      <div class="st-when">${timeAgo(e.created_at)}</div></div>
    <div class="big">${big(e)}</div><div class="kind">${kind}</div>
    <div class="tale">${tale}</div>
    ${e.game ? `<div class="foot"><span class="gchip">${esc(gameName(e.game))}</span></div>` : ''}</div>`;
}

// ── guilds ──────────────────────────────────────────────────────────────────
const LOCK = '<svg class="glock" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/></svg>';
const pending = new Set();
async function renderGuilds() {
  const host = $('p-guilds');
  if (!guilds) {
    loading(host);
    try {
      const [g, m] = await Promise.all([api.get('/social/guilds'), api.get('/social/guilds/mine')]);
      guilds = g.guilds || []; mine = m.guild || null;
    } catch (err) { host.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
  }
  if (tab !== 'guilds') return;
  const feat = mine ? guilds.find((g) => g.id === mine.id) || mine : guilds[0];
  host.innerHTML = `<div class="gwrap">
    ${feat ? `<div class="featured"><div class="fl">${mine ? 'Your guild' : '★ Featured guild'}</div>
      <div class="ftop">${guildIcon(feat, 58)}
        <div style="flex:1;min-width:0"><div class="fname">${esc(feat.name)} <span class="gt">${esc(feat.tag)}</span>${feat.is_private ? LOCK : ''}</div>
        <div class="fsub">${feat.member_count != null ? `${fmt(feat.member_count)} members · ` : ''}${feat.unlocked ? '<span class="unl">Unlocked</span>' : `${fmt(feat.fund_balance)} / 15,000 CC`}</div></div></div>
      ${feat.description ? `<div class="fdesc">${esc(feat.description)}</div>` : '<div style="height:12px"></div>'}
      <div class="bar"><i style="width:${Math.min(100, feat.progress_pct || 0)}%"></i></div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">${mine ? '<button class="btn em" data-open="mine">Open</button>' : guildBtn(feat)}</div>
    </div>` : ''}
    <div class="lbtools"><input class="inp" id="gq" placeholder="Search guilds by name or tag…" autocomplete="off"></div>
    <div class="glist" id="glist"></div>
    ${mine ? '' : '<button class="create" id="openCreate"><b>+</b><div><div style="font-weight:700;color:#fff">Start your own guild</div><div style="font-size:11px;margin-top:2px">You\'ll still have to fund it to 15,000 CC.</div></div></button>'}
  </div>`;
  paintGuilds('');
  $('gq').addEventListener('input', (e) => paintGuilds(e.target.value));
  $('openCreate')?.addEventListener('click', () => openSheet('shCreate'));
  wireGuildBtns(host);
}
function guildBtn(g) {
  if (mine) return mine.id === g.id ? '<button class="btn sm state em" data-open="mine">Open</button>' : `<button class="btn sm state" data-view="${g.id}">View</button>`;
  if (pending.has(g.id)) return `<button class="btn sm state amber" disabled>Requested</button>`;
  return g.is_private ? `<button class="btn sm state amber" data-join="${g.id}">Request</button>` : `<button class="btn sm state em" data-join="${g.id}">Join</button>`;
}
function paintGuilds(q) {
  q = q.trim().toLowerCase();
  const list = guilds.filter((g) => !q || g.name.toLowerCase().includes(q) || (g.tag || '').toLowerCase().includes(q));
  $('glist').innerHTML = (q ? '' : '<div class="sec first" style="margin:18px 4px 10px">All guilds</div>') + (list.length ? list.map((g) => {
    const pct = Math.min(100, g.progress_pct || 0);
    return `<div class="gr" data-view="${g.id}">${guildIcon(g, 46)}<div class="gi"><div class="gn"><span class="t">${esc(g.name)}</span><span class="gt">${esc(g.tag)}</span>${g.is_private ? LOCK : ''}</div>
      <div class="gs">${fmt(g.member_count)} members · ${g.unlocked ? '<span class="unl">Unlocked</span>' : `${fmt(g.fund_balance)} / 15,000 CC`}</div>
      <div class="bar"><i style="width:${pct}%;${g.unlocked ? '' : 'background:rgba(16,185,129,.5)'}"></i></div></div>${guildBtn(g)}</div>`;
  }).join('') : `<div class="empty">No guild matches “${esc(q)}”.</div>`);
  wireGuildBtns($('glist'));
}
function wireGuildBtns(root) {
  root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); window.__navigate('guild'); }));
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); window.__navigate('guild', { guildId: b.dataset.view }); }));
  root.querySelectorAll('[data-join]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation(); b.disabled = true;
    try {
      const res = await api.post(`/social/guilds/${b.dataset.join}/join`);
      if (res.status === 'requested') { pending.add(b.dataset.join); toast('Request sent — waiting for approval', 'amber'); paintGuilds($('gq').value); }
      else { toast('Joined 🎉', 'em'); window.__navigate('guild'); }
    } catch (err) { toast(err.message || 'Could not join', 'red'); b.disabled = false; }
  }));
}
async function createGuild() {
  const name = $('cgName').value.trim(), tag = $('cgTag').value.trim(), description = $('cgDesc').value.trim();
  if (!name || !tag) return toast('Name and tag are required', 'red');
  $('cgGo').disabled = true;
  try {
    await api.post('/social/guilds', { name, tag, description, is_private: $('cgSw').classList.contains('on') });
    closeSheets(); toast('Guild created 🏰', 'em'); window.__navigate('guild');
  } catch (err) { toast(err.message || 'Could not create guild', 'red'); $('cgGo').disabled = false; }
}

// ── player sheet ────────────────────────────────────────────────────────────
function openPlayer(username) {
  const row = lb?.leaderboard.find((r) => r.username === username) || (lb?.me?.username === username ? lb.me : null);
  const cos = row ? row.cosmetics : cosByName[username] || null;
  const isMe = username === store.user?.username;
  $('psBody').innerHTML = `<div class="ps-top">${playerFrame(username, cos, 100)}<div style="display:flex;align-items:center;gap:7px;margin-top:8px">${playerName(username, cos, 24)}${playerBadge(cos)}</div></div>
    ${row ? `<div class="ps-stats"><div><div class="ps-v" style="color:var(--em)">${fmt(row.cc_balance)}</div><div class="ps-l">Credits</div></div><div><div class="ps-v">#${fmt(row.rank)}</div><div class="ps-l">Rank</div></div></div>` : ''}`;
  $('psFoot').innerHTML = `<button class="btn em" id="psGo">${isMe ? 'View your profile' : 'View profile'}</button>`;
  openSheet('shPlayer');
  $('psGo').addEventListener('click', () => window.__navigate('profile', { username }));
}
