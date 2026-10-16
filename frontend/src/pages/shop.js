import { api } from '../api.js';
import { store, updateBalance } from '../store.js';
import { renderAvatarFrame, renderCosmeticPreview, CATEGORY_LABELS } from '../cosmeticPreview.js';
import {
  $, fmt, esc, hexA, toast, dockHTML, bindNav, balanceHTML, bindBalance, emitBalance, amountOf,
  playerFrame, playerName, playerBadge, RARITY_COLORS, sheetHTML, openSheet, closeSheets, holdButton, onLeave,
} from '../ui/core.js';

// Mirrors backend/src/shop/packs.js — kept in sync with balance.md
const PACKS = [
  { type: 'starter', name: 'Starter Pack', price: 15, desc: 'A little of everything. Good for new players.', c1: '#6b7280', c2: '#2a2d33', glow: 'rgba(156,163,175,.22)', em: '✦', odds: { Common: 72, Rare: 28 } },
  { type: 'high_roller', name: 'High Roller', price: 40, desc: 'Weighted toward Rare and above. For those with taste.', c1: '#e8c65a', c2: '#6d5413', glow: 'rgba(212,175,55,.3)', em: '💰', odds: { Common: 45, Rare: 35, Epic: 17, Legendary: 3 } },
  { type: 'epic_cache', name: 'Epic Cache', price: 75, desc: 'Rare or better, guaranteed.', c1: '#b77cf7', c2: '#3b1466', glow: 'rgba(168,85,247,.32)', em: '🔮', odds: { Rare: 40, Epic: 42, Legendary: 15, Exotic: 3 } },
  { type: 'exotic_crate', name: 'Exotic Crate', price: 250, desc: 'Epic minimum. The good stuff lives here.', c1: '#fb923c', c2: '#7c2d12', glow: 'rgba(249,115,22,.36)', em: '🌋', odds: { Epic: 55, Legendary: 33, Exotic: 12 } },
];
const CATS = [['', 'All'], ['avatar_frame', 'Frames'], ['name_aura', 'Auras'], ['name_color', 'Colours'], ['name_font', 'Fonts'], ['chat_badge', 'Badges'], ['status_title', 'Titles'], ['custom_emoji', 'Emoji']];
const RARS = ['Common', 'Rare', 'Epic', 'Legendary', 'Exotic'];
const LV = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Exotic: 5 };
const TYPICAL = { Common: 6, Rare: 18, Epic: 45, Legendary: 140, Exotic: 520 };

const STYLE = `
.top2{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 8px}
.top2 h1{font-size:24px}
.pane{display:none}.pane.on{display:block}
.fbar{display:flex;gap:6px;overflow-x:auto;padding:12px 12px 2px;scrollbar-width:none}
.fbar::-webkit-scrollbar{display:none}
.fc{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);font-size:12px;color:rgba(255,255,255,.45);cursor:pointer;white-space:nowrap}
.fc.on{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.22);color:#fff}
.fc i{width:7px;height:7px;border-radius:50%}
.mtools{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px;font-size:11.5px;color:rgba(255,255,255,.32)}
.seg{display:flex;gap:4px;padding:3px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}
.seg button{padding:5px 10px;border-radius:9px;background:none;border:none;color:rgba(255,255,255,.5);font-size:11.5px;cursor:pointer}
.seg button.on{background:rgba(255,255,255,.09);color:#fff}
.igrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;padding:8px 12px 0}
.it{border-radius:16px;border:1px solid var(--line);background:var(--card);overflow:hidden;cursor:pointer;position:relative;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;text-align:left;color:#fff;padding:0}
.it:hover{border-color:rgba(255,255,255,.16)}
.it:active{transform:scale(.98)}
.it .pv{height:108px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
.it .pv::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--rc)}
.it .bd{padding:10px 12px 12px;display:flex;flex-direction:column;gap:2px;flex:1}
.it .nm{font-size:13px;font-weight:700;line-height:1.2}
.it .ct{font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.26)}
.it .sl{font-size:10.5px;color:rgba(255,255,255,.3);margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.price{display:flex;align-items:center;gap:5px;font-size:15px;font-weight:700;color:var(--gold);margin-top:9px}
.coin{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#D4AF37 60%,#8a6b15);color:#3a2a00;font-size:9.5px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-style:normal}
.mine-tag{position:absolute;top:8px;left:8px;font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;padding:2px 7px;border-radius:7px;background:rgba(16,185,129,.18);color:var(--em);z-index:2}
.tryon{border-radius:18px;padding:22px 14px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.tryon .l2{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:6px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
.cmp>div{border-radius:13px;border:1px solid var(--line);background:var(--card);padding:12px;text-align:center}
.cmp b{display:block;font-size:14px;margin-top:3px}
.cmp span{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.28)}
.receipt{margin-top:12px;border-radius:13px;border:1px solid var(--line);padding:12px 14px;font-size:12.5px}
.receipt div{display:flex;justify-content:space-between;padding:3px 0;color:rgba(255,255,255,.5)}
.receipt div.tot{color:#fff;font-weight:700;border-top:1px solid var(--line);margin-top:6px;padding-top:9px}
.packnote{margin:10px 16px 4px;font-size:12px;font-style:italic;color:rgba(255,255,255,.36);line-height:1.5}
.pgrid{display:grid;grid-template-columns:1fr;gap:12px;padding:10px 12px 0}
.pk{border-radius:20px;border:1px solid var(--pkg);background:radial-gradient(100% 70% at 85% 0%,var(--pkg),transparent 60%),#080808;padding:18px;display:grid;grid-template-columns:96px 1fr;gap:16px;align-items:center;overflow:hidden}
.crate{width:96px;height:96px;position:relative;filter:drop-shadow(0 12px 18px rgba(0,0,0,.6)) drop-shadow(0 0 16px var(--pkg))}
.crate .bx{position:absolute;inset:18px 6px 0;border-radius:12px;background:linear-gradient(160deg,var(--c1),var(--c2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.2),inset 0 -14px 20px rgba(0,0,0,.35)}
.crate .lid{position:absolute;left:0;right:0;top:8px;height:24px;border-radius:9px;background:linear-gradient(180deg,var(--c1),var(--c2));box-shadow:inset 0 0 0 1px rgba(255,255,255,.25),0 4px 8px rgba(0,0,0,.4)}
.crate .band{position:absolute;left:50%;top:8px;bottom:0;width:14px;transform:translateX(-50%);background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.18));border-radius:3px}
.crate .emb{position:absolute;left:50%;top:56%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:#0b0b0b;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 0 0 2px rgba(255,255,255,.4)}
.pk:hover .crate{animation:crateWiggle .5s ease-in-out}
@keyframes crateWiggle{25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
.pk h3{font-size:18px}
.pk .pd{font-size:11.5px;font-style:italic;color:rgba(255,255,255,.4);margin:3px 0 10px}
.odds{display:flex;height:8px;border-radius:4px;overflow:hidden;gap:2px}
.odds i{display:block;height:100%}
.oddl{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:7px;font-size:10.5px;color:rgba(255,255,255,.45)}
.oddl span{display:flex;align-items:center;gap:4px}
.oddl span i{width:6px;height:6px;border-radius:50%}
.pk .buy{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;padding-top:4px}
.pk .buy .price{margin:0}
.reveal{position:fixed;inset:0;z-index:70;background:rgba(3,3,3,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;overflow:hidden}
.reveal.on{display:flex}
.stage{position:relative;width:240px;height:240px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rays{position:absolute;inset:-60px;border-radius:50%;background:repeating-conic-gradient(var(--rc) 0deg 8deg,transparent 8deg 24deg);opacity:0;-webkit-mask-image:radial-gradient(circle,#000 20%,transparent 68%);mask-image:radial-gradient(circle,#000 20%,transparent 68%);animation:spinr 14s linear infinite;transition:opacity .5s}
@keyframes spinr{to{transform:rotate(360deg)}}
.bigcrate{transform:scale(1.7)}
.bigcrate.shake{animation:shake .12s linear infinite}
@keyframes shake{0%{transform:scale(1.7) translate(0,0) rotate(0)}25%{transform:scale(1.72) translate(-3px,1px) rotate(-3deg)}50%{transform:scale(1.74) translate(2px,-2px) rotate(2deg)}75%{transform:scale(1.76) translate(-2px,2px) rotate(-2deg)}100%{transform:scale(1.78) translate(3px,0) rotate(3deg)}}
.rcard{position:absolute;width:190px;border-radius:20px;border:1px solid var(--rc);background:linear-gradient(170deg,rgba(255,255,255,.06),#0b0b0b 55%);box-shadow:0 0 40px var(--rcg),0 20px 50px rgba(0,0,0,.7);padding:18px 14px;display:none;flex-direction:column;align-items:center;gap:8px}
.rcard.on{display:flex;animation:cardIn .7s cubic-bezier(.2,1.4,.4,1)}
@keyframes cardIn{0%{transform:scale(.2) rotateY(180deg);opacity:0}100%{transform:scale(1) rotateY(0);opacity:1}}
.rcard .pvw{height:96px;display:flex;align-items:center;justify-content:center;width:100%}
.rcard .nm{font-size:17px;font-weight:700}
.rcard .ct{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.rtier{font-size:30px;font-weight:700;letter-spacing:.04em;opacity:0;transform:translateY(10px);transition:all .4s .35s}
.rtier.on{opacity:1;transform:none}
.rdupe{font-size:12px;color:rgba(255,255,255,.5);font-style:italic;min-height:16px}
.racts{display:flex;gap:9px;width:100%;max-width:340px;opacity:0;transition:opacity .3s .6s}
.racts.on{opacity:1}
.racts .btn{flex:1}
.rhint{font-size:12px;color:rgba(255,255,255,.35);font-style:italic}
.spark{position:absolute;left:50%;top:50%;width:6px;height:6px;border-radius:50%;pointer-events:none}
.cv{margin:14px 12px 0;padding:20px 16px;border-radius:20px;border:1px solid var(--line);background:var(--card)}
.cv-row{display:flex;align-items:center;gap:10px}
.cv-in{flex:1;min-width:0}
.cv-in .inp{font-size:26px;font-weight:700;padding:14px}
.cv-arrow{width:38px;height:38px;border-radius:50%;margin:12px auto;display:flex;align-items:center;justify-content:center;background:rgba(212,175,55,.1);border:1px solid rgba(212,175,55,.3);color:var(--gold)}
.cv-out{border-radius:14px;padding:16px;background:linear-gradient(140deg,rgba(212,175,55,.13),rgba(212,175,55,.03));border:1px solid rgba(212,175,55,.26);display:flex;align-items:center;justify-content:space-between;gap:10px}
.cv-out .big{font-size:34px;font-weight:700;color:var(--gold);display:flex;align-items:center;gap:9px}
.cv-out .big .coin{width:26px;height:26px;font-size:14px}
.cv-out .lft{font-size:11px;color:rgba(255,255,255,.38);text-align:right;line-height:1.4}
.cv .chips{display:flex;gap:6px;margin-top:10px}
.cv .chips button{flex:1;padding:8px 0;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);font-size:12px;font-weight:700;cursor:pointer}
.warn{margin:12px 12px 0;padding:14px;border-radius:15px;border:1px solid rgba(239,68,68,.24);background:rgba(239,68,68,.05);display:flex;gap:12px}
.warn b{font-size:20px}
.warn div{font-size:12px;color:rgba(255,255,255,.55);line-height:1.5}
.warn div strong{color:#fca5a5;display:block;font-size:13px;margin-bottom:2px}
.holdbtn{position:relative;overflow:hidden;touch-action:none;user-select:none;margin:14px 12px 0;width:calc(100% - 24px);padding:16px;font-size:15px}
.holdbtn i{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(255,255,255,.28)}
.holdbtn span{position:relative}
.rate{display:flex;justify-content:space-between;margin:14px 16px 0;font-size:11.5px;color:rgba(255,255,255,.32)}
.owned{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.ow{border-radius:13px;border:1px solid var(--line);background:var(--card);padding:10px 4px 8px;text-align:center;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;min-height:104px;justify-content:center;color:#fff}
.ow.on{border-color:var(--em);box-shadow:0 0 0 2px rgba(16,185,129,.22)}
.ow small{font-size:10px;color:rgba(255,255,255,.5);line-height:1.2}
@media(min-width:900px){
  .igrid{grid-template-columns:repeat(4,1fr);padding:8px 20px 0;gap:12px}
  .fbar{padding:12px 20px 2px}
  .mtools{padding:12px 22px 4px}
  .pgrid{grid-template-columns:1fr 1fr;padding:10px 20px 0}
  .convwrap{max-width:520px;margin:0 auto}
}
`;

let tab = 'market', cat = '', rar = '', mineOnly = false, listings = [], owned = null, pickO = 0, meCos = null;

export async function renderShop(app, opts = {}) {
  mineOnly = !!opts.filterMine; tab = opts.tab || 'market'; owned = null;
  app.innerHTML = `<style>${STYLE}</style>
  <div class="scroll" id="shscroll"><div class="wrap">
    <div class="top2"><h1>Shop</h1>${balanceHTML()}</div>
    <div class="tabs" id="shtabs">
      <button class="tb" data-t="market">Market</button>
      <button class="tb gold" data-t="packs">Packs</button>
      <button class="tb" data-t="convert">Convert CC → A</button>
    </div>
    <section class="pane" id="p-market">
      <div class="fbar" id="cats"></div>
      <div class="fbar" id="rars" style="padding-top:6px"></div>
      <div class="mtools"><span id="count"></span><div class="seg"><button data-v="all">All listings</button><button data-v="mine">Mine</button></div></div>
      <div class="igrid" id="grid"></div>
      <div style="padding:14px 12px 18px"><button class="btn block" id="sellBtn">+ List one of your items</button></div>
    </section>
    <section class="pane" id="p-packs">
      <div class="packnote">The shop never sells cosmetics directly. Open a pack, or buy what other players are selling. Duplicates refund A.</div>
      <div class="pgrid" id="packs"></div><div style="height:18px"></div>
    </section>
    <section class="pane" id="p-convert"><div class="convwrap">
      <div class="cv">
        <div class="lbl">You give</div>
        <div class="cv-row"><div class="cv-in"><input class="inp" id="cvIn" inputmode="numeric" value="1,000"></div><span style="font-size:13px;color:rgba(255,255,255,.35)">CC</span></div>
        <div class="chips"><button data-p=".25">25%</button><button data-p=".5">50%</button><button data-p=".75">75%</button><button data-p="1">All</button></div>
        <div class="cv-arrow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg></div>
        <div class="lbl">You get</div>
        <div class="cv-out"><div class="big"><span class="coin">A</span><span id="cvOut">1</span></div><div class="lft" id="cvLeft"></div></div>
      </div>
      <div class="rate"><span>Rate · 1,000 CC = 1 A</span><span id="cvAfter"></span></div>
      <div class="warn"><b>⚠️</b><div><strong>This is one-way. Forever.</strong>Tokens can never be turned back into credits. They don't gamble, they don't get lost — they only buy cosmetics.</div></div>
      <button class="btn gold holdbtn" id="cvGo"><i></i><span>Hold to convert</span></button>
      <div style="height:18px"></div>
    </div></section>
  </div></div>
  ${dockHTML('shop')}
  ${sheetHTML('shItem', '', '<div id="itBody"></div>', '<span id="itFoot" style="display:contents"></span>')}
  ${sheetHTML('shSell', 'List an item', `<div class="lbl">Pick something you own</div><div class="owned" id="owned"></div>
    <div class="lbl" style="margin-top:16px">You receive (A)</div><input class="inp" id="sellPrice" inputmode="numeric" value="10" style="font-size:22px;font-weight:700">
    <div class="receipt" id="sellRc"></div>
    <p style="font-size:11px;color:rgba(255,255,255,.28);margin-top:10px;font-style:italic">The house adds 15% on top for the buyer. You always get exactly what you list.</p>`,
    '<button class="btn" data-close>Cancel</button><button class="btn em" id="sellGo">List it</button>')}
  <div class="reveal" id="reveal"><div class="stage" id="stage"><div class="rays" id="rays"></div><div id="bigcrate"></div><div class="rcard" id="rcard"></div></div>
    <div class="rtier" id="rtier"></div><div class="rdupe" id="rdupe"></div><div class="rhint" id="rhint"></div><div class="racts" id="racts"></div></div>`;
  bindNav(app); bindBalance();
  onLeave(() => $('reveal')?.remove());
  document.querySelectorAll('#shtabs [data-t]').forEach((b) => b.addEventListener('click', () => go(b.dataset.t)));
  document.querySelectorAll('.seg [data-v]').forEach((b) => b.addEventListener('click', () => { mineOnly = b.dataset.v === 'mine'; paintSeg(); paintGrid(); }));
  $('sellBtn').addEventListener('click', openSell);
  $('sellPrice').addEventListener('input', paintSell);
  $('sellGo').addEventListener('click', submitSell);
  wireConvert();
  $('stage').addEventListener('click', crack);
  api.get(`/profile/${encodeURIComponent(store.user?.username || '')}`).then((p) => { meCos = p.equipped; }).catch(() => {});
  go(tab);
}
function go(t) {
  tab = t;
  document.querySelectorAll('#shtabs [data-t]').forEach((x) => x.classList.toggle('on', x.dataset.t === t));
  document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === `p-${t}`));
  if ($('shscroll')) $('shscroll').scrollTop = 0;
  if (t === 'market') { paintFilters(); paintSeg(); loadListings(); }
  if (t === 'packs') paintPacks();
  if (t === 'convert') paintConvert();
}

// ── preview of an item (same rules as profile) ──────────────────────────────
const me = () => store.user?.username || 'You';
function preview(it, big) {
  const k = big ? 1.35 : 0.95;
  if (it.category === 'avatar_frame') return renderAvatarFrame(it, 74 * k, `<span class="av-initial" style="font-size:${Math.round(21 * k)}px">${esc(me().slice(0, 1).toUpperCase())}</span>`);
  if (['name_aura', 'name_color', 'name_font'].includes(it.category)) return playerName(me(), [it], big ? 30 : 21);
  if (it.category === 'status_title') return `<span style="font-size:${big ? 20 : 14}px;font-style:italic;color:rgba(255,255,255,.62);padding:0 10px;text-align:center">"${esc(it.name)}"</span>`;
  return `<div style="transform:scale(${big ? 1.8 : 1.3})">${renderCosmeticPreview(it).innerHTML}</div>`;
}
function tryOn(it) {
  const cos = { ...(meCos || {}) };
  if (it.category !== 'status_title' && it.category !== 'custom_emoji') cos[it.category] = it;
  const title = it.category === 'status_title' ? it.name : (meCos?.status_title?.name || '');
  return `${playerFrame(me(), cos, 82)}<div style="display:flex;align-items:center;gap:7px;margin-top:8px">${playerName(me(), cos, 24)}${playerBadge(cos)}</div>
    ${title ? `<div style="font-size:12px;font-style:italic;color:rgba(255,255,255,.4)">"${esc(title)}"</div>` : ''}
    ${it.category === 'custom_emoji' ? `<div style="margin-top:8px;padding:8px 14px;border-radius:14px;background:rgba(255,255,255,.06);font-size:14px">gg ${renderCosmeticPreview(it).innerHTML}</div>` : ''}`;
}

// ── market ──────────────────────────────────────────────────────────────────
function paintFilters() {
  $('cats').innerHTML = CATS.map(([k, n]) => `<button class="fc${k === cat ? ' on' : ''}" data-c="${k}">${n}</button>`).join('');
  $('rars').innerHTML = `<button class="fc${!rar ? ' on' : ''}" data-r="">Any rarity</button>` + RARS.map((r) => `<button class="fc${r === rar ? ' on' : ''}" data-r="${r}"><i style="background:${RARITY_COLORS[r]}"></i>${r}</button>`).join('');
  document.querySelectorAll('#cats [data-c]').forEach((b) => b.addEventListener('click', () => { cat = b.dataset.c; paintFilters(); loadListings(); }));
  document.querySelectorAll('#rars [data-r]').forEach((b) => b.addEventListener('click', () => { rar = b.dataset.r; paintFilters(); loadListings(); }));
}
function paintSeg() { document.querySelectorAll('.seg [data-v]').forEach((x) => x.classList.toggle('on', (x.dataset.v === 'mine') === mineOnly)); }
async function loadListings() {
  $('grid').innerHTML = '<div class="page-load" style="grid-column:1/-1;padding:30px">Loading…</div>';
  const q = new URLSearchParams(); if (cat) q.set('category', cat); if (rar) q.set('rarity', rar);
  try { listings = (await api.get(`/shop/listings${q.toString() ? `?${q}` : ''}`)).listings || []; }
  catch (err) { $('grid').innerHTML = `<div class="empty" style="grid-column:1/-1">${esc(err.message)}</div>`; return; }
  paintGrid();
}
function paintGrid() {
  const list = mineOnly ? listings.filter((l) => l.seller === me()) : listings;
  $('count').textContent = `${list.length} listing${list.length === 1 ? '' : 's'} · cheapest first`;
  $('grid').innerHTML = list.length ? list.map((it, i) => {
    const rc = RARITY_COLORS[it.rarity] || '#9ca3af';
    return `<button class="it" data-i="${i}" style="--rc:${rc}">${it.seller === me() ? '<span class="mine-tag">Yours</span>' : ''}
      <div class="pv" style="background:radial-gradient(80% 90% at 50% 100%,${hexA(rc, .16)},transparent 70%)">${preview(it)}</div>
      <div class="bd"><div class="nm">${esc(it.name)}</div><div class="ct">${CATEGORY_LABELS[it.category] || ''} · <span style="color:${rc}">${esc(it.rarity)}</span></div>
      <div class="sl">by ${esc(it.seller)}</div>
      <div class="price"><i class="coin">A</i>${fmt(it.buyer_price_a)}</div></div></button>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1">${mineOnly ? 'You have nothing listed.' : 'Nothing listed in this filter right now.'}</div>`;
  $('grid').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => openItem(list[Number(b.dataset.i)])));
}
function openItem(it) {
  const rc = RARITY_COLORS[it.rarity] || '#9ca3af', mine = it.seller === me(), cost = it.buyer_price_a, A = Number(store.aBalance);
  $('shItem').querySelector('h2').textContent = it.name;
  $('itBody').innerHTML = `<div class="tryon" style="background:radial-gradient(90% 80% at 50% 0%,${hexA(rc, .18)},transparent 70%),#080808;border:1px solid ${hexA(rc, .25)}">
      <div class="l2">${it.category === 'custom_emoji' ? 'In guild chat' : 'On you'}</div>${tryOn(it)}</div>
    <div class="cmp"><div><span>Category</span><b>${CATEGORY_LABELS[it.category] || ''}</b></div><div><span>Rarity</span><b style="color:${rc}">${esc(it.rarity)}</b></div></div>
    ${mine
      ? `<div class="receipt"><div><span>Listed for</span><span>${fmt(it.price_a)} A</span></div><div><span>Buyers pay</span><span>${fmt(cost)} A</span></div><div class="tot"><span>You receive</span><span style="color:var(--gold)">${fmt(it.price_a)} A</span></div></div>`
      : `<div class="receipt"><div><span>Seller gets</span><span>${fmt(it.price_a)} A</span></div><div><span>House cut · 15%</span><span>${fmt(cost - it.price_a)} A</span></div>
         <div class="tot"><span>You pay</span><span style="color:var(--gold)">${fmt(cost)} A</span></div>
         ${A >= cost ? `<div><span>Balance after</span><span>${fmt(A - cost)} A</span></div>` : `<div><span>You have</span><span style="color:#f87171">${fmt(A)} A</span></div>`}</div>`}`;
  $('itFoot').innerHTML = mine
    ? '<button class="btn" data-close>Close</button><button class="btn red" id="cancelL">Cancel listing</button>'
    : `<button class="btn" data-close>Close</button><button class="btn em" id="buyGo" ${A < cost ? 'disabled' : ''}>${A < cost ? `Need ${fmt(cost - A)} more A` : `Buy for ${fmt(cost)} A`}</button>`;
  openSheet('shItem');
  $('buyGo')?.addEventListener('click', async () => {
    $('buyGo').disabled = true;
    try {
      const r = await api.post(`/shop/listings/${it.id}/buy`);
      updateBalance({ a_balance: r.a_balance }); emitBalance();
      closeSheets(); toast(`Bought ${it.name} · it's in your cosmetics`, 'gold');
      listings = listings.filter((x) => x.id !== it.id); paintGrid(); owned = null;
    } catch (err) { toast(err.message || 'Purchase failed', 'red'); $('buyGo').disabled = false; }
  });
  $('cancelL')?.addEventListener('click', async () => {
    try { await api.delete(`/shop/listings/${it.id}`); closeSheets(); toast('Listing cancelled'); listings = listings.filter((x) => x.id !== it.id); paintGrid(); owned = null; }
    catch (err) { toast(err.message || 'Failed to cancel', 'red'); }
  });
}

// ── sell ────────────────────────────────────────────────────────────────────
async function openSell() {
  if (!owned) {
    try { owned = ((await api.get(`/profile/${encodeURIComponent(me())}/cosmetics`)).cosmetics || []).filter((c) => !c.is_equipped); }
    catch (err) { toast(err.message || 'Could not load your items', 'red'); return; }
  }
  if (!owned.length) { toast('Nothing to sell — unequip something or open a pack first'); return; }
  pickO = 0; $('sellPrice').value = TYPICAL[owned[0].rarity] || 10;
  paintSell(); openSheet('shSell');
}
function paintSell() {
  $('owned').innerHTML = owned.map((o, i) => `<button class="ow${i === pickO ? ' on' : ''}" data-o="${i}"><div style="transform:scale(.7);height:58px;display:flex;align-items:center">${preview(o)}</div>
    <small>${esc(o.name)}<br><span style="color:${RARITY_COLORS[o.rarity]}">${esc(o.rarity)}</span></small></button>`).join('');
  $('owned').querySelectorAll('[data-o]').forEach((e) => e.addEventListener('click', () => { pickO = Number(e.dataset.o); $('sellPrice').value = TYPICAL[owned[pickO].rarity] || 10; paintSell(); }));
  const p = amountOf($('sellPrice').value), o = owned[pickO];
  $('sellRc').innerHTML = `<div><span>You receive</span><span>${fmt(p)} A</span></div><div><span>Buyer pays</span><span>${fmt(Math.ceil(p * 1.15))} A</span></div>
    <div><span>Typical ${esc(o.rarity)} price</span><span>${Math.round((TYPICAL[o.rarity] || 10) * 0.8)}–${Math.round((TYPICAL[o.rarity] || 10) * 1.4)} A</span></div>`;
  $('sellGo').disabled = !p;
}
async function submitSell() {
  const o = owned[pickO], p = amountOf($('sellPrice').value); if (!o || !p) return;
  $('sellGo').disabled = true;
  try {
    await api.post('/shop/listings', { user_cosmetic_id: o.user_cosmetic_id, price_a: p });
    closeSheets(); toast(`Listed ${o.name} for ${fmt(p)} A`, 'em');
    owned.splice(pickO, 1); mineOnly = true; cat = ''; rar = ''; paintFilters(); paintSeg(); loadListings();
  } catch (err) { toast(err.message || 'Failed to list', 'red'); }
  $('sellGo').disabled = false;
}

// ── packs ───────────────────────────────────────────────────────────────────
const crate = (pk) => `<div class="crate" style="--c1:${pk.c1};--c2:${pk.c2};--pkg:${pk.glow}"><div class="bx"></div><div class="lid"></div><div class="band"></div><div class="emb">${pk.em}</div></div>`;
function paintPacks() {
  const A = Number(store.aBalance);
  $('packs').innerHTML = PACKS.map((pk, i) => `<div class="pk" style="--pkg:${pk.glow}">${crate(pk)}
    <div><h3>${pk.name}</h3><div class="pd">${pk.desc}</div>
      <div class="odds">${Object.entries(pk.odds).map(([r, v]) => `<i style="width:${v}%;background:${RARITY_COLORS[r]}"></i>`).join('')}</div>
      <div class="oddl">${Object.entries(pk.odds).map(([r, v]) => `<span><i style="background:${RARITY_COLORS[r]}"></i>${r} ${v}%</span>`).join('')}</div></div>
    <div class="buy"><span class="price"><i class="coin">A</i>${pk.price}</span>
      <button class="btn ${A >= pk.price ? 'gold' : ''}" data-pk="${i}" ${A >= pk.price ? '' : 'disabled'}>${A >= pk.price ? 'Open' : `Need ${fmt(pk.price - A)} more A`}</button></div></div>`).join('');
  $('packs').querySelectorAll('[data-pk]').forEach((b) => b.addEventListener('click', () => openPack(Number(b.dataset.pk))));
}
let opening = null;
function openPack(i) {
  const pk = PACKS[i]; if (Number(store.aBalance) < pk.price) return;
  opening = { pk, i, state: 'closed', res: null, req: null };
  opening.req = api.post('/shop/packs/open', { pack_type: pk.type }).then((r) => { opening.res = r; return r; });
  opening.req.catch((err) => { toast(err.message || 'Could not open the pack', 'red'); $('reveal').classList.remove('on'); opening = null; });
  $('bigcrate').className = 'bigcrate'; $('bigcrate').innerHTML = crate(pk); $('bigcrate').style.display = '';
  $('rays').style.opacity = 0; $('rcard').className = 'rcard'; $('rtier').className = 'rtier'; $('rtier').textContent = '';
  $('rdupe').textContent = ''; $('racts').className = 'racts'; $('racts').innerHTML = ''; $('rhint').style.display = ''; $('rhint').textContent = 'Tap the crate to open it';
  $('reveal').classList.add('on');
}
async function crack() {
  if (!opening || opening.state !== 'closed') return;
  const o = opening; o.state = 'shaking'; $('rhint').textContent = '…';
  $('bigcrate').classList.add('shake');
  let r;
  try { r = await o.req; } catch { return; }
  const lv = LV[r.rarity] || 1;
  await new Promise((res) => setTimeout(res, lv >= 4 ? 1400 : 900));
  if (opening !== o) return;
  const rc = RARITY_COLORS[r.rarity] || '#9ca3af';
  $('reveal').style.setProperty('--rc', hexA(rc, .55)); $('reveal').style.setProperty('--rcg', hexA(rc, .5));
  $('bigcrate').style.display = 'none'; $('rhint').style.display = 'none';
  burst(rc);
  $('rays').style.opacity = lv >= 3 ? 0.9 : 0.45;
  $('rcard').style.setProperty('--rc', rc);
  $('rcard').innerHTML = `<div class="pvw">${preview(r.item, lv >= 4)}</div><div class="nm">${esc(r.item.name)}</div><div class="ct">${CATEGORY_LABELS[r.item.category] || ''}</div>`;
  $('rcard').classList.add('on');
  $('rtier').textContent = r.rarity; $('rtier').style.color = rc; $('rtier').classList.add('on');
  $('rdupe').textContent = r.duplicate ? `You already own this — refunded ${fmt(r.refund_a)} A` : '';
  updateBalance({ a_balance: r.a_balance }); emitBalance(); owned = null;
  const again = Number(store.aBalance) >= o.pk.price;
  $('racts').innerHTML = `${r.duplicate ? '' : '<button class="btn" id="rEquip">Equip it</button>'}<button class="btn ${again ? 'gold' : ''}" id="rAgain">${again ? `Open another · ${o.pk.price} A` : 'Done'}</button>`;
  $('racts').classList.add('on');
  $('rEquip')?.addEventListener('click', async () => {
    try { await api.post(`/cosmetics/${r.item.id}/equip`); toast(`${r.item.name} equipped`, 'em'); } catch (err) { toast(err.message || 'Could not equip', 'red'); }
    $('reveal').classList.remove('on'); paintPacks();
  });
  $('rAgain').addEventListener('click', () => { if (again) openPack(o.i); else { $('reveal').classList.remove('on'); paintPacks(); } });
  o.state = 'open';
  if (lv >= 4) toast(`${r.rarity} pull! ${r.item.name}`, 'gold');
}
function burst(c) {
  for (let k = 0; k < 28; k++) {
    const s = document.createElement('div'); s.className = 'spark'; s.style.background = k % 3 ? c : '#fff'; s.style.boxShadow = `0 0 8px ${c}`;
    $('stage').appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 90;
    s.animate([{ transform: 'translate(-50%,-50%) scale(1)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 }],
      { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
  }
}

// ── convert ─────────────────────────────────────────────────────────────────
function paintConvert() {
  const CC = Number(store.ccBalance), v = Math.min(amountOf($('cvIn').value), CC), out = Math.floor(v / 1000), left = v - out * 1000;
  $('cvOut').textContent = fmt(out);
  $('cvLeft').innerHTML = left ? `${fmt(left)} CC can't convert<br>and stays as credits` : (out ? 'Exact — nothing left over' : '');
  $('cvAfter').textContent = `After: ${fmt(CC - out * 1000)} CC · ${fmt(Number(store.aBalance) + out)} A`;
  $('cvGo').disabled = !out;
  $('cvGo').querySelector('span').textContent = out ? `Hold to convert ${fmt(out * 1000)} CC` : 'Enter at least 1,000 CC';
}
function wireConvert() {
  $('cvIn').addEventListener('input', (e) => { const v = amountOf(e.target.value); e.target.value = v ? fmt(v) : ''; paintConvert(); });
  document.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { $('cvIn').value = fmt(Math.floor(Number(store.ccBalance) * Number(b.dataset.p))); paintConvert(); }));
  holdButton($('cvGo'), 1200, async () => {
    const out = Math.floor(Math.min(amountOf($('cvIn').value), Number(store.ccBalance)) / 1000);
    if (!out) return;
    try {
      const r = await api.post('/convert', { amount_cc: out * 1000 });
      updateBalance({ cc_balance: r.cc_balance, a_balance: r.a_balance }); emitBalance();
      toast(`Converted ${fmt(r.converted_cc)} CC into ${fmt(r.received_a)} A`, 'gold');
      $('cvIn').value = fmt(Math.min(1000, Number(store.ccBalance))); paintConvert();
    } catch (err) { toast(err.message || 'Conversion failed', 'red'); }
  });
}

