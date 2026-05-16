import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

export function renderCoinflip(app, matchData) {
  const { matchId, your_role, pot } = matchData;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .cp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,#1a130a 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff;align-items:center;justify-content:center;gap:24px;text-align:center;padding:28px}
      .game-lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .pot-display{font-size:14px;color:rgba(255,255,255,.4)}
      .pot-display span{color:#D4AF37;font-weight:700}
      .role-badge{padding:8px 22px;border-radius:20px;font-size:16px;font-weight:700;border:1px solid}
      .role-badge.heads{background:rgba(212,175,55,.15);border-color:rgba(212,175,55,.35);color:#D4AF37}
      .role-badge.tails{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.7)}
      .coin-wrap{position:relative;width:140px;height:140px}
      .coin{width:140px;height:140px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:64px;border:3px solid #D4AF37;background:rgba(212,175,55,.12);transition:all .5s}
      .coin.spinning{animation:flip 0.8s linear infinite}
      @keyframes flip{0%{transform:rotateY(0deg)}100%{transform:rotateY(360deg)}}
      .coin.result-heads{background:rgba(212,175,55,.2);border-color:#D4AF37}
      .coin.result-tails{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3)}
      .status{font-size:18px;color:rgba(255,255,255,.6);font-style:italic;min-height:28px}
      .result-big{font-size:42px;font-weight:700;min-height:52px}
      .result-big.win{color:#10b981}
      .result-big.loss{color:#ef4444}
      .amount{font-size:22px;font-weight:700;min-height:30px}
      .nav-btn{padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;display:none}
    </style>
    <div class="cp">
      <div class="game-lbl">Coinflip · PvP</div>
      <div class="pot-display">Pot: <span>${pot.toLocaleString()} CC</span></div>
      <div class="role-badge ${your_role}" id="roleBadge">You are ${your_role.toUpperCase()}</div>
      <div class="coin spinning" id="coin">🪙</div>
      <div class="status" id="status">Flipping…</div>
      <div class="result-big" id="resultBig"></div>
      <div class="amount" id="amount"></div>
      <button class="nav-btn" id="navBtn" onclick="window.__navigate('games')">Back to Games</button>
    </div>
  `;

  socket.on('pvp:round_result', ({ flip, your_role: role, cc_balance }) => {
    const coin   = document.getElementById('coin');
    const status = document.getElementById('status');
    const result = document.getElementById('resultBig');
    const amt    = document.getElementById('amount');
    const btn    = document.getElementById('navBtn');

    coin.classList.remove('spinning');
    coin.textContent = flip === 'heads' ? '👑' : '🔘';
    coin.className   = `coin result-${flip}`;

    status.textContent = `The coin landed on ${flip.toUpperCase()}`;

    const won = role === flip;
    result.textContent = won ? 'You Win!' : 'You Lose';
    result.className   = `result-big ${won ? 'win' : 'loss'}`;

    if (won) {
      amt.textContent = `+${pot.toLocaleString()} CC`;
      amt.style.color = '#10b981';
    } else {
      amt.style.color = '#ef4444';
    }

    if (cc_balance !== undefined) {
      updateBalance({ cc_balance });
    }

    btn.style.display = 'block';
    socket.off('pvp:round_result');
    socket.off('pvp:auto_win');
  });

  socket.on('pvp:auto_win', ({ pot: p }) => {
    document.getElementById('coin').classList.remove('spinning');
    document.getElementById('status').textContent = 'Opponent disconnected';
    document.getElementById('resultBig').textContent = 'You Win!';
    document.getElementById('resultBig').className = 'result-big win';
    document.getElementById('amount').textContent = `+${(p||pot).toLocaleString()} CC`;
    document.getElementById('amount').style.color = '#10b981';
    document.getElementById('navBtn').style.display = 'block';
    socket.off('pvp:round_result');
    socket.off('pvp:auto_win');
  });
}
