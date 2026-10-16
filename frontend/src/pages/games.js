import { api } from '../api.js';
import { $, fmt, dockHTML, bindNav, balanceHTML, bindBalance, sheetHTML, openSheet, closeSheets } from '../ui/core.js';
import { mountScene } from '../ui/scenes.js';
import { GAMES, GAME_BY_ID } from '../ui/games-meta.js';

const STYLE = `
.top2{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 4px}
.top2 h1{font-size:24px}
.feat{position:relative;height:200px;margin:10px 12px 0;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.07);cursor:pointer;display:block;width:calc(100% - 24px);background:#080808;text-align:left;color:#fff;padding:0}
.feat canvas,.card canvas,.sv canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.feat .scrim{position:absolute;inset:0;background:linear-gradient(to top,rgba(5,5,5,.96) 4%,rgba(5,5,5,.55) 46%,rgba(5,5,5,.08) 100%)}
.feat .body{position:absolute;left:0;right:0;bottom:0;padding:18px;z-index:2}
.eyebrow{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--em);margin-bottom:7px;display:flex;align-items:center;gap:6px}
.dot{width:5px;height:5px;border-radius:50%;background:var(--em);animation:pulse 2.4s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.25}}
.feat .fname{font-size:32px;font-weight:700;line-height:1}
.feat .fdesc{font-size:12.5px;font-style:italic;color:rgba(255,255,255,.42);margin-top:5px}
.glbl{padding:20px 20px 9px;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.18);display:flex;align-items:center;gap:10px}
.glbl::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06)}
.grid{display:flex;flex-direction:column;gap:8px;padding:0 12px}
.card{position:relative;height:112px;border-radius:14px;overflow:hidden;background:#080808;border:1px solid rgba(255,255,255,.055);cursor:pointer;width:100%;text-align:left;color:#fff;transition:border-color .18s,transform .18s;padding:0}
.card:hover{border-color:rgba(16,185,129,.3)}
.card:active{transform:scale(.985)}
.card .scrim{position:absolute;inset:0;background:linear-gradient(to right,rgba(5,5,5,.97) 2%,rgba(5,5,5,.86) 34%,rgba(5,5,5,.2) 72%,rgba(5,5,5,.05) 100%)}
.card .body{position:absolute;inset:0;padding:16px;z-index:2;display:flex;flex-direction:column;justify-content:center;gap:3px;max-width:66%}
.cname{font-size:17.5px;font-weight:700;line-height:1.1}
.cdesc{font-size:11.5px;font-style:italic;color:rgba(255,255,255,.36);line-height:1.3}
.cstat{font-size:10px;letter-spacing:.06em;color:rgba(255,255,255,.3);margin-top:4px}
.cstat b{color:var(--em)}.cstat b.r{color:var(--red)}
.sv{position:relative;height:38vh;height:38dvh;flex-shrink:0;background:#080808;overflow:hidden;margin:-4px -18px 0;border-radius:0}
.sv .scrim{position:absolute;inset:0;background:linear-gradient(to top,#0b0b0b 3%,rgba(11,11,11,.4) 52%,rgba(11,11,11,0) 100%)}
.stype{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3);margin:-40px 0 6px;position:relative}
.sname{font-size:32px;font-weight:700;line-height:1;position:relative}
.sdesc{font-size:13px;font-style:italic;color:rgba(255,255,255,.4);margin-top:6px}
.sstats{display:flex;gap:26px;margin:18px 0 16px;padding:14px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.sv2{font-size:15px;font-weight:700;color:var(--em)}
.sv2.r{color:var(--red)}
.sl{font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.26);margin-top:3px}
.rules{font-size:12.5px;color:rgba(255,255,255,.5);line-height:1.65}
.fair{margin-top:18px;font-size:11px;color:rgba(255,255,255,.24)}
#shGame .sh-head{position:absolute;right:0;top:0;z-index:5}
#shGame .sh-head h2{display:none}
#shGame{max-height:94%}
@media(min-width:900px){
  .feat{height:310px;margin:16px 20px 0;width:calc(100% - 40px)}
  .feat .body{padding:26px}.feat .fname{font-size:46px}
  .glbl{padding:22px 22px 11px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 20px}
  .card{height:180px}
  .card .scrim{background:linear-gradient(to top,rgba(5,5,5,.96) 6%,rgba(5,5,5,.6) 48%,rgba(5,5,5,.1) 100%)}
  .card .body{max-width:100%;justify-content:flex-end;padding:18px}
  .sv{height:280px}
}
`;

let mine = {};
let sheetScene = null;

export async function renderGames(app) {
  sheetScene = null;
  const featured = GAMES[0];
  app.innerHTML = `<style>${STYLE}</style>
  <div class="scroll"><div class="wrap">
    <div class="top2"><h1>Games</h1>${balanceHTML()}</div>
    <button class="feat" data-g="${featured.id}"><canvas data-sc="${featured.scene}" data-feat></canvas><div class="scrim"></div>
      <div class="body"><div class="eyebrow"><span class="dot"></span>Live · everyone watches the same graph</div>
      <div class="fname">${featured.name}</div><div class="fdesc">${featured.desc}</div></div></button>
    <div class="glbl">Solo</div><div class="grid" id="gsolo"></div>
    <div class="glbl">PvP</div><div class="grid" id="gpvp"></div>
    <div style="height:18px"></div>
  </div></div>
  ${dockHTML('games')}
  ${sheetHTML('shGame', '', `<div class="sv" id="sv"><canvas id="svCv"></canvas><div class="scrim"></div></div>
    <div class="stype" id="stype"></div><div class="sname" id="sname"></div><div class="sdesc" id="sdesc"></div>
    <div class="sstats" id="sstats"></div><div class="rules" id="srules"></div>
    <div class="fair">◈ Provably fair — every round is committed to a hash before it starts.</div>`, '<span id="sbtns" style="display:contents"></span>')}`;
  bindNav(app); bindBalance();

  GAMES.slice(1).forEach((g) => {
    $(g.type === 'solo' ? 'gsolo' : 'gpvp').insertAdjacentHTML('beforeend',
      `<button class="card" data-g="${g.id}"><canvas data-sc="${g.scene}"></canvas><div class="scrim"></div>
        <div class="body"><div class="cname">${g.name}</div><div class="cdesc">${g.desc}</div><div class="cstat" data-stat="${g.id}"></div></div></button>`);
  });
  const wide = () => innerWidth >= 900;
  document.querySelectorAll('canvas[data-sc]').forEach((cv) => {
    const feat = cv.hasAttribute('data-feat');
    mountScene(cv, cv.dataset.sc, feat ? { fps: 60 } : { fps: 30, cx: (W) => (wide() ? W * 0.5 : W * 0.68), lift: wide() ? 0.62 : 0 });
  });
  document.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => openGame(b.dataset.g)));

  // personal record per game from recent history
  try {
    const rows = (await api.get('/games/history?limit=50')).results || [];
    mine = {};
    rows.forEach((r) => { const k = r.game === 'higherlow' ? 'highlow' : r.game; const m = mine[k] || (mine[k] = { n: 0, net: 0, best: 0 }); m.n++; m.net += Number(r.net) || 0; m.best = Math.max(m.best, Number(r.net) || 0); });
    document.querySelectorAll('[data-stat]').forEach((el) => {
      const m = mine[el.dataset.stat];
      el.innerHTML = m ? `${m.n} recent · <b class="${m.net < 0 ? 'r' : ''}">${m.net >= 0 ? '+' : '−'}${fmt(Math.abs(m.net))}</b>` : 'Not played yet';
    });
  } catch { /* stats are optional */ }
}

function openGame(id) {
  const g = GAME_BY_ID[id]; if (!g) return;
  const m = mine[id];
  $('stype').textContent = g.type === 'solo' ? 'Solo · vs House' : 'PvP · vs Player';
  $('sname').textContent = g.name; $('sdesc').textContent = g.desc;
  $('srules').textContent = g.rules;
  $('sstats').innerHTML = m
    ? `<div><div class="sv2">${m.n}</div><div class="sl">Recent rounds</div></div>
       <div><div class="sv2${m.net < 0 ? ' r' : ''}">${m.net >= 0 ? '+' : '−'}${fmt(Math.abs(m.net))}</div><div class="sl">Your net</div></div>
       <div><div class="sv2">+${fmt(m.best)}</div><div class="sl">Best round</div></div>`
    : '<div><div class="sv2" style="color:rgba(255,255,255,.5)">New</div><div class="sl">You haven\'t played this yet</div></div>';
  $('sbtns').innerHTML = g.type === 'solo'
    ? `<button class="btn em" data-go="${g.route}">Play</button>`
    : `<button class="btn" data-go="guild">Play with guild</button><button class="btn em" data-go="${g.route}">Find match</button>`;
  openSheet('shGame');
  if (!sheetScene) sheetScene = mountScene($('svCv'), g.scene, { fps: 60 });
  else sheetScene.setKey(g.scene);
  $('sbtns').querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { closeSheets(); window.__navigate(b.dataset.go); }));
}
