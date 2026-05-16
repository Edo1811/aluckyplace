import { api } from '../api.js';
import { store } from '../store.js';

const GAMES = [
  { id:'crash',    name:'Crash',              desc:'Cash out before it crashes.',        type:'solo', anim:'crash',  rules:'A multiplier climbs from 1×. Cash out anytime — stay too long and lose everything.', stats:['847','145,200 CC','50,000 CC'], ab:'CR' },
  { id:'blackjack',name:'Blackjack',          desc:'Pick cards, beat the dealer.',       type:'solo', anim:'bj',     rules:'Get closer to 21 than the dealer without going over. Hit, stand, double, or split.', stats:['312','28,400 CC','15,000 CC'], ab:'BJ' },
  { id:'slots',    name:'Slots',              desc:'Spin to win. Probably lose.',        type:'solo', anim:'slots',  rules:'Spin 3 reels and match symbols. Multipliers up to 100×.', stats:['521','89,100 CC','5,000 CC'], ab:'SL' },
  { id:'roulette', name:'Roulette',           desc:'Big swings. Classic.',               type:'solo', anim:'ph',     rules:'Bet on a number, color, or range. European single-zero wheel.', stats:['198','72,000 CC','35,000 CC'], ab:'RL', phc:'#110306' },
  { id:'dice',     name:'Dice',               desc:'Bet over/under. Done in seconds.',  type:'solo', anim:'ph',     rules:'Pick a threshold and bet OVER or UNDER. Payout scales with risk.', stats:['89','12,800 CC','8,500 CC'], ab:'DC', phc:'#030711' },
  { id:'mines',    name:'Mines',              desc:'One wrong tile ends everything.',   type:'solo', anim:'ph',     rules:'5×5 grid — 5 bombs hidden. Pick safe tiles and cash out whenever you dare.', stats:['234','41,600 CC','20,000 CC'], ab:'MN', phc:'#030d04' },
  { id:'plinko',   name:'Plinko',             desc:'Drop the ball, collect the chaos.', type:'solo', anim:'ph',     rules:'Drop a ball down a 12-row peg board into multiplier slots.', stats:['156','33,000 CC','10,000 CC'], ab:'PL', phc:'#08031a' },
  { id:'coinflip', name:'Coinflip',           desc:'Heads or tails. Classic.',          type:'pvp',  anim:'ph',     rules:'Both players bet. A coin decides everything. Winner takes full pot.', stats:['445','95,000 CC','47,500 CC'], ab:'CF', phc:'#130f00' },
  { id:'rps',      name:'Rock Paper Scissors',desc:'Fast, dumb, perfect.',              type:'pvp',  anim:'ph',     rules:'Both players pick simultaneously. Best of 3 wins the pot.', stats:['178','22,000 CC','11,000 CC'], ab:'RS', phc:'#000e13' },
  { id:'uno',      name:'Uno',                desc:'Bet on every card.',                type:'pvp',  anim:'ph',     rules:'Simplified Uno. First to empty their hand wins the full pot.', stats:['67','18,400 CC','9,200 CC'], ab:'UN', phc:'#130003' },
  { id:'highlow',  name:'Higher or Lower',    desc:'Whose number wins?',                type:'pvp',  anim:'ph',     rules:'Both players get a hidden number 1–100. Higher wins the pot.', stats:['134','31,000 CC','15,500 CC'], ab:'HL', phc:'#001308' },
  { id:'duels',    name:'Duels',              desc:'Bluff. Attack. Survive.',           type:'pvp',  anim:'ph',     rules:'Turn-based bluffing. Attack / Defend / Special each round. Last one standing wins.', stats:['93','44,000 CC','22,000 CC'], ab:'DU', phc:'#0f0014' },
];

let curIdx = 0, htpOpen = false, hoverTimer = null;
let animId = null, cT = 0, cPhase = 'up', cFlash = 0, bjPhase = 0, slotOff = [0,0,0];
const SSYMS = ['7','★','BAR','$','3×'];

export function renderGames(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
      body { background:#050505 }
      .gp { display:flex; flex-direction:column; height:100vh; background:#050505; overflow:hidden }
      .gmain { display:flex; flex:1; overflow:hidden }
      .gl { width:238px; flex-shrink:0; border-right:1px solid rgba(255,255,255,.06); overflow-y:auto; scrollbar-width:none }
      .gl::-webkit-scrollbar { display:none }
      .gdiv { padding:16px 16px 6px; font-size:9.5px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.17); font-family:'Playfair Display',Georgia,serif }
      .gr { height:55px; display:flex; align-items:center; padding:0 16px; gap:12px; cursor:pointer; border-left:3px solid transparent; transition:border-color .2s,background .2s; user-select:none }
      .gr:hover { background:rgba(255,255,255,.025) }
      .gr.on { border-left-color:#10b981; background:rgba(16,185,129,.06) }
      .gi { width:28px; height:28px; border-radius:7px; background:rgba(255,255,255,.07); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; font-weight:700; color:rgba(255,255,255,.32); font-family:'Playfair Display',Georgia,serif; transition:background .2s,color .2s }
      .gr.on .gi { background:rgba(16,185,129,.15); color:#10b981 }
      .gn { font-size:13px; color:rgba(255,255,255,.48); font-family:'Playfair Display',Georgia,serif; transition:color .2s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
      .gr.on .gn { color:#fff; font-weight:700 }
      .gright { flex:1; position:relative; overflow:hidden }
      #phbg { position:absolute; inset:0; background:#050505; transition:background .5s; pointer-events:none }
      #bgc  { position:absolute; inset:0; width:100%; height:100%; pointer-events:none }
      .ov   { position:absolute; inset:0; background:linear-gradient(to top,rgba(5,5,5,.97) 0%,rgba(5,5,5,.58) 44%,rgba(5,5,5,.14) 100%); pointer-events:none }
      .pc   { position:absolute; bottom:0; left:0; right:0; padding:22px 28px; z-index:2 }
      .pname { font-family:'Playfair Display',Georgia,serif; font-size:38px; font-weight:700; color:#fff; line-height:1; margin-bottom:4px }
      .pdesc { font-size:13px; color:rgba(255,255,255,.4); font-style:italic; margin-bottom:12px }
      .stats { display:flex; gap:20px; margin-bottom:10px }
      .sv { font-family:'Playfair Display',Georgia,serif; font-size:14px; font-weight:700; color:#10b981 }
      .sl { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.24); margin-top:2px }
      .htpbtn { background:none; border:none; padding:0; font-size:11px; color:rgba(255,255,255,.28); cursor:pointer; font-family:'Playfair Display',Georgia,serif; letter-spacing:.05em; transition:color .15s }
      .htpbtn:hover { color:rgba(255,255,255,.5) }
      .htptxt { font-size:11.5px; color:rgba(255,255,255,.38); line-height:1.65; max-height:0; overflow:hidden; transition:max-height .3s; margin-top:5px }
      .htptxt.open { max-height:80px }
      .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px }
      .bp { padding:10px 24px; background:#10b981; border:none; border-radius:9px; color:#fff; font-size:13.5px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer; letter-spacing:.03em; transition:background .15s }
      .bp:hover { background:#0ea472 }
      .bs { padding:10px 15px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1); border-radius:9px; color:rgba(255,255,255,.55); font-size:12px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer; transition:background .15s }
      .bs:hover { background:rgba(255,255,255,.12) }
      .dock-wrap { display:flex; justify-content:center; padding:8px 0 11px; background:#050505; border-top:1px solid rgba(255,255,255,.05); flex-shrink:0 }
      .pill { display:flex; align-items:center; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:40px; padding:6px 14px; gap:2px }
      .di { width:40px; height:40px; display:flex; align-items:center; justify-content:center; border-radius:50%; cursor:pointer; position:relative; transition:background .15s }
      .di:hover { background:rgba(255,255,255,.07) }
      .di.on svg { opacity:1 }
      .di.on::after { content:''; position:absolute; bottom:-3px; left:50%; transform:translateX(-50%); width:4px; height:4px; border-radius:50%; background:#10b981 }
      .di svg { opacity:.4; transition:opacity .15s }
    </style>

    <div class="gp">
      <div class="gmain">
        <div class="gl" id="gl"></div>
        <div class="gright">
          <div id="phbg"></div>
          <canvas id="bgc"></canvas>
          <div class="ov"></div>
          <div class="pc">
            <div class="pname" id="pname"></div>
            <div class="pdesc" id="pdesc"></div>
            <div class="stats">
              <div><div class="sv" id="s1"></div><div class="sl">Playing now</div></div>
              <div><div class="sv" id="s2"></div><div class="sl">Last big win</div></div>
              <div><div class="sv" id="s3"></div><div class="sl">Biggest active bet</div></div>
            </div>
            <div>
              <button class="htpbtn" id="htpbtn">▸ How to play</button>
              <div class="htptxt" id="htptxt"></div>
            </div>
            <div class="btns" id="btns"></div>
          </div>
        </div>
      </div>
      <div class="dock-wrap">
        <div class="pill">
          <div class="di" id="nav-home">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7.5L9 2l7 5.5V16H2V7.5z"/><path d="M6.5 16v-5h5v5"/></svg>
          </div>
          <div class="di on">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="14" height="9" rx="2.5"/><path d="M6 9.5h2m-1-1v2"/><circle cx="12" cy="9" r=".85" fill="white"/><circle cx="13.8" cy="10.2" r=".85" fill="white"/></svg>
          </div>
          <div class="di"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6" r="2.5"/><path d="M1.5 15c0-2.76 2.24-5 5-5s5 2.24 5 5"/><circle cx="13" cy="5.5" r="2"/><path d="M16.5 14c0-2.21-1.57-4-3.5-4"/></svg></div>
          <div class="di"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h10l-1.2 8H5.2L4 4z"/><path d="M6.5 4c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"/><circle cx="6.5" cy="14.5" r="1"/><circle cx="11.5" cy="14.5" r="1"/></svg></div>
          <div class="di"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="3"/><path d="M2 16c0-3.87 3.13-7 7-7s7 3.13 7 7"/></svg></div>
        </div>
      </div>
    </div>
  `;

  buildList();
  setupCanvas();
  select(0);

  document.getElementById('nav-home').addEventListener('click', () => { stopAnim(); window.__navigate('home'); });
  document.getElementById('htpbtn').addEventListener('click', () => {
    htpOpen = !htpOpen;
    document.getElementById('htptxt').classList.toggle('open', htpOpen);
    document.getElementById('htpbtn').textContent = (htpOpen ? '▾' : '▸') + ' How to play';
  });

  document.getElementById('btns').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const g = GAMES[curIdx];
    console.log('btn clicked, game:', g.id, 'type:', g.type, 'btn class:', btn.className); // ADD THIS

    if (g.type === 'solo') {
      stopAnim();
      window.__navigate('game-' + g.id);
      return;
    }

    // PvP
    if (btn.classList.contains('bp')) {
      // Find Match
      stopAnim();
      window.__navigate('matchmaking-' + g.id);
    }
    // Play with Friends — Phase 7 (guild context)
  });
}

function buildList() {
  const gl = document.getElementById('gl');
  let prevType = null;
  GAMES.forEach((g, i) => {
    if (g.type !== prevType) {
      const d = document.createElement('div');
      d.className = 'gdiv';
      d.textContent = g.type === 'solo' ? 'Solo' : 'PvP';
      gl.appendChild(d);
      prevType = g.type;
    }
    const r = document.createElement('div');
    r.className = 'gr' + (i === 0 ? ' on' : '');
    r.innerHTML = `<div class="gi">${g.ab}</div><div class="gn">${g.name}</div>`;
    r.addEventListener('mouseenter', () => { clearTimeout(hoverTimer); hoverTimer = setTimeout(() => select(i), 250); });
    r.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    r.addEventListener('click', () => select(i));
    gl.appendChild(r);
  });
}

function select(i) {
  curIdx = i; htpOpen = false;
  document.getElementById('htptxt').classList.remove('open');
  document.getElementById('htpbtn').textContent = '▸ How to play';
  document.querySelectorAll('.gr').forEach((r, j) => r.classList.toggle('on', j === i));
  const g = GAMES[i];
  document.getElementById('pname').textContent = g.name;
  document.getElementById('pdesc').textContent = g.desc;
  document.getElementById('s1').textContent = g.stats[0];
  document.getElementById('s2').textContent = g.stats[1];
  document.getElementById('s3').textContent = g.stats[2];
  document.getElementById('htptxt').textContent = g.rules;
  document.getElementById('btns').innerHTML = g.type === 'solo'
    ? `<button class="bp">Play</button>`
    : `<button class="bp">Find Match</button><button class="bs">Play with Friends</button>`;
  startAnim(g);
}

// ── Canvas ────────────────────────────────────────────────────────────────────
let canvas, ctx, phbg;
function setupCanvas() {
  canvas = document.getElementById('bgc');
  ctx    = canvas.getContext('2d');
  phbg   = document.getElementById('phbg');
  function resize() { const r = canvas.parentElement.getBoundingClientRect(); if (r.width > 0) { canvas.width = r.width; canvas.height = r.height; } }
  resize();
  try { new ResizeObserver(resize).observe(canvas.parentElement); } catch(e) {}
}

function stopAnim() { if (animId) { cancelAnimationFrame(animId); animId = null; } }

function startAnim(g) {
  stopAnim();
  phbg.style.background = g.phc || '#050505';
  if (g.anim === 'crash') animCrash();
  else if (g.anim === 'bj') animBJ();
  else if (g.anim === 'slots') animSlots();
  else if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.arcTo(x+w,y,x+w,y+r,r);c.lineTo(x+w,y+h-r);c.arcTo(x+w,y+h,x+w-r,y+h,r);c.lineTo(x+r,y+h);c.arcTo(x,y+h,x,y+h-r,r);c.lineTo(x,y+r);c.arcTo(x,y,x+r,y,r);c.closePath();}

function animCrash() {
  const W=canvas.width,H=canvas.height,dt=0.016;
  ctx.clearRect(0,0,W,H);
  if(cPhase==='up'){cT+=dt/6;if(cT>=1){cPhase='crash';cFlash=0;}}
  else{cFlash+=dt;if(cFlash>2){cPhase='up';cT=0;}}
  const drawT=cPhase==='crash'?1:cT,maxE=Math.exp(2.14),isCrash=cPhase==='crash',gc=isCrash?'rgba(239,68,68,':'rgba(16,185,129,';
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
  for(let i=0;i<4;i++){const y=H*.18+i*(H*.62/3);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  const grad=ctx.createLinearGradient(0,H*.18,0,H*.84);
  grad.addColorStop(0,gc+'0.1)');grad.addColorStop(1,gc+'0)');
  ctx.beginPath();let first=true;
  for(let i=0;i<=60;i++){const t=i/60;if(t>drawT)break;const x=W*.07+t*(W*.86),y=H*.84-(Math.exp(t*2.14)/maxE)*(H*.62);if(first){ctx.moveTo(x,H*.84);first=false;}ctx.lineTo(x,y);}
  ctx.lineTo(W*.07+drawT*(W*.86),H*.84);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.strokeStyle=gc+'0.88)';ctx.lineWidth=2.2;ctx.lineJoin='round';first=true;
  for(let i=0;i<=60;i++){const t=i/60;if(t>drawT)break;const x=W*.07+t*(W*.86),y=H*.84-(Math.exp(t*2.14)/maxE)*(H*.62);if(first){ctx.moveTo(x,y);first=false;}else ctx.lineTo(x,y);}
  ctx.stroke();
  ctx.font='bold 30px "Playfair Display",Georgia,serif';ctx.fillStyle=isCrash?'rgba(239,68,68,.9)':'rgba(16,185,129,.85)';ctx.textAlign='right';ctx.textBaseline='top';
  ctx.fillText(isCrash?'CRASH':(Math.exp(cT*2.14)).toFixed(2)+'×',W-20,18);
  if(isCrash){ctx.fillStyle=`rgba(239,68,68,${0.1*Math.abs(Math.sin(cFlash*3))})`;ctx.fillRect(0,0,W,H);}
  animId=requestAnimationFrame(animCrash);
}

const BJCARDS=[{v:'A',s:'♠',r:false,rot:-20,ox:-84,oy:14},{v:'K',s:'♥',r:true,rot:-9,ox:-36,oy:2},{v:'7',s:'♦',r:true,rot:2,ox:13,oy:-4},{v:'J',s:'♠',r:false,rot:12,ox:62,oy:2},{v:'Q',s:'♥',r:true,rot:22,ox:110,oy:12}];
function animBJ() {
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);bjPhase+=0.0018;
  const fl=Math.sin(bjPhase)*5;
  BJCARDS.forEach((c,i)=>{
    const cx=W/2+c.ox+Math.sin(bjPhase+i*.6)*2.5,cy=H*.44+c.oy+fl,cw=58,ch=82;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(c.rot*Math.PI/180);
    ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=14;ctx.shadowOffsetY=5;
    ctx.fillStyle='rgba(250,248,242,.94)';rr(ctx,-cw/2,-ch/2,cw,ch,5);ctx.fill();
    ctx.shadowColor='transparent';ctx.strokeStyle='rgba(0,0,0,.08)';ctx.lineWidth=0.5;ctx.stroke();
    const col=c.r?'#b02020':'#111';ctx.fillStyle=col;
    ctx.font='bold 10px Georgia,serif';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(c.v,-cw/2+5,-ch/2+5);
    ctx.font='9px Georgia,serif';ctx.fillText(c.s,-cw/2+5,-ch/2+16);
    ctx.font='26px Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(c.s,0,3);
    ctx.restore();
  });
  animId=requestAnimationFrame(animBJ);
}

function animSlots() {
  const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
  slotOff=slotOff.map((o,i)=>(o+(3.8+i*.65)*.4)%80);
  const sw=60,sh=68,gap=12,cols=3,sx=(W-cols*(sw+gap)+gap)/2,cy=H*.4;
  for(let col=0;col<cols;col++){
    const x=sx+col*(sw+gap);
    ctx.fillStyle='rgba(255,255,255,.04)';rr(ctx,x,cy-sh*1.5-gap*1.5,sw,sh*3+gap*3,6);ctx.fill();
    ctx.save();ctx.beginPath();rr(ctx,x,cy-sh*1.5-gap*1.5,sw,sh*3+gap*3,6);ctx.clip();
    for(let row=-2;row<=3;row++){
      const si=(Math.floor(slotOff[col]/80)+row+100*SSYMS.length+Math.floor(slotOff[col]/(sh+gap))+col*3)%SSYMS.length;
      const y=cy+row*(sh+gap)-slotOff[col]%(sh+gap);
      ctx.fillStyle='rgba(255,255,255,.05)';rr(ctx,x+4,y-sh/2,sw-8,sh,4);ctx.fill();
      ctx.fillStyle=SSYMS[si]==='7'?'#10b981':'rgba(255,255,255,.72)';
      ctx.font='bold 20px "Playfair Display",Georgia,serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(SSYMS[si],x+sw/2,y);
    }
    ctx.restore();
  }
  animId=requestAnimationFrame(animSlots);
}
