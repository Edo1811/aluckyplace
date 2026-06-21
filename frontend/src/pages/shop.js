import { api } from '../api.js';
import { store, updateBalance } from '../store.js';
import { renderCosmeticPreview, COSMETIC_PREVIEW_KEYFRAMES } from '../cosmeticPreview.js';

const CATEGORIES = [
  { em: '🖼', value: 'avatar_frame', label: 'Avatar Frame' },
  { em: '🏷', value: 'chat_badge',   label: 'Chat Badge' },
  { em: '✍', value: 'status_title', label: 'Status Title' },
  { em: '🔤', value: 'name_font',    label: 'Name Font' },
  { em: '🎨', value: 'name_color',   label: 'Name Color' },
  { em: '✨', value: 'name_aura',    label: 'Name Aura' },
  { em: '😎', value: 'custom_emoji', label: 'Custom Emoji' },
];

const RARITY_COLORS = {
  Common:    { col: '#9ca3af', bg: 'rgba(156,163,175,.08)' },
  Rare:      { col: '#3b82f6', bg: 'rgba(59,130,246,.1)' },
  Epic:      { col: '#a855f7', bg: 'rgba(168,85,247,.1)' },
  Legendary: { col: '#D4AF37', bg: 'rgba(212,175,55,.1)' },
  Exotic:    { col: '#f97316', bg: 'rgba(249,115,22,.1)' },
};

// Mirrors backend/src/shop/packs.js — kept in sync with balance.md
const PACKS = [
  { type: 'starter',      name: 'Starter Pack',     icon: '📦', col: '#9ca3af', price: 15,  desc: 'A little of everything. Good for new players.',          odds: [['Common', 72], ['Rare', 28]] },
  { type: 'high_roller',  name: 'High Roller Pack', icon: '💰', col: '#D4AF37', price: 40,  desc: 'Weighted toward Rare and above. For those with taste.',    odds: [['Common', 45], ['Rare', 35], ['Epic', 17], ['Legendary', 3]] },
  { type: 'epic_cache',   name: 'Epic Cache',       icon: '🔮', col: '#a855f7', price: 75,  desc: 'Rare or better, guaranteed.',                                odds: [['Rare', 40], ['Epic', 42], ['Legendary', 15], ['Exotic', 3]] },
  { type: 'exotic_crate', name: 'Exotic Crate',     icon: '🌋', col: '#f97316', price: 250, desc: 'Epic minimum. The good stuff lives here.',                   odds: [['Epic', 55], ['Legendary', 33], ['Exotic', 12]] },
];

let curTab = 0;
let curCategory = 'All';
let curRarity = 'All';
let mineOnly = false;
let listingsCache = [];

export async function renderShop(app, opts = {}) {
  mineOnly = !!opts.filterMine;
  curTab = 0;
  curCategory = 'All';
  curRarity = 'All';

  inject(app);
  bindEvents(app);
  await loadShopTab();
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
      .sp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif}
      .topbar{padding:14px 18px 0;flex-shrink:0}
      .bal-strip{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-bottom:10px}
      .bal-pill{padding:5px 14px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:12px;color:rgba(255,255,255,.5)}
      .bal-pill span{color:#D4AF37;font-weight:700;margin-left:5px}
      .tabs{display:flex;gap:2px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:4px}
      .tb{flex:1;padding:9px 0;background:none;border:none;border-radius:8px;color:rgba(255,255,255,.3);font-size:12.5px;cursor:pointer;font-family:'Playfair Display',Georgia,serif;transition:background .18s,color .18s}
      .tb.on{background:rgba(212,175,55,.12);color:#D4AF37;font-weight:700}
      #content{flex:1;overflow:hidden;display:flex}

      .pshop{display:flex;flex:1;overflow:hidden;width:100%}
      .sidebar{width:148px;flex-shrink:0;border-right:1px solid rgba(255,255,255,.06);overflow-y:auto;padding:12px 0;scrollbar-width:none}
      .sidebar::-webkit-scrollbar{display:none}
      .shead{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.18);padding:0 14px 6px}
      .scat{display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;border-left:2px solid transparent;transition:all .15s;font-size:12px;color:rgba(255,255,255,.38)}
      .scat:hover{background:rgba(255,255,255,.025);color:rgba(255,255,255,.6)}
      .scat.on{border-left-color:#D4AF37;background:rgba(212,175,55,.06);color:#D4AF37}
      .scat-em{font-size:14px;width:18px;text-align:center}
      .sdiv{height:1px;background:rgba(255,255,255,.05);margin:8px 14px}
      .rcat{display:flex;align-items:center;gap:6px;padding:7px 14px;cursor:pointer;border-left:2px solid transparent;transition:all .15s;font-size:11.5px;color:rgba(255,255,255,.3)}
      .rcat:hover{color:rgba(255,255,255,.5)}
      .rcat.on{border-left-color:var(--rc);color:var(--rc)}
      .rdot{width:8px;height:8px;border-radius:50%;background:var(--rc);flex-shrink:0}

      .grid-wrap{flex:1;overflow-y:auto;padding:14px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.07) transparent}
      .grid-wrap::-webkit-scrollbar{width:3px}
      .grid-wrap::-webkit-scrollbar-thumb{background:rgba(255,255,255,.08)}
      .grid-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:8px}
      .grid-label{font-size:11px;color:rgba(255,255,255,.25)}
      .mine-btn{padding:5px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:7px;color:rgba(255,255,255,.4);font-size:11px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .mine-btn.on{background:rgba(212,175,55,.12);border-color:rgba(212,175,55,.25);color:#D4AF37}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      .item{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;position:relative}
      .item-preview{height:64px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:9px;position:relative;overflow:hidden}
      .rarity-bar{position:absolute;bottom:0;left:0;right:0;height:3px}
      .iname{font-size:12px;font-weight:700;color:#fff;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .iseller{font-size:10px;color:rgba(255,255,255,.25);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .iprice-row{display:flex;align-items:center;justify-content:space-between}
      .iprice{font-size:13px;font-weight:700;color:#D4AF37}
      .ibuy{padding:5px 10px;background:rgba(212,175,55,.12);border:1px solid rgba(212,175,55,.2);border-radius:6px;color:#D4AF37;font-size:10.5px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .ibuy:hover{background:rgba(212,175,55,.22)}
      .icancel{padding:5px 10px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);border-radius:6px;color:#ef4444;font-size:10.5px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .cut-note{font-size:9px;color:rgba(255,255,255,.15);text-align:center;padding:8px 0;border-top:1px solid rgba(255,255,255,.04);margin-top:6px}
      .empty-note{font-size:12px;color:rgba(255,255,255,.25);text-align:center;padding:40px 20px;font-style:italic}

      .packs-wrap{flex:1;overflow-y:auto;padding:18px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.07) transparent}
      .packs-note{font-size:12px;color:rgba(255,255,255,.28);font-style:italic;text-align:center;margin-bottom:18px;line-height:1.6}
      .packs-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
      .pack{border-radius:14px;padding:18px;cursor:pointer;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden;background:rgba(255,255,255,.03)}
      .pack:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.5)}
      .pack-glow{position:absolute;inset:0;opacity:.12;pointer-events:none}
      .pack-icon{font-size:36px;margin-bottom:10px;display:block;text-align:center}
      .pack-name{font-size:15px;font-weight:700;color:#fff;text-align:center;margin-bottom:4px}
      .pack-desc{font-size:11px;color:rgba(255,255,255,.45);text-align:center;margin-bottom:12px;line-height:1.55}
      .pack-odds{display:flex;flex-direction:column;gap:3px;margin-bottom:12px}
      .pod{display:flex;justify-content:space-between;font-size:10.5px;padding:3px 0}
      .pod-r{font-weight:700}
      .pack-price{text-align:center;font-size:18px;font-weight:700;color:#D4AF37;margin-bottom:10px}
      .pack-btn{width:100%;padding:10px;border:none;border-radius:9px;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .pack-btn:hover{opacity:.85}
      .pack-btn:disabled{opacity:.4;cursor:not-allowed}

      .conv-wrap{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:20px;width:100%}
      .conv-card{width:100%;max-width:340px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:24px}
      .conv-title{font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;text-align:center}
      .conv-sub{font-size:12px;color:rgba(255,255,255,.3);text-align:center;font-style:italic;margin-bottom:20px}
      .conv-rate{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:20px}
      .conv-side{text-align:center}
      .conv-big{font-size:28px;font-weight:700}
      .conv-lbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-top:2px}
      .conv-arrow{font-size:20px;color:rgba(255,255,255,.2)}
      .conv-input-wrap{margin-bottom:14px}
      .conv-ilbl{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:6px}
      .conv-input{width:100%;padding:11px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:9px;color:#fff;font-size:16px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none}
      .conv-input:focus{border-color:rgba(212,175,55,.4)}
      .conv-result{background:rgba(212,175,55,.07);border:1px solid rgba(212,175,55,.15);border-radius:9px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
      .conv-res-lbl{font-size:12px;color:rgba(255,255,255,.35)}
      .conv-res-n{font-size:20px;font-weight:700;color:#D4AF37}
      .conv-btn{width:100%;padding:12px;background:#D4AF37;border:none;border-radius:9px;color:#000;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .conv-btn:hover{opacity:.88}
      .conv-btn:disabled{opacity:.4;cursor:not-allowed}
      .conv-warn{font-size:11px;color:rgba(255,255,255,.2);text-align:center;font-style:italic;line-height:1.6}
      .conv-bal{font-size:12px;color:rgba(255,255,255,.28);text-align:center}
      .conv-bal span{color:#D4AF37;font-weight:700}

      .dock-wrap{display:flex;justify-content:center;padding:9px 0 13px;background:#050505;flex-shrink:0}
      .pill{display:flex;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:40px;padding:8px 16px;gap:2px}
      .di{width:42px;height:42px;display:flex;align-items:center;justify-content:center;border-radius:50%;cursor:pointer;position:relative;transition:background .15s}
      .di:hover{background:rgba(255,255,255,.07)}
      .di.on svg{opacity:1}
      .di.on::after{content:'';position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#D4AF37}
      .di svg{opacity:.4;transition:opacity .15s}
      .toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;white-space:nowrap;z-index:200;opacity:0;transition:opacity .25s;pointer-events:none;font-family:'Playfair Display',Georgia,serif}
      .toast.green{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.35);color:#10b981}
      .toast.red{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.35);color:#ef4444}
      .toast.gold{background:rgba(212,175,55,.15);border:1px solid rgba(212,175,55,.35);color:#D4AF37}
      .toast.show{opacity:1}
    </style>

    <div class="sp">
      <div class="topbar">
        <div class="bal-strip">
          <div class="bal-pill">CC <span id="ccbal">${Number(store.ccBalance).toLocaleString()}</span></div>
          <div class="bal-pill">A <span id="abal">${Number(store.aBalance).toLocaleString()}</span></div>
        </div>
        <div class="tabs">
          <button class="tb on" id="tab0">Player Shop</button>
          <button class="tb" id="tab1">Packs</button>
          <button class="tb" id="tab2">Convert CC → A</button>
        </div>
      </div>
      <div id="content"></div>
      <div class="dock-wrap">
        <div class="pill">
          <div class="di" id="nav-home"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg></div>
          <div class="di" id="nav-games"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/></svg></div>
          <div class="di"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg></div>
          <div class="di on"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/></svg></div>
          <div class="di" id="nav-profile"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg></div>
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

function setBalances(cc, a) {
  if (cc !== undefined) {
    store.ccBalance = cc;
    const el = document.getElementById('ccbal'); if (el) el.textContent = Number(cc).toLocaleString();
  }
  if (a !== undefined) {
    store.aBalance = a;
    const el = document.getElementById('abal'); if (el) el.textContent = Number(a).toLocaleString();
  }
  updateBalance({ cc_balance: cc, a_balance: a });
}

async function loadShopTab() {
  const c = document.getElementById('content');
  if (curTab === 0) { c.style.display = 'flex'; await renderPlayerShop(c); }
  else if (curTab === 1) { c.style.display = 'flex'; renderPacks(c); }
  else { c.style.display = 'flex'; renderConvert(c); }
}

async function renderPlayerShop(c) {
  c.innerHTML = `<div class="pshop"><div class="grid-wrap"><div class="empty-note">Loading listings…</div></div></div>`;

  const params = new URLSearchParams();
  if (curCategory !== 'All') params.set('category', curCategory);
  if (curRarity !== 'All') params.set('rarity', curRarity);

  try {
    const res = await api.get(`/shop/listings${params.toString() ? '?' + params : ''}`);
    listingsCache = res.listings || [];
  } catch (err) {
    listingsCache = [];
    showToast(err.message || 'Failed to load shop', 'red');
  }

  const myUsername = store.user?.username;
  const filtered = mineOnly ? listingsCache.filter(l => l.seller === myUsername) : listingsCache;

  c.innerHTML = `
    <div class="pshop">
      <div class="sidebar">
        <div class="shead">Category</div>
        <div class="scat${curCategory === 'All' ? ' on' : ''}" data-cat="All"><span class="scat-em">🛍</span>All</div>
        ${CATEGORIES.map(cat => `
          <div class="scat${curCategory === cat.value ? ' on' : ''}" data-cat="${cat.value}">
            <span class="scat-em">${cat.em}</span>${cat.label}
          </div>`).join('')}
        <div class="sdiv"></div>
        <div class="shead">Rarity</div>
        <div class="rcat${curRarity === 'All' ? ' on' : ''}" style="--rc:rgba(255,255,255,.3)" data-rarity="All">
          <div style="width:8px;height:8px;border-radius:50%;border:1px solid rgba(255,255,255,.25)"></div>All
        </div>
        ${Object.keys(RARITY_COLORS).map(r => `
          <div class="rcat${curRarity === r ? ' on' : ''}" style="--rc:${RARITY_COLORS[r].col}" data-rarity="${r}">
            <div class="rdot" style="background:${RARITY_COLORS[r].col}"></div>${r}
          </div>`).join('')}
      </div>
      <div class="grid-wrap">
        <div class="grid-top">
          <span class="grid-label">${filtered.length} listing${filtered.length === 1 ? '' : 's'}</span>
          <button class="mine-btn${mineOnly ? ' on' : ''}" id="mineToggle">${mineOnly ? '✓ ' : ''}My Listings</button>
        </div>
        ${filtered.length === 0
          ? `<div class="empty-note">${mineOnly ? "You don't have anything listed." : 'No listings match these filters yet.'}</div>`
          : `<div class="grid">
              ${filtered.map(it => {
                const R = RARITY_COLORS[it.rarity] || RARITY_COLORS.Common;
                const isMine = it.seller === myUsername;
                const preview = renderCosmeticPreview(it);
                return `<div class="item">
                  <div class="item-preview" style="${preview.boxStyle || `background:${R.bg}`}">
                    ${preview.innerHTML}
                    <div class="rarity-bar" style="background:${R.col}"></div>
                  </div>
                  <div class="iname">${it.name}</div>
                  <div class="iseller">by ${it.seller}</div>
                  <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px">
                    <span style="font-size:10px;font-weight:700;color:${R.col};background:${R.bg};padding:2px 7px;border-radius:8px;border:1px solid ${R.col}33">${it.rarity}</span>
                  </div>
                  <div class="iprice-row">
                    <span class="iprice">${it.buyer_price_a} A</span>
                    ${isMine
                      ? `<button class="icancel" data-cancel="${it.id}">Cancel</button>`
                      : `<button class="ibuy" data-buy="${it.id}">Buy</button>`}
                  </div>
                </div>`;
              }).join('')}
            </div>`}
        <div class="cut-note">15% of every sale goes to the house. Listed prices are what the seller receives.</div>
      </div>
    </div>`;
}

function renderPacks(c) {
  c.innerHTML = `
    <div class="packs-wrap">
      <div class="packs-note">The shop never sells cosmetics directly.<br>Open packs to earn them — or buy from other players.</div>
      <div class="packs-grid">
        ${PACKS.map(p => `
          <div class="pack" style="border:1px solid ${p.col}33">
            <div class="pack-glow" style="background:radial-gradient(circle at 50% 0%,${p.col},transparent 70%)"></div>
            <span class="pack-icon">${p.icon}</span>
            <div class="pack-name">${p.name}</div>
            <div class="pack-desc">${p.desc}</div>
            <div class="pack-odds">${p.odds.map(([r, pct]) => {
              const col = RARITY_COLORS[r]?.col || '#9ca3af';
              return `<div class="pod"><span style="color:${col};font-size:10.5px">${r}</span><span class="pod-r" style="color:${col}">${pct}%</span></div>`;
            }).join('')}</div>
            <div class="pack-price">${p.price} A</div>
            <button class="pack-btn" style="background:${p.col};color:#000" data-pack="${p.type}" ${store.aBalance < p.price ? 'disabled' : ''}>Open Pack</button>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderConvert(c) {
  c.innerHTML = `
    <div class="conv-wrap">
      <div class="conv-card">
        <div class="conv-title">Convert CC to A</div>
        <div class="conv-sub">Tokens are never lost. Credits are gone forever.</div>
        <div class="conv-rate">
          <div class="conv-side"><div class="conv-big" style="color:#10b981">1,000</div><div class="conv-lbl">Credits (CC)</div></div>
          <div class="conv-arrow">→</div>
          <div class="conv-side"><div class="conv-big" style="color:#D4AF37">1</div><div class="conv-lbl">Token (A)</div></div>
        </div>
        <div class="conv-input-wrap">
          <div class="conv-ilbl">Amount to convert (CC)</div>
          <input class="conv-input" id="ccin" type="number" min="1000" step="1000" placeholder="1000">
        </div>
        <div class="conv-result">
          <span class="conv-res-lbl">You receive</span>
          <span class="conv-res-n" id="conv-out">— A</span>
        </div>
        <button class="conv-btn" id="convertBtn">Convert</button>
      </div>
      <div class="conv-warn">Conversion is permanent and one-way.<br>You cannot convert A back to CC.</div>
      <div class="conv-bal">Your balance: <span id="ccshow">${Number(store.ccBalance).toLocaleString()}</span> CC · <span id="ashow">${Number(store.aBalance).toLocaleString()}</span> A</div>
    </div>`;
}

function bindEvents(app) {
  // Tabs
  ['tab0', 'tab1', 'tab2'].forEach((id, i) => {
    document.getElementById(id).addEventListener('click', async () => {
      curTab = i;
      document.querySelectorAll('.tb').forEach((t, j) => t.classList.toggle('on', j === i));
      await loadShopTab();
    });
  });

  // Dock
  document.getElementById('nav-home').addEventListener('click', () => window.__navigate('home'));
  document.getElementById('nav-games').addEventListener('click', () => window.__navigate('games'));
  document.getElementById('nav-profile').addEventListener('click', () => window.__navigate('profile'));

  // Delegated content clicks (sidebar filters, buy/cancel, my-listings toggle, packs, convert)
  app.addEventListener('click', async (e) => {
    const cat = e.target.closest('[data-cat]');
    if (cat) { curCategory = cat.dataset.cat; return renderPlayerShop(document.getElementById('content')); }

    const rarity = e.target.closest('[data-rarity]');
    if (rarity) { curRarity = rarity.dataset.rarity; return renderPlayerShop(document.getElementById('content')); }

    if (e.target.id === 'mineToggle') { mineOnly = !mineOnly; return renderPlayerShop(document.getElementById('content')); }

    const buyBtn = e.target.closest('[data-buy]');
    if (buyBtn) {
      const id = buyBtn.dataset.buy;
      buyBtn.disabled = true; buyBtn.textContent = '…';
      try {
        const res = await api.post(`/shop/listings/${id}/buy`);
        setBalances(undefined, res.a_balance);
        showToast(`Bought for ${res.paid_a} A!`, 'gold');
        await renderPlayerShop(document.getElementById('content'));
      } catch (err) {
        showToast(err.message || 'Purchase failed', 'red');
        buyBtn.disabled = false; buyBtn.textContent = 'Buy';
      }
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel]');
    if (cancelBtn) {
      const id = cancelBtn.dataset.cancel;
      cancelBtn.disabled = true; cancelBtn.textContent = '…';
      try {
        await api.delete(`/shop/listings/${id}`);
        showToast('Listing cancelled', 'green');
        await renderPlayerShop(document.getElementById('content'));
      } catch (err) {
        showToast(err.message || 'Failed to cancel', 'red');
        cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel';
      }
      return;
    }

    const packBtn = e.target.closest('[data-pack]');
    if (packBtn) {
      const packType = packBtn.dataset.pack;
      packBtn.disabled = true; packBtn.textContent = 'Opening…';
      try {
        const res = await api.post('/shop/packs/open', { pack_type: packType });
        setBalances(undefined, res.a_balance);
        if (res.duplicate) {
          showToast(`Already owned ${res.item.name} — refunded ${res.refund_a} A`, 'gold');
        } else {
          showToast(`🎉 ${res.rarity}: ${res.item.name}!`, 'gold');
        }
      } catch (err) {
        showToast(err.message || 'Failed to open pack', 'red');
      } finally {
        packBtn.disabled = (store.aBalance < PACKS.find(p => p.type === packType).price);
        packBtn.textContent = 'Open Pack';
      }
      return;
    }

    if (e.target.id === 'convertBtn') {
      const input = document.getElementById('ccin');
      const amount = parseInt(input.value) || 0;
      if (amount < 1000) return showToast('Minimum conversion is 1,000 CC', 'red');
      e.target.disabled = true; e.target.textContent = 'Converting…';
      try {
        const res = await api.post('/convert', { amount_cc: amount });
        setBalances(res.cc_balance, res.a_balance);
        document.getElementById('ccshow').textContent = Number(res.cc_balance).toLocaleString();
        document.getElementById('ashow').textContent = Number(res.a_balance).toLocaleString();
        input.value = '';
        document.getElementById('conv-out').textContent = '— A';
        showToast(`Converted ${res.converted_cc.toLocaleString()} CC → ${res.received_a} A`, 'gold');
      } catch (err) {
        showToast(err.message || 'Conversion failed', 'red');
      } finally {
        e.target.disabled = false; e.target.textContent = 'Convert';
      }
      return;
    }
  });

  // Live convert preview
  app.addEventListener('input', (e) => {
    if (e.target.id !== 'ccin') return;
    const v = parseInt(e.target.value) || 0;
    const out = Math.floor(v / 1000);
    document.getElementById('conv-out').textContent = out > 0 ? `${out} A` : '— A';
  });
}
