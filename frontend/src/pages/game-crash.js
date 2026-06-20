import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

let roundId = null, myBet = 0, cashedOut = false, phase = 'betting';
let multiplier = 1.00, startedAt = null;
let animId = null, points = [];
let chatMessages = [];

export function renderCrash(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
      body { background:#050505 }
      .cp { display:flex; flex-direction:column; height:100vh; background:#050505; font-family:'Playfair Display',Georgia,serif; color:#fff }
      .topbar { display:flex; align-items:center; gap:12px; padding:12px 18px; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0 }
      .back { padding:6px 14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:8px; color:rgba(255,255,255,.5); font-size:12px; cursor:pointer; font-family:'Playfair Display',Georgia,serif }
      .back:hover { background:rgba(255,255,255,.09) }
      .game-title { font-size:16px; font-weight:700 }
      .bal-chip { margin-left:auto; font-size:12px; color:rgba(255,255,255,.4) }
      .bal-chip span { color:#10b981; font-weight:700 }
      .main { display:flex; flex:1; overflow:hidden }
      .graph-side { flex:1; display:flex; flex-direction:column; position:relative }
      canvas#crashCanvas { flex:1; display:block; width:100%; }
      .mult-overlay { position:absolute; top:16px; right:20px; font-size:42px; font-weight:700; font-family:'Playfair Display',Georgia,serif; transition:color .2s }
      .phase-label { position:absolute; top:16px; left:20px; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.3) }
      .bet-panel { width:220px; flex-shrink:0; border-left:1px solid rgba(255,255,255,.06); display:flex; flex-direction:column; padding:16px; gap:10px }
      .bp-label { font-size:9.5px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.25) }
      .bp-input { width:100%; padding:10px 12px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:8px; color:#fff; font-size:15px; font-weight:700; font-family:'Playfair Display',Georgia,serif; outline:none }
      .bp-input:focus { border-color:rgba(16,185,129,.4) }
      .bp-btn { width:100%; padding:12px; border:none; border-radius:9px; font-size:14px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer; transition:all .15s }
      .bp-btn.bet { background:#10b981; color:#fff }
      .bp-btn.bet:hover { background:#0ea472 }
      .bp-btn.bet:disabled { background:rgba(255,255,255,.08); color:rgba(255,255,255,.25); cursor:not-allowed }
      .bp-btn.cash { background:#D4AF37; color:#000 }
      .bp-btn.cash:hover { background:#c9a42e }
      .bp-btn.cash:disabled { background:rgba(255,255,255,.08); color:rgba(255,255,255,.25); cursor:not-allowed }
      .bp-status { font-size:11px; color:rgba(255,255,255,.3); font-style:italic; text-align:center; min-height:16px }
      .bp-status.green { color:#10b981 }
      .bp-status.red   { color:#ef4444 }
      .bp-divider { height:1px; background:rgba(255,255,255,.06) }
      .chat-section { flex:1; display:flex; flex-direction:column; overflow:hidden }
      .chat-label { font-size:9px; letter-spacing:.14em; text-transform:uppercase; color:rgba(255,255,255,.2); margin-bottom:6px }
      .chat-msgs { flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:5px; scrollbar-width:none }
      .chat-msgs::-webkit-scrollbar { display:none }
      .cmsg { font-size:11.5px; line-height:1.45 }
      .cmsg .cu { color:#10b981; font-weight:700 }
      .cmsg .ct { color:rgba(255,255,255,.55) }
      .chat-input-row { display:flex; gap:6px; margin-top:8px }
      .chat-inp { flex:1; padding:7px 10px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.07); border-radius:7px; color:#fff; font-size:12px; font-family:'Playfair Display',Georgia,serif; outline:none }
      .chat-inp:focus { border-color:rgba(16,185,129,.3) }
      .chat-send { padding:7px 12px; background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.2); border-radius:7px; color:#10b981; font-size:11px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer }
      .hash-bar { padding:6px 12px; background:rgba(255,255,255,.025); border-top:1px solid rgba(255,255,255,.05); font-size:9.5px; color:rgba(255,255,255,.2); font-family:monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0 }
    </style>
    <div class="cp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Crash</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="main">
        <div class="graph-side">
          <canvas id="crashCanvas"></canvas>
          <div class="mult-overlay" id="multOverlay" style="color:#10b981">1.00×</div>
          <div class="phase-label" id="phaseLabel">Betting open</div>
        </div>
        <div class="bet-panel">
          <div class="bp-label">Your Bet</div>
          <input class="bp-input" id="betInput" type="number" min="10" placeholder="10" value="100">
          <button class="bp-btn bet" id="betBtn">Place Bet</button>
          <button class="bp-btn cash" id="cashBtn" disabled>Cash Out</button>
          <div class="bp-status" id="bpStatus">Waiting for betting window…</div>
          <div class="bp-divider"></div>
          <div class="chat-section">
            <div class="chat-label">Live Chat</div>
            <div class="chat-msgs" id="chatMsgs"></div>
            <div class="chat-input-row">
              <input class="chat-inp" id="chatInp" placeholder="Say something…" maxlength="200">
              <button class="chat-send" id="chatSend">Send</button>
            </div>
          </div>
        </div>
      </div>
      <div class="hash-bar" id="hashBar">Waiting for next round…</div>
    </div>
  `;

  setupCanvas();
  bindSocketEvents();
  bindUI();
}

function setupCanvas() {
  const canvas = document.getElementById('crashCanvas');
  const resize = () => {
    const p = canvas.parentElement;
    canvas.width  = p.clientWidth;
    canvas.height = p.clientHeight;
  };
  resize();
  try { new ResizeObserver(resize).observe(canvas.parentElement); } catch(e) {}
  animId = requestAnimationFrame(drawLoop);
}

function drawLoop() {
  const canvas = document.getElementById('crashCanvas');
  if (!canvas) { animId = null; return; }
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const isCrashed = phase === 'crashed';
  const color = isCrashed ? '#ef4444' : '#10b981';

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 0.5;
  for (let i = 1; i < 4; i++) {
    const y = H * 0.1 + i * (H * 0.72 / 4);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  if (points.length > 1) {
    // Fill
    const grad = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.85);
    grad.addColorStop(0, isCrashed ? 'rgba(239,68,68,.18)' : 'rgba(16,185,129,.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.moveTo(points[0].x, H * 0.85);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length-1].x, H * 0.85);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    // Line
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
  }

  animId = requestAnimationFrame(drawLoop);
}

function pushPoint(mult) {
  const canvas = document.getElementById('crashCanvas');
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const maxMult = Math.max(mult * 1.2, 2);
  const t = (mult - 1) / (maxMult - 1);
  const x = W * 0.06 + (W * 0.88) * ((Date.now() - startedAt) / Math.max(Date.now() - startedAt, 1));
  // Recalculate all points based on current mult range
  if (!startedAt) return;
  const elapsed = (Date.now() - startedAt) / 1000;
  const newPts = [];
  for (let s = 0; s <= elapsed; s += 0.1) {
    const m = Math.max(1, Math.exp(s * 0.35));
    const px = W * 0.06 + (s / Math.max(elapsed, 1)) * W * 0.88;
    const py = H * 0.85 - ((m - 1) / (maxMult - 1)) * (H * 0.72);
    newPts.push({ x: px, y: Math.max(H * 0.1, py) });
  }
  points = newPts;
}

function updateMultOverlay(mult, crashed = false) {
  const el = document.getElementById('multOverlay');
  if (!el) return;
  el.textContent = crashed ? `CRASHED ${mult.toFixed(2)}×` : `${mult.toFixed(2)}×`;
  el.style.color = crashed ? '#ef4444' : mult > 3 ? '#D4AF37' : '#10b981';
}

function setStatus(msg, cls = '') {
  const el = document.getElementById('bpStatus');
  if (el) { el.textContent = msg; el.className = 'bp-status ' + cls; }
}

function addChat(username, text) {
  chatMessages.push({ username, text });
  if (chatMessages.length > 50) chatMessages.shift();
  const el = document.getElementById('chatMsgs');
  if (!el) return;
  const div = document.createElement('div');
  div.className = 'cmsg';
  div.innerHTML = `<span class="cu">${username}:</span> <span class="ct">${text}</span>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function bindSocketEvents() {
  // Current state on join
  socket.on('crash:state', (data) => {
    roundId = data.round_id;
    phase   = data.phase;
    if (data.phase === 'active') {
      startedAt = data.started_at;
      multiplier = data.multiplier || 1;
    }
    updatePhaseUI();
  });

  socket.on('crash:betting_open', ({ round_id, hash }) => {
    roundId = round_id; phase = 'betting'; myBet = 0; cashedOut = false;
    points = []; startedAt = null; multiplier = 1;
    document.getElementById('betBtn').disabled  = false;
    document.getElementById('cashBtn').disabled = true;
    document.getElementById('betInput').disabled = false;
    document.getElementById('phaseLabel').textContent = 'Betting open — 6s';
    document.getElementById('hashBar').textContent = `Round hash: ${hash}`;
    updateMultOverlay(1);
    setStatus('Place your bet!');
  });

  socket.on('crash:start', ({ started_at }) => {
    phase = 'active'; startedAt = started_at;
    document.getElementById('phaseLabel').textContent = 'In progress';
    document.getElementById('betBtn').disabled   = true;
    document.getElementById('betInput').disabled = true;
    if (myBet > 0 && !cashedOut) {
      document.getElementById('cashBtn').disabled = false;
      setStatus(`Bet: ${myBet.toLocaleString()} CC — cash out!`, 'green');
    } else if (!myBet) {
      setStatus('Watching this round');
    }
  });

  socket.on('crash:tick', ({ multiplier: m }) => {
    multiplier = m;
    updateMultOverlay(m);
    pushPoint(m);
  });

  socket.on('crash:cashout:confirm', ({ multiplier: m, payout, cc_balance }) => {
    cashedOut = true;
    document.getElementById('cashBtn').disabled = true;
    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    setStatus(`Cashed out at ${m.toFixed(2)}× — +${(payout - myBet).toLocaleString()} CC 🎉`, 'green');
  });

  socket.on('crash:cashout:broadcast', ({ username, multiplier: m }) => {
    addChat('🎰 System', `${username} cashed out at ${m.toFixed(2)}×`);
  });

  socket.on('crash:crash', ({ crash_point, seed }) => {
    phase = 'crashed';
    updateMultOverlay(crash_point, true);
    document.getElementById('phaseLabel').textContent = `Crashed at ${crash_point.toFixed(2)}×`;
    document.getElementById('cashBtn').disabled = true;
    document.getElementById('hashBar').textContent = `Seed revealed: ${seed}`;
    if (myBet > 0 && !cashedOut) setStatus(`Lost ${myBet.toLocaleString()} CC`, 'red');
    points = []; startedAt = null;
  });

  socket.on('crash:chat:message', ({ username, text }) => addChat(username, text));

  socket.on('crash:bet:confirm', ({ amount, cc_balance }) => {
    myBet = amount;
    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    setStatus(`Bet placed: ${amount.toLocaleString()} CC`, 'green');
  });

  socket.on('crash:error', ({ message }) => setStatus(message, 'red'));
}

function updatePhaseUI() {
  if (phase === 'betting') {
    document.getElementById('betBtn').disabled  = false;
    document.getElementById('cashBtn').disabled = true;
    document.getElementById('phaseLabel').textContent = 'Betting open';
    setStatus('Place your bet!');
  } else if (phase === 'active') {
    document.getElementById('betBtn').disabled   = true;
    document.getElementById('betInput').disabled = true;
    document.getElementById('phaseLabel').textContent = 'In progress';
    setStatus('Round in progress');
  }
}

function bindUI() {
  document.getElementById('backBtn').addEventListener('click', () => {
    cleanup();
    window.__navigate('games');
  });

  document.getElementById('betBtn').addEventListener('click', () => {
    if (!roundId || phase !== 'betting') return;
    const amount = Math.floor(Number(document.getElementById('betInput').value));
    if (amount < 10) return setStatus('Minimum bet is 10 CC', 'red');
    socket.emit('crash:bet', { round_id: roundId, amount });
    document.getElementById('betBtn').disabled = true;
  });

  document.getElementById('cashBtn').addEventListener('click', () => {
    if (!roundId || phase !== 'active' || cashedOut) return;
    socket.emit('crash:cashout', { round_id: roundId });
  });

  document.getElementById('chatSend').addEventListener('click', sendChat);
  document.getElementById('chatInp').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
}

function sendChat() {
  const inp = document.getElementById('chatInp');
  if (!inp || !inp.value.trim()) return;
  socket.emit('crash:chat', { text: inp.value.trim() });
  inp.value = '';
}

function cleanup() {
  if (animId) { cancelAnimationFrame(animId); animId = null; }
  socket.off('crash:state'); socket.off('crash:betting_open'); socket.off('crash:start');
  socket.off('crash:tick');  socket.off('crash:crash');        socket.off('crash:cashout:confirm');
  socket.off('crash:cashout:broadcast'); socket.off('crash:chat:message');
  socket.off('crash:bet:confirm'); socket.off('crash:error');
}
