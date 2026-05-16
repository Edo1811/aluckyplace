import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

export function renderHigherLow(app, matchData) {
  const { matchId, pot } = matchData;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .hlp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,#080d1a 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff;align-items:center;justify-content:center;gap:24px;text-align:center;padding:28px}
      .game-lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .pot-display{font-size:14px;color:rgba(255,255,255,.4)}
      .pot-display span{color:#D4AF37;font-weight:700}
      .cards-row{display:flex;gap:24px;align-items:center}
      .card-wrap{display:flex;flex-direction:column;align-items:center;gap:10px}
      .card-lbl{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .card-face{width:100px;height:140px;border-radius:12px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;transition:all .5s;cursor:default}
      .card-face.facedown{background:linear-gradient(135deg,#1a2a5e,#0d1a3a)}
      .card-face.revealed{background:rgba(255,255,255,.95);color:#111;animation:flip .4s ease-out}
      .card-face.winner{border-color:#D4AF37;box-shadow:0 0 24px rgba(212,175,55,.4)}
      .card-face.loser{border-color:#ef4444;opacity:.6}
      @keyframes flip{0%{transform:rotateY(90deg)}100%{transform:rotateY(0deg)}}
      .vs-sep{font-size:20px;color:rgba(255,255,255,.2);font-weight:700}
      .status{font-size:18px;color:rgba(255,255,255,.5);font-style:italic;min-height:28px}
      .result-big{font-size:36px;font-weight:700;min-height:44px}
      .result-big.win{color:#10b981}
      .result-big.loss{color:#ef4444}
      .nav-btn{padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;display:none}
    </style>
    <div class="hlp">
      <div class="game-lbl">Higher or Lower · PvP</div>
      <div class="pot-display">Pot: <span>${pot.toLocaleString()} CC</span></div>
      <div class="cards-row">
        <div class="card-wrap">
          <div class="card-lbl">You</div>
          <div class="card-face facedown" id="myCard">🂠</div>
        </div>
        <div class="vs-sep">VS</div>
        <div class="card-wrap">
          <div class="card-lbl">Opponent</div>
          <div class="card-face facedown" id="oppCard">🂠</div>
        </div>
      </div>
      <div class="status" id="status">Cards are being drawn…</div>
      <div class="result-big" id="resultBig"></div>
      <button class="nav-btn" id="navBtn" onclick="window.__navigate('games')">Back to Games</button>
    </div>
  `;

  // Brief suspense then reveal
  setTimeout(() => {
    document.getElementById('status').textContent = 'Revealing in 3…';
    let t = 3;
    const iv = setInterval(() => {
      t--;
      const el = document.getElementById('status');
      if (el) el.textContent = t > 0 ? `Revealing in ${t}…` : 'Revealing!';
      if (t <= 0) clearInterval(iv);
    }, 1000);
  }, 500);

  socket.on('pvp:round_result', ({ your_number, opp_number, tie }) => {
    if (tie) {
      document.getElementById('status').textContent = 'Tie! Redrawing…';
      document.getElementById('myCard').className  = 'card-face facedown';
      document.getElementById('myCard').textContent  = '🂠';
      document.getElementById('oppCard').className = 'card-face facedown';
      document.getElementById('oppCard').textContent = '🂠';
      return;
    }

    const myCard  = document.getElementById('myCard');
    const oppCard = document.getElementById('oppCard');

    myCard.textContent  = your_number;
    oppCard.textContent = opp_number;
    myCard.className    = 'card-face revealed';
    oppCard.className   = 'card-face revealed';

    setTimeout(() => {
      const won = your_number > opp_number;
      myCard.classList.add(won ? 'winner' : 'loser');
      oppCard.classList.add(won ? 'loser' : 'winner');

      document.getElementById('status').textContent = '';
      const rb = document.getElementById('resultBig');
      rb.textContent = won ? '🏆 You Win!' : 'You Lose';
      rb.className   = `result-big ${won ? 'win' : 'loss'}`;
      document.getElementById('navBtn').style.display = 'block';

      socket.off('pvp:round_result');
      socket.off('pvp:auto_win');
    }, 600);
  });

  socket.on('pvp:auto_win', ({ pot: p }) => {
    document.getElementById('status').textContent    = 'Opponent disconnected.';
    document.getElementById('resultBig').textContent = '🏆 You Win!';
    document.getElementById('resultBig').className   = 'result-big win';
    document.getElementById('navBtn').style.display  = 'block';
    socket.off('pvp:round_result');
    socket.off('pvp:auto_win');
  });
}
