import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

const MOVES   = ['rock','paper','scissors'];
const EMOJI   = { rock:'🪨', paper:'📄', scissors:'✂️' };
const BEATS   = { rock:'scissors', scissors:'paper', paper:'rock' };

export function renderRps(app, matchData) {
  const { matchId, pot } = matchData;
  let scores = {};
  let myMove = null;
  let round  = 1;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .rp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif;color:#fff;align-items:center;justify-content:center;gap:20px;text-align:center;padding:28px}
      .game-lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .pot-display{font-size:14px;color:rgba(255,255,255,.4)}
      .pot-display span{color:#D4AF37;font-weight:700}
      .score-row{display:flex;gap:20px;align-items:center}
      .score-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 24px;text-align:center}
      .score-n{font-size:32px;font-weight:700}
      .score-l{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-top:4px}
      .vs-sep{font-size:18px;color:rgba(255,255,255,.2);font-weight:700}
      .reveal-area{display:flex;gap:32px;align-items:center;min-height:100px}
      .move-display{font-size:64px;min-width:80px}
      .round-lbl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.25)}
      .status{font-size:16px;color:rgba(255,255,255,.5);font-style:italic;min-height:24px}
      .moves-row{display:flex;gap:12px}
      .move-btn{width:80px;height:80px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:36px;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center}
      .move-btn:hover{background:rgba(255,255,255,.12);transform:scale(1.06)}
      .move-btn.selected{border-color:#10b981;background:rgba(16,185,129,.12)}
      .move-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
      .result-big{font-size:36px;font-weight:700;min-height:44px}
      .result-big.win{color:#10b981}
      .result-big.loss{color:#ef4444}
      .result-big.tie{color:#D4AF37}
      .nav-btn{padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;display:none}
    </style>
    <div class="rp">
      <div class="game-lbl">Rock Paper Scissors · PvP</div>
      <div class="pot-display">Pot: <span>${pot.toLocaleString()} CC</span></div>
      <div class="score-row">
        <div class="score-card"><div class="score-n" id="myScore" style="color:#10b981">0</div><div class="score-l">You</div></div>
        <div class="vs-sep">—</div>
        <div class="score-card"><div class="score-n" id="oppScore" style="color:#ef4444">0</div><div class="score-l">Opponent</div></div>
      </div>
      <div class="round-lbl" id="roundLbl">Round 1 · Best of 3</div>
      <div class="reveal-area">
        <div class="move-display" id="myMoveDisplay">❓</div>
        <div style="font-size:18px;color:rgba(255,255,255,.2)">VS</div>
        <div class="move-display" id="oppMoveDisplay">❓</div>
      </div>
      <div class="status" id="status">Pick your move!</div>
      <div class="moves-row" id="movesRow">
        ${MOVES.map(m => `<button class="move-btn" data-move="${m}" title="${m}">${EMOJI[m]}</button>`).join('')}
      </div>
      <div class="result-big" id="resultBig"></div>
      <button class="nav-btn" id="navBtn" onclick="window.__navigate('games')">Back to Games</button>
    </div>
  `;

  const myId = store.user?.userId;

  document.getElementById('movesRow').addEventListener('click', e => {
    const btn = e.target.closest('.move-btn');
    if (!btn || myMove) return;
    myMove = btn.dataset.move;
    document.querySelectorAll('.move-btn').forEach(b => { b.disabled = true; b.classList.toggle('selected', b.dataset.move === myMove); });
    document.getElementById('myMoveDisplay').textContent = EMOJI[myMove];
    document.getElementById('status').textContent = 'Waiting for opponent…';
    socket.emit('pvp:move', { match_id: matchId, move: myMove });
  });

  socket.on('pvp:round_result', ({ your_move, opp_move, result, scores: sc, round: r }) => {
    document.getElementById('myMoveDisplay').textContent  = EMOJI[your_move] || '❓';
    document.getElementById('oppMoveDisplay').textContent = EMOJI[opp_move]  || '❓';

    if (result === 'tie') {
      document.getElementById('status').textContent = 'Tie — round replayed!';
    } else {
      const myScore  = sc?.[myId] || 0;
      const allScores = Object.values(sc || {});
      const oppScore = allScores.find((_, i) => Object.keys(sc)[i] !== myId) || 0;
      document.getElementById('myScore').textContent  = myScore;
      document.getElementById('oppScore').textContent = oppScore;
      document.getElementById('status').textContent   = result === 'win' ? 'You won that round!' : 'Opponent won that round.';
      document.getElementById('roundLbl').textContent = `Round ${r} · Best of 3`;

      // Check match over
      if (myScore >= 2 || oppScore >= 2) return; // pvp:result coming
    }

    // Reset for next round
    setTimeout(() => {
      myMove = null;
      document.getElementById('myMoveDisplay').textContent  = '❓';
      document.getElementById('oppMoveDisplay').textContent = '❓';
      document.getElementById('status').textContent = 'Pick your move!';
      document.querySelectorAll('.move-btn').forEach(b => { b.disabled = false; b.classList.remove('selected'); });
    }, 1500);
  });

  socket.on('pvp:result', ({ winner_id, pot: p, you_won }) => {
    document.getElementById('movesRow').style.display = 'none';
    document.getElementById('status').textContent = '';
    const rb = document.getElementById('resultBig');
    rb.textContent = you_won ? '🏆 You Win!' : 'You Lose';
    rb.className   = `result-big ${you_won ? 'win' : 'loss'}`;
    document.getElementById('navBtn').style.display = 'block';
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });

  socket.on('pvp:auto_win', ({ pot: p }) => {
    document.getElementById('movesRow').style.display = 'none';
    document.getElementById('resultBig').textContent  = '🏆 You Win!';
    document.getElementById('resultBig').className    = 'result-big win';
    document.getElementById('status').textContent     = 'Opponent disconnected.';
    document.getElementById('navBtn').style.display   = 'block';
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });
}
