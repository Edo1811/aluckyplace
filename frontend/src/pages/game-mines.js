import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

export function renderMines(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .mp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 50%,#0a1f0a 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .main{flex:1;display:flex;align-items:center;justify-content:center;gap:24px;padding:20px;flex-wrap:wrap}
      .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(320px,80vw)}
      .tile{aspect-ratio:1;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;transition:all .15s;user-select:none}
      .tile:hover:not(.revealed):not(.bomb):not(.locked){background:rgba(255,255,255,.13);border-color:rgba(255,255,255,.2);transform:scale(1.04)}
      .tile.revealed{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.35);cursor:default}
      .tile.bomb{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.4);cursor:default;animation:shake .3s ease}
      .tile.hit-bomb{background:rgba(239,68,68,.3);border-color:#ef4444}
      .tile.locked{cursor:default;opacity:.6}
      @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
      .side{display:flex;flex-direction:column;gap:14px;width:180px}
      .mult-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;text-align:center}
      .mult-label{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:6px}
      .mult-val{font-size:36px;font-weight:700;color:#10b981;line-height:1;transition:all .3s}
      .mult-pot{font-size:12px;color:rgba(255,255,255,.3);margin-top:4px}
      .bet-inp{width:100%;padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none;text-align:center}
      .bet-inp:focus{border-color:rgba(16,185,129,.4)}
      .sbtn{width:100%;padding:12px;border:none;border-radius:9px;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;transition:all .15s}
      .sbtn.start{background:#10b981;color:#fff}
      .sbtn.start:hover{background:#0ea472}
      .sbtn.cash{background:#D4AF37;color:#000}
      .sbtn.cash:hover{background:#c9a42e}
      .sbtn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed}
      .status{font-size:11.5px;color:rgba(255,255,255,.35);font-style:italic;text-align:center;min-height:18px}
      .picks-label{font-size:11px;color:rgba(255,255,255,.25);text-align:center}
    </style>
    <div class="mp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Mines</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="main">
        <div class="grid" id="grid"></div>
        <div class="side">
          <div class="mult-card">
            <div class="mult-label">Multiplier</div>
            <div class="mult-val" id="multVal">—</div>
            <div class="mult-pot" id="multPot">Pick a tile to start</div>
          </div>
          <input class="bet-inp" id="betInput" type="number" min="10" value="100" placeholder="Bet CC">
          <button class="sbtn start" id="startBtn">Start Game</button>
          <button class="sbtn cash"  id="cashBtn" disabled>Cash Out</button>
          <div class="status" id="statusMsg">Place a bet to begin.</div>
          <div class="picks-label" id="picksLabel"></div>
        </div>
      </div>
    </div>
  `;

  buildGrid();
  bindUI();
  bindSocket();
}

let gameActive = false, picks = 0, currentBet = 0;

function buildGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile locked';
    tile.dataset.idx = i;
    tile.textContent = '▪';
    grid.appendChild(tile);
  }
}

function resetGrid() {
  document.querySelectorAll('.tile').forEach(t => {
    t.className = 'tile locked';
    t.textContent = '▪';
  });
}

function unlockGrid() {
  document.querySelectorAll('.tile').forEach(t => {
    t.className = 'tile';
    t.textContent = '▪';
  });
}

function bindUI() {
  document.getElementById('backBtn').addEventListener('click', () => {
    socket.off('mines:board'); socket.off('mines:safe');
    socket.off('mines:bomb'); socket.off('mines:cashout:confirm'); socket.off('mines:error');
    window.__navigate('games');
  });

  document.getElementById('startBtn').addEventListener('click', () => {
    const bet = Math.floor(Number(document.getElementById('betInput').value));
    if (bet < 10) { setStatus('Minimum bet is 10 CC'); return; }
    currentBet = bet;
    picks = 0;
    socket.emit('mines:start', { bet });
    document.getElementById('startBtn').disabled = true;
    document.getElementById('betInput').disabled = true;
    setStatus('Starting…');
  });

  document.getElementById('cashBtn').addEventListener('click', () => {
    if (!gameActive) return;
    socket.emit('mines:cashout');
    document.getElementById('cashBtn').disabled = true;
  });

  document.getElementById('grid').addEventListener('click', e => {
    if (!gameActive) return;
    const tile = e.target.closest('.tile');
    if (!tile || tile.classList.contains('revealed') || tile.classList.contains('bomb')) return;
    socket.emit('mines:pick', { tile_index: parseInt(tile.dataset.idx) });
  });
}

function bindSocket() {
  socket.on('mines:board', ({ cc_balance }) => {
    gameActive = true;
    unlockGrid();
    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    document.getElementById('multVal').textContent = '1.00×';
    document.getElementById('multPot').textContent = 'Pick a tile!';
    document.getElementById('picksLabel').textContent = '0 safe picks';
    setStatus('Click a tile. 5 bombs hidden.');
  });

  socket.on('mines:safe', ({ tile_index, multiplier, potential_payout }) => {
    picks++;
    const tile = document.querySelector(`.tile[data-idx="${tile_index}"]`);
    if (tile) { tile.className = 'tile revealed'; tile.textContent = '💎'; }
    document.getElementById('multVal').textContent = multiplier.toFixed(2) + '×';
    document.getElementById('multPot').textContent = `${potential_payout.toLocaleString()} CC if cashed`;
    document.getElementById('picksLabel').textContent = `${picks} safe pick${picks > 1 ? 's' : ''}`;
    document.getElementById('cashBtn').disabled = false;
    setStatus(`Safe! Keep going or cash out.`);
  });

  socket.on('mines:bomb', ({ tile_index, bomb_positions, cc_balance }) => {
    gameActive = false;
    const hit = document.querySelector(`.tile[data-idx="${tile_index}"]`);
    if (hit) { hit.className = 'tile hit-bomb'; hit.textContent = '💣'; }
    setTimeout(() => {
      bomb_positions.forEach(idx => {
        if (idx === tile_index) return;
        const t = document.querySelector(`.tile[data-idx="${idx}"]`);
        if (t) { t.className = 'tile bomb'; t.textContent = '💣'; }
      });
    }, 120);
    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    document.getElementById('cashBtn').disabled = true;
    document.getElementById('multVal').textContent = '💥';
    document.getElementById('multVal').style.color = '#ef4444';
    setStatus(`Boom! Lost ${currentBet.toLocaleString()} CC.`);
    setTimeout(resetGame, 2500);
  });

  socket.on('mines:cashout:confirm', ({ payout, picks: p, cc_balance }) => {
    gameActive = false;
    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    document.getElementById('cashBtn').disabled = true;
    document.getElementById('multVal').style.color = '#10b981';
    setStatus(`Cashed out! +${(payout - currentBet).toLocaleString()} CC after ${p} safe picks 🎉`);
    setTimeout(resetGame, 2000);
  });

  socket.on('mines:error', ({ message }) => {
    setStatus(message);
    resetGame();
  });
}

function resetGame() {
  gameActive = false; picks = 0;
  resetGrid();
  document.getElementById('startBtn').disabled = false;
  document.getElementById('betInput').disabled = false;
  document.getElementById('cashBtn').disabled  = true;
  document.getElementById('multVal').textContent = '—';
  document.getElementById('multVal').style.color = '#10b981';
  document.getElementById('multPot').textContent = 'Pick a tile to start';
  document.getElementById('picksLabel').textContent = '';
  setStatus('Place a bet to begin.');
}

function setStatus(msg) { const el = document.getElementById('statusMsg'); if (el) el.textContent = msg; }
