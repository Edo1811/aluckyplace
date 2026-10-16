// Admin panel: overview, players (cheats + moderation), guilds, shop, halls,
// read-only database browser + SQL console, and the audit log.
import { api } from '../api.js';
import { store } from '../store.js';
import { $, fmt, esc, timeAgo, toast, dockHTML, bindNav, sheetHTML, openSheet, closeSheets, playerFrame } from '../ui/core.js';

const STYLE = `
.adm{padding:0 12px 24px}
.kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.kpi{padding:14px}
.kpi b{display:block;font-size:20px;font-weight:700}
.kpi small{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.kpi b.em{color:var(--em)}.kpi b.gold{color:var(--gold)}.kpi b.red{color:#f87171}
.rows{display:flex;flex-direction:column}
.row{display:flex;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid var(--line);font-size:13px;min-width:0}
.row:last-child{border-bottom:none}
.row.tap{cursor:pointer}.row.tap:hover{background:rgba(255,255,255,.03)}
.row .grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row small{color:rgba(255,255,255,.35);font-size:11px}
.row .num{font-variant-numeric:tabular-nums;font-weight:700}
.pos{color:var(--em)}.neg{color:#f87171}
.chip2{font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:7px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.5)}
.chip2.red{background:rgba(239,68,68,.14);color:#fca5a5}.chip2.em{background:rgba(16,185,129,.14);color:#6ee7b7}.chip2.gold{background:rgba(212,175,55,.14);color:var(--gold)}
.bar2{display:flex;gap:8px;align-items:center;margin:4px 0 10px}
.bar2 .inp{padding:10px 12px;font-size:13px}
.bar2 select.inp{width:auto;flex:0 0 auto}
.dot{width:7px;height:7px;border-radius:50%;background:var(--em);flex-shrink:0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.f{display:flex;flex-direction:column;gap:6px}
.btnrow{display:flex;gap:8px;flex-wrap:wrap}
.btnrow .btn{flex:1}
.tbl{overflow:auto;max-height:62vh;border-radius:12px;border:1px solid var(--line);-webkit-overflow-scrolling:touch}
.tbl table{border-collapse:collapse;font-size:11.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;min-width:100%}
.tbl th{position:sticky;top:0;background:#101010;text-align:left;padding:8px 10px;color:rgba(255,255,255,.5);font-weight:600;white-space:nowrap;cursor:pointer;border-bottom:1px solid var(--line)}
.tbl th.on{color:var(--em)}
.tbl td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap;max-width:280px;overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.8)}
.tbl td.null{color:rgba(255,255,255,.2);font-style:italic}
.tbl tr:hover td{background:rgba(255,255,255,.025)}
textarea.inp{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;min-height:96px;resize:vertical}
.tlist{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}
.tlist::-webkit-scrollbar{display:none}
.pager{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;font-size:12px;color:rgba(255,255,255,.4)}
.logd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;color:rgba(255,255,255,.35);white-space:normal;word-break:break-all}
.uhead{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.uhead h3{font-size:20px}
.cosgrid{display:flex;flex-direction:column;gap:6px;max-height:240px;overflow:auto}
@media(min-width:900px){.adm{padding:0 20px 30px}.kpis{grid-template-columns:repeat(4,1fr)}}
`;

let tab = 'overview';
const st = { usersQ: '', usersSort: 'cc', usersFilter: '', usersOffset: 0, guildQ: '', hall: 'fame', table: null, tSort: null, tDir: 'desc', tOffset: 0, tCol: '', tVal: '', sql: 'SELECT username, cc_balance, a_balance FROM users ORDER BY cc_balance DESC LIMIT 20' };
let catalog = null;

const sign = (n) => { n = Number(n); return `<span class="num ${n > 0 ? 'pos' : n < 0 ? 'neg' : ''}">${n > 0 ? '+' : n < 0 ? '−' : ''}${fmt(Math.abs(n))}</span>`; };
const when = (d) => (d ? timeAgo(d) : '—');
const loading = () => { $('adBody').innerHTML = '<div class="page-load">Loading…</div>'; };
const err = (e) => { $('adBody').innerHTML = `<div class="empty">${esc(e.message || e)}</div>`; };

/** Destructive buttons need a second tap within 3s. */
function confirmTap(btn, fn) {
  let armed = 0;
  const base = btn.textContent;
  btn.addEventListener('click', async () => {
    if (!armed) { btn.textContent = 'Tap again to confirm'; armed = setTimeout(() => { armed = 0; btn.textContent = base; }, 3000); return; }
    clearTimeout(armed); armed = 0; btn.textContent = base; btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  });
}
async function run(fn, ok) {
  try { const r = await fn(); if (ok) toast(ok, 'em'); return r; } catch (e) { toast(e.message, 'red'); return null; }
}

export function renderAdmin(app) {
  if (!store.user?.is_admin) { window.__navigate('home'); return; }
  app.innerHTML = `<style>${STYLE}</style>
  <div class="topbar"><h1>Admin</h1><span class="chip2 gold">${esc(store.user.username)}</span></div>
  <div class="tabs" id="adTabs">
    ${[['overview', 'Overview'], ['players', 'Players'], ['guilds', 'Guilds'], ['shop', 'Shop'], ['halls', 'Halls'], ['db', 'Database'], ['log', 'Log']]
      .map(([k, l]) => `<button class="tb${k === tab ? ' on' : ''}" data-t="${k}">${l}</button>`).join('')}
  </div>
  <div class="scroll"><div class="wrap adm" id="adBody"></div></div>
  ${dockHTML('admin')}
  ${sheetHTML('shAdUser', 'Player', '<div id="adUser"></div>')}
  ${sheetHTML('shAdGuild', 'Guild', '<div id="adGuild"></div>')}`;
  bindNav(app);
  $('adTabs').querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.t;
    $('adTabs').querySelectorAll('.tb').forEach((x) => x.classList.toggle('on', x === b));
    show();
  }));
  show();
}

function show() {
  ({ overview, players, guilds, shop, halls, db, log })[tab]();
}

// ── overview ─────────────────────────────────────────────────────────────────
async function overview() {
  loading();
  try {
    const o = await api.get('/admin/overview');
    const list = (rows) => rows.length ? rows.map((r) => `<div class="row"><span class="grow">${esc(r.username)} <small>· ${esc(r.game)} · ${when(r.created_at)}</small></span>${sign(r.net)}</div>`).join('') : '<div class="empty">Nothing today</div>';
    $('adBody').innerHTML = `
      <div class="sec first">Economy</div>
      <div class="kpis">
        <div class="card kpi"><b>${fmt(o.totals.users)}</b><small>Players · ${o.totals.new_today} new today</small></div>
        <div class="card kpi"><b class="em">${fmt(o.totals.cc)}</b><small>CC in circulation</small></div>
        <div class="card kpi"><b class="gold">${fmt(o.totals.a)}</b><small>A in circulation</small></div>
        <div class="card kpi"><b class="${o.totals.banned ? 'red' : ''}">${o.totals.banned}</b><small>Banned</small></div>
      </div>
      <div class="sec">Last 24 hours</div>
      <div class="kpis">
        <div class="card kpi"><b>${fmt(o.today.games)}</b><small>Solo games</small></div>
        <div class="card kpi"><b>${fmt(o.today.wagered)}</b><small>CC wagered</small></div>
        <div class="card kpi"><b class="${Number(o.today.house_net) >= 0 ? 'em' : 'red'}">${Number(o.today.house_net) >= 0 ? '+' : '−'}${fmt(Math.abs(o.today.house_net))}</b><small>House net</small></div>
        <div class="card kpi"><b class="em">${o.online.length}</b><small>Online now</small></div>
      </div>
      <div class="sec">Online now</div>
      <div class="card rows">${o.online.length ? o.online.map((u) => `<div class="row tap" data-u="${u.id}"><span class="dot"></span><span class="grow">${esc(u.username)}</span></div>`).join('') : '<div class="empty">Nobody</div>'}</div>
      <div class="sec">Biggest wins today</div><div class="card rows">${list(o.top_wins.filter((r) => Number(r.net) > 0))}</div>
      <div class="sec">Biggest losses today</div><div class="card rows">${list(o.top_losses.filter((r) => Number(r.net) < 0))}</div>`;
    $('adBody').querySelectorAll('[data-u]').forEach((r) => r.addEventListener('click', () => openUser(r.dataset.u)));
  } catch (e) { err(e); }
}

// ── players ──────────────────────────────────────────────────────────────────
async function players() {
  $('adBody').innerHTML = `
    <div class="bar2"><input class="inp" id="uQ" placeholder="Search username, email or id" value="${esc(st.usersQ)}" autocomplete="off"></div>
    <div class="bar2">
      <select class="inp" id="uSort">${[['cc', 'Richest'], ['a', 'Most A'], ['login', 'Last login'], ['created', 'Newest'], ['name', 'Name']].map(([k, l]) => `<option value="${k}"${k === st.usersSort ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select class="inp" id="uFilter">${[['', 'Everyone'], ['banned', 'Banned'], ['admins', 'Admins']].map(([k, l]) => `<option value="${k}"${k === st.usersFilter ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>
    <div class="card rows" id="uList"><div class="page-load">Loading…</div></div>
    <div class="pager" id="uPager"></div>`;
  let t = 0;
  $('uQ').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { st.usersQ = e.target.value.trim(); st.usersOffset = 0; loadUsers(); }, 250); });
  $('uSort').onchange = (e) => { st.usersSort = e.target.value; st.usersOffset = 0; loadUsers(); };
  $('uFilter').onchange = (e) => { st.usersFilter = e.target.value; st.usersOffset = 0; loadUsers(); };
  loadUsers();
}
async function loadUsers() {
  const dir = st.usersSort === 'name' ? 'asc' : 'desc';
  try {
    const r = await api.get(`/admin/users?q=${encodeURIComponent(st.usersQ)}&sort=${st.usersSort}&dir=${dir}&filter=${st.usersFilter}&limit=50&offset=${st.usersOffset}`);
    $('uList').innerHTML = r.users.length ? r.users.map((u) => `<div class="row tap" data-u="${u.id}">
        ${u.online ? '<span class="dot"></span>' : ''}<span class="grow">${esc(u.username)}${u.is_admin ? ' <span class="chip2 gold">admin</span>' : ''}${u.banned_at ? ' <span class="chip2 red">banned</span>' : ''}
        <br><small>last login ${when(u.last_login_at)}</small></span>
        <span style="text-align:right"><span class="num" style="color:var(--em)">${fmt(u.cc_balance)}</span><br><small>${fmt(u.a_balance)} A</small></span></div>`).join('')
      : '<div class="empty">No players match</div>';
    $('uList').querySelectorAll('[data-u]').forEach((x) => x.addEventListener('click', () => openUser(x.dataset.u)));
    const end = Math.min(r.total, st.usersOffset + 50);
    $('uPager').innerHTML = `<button class="btn sm" id="uPrev"${st.usersOffset ? '' : ' disabled'}>Prev</button><span>${r.total ? st.usersOffset + 1 : 0}–${end} of ${fmt(r.total)}</span><button class="btn sm" id="uNext"${end < r.total ? '' : ' disabled'}>Next</button>`;
    $('uPrev').onclick = () => { st.usersOffset = Math.max(0, st.usersOffset - 50); loadUsers(); };
    $('uNext').onclick = () => { st.usersOffset += 50; loadUsers(); };
  } catch (e) { $('uList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

async function openUser(id) {
  $('adUser').innerHTML = '<div class="page-load">Loading…</div>';
  openSheet('shAdUser');
  try {
    const d = await api.get(`/admin/users/${id}`);
    const u = d.user;
    if (!catalog) catalog = (await api.get('/admin/cosmetics')).cosmetics;
    const owned = new Set(d.cosmetics.map((c) => c.cosmetic_id));
    $('adUser').innerHTML = `
      <div class="uhead">${playerFrame(u.username, null, 52)}<div><h3>${esc(u.username)}</h3>
        <small style="color:rgba(255,255,255,.4)">${esc(u.email)} · joined ${when(u.created_at)} · ${u.online ? '<span class="pos">online</span>' : `seen ${when(u.last_login_at)}`}</small><br>
        ${u.is_admin ? '<span class="chip2 gold">admin</span> ' : ''}${u.banned_at ? `<span class="chip2 red">banned ${when(u.banned_at)}</span> <small>${esc(u.ban_reason || '')}</small>` : ''}</div></div>
      <div class="kpis">
        <div class="card kpi"><b class="em">${fmt(u.cc_balance)}</b><small>CC</small></div>
        <div class="card kpi"><b class="gold">${fmt(u.a_balance)}</b><small>A</small></div>
        <div class="card kpi"><b>${fmt(d.stats.games)}</b><small>Solo games · ${d.stats.pvp.wins}/${d.stats.pvp.matches} PvP</small></div>
        <div class="card kpi"><b class="${Number(d.stats.net) >= 0 ? 'em' : 'red'}">${Number(d.stats.net) >= 0 ? '+' : '−'}${fmt(Math.abs(d.stats.net))}</b><small>Lifetime net</small></div>
      </div>
      <div class="sec">Balance</div>
      <div class="grid2">
        <div class="f"><div class="lbl">CC</div><input class="inp" id="auCC" inputmode="numeric" placeholder="e.g. 5000, +500, -200"></div>
        <div class="f"><div class="lbl">A</div><input class="inp" id="auA" inputmode="numeric" placeholder="e.g. 100, +10"></div>
      </div>
      <div class="lbl" style="margin-top:6px">A plain number sets it · +/- adjusts it</div>
      <button class="btn em block" id="auBal" style="margin-top:8px">Apply balance</button>
      <div class="sec">Cosmetics <span>${d.cosmetics.length} owned</span></div>
      <div class="bar2"><select class="inp" id="auCos" style="flex:1;width:100%">${catalog.filter((c) => !owned.has(c.id)).map((c) => `<option value="${c.id}">${esc(c.name)} · ${c.rarity} ${c.category.replace(/_/g, ' ')}</option>`).join('')}</select><button class="btn gold" id="auGive">Give</button></div>
      <div class="card rows cosgrid">${d.cosmetics.length ? d.cosmetics.map((c) => `<div class="row"><span class="grow">${esc(c.name)} <small>· ${c.rarity} · ${c.category.replace(/_/g, ' ')}${c.is_equipped ? ' · equipped' : ''}${c.listed ? ' · listed' : ''}</small></span><button class="btn sm red" data-rm="${c.user_cosmetic_id}">Remove</button></div>`).join('') : '<div class="empty">None</div>'}</div>
      <div class="sec">Moderation</div>
      <div class="btnrow">
        <button class="btn" id="auStreak">Reset daily streak${d.streak ? ` (${d.streak.current_streak})` : ''}</button>
        ${u.banned_at ? '<button class="btn em" id="auUnban">Unban</button>' : `<button class="btn red" id="auBan"${u.is_admin ? ' disabled' : ''}>Ban</button>`}
      </div>
      ${u.banned_at ? '' : '<input class="inp" id="auReason" placeholder="Ban reason (shown to them at login)" style="margin-top:8px" maxlength="200">'}
      ${d.guild ? `<div class="sec">Guild</div><div class="card rows"><div class="row tap" data-g="${d.guild.id}"><span class="grow">[${esc(d.guild.tag)}] ${esc(d.guild.name)}${d.guild.is_owner ? ' <small>· owner</small>' : ''}</span></div></div>` : ''}
      <div class="sec">Recent games</div>
      <div class="card rows">${d.recent.length ? d.recent.map((g) => `<div class="row"><span class="grow">${esc(g.game)} <small>· bet ${fmt(g.bet_amount)} · ${when(g.created_at)}</small></span>${sign(g.net)}</div>`).join('') : '<div class="empty">No games yet</div>'}</div>
      <div class="lbl" style="margin-top:14px;text-transform:none;letter-spacing:0">id ${esc(u.id)}</div>`;

    $('auBal').onclick = async () => {
      const parse = (v, k) => { v = v.replace(/[\s,_]/g, ''); if (!v) return {}; if (/^[+-]\d+$/.test(v)) return { [`${k}_delta`]: Number(v) }; if (/^\d+$/.test(v)) return { [`${k}_set`]: Number(v) }; throw new Error(`"${v}" isn't a number`); };
      let body;
      try { body = { ...parse($('auCC').value, 'cc'), ...parse($('auA').value, 'a') }; } catch (e) { return toast(e.message, 'red'); }
      if (!Object.keys(body).length) return toast('Type an amount first', 'amber');
      if (await run(() => api.post(`/admin/users/${id}/balance`, body), 'Balance updated')) openUser(id);
    };
    $('auGive').onclick = async () => { const cid = $('auCos').value; if (!cid) return; await run(() => api.post(`/admin/users/${id}/cosmetics`, { cosmetic_id: cid }), 'Given'); openUser(id); };
    $('adUser').querySelectorAll('[data-rm]').forEach((b) => confirmTap(b, async () => { await run(() => api.delete(`/admin/users/${id}/cosmetics/${b.dataset.rm}`), 'Removed'); openUser(id); }));
    confirmTap($('auStreak'), async () => { await run(() => api.post(`/admin/users/${id}/streak/reset`), 'Streak reset'); openUser(id); });
    if ($('auBan')) confirmTap($('auBan'), async () => { await run(() => api.post(`/admin/users/${id}/ban`, { reason: $('auReason').value }), `${u.username} banned`); openUser(id); });
    if ($('auUnban')) confirmTap($('auUnban'), async () => { await run(() => api.post(`/admin/users/${id}/unban`), `${u.username} unbanned`); openUser(id); });
    $('adUser').querySelectorAll('[data-g]').forEach((r) => r.addEventListener('click', () => openGuild(r.dataset.g)));
  } catch (e) { $('adUser').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── guilds ───────────────────────────────────────────────────────────────────
async function guilds() {
  $('adBody').innerHTML = `<div class="bar2"><input class="inp" id="gQ" placeholder="Search name or tag" value="${esc(st.guildQ)}" autocomplete="off"></div><div class="card rows" id="gList"><div class="page-load">Loading…</div></div>`;
  let t = 0;
  $('gQ').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { st.guildQ = e.target.value.trim(); loadGuilds(); }, 250); });
  loadGuilds();
}
async function loadGuilds() {
  try {
    const r = await api.get(`/admin/guilds?q=${encodeURIComponent(st.guildQ)}`);
    $('gList').innerHTML = r.guilds.length ? r.guilds.map((g) => `<div class="row tap" data-g="${g.id}"><span style="font-size:20px">${esc(g.icon || '🏰')}</span>
      <span class="grow">[${esc(g.tag)}] ${esc(g.name)}<br><small>${g.members} members · owner ${esc(g.owner)}${g.unlocked ? '' : ' · locked'}</small></span><span class="num" style="color:var(--em)">${fmt(g.fund_balance)}</span></div>`).join('')
      : '<div class="empty">No guilds</div>';
    $('gList').querySelectorAll('[data-g]').forEach((x) => x.addEventListener('click', () => openGuild(x.dataset.g)));
  } catch (e) { $('gList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
async function openGuild(id) {
  $('adGuild').innerHTML = '<div class="page-load">Loading…</div>';
  openSheet('shAdGuild');
  try {
    const { guild: g, members } = await api.get(`/admin/guilds/${id}`);
    $('adGuild').innerHTML = `
      <div class="uhead"><span style="font-size:34px;width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:${esc(g.icon_bg || '#10b981')}33">${esc(g.icon || '🏰')}</span>
        <div><h3>${esc(g.name)}</h3><small style="color:rgba(255,255,255,.4)">owner ${esc(g.owner)} · created ${when(g.created_at)} · ${g.unlocked ? 'unlocked' : 'locked'}</small></div></div>
      <div class="grid2"><div class="f"><div class="lbl">Name</div><input class="inp" id="agName" value="${esc(g.name)}" maxlength="64"></div>
        <div class="f"><div class="lbl">Tag</div><input class="inp" id="agTag" value="${esc(g.tag)}" maxlength="8"></div></div>
      <div class="f" style="margin-top:8px"><div class="lbl">Description</div><input class="inp" id="agDesc" value="${esc(g.description || '')}" maxlength="256"></div>
      <button class="btn em block" id="agSave" style="margin-top:8px">Save details</button>
      <div class="sec">Fund <span>${fmt(g.fund_balance)} CC</span></div>
      <div class="bar2"><input class="inp" id="agFund" inputmode="numeric" placeholder="e.g. 15000, +5000, -1000"><button class="btn gold" id="agFundGo">Apply</button></div>
      <div class="sec">Members <span>${members.length}</span></div>
      <div class="card rows">${members.map((m) => `<div class="row"><span class="grow tap" data-u="${m.id}" style="cursor:pointer">${esc(m.username)}${m.is_owner ? ' <span class="chip2 gold">owner</span>' : ''}<br><small>joined ${when(m.joined_at)} · ${fmt(m.cc_balance)} CC</small></span>${m.is_owner ? '' : `<button class="btn sm red" data-kick="${m.id}">Kick</button>`}</div>`).join('')}</div>
      <div class="sec">Danger</div>
      <button class="btn red block" id="agDisband">Disband guild</button>`;
    $('agSave').onclick = async () => { await run(() => api.patch(`/admin/guilds/${id}`, { name: $('agName').value, tag: $('agTag').value, description: $('agDesc').value }), 'Saved'); openGuild(id); if (tab === 'guilds') loadGuilds(); };
    $('agFundGo').onclick = async () => {
      const v = $('agFund').value.replace(/[\s,_]/g, '');
      const body = /^[+-]\d+$/.test(v) ? { delta: Number(v) } : /^\d+$/.test(v) ? { set: Number(v) } : null;
      if (!body) return toast('Type an amount like 5000 or +500', 'amber');
      await run(() => api.post(`/admin/guilds/${id}/fund`, body), 'Fund updated'); openGuild(id);
    };
    $('adGuild').querySelectorAll('[data-kick]').forEach((b) => confirmTap(b, async () => { await run(() => api.delete(`/admin/guilds/${id}/members/${b.dataset.kick}`), 'Kicked'); openGuild(id); }));
    $('adGuild').querySelectorAll('[data-u]').forEach((r) => r.addEventListener('click', () => openUser(r.dataset.u)));
    confirmTap($('agDisband'), async () => { await run(() => api.post(`/admin/guilds/${id}/disband`), 'Guild disbanded'); closeSheets(); if (tab === 'guilds') loadGuilds(); });
  } catch (e) { $('adGuild').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── shop ─────────────────────────────────────────────────────────────────────
async function shop() {
  loading();
  try {
    const r = await api.get('/admin/listings');
    $('adBody').innerHTML = `<div class="sec first">Active listings <span>${r.listings.length}</span></div>
      <div class="card rows">${r.listings.length ? r.listings.map((l) => `<div class="row"><span class="grow">${esc(l.name)} <small>· ${l.rarity} · by ${esc(l.seller)} · ${when(l.listed_at)}</small></span><span class="num" style="color:var(--gold)">${fmt(l.price_a)} A</span><button class="btn sm red" data-l="${l.id}">Take down</button></div>`).join('') : '<div class="empty">No active listings</div>'}</div>
      <div class="lbl" style="margin-top:10px;text-transform:none;letter-spacing:0">Taking a listing down leaves the item with the seller.</div>`;
    $('adBody').querySelectorAll('[data-l]').forEach((b) => confirmTap(b, async () => { await run(() => api.delete(`/admin/listings/${b.dataset.l}`), 'Listing removed'); shop(); }));
  } catch (e) { err(e); }
}

// ── halls ────────────────────────────────────────────────────────────────────
async function halls() {
  $('adBody').innerHTML = `<div class="tabs" style="padding:4px 0 10px"><button class="tb gold${st.hall === 'fame' ? ' on' : ''}" data-h="fame">Hall of Fame</button><button class="tb red${st.hall === 'shame' ? ' on' : ''}" data-h="shame">Hall of Shame</button></div><div class="card rows" id="hList"><div class="page-load">Loading…</div></div>`;
  $('adBody').querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => { st.hall = b.dataset.h; halls(); }));
  try {
    const r = await api.get(`/admin/halls/${st.hall}`);
    $('hList').innerHTML = r.entries.length ? r.entries.map((h) => `<div class="row"><span class="grow">${esc(h.username)} <small>· ${esc(h.trigger.replace(/_/g, ' '))}${h.game ? ` · ${esc(h.game)}` : ''} · ${when(h.created_at)}</small></span>${h.amount ? `<span class="num">${fmt(h.amount)}</span>` : ''}<button class="btn sm red" data-h2="${h.id}">Delete</button></div>`).join('') : '<div class="empty">Empty</div>';
    $('hList').querySelectorAll('[data-h2]').forEach((b) => confirmTap(b, async () => { await run(() => api.delete(`/admin/halls/${st.hall}/${b.dataset.h2}`), 'Deleted'); halls(); }));
  } catch (e) { $('hList').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

// ── database ─────────────────────────────────────────────────────────────────
function gridHTML(fields, rows, sortable) {
  const cell = (v) => {
    if (v === null || v === undefined) return '<td class="null">null</td>';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `<td title="${esc(s)}">${esc(s)}</td>`;
  };
  return `<div class="tbl"><table><thead><tr>${fields.map((f) => `<th data-c="${esc(f)}" class="${sortable && st.tSort === f ? 'on' : ''}">${esc(f)}${sortable && st.tSort === f ? (st.tDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${fields.map((f) => cell(r[f])).join('')}</tr>`).join('')}</tbody></table></div>`;
}
let tables = null;
async function db() {
  loading();
  try {
    tables = (await api.get('/admin/db/tables')).tables;
    if (!st.table) st.table = 'users';
    $('adBody').innerHTML = `
      <div class="sec first">Tables</div>
      <div class="tlist">${tables.map((t) => `<button class="tb${t.name === st.table ? ' on' : ''}" data-tb="${t.name}">${t.name} <small style="opacity:.5">${fmt(t.rows)}</small></button>`).join('')}</div>
      <div class="bar2"><select class="inp" id="tCol"></select><input class="inp" id="tVal" placeholder="contains…" autocomplete="off"></div>
      <div id="tGrid"><div class="page-load">Loading…</div></div><div class="pager" id="tPager"></div>
      <div class="sec">SQL console <span>read-only · 5s · 500 rows</span></div>
      <textarea class="inp" id="sqlIn" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(st.sql)}</textarea>
      <div class="btnrow" style="margin-top:8px"><button class="btn em" id="sqlRun">Run</button></div>
      <div id="sqlOut" style="margin-top:10px"></div>`;
    $('adBody').querySelectorAll('[data-tb]').forEach((b) => b.addEventListener('click', () => {
      st.table = b.dataset.tb; st.tSort = null; st.tDir = 'desc'; st.tOffset = 0; st.tCol = ''; st.tVal = '';
      $('adBody').querySelectorAll('[data-tb]').forEach((x) => x.classList.toggle('on', x === b));
      $('tVal').value = ''; loadTable();
    }));
    let t = 0;
    $('tVal').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { st.tVal = e.target.value; st.tOffset = 0; if (st.tCol) loadTable(); }, 300); });
    $('tCol').onchange = (e) => { st.tCol = e.target.value; st.tOffset = 0; loadTable(); };
    $('sqlRun').onclick = runSql;
    $('sqlIn').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runSql(); });
    loadTable();
  } catch (e) { err(e); }
}
async function loadTable() {
  const t = tables.find((x) => x.name === st.table); if (!t) return;
  $('tCol').innerHTML = `<option value="">Filter column…</option>${t.columns.map((c) => `<option${c.name === st.tCol ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;
  try {
    const qs = new URLSearchParams({ limit: 50, offset: st.tOffset, dir: st.tDir, ...(st.tSort ? { sort: st.tSort } : {}), ...(st.tCol ? { col: st.tCol, val: st.tVal } : {}) });
    const r = await api.get(`/admin/db/tables/${encodeURIComponent(st.table)}?${qs}`);
    st.tSort = r.sort; st.tDir = r.dir;
    const fields = r.columns.map((c) => c.name);
    $('tGrid').innerHTML = r.rows.length ? gridHTML(fields, r.rows, true) : '<div class="empty">No rows</div>';
    $('tGrid').querySelectorAll('th[data-c]').forEach((th) => th.addEventListener('click', () => {
      const c = th.dataset.c; st.tDir = st.tSort === c && st.tDir === 'desc' ? 'asc' : 'desc'; st.tSort = c; st.tOffset = 0; loadTable();
    }));
    const end = Math.min(r.total, st.tOffset + 50);
    $('tPager').innerHTML = `<button class="btn sm" id="tPrev"${st.tOffset ? '' : ' disabled'}>Prev</button><span>${r.total ? st.tOffset + 1 : 0}–${end} of ${fmt(r.total)}</span><button class="btn sm" id="tNext"${end < r.total ? '' : ' disabled'}>Next</button>`;
    $('tPrev').onclick = () => { st.tOffset = Math.max(0, st.tOffset - 50); loadTable(); };
    $('tNext').onclick = () => { st.tOffset += 50; loadTable(); };
  } catch (e) { $('tGrid').innerHTML = `<div class="empty">${esc(e.message)}</div>`; $('tPager').innerHTML = ''; }
}
async function runSql() {
  st.sql = $('sqlIn').value;
  $('sqlOut').innerHTML = '<div class="page-load">Running…</div>';
  try {
    const r = await api.post('/admin/db/query', { sql: st.sql });
    $('sqlOut').innerHTML = `<div class="lbl" style="text-transform:none;letter-spacing:0">${fmt(r.row_count ?? r.rows.length)} rows · ${r.ms} ms${r.truncated ? ' · showing first 500' : ''}</div>${r.rows.length ? gridHTML(r.fields, r.rows, false) : ''}`;
  } catch (e) { $('sqlOut').innerHTML = `<div class="empty" style="color:#fca5a5;text-align:left;font-family:ui-monospace,monospace;font-size:12px">${esc(e.message)}</div>`; }
}

// ── audit log ────────────────────────────────────────────────────────────────
async function log() {
  loading();
  try {
    const r = await api.get('/admin/log?limit=200');
    $('adBody').innerHTML = `<div class="sec first">Admin actions <span>last ${r.entries.length}</span></div>
      <div class="card rows">${r.entries.length ? r.entries.map((e) => `<div class="row" style="align-items:flex-start"><span class="grow" style="white-space:normal"><b>${esc(e.action.replace(/_/g, ' '))}</b> <small>· ${esc(e.admin_username || '?')} · ${when(e.created_at)}</small>
        <div class="logd">${esc(JSON.stringify(e.detail))}</div></span></div>`).join('') : '<div class="empty">Nothing yet</div>'}</div>`;
  } catch (e) { err(e); }
}
