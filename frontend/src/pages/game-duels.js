import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

export function renderDuels(app, matchData) {
  const { matchId, pot } = matchData;
  let myHp = 3, oppHp = 3, myMove = null, turnActive = true;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .dp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,#1a0814 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff;align-items:center;justify-content:center;gap:20px;text-align:center;padding:28px}
      .game-lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .pot-display{font-size:14px;color:rgba(255,255,255,.4)}
      .pot-display span{color:#D4AF37;font-weight:700}
      .fighters{display:flex;gap:28px;align-items:center}
      .fighter{display:flex;flex-direction:column;align-items:center;gap:8px}
      .f-name{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.35)}
      .f-hearts{display:flex;gap:6px;font-size:24px;min-height:34px}
      .vs-big{font-size:22px;color:rgba(255,255,255,.2);font-weight:700}
      .round-lbl{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.25)}
      .reveal-area{display:flex;gap:20px;align-items:center;min-height:70px}
      .move-icon{font-size:44px;min-width:60px}
      .status{font-size:15px;color:rgba(255,255,255,.5);font-style:italic;min-height:22px}
      .moves-row{display:flex;gap:12px}
      .move-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 18px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);cursor:pointer;transition:all .15s;font-family:'Playfair Display',Georgia,serif}
      .move-btn:hover{background:rgba(255,255,255,.12);transform:translateY(-2px)}
      .move-btn.selected{border-color:#10b981;background:rgba(16,185,129,.12)}
      .move-btn:disabled{opacity:.3;cursor:not-allowed;transform:none}
      .move-btn .em{font-size:28px}
      .move-btn .lbl{font-size:11px;color:rgba(255,255,255,.5);letter-spacing:.06em;text-transform:uppercase}
      .result-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);align-items:center;justify-content:center;flex-direction:column;gap:14px;z-index:100}
      .result-overlay.show{display:flex}
      .res-title{font-size:42px;font-weight:700}
      .res-sub{font-size:14px;color:rgba(255,255,255,.4);font-style:italic}
      .res-btn{padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .timer-bar{width:200px;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
      .timer-fill{height:100%;background:#10b981;border-radius:2px;transition:width 1s linear}
    </style>
    <div class="dp">
      <div class="game-lbl">Duels · PvP</div>
      <div class="pot-display">Pot: <span>${pot.toLocaleString()} CC</span></div>
      <div class="fighters">
        <div class="fighter">
          <div class="f-name">You</div>
          <div class="f-hearts" id="myHearts">❤️❤️❤️</div>
        </div>
        <div class="vs-big">⚔️</div>
        <div class="fighter">
          <div class="f-name">Opponent</div>
          <div class="f-hearts" id="oppHearts">❤️❤️❤️</div>
        </div>
      </div>
      <div class="round-lbl" id="roundLbl">Round 1</div>
      <div class="reveal-area">
        <div class="move-icon" id="myMoveIcon">❓</div>
        <div style="font-size:18px;color:rgba(255,255,255,.2)">VS</div>
        <div class="move-icon" id="oppMoveIcon">❓</div>
      </div>
      <div class="status" id="status">Choose your move!</div>
      <div class="timer-bar"><div class="timer-fill" id="timerFill" style="width:100%"></div></div>
      <div class="moves-row" id="movesRow">
        <button class="move-btn" data-move="attack"><span class="em">⚔️</span><span class="lbl">Attack</span></button>
        <button class="move-btn" data-move="defend"><span class="em">🛡️</span><span class="lbl">Defend</span></button>
        <button class="move-btn" data-move="special"><span class="em">✨</span><span class="lbl">Special</span></button>
      </div>
    </div>
    <div class="result-overlay" id="resultOverlay">
      <div class="res-title" id="resTitle"></div>
      <div class="res-sub"   id="resSub">Match over</div>
      <button class="res-btn" onclick="window.__navigate('games')">Back to Games</button>
    </div>
  `;

  const MOVE_EMOJI = { attack:'⚔️', defend:'🛡️', special:'✨' };
  let timerInterval = null;
  let round = 1;

  function renderHearts(hp) {
    return '❤️'.repeat(Math.max(0,hp)) + '🖤'.repeat(Math.max(0, 3 - hp));
  }

  function startTimer() {
    let t = 10;
    document.getElementById('timerFill').style.width = '100%';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      t--;
      const el = document.getElementById('timerFill');
      if (el) el.style.width = (t / 10 * 100) + '%';
      if (t <= 0) { clearInterval(timerInterval); if (!myMove) autoDefend(); }
    }, 1000);
  }

  function autoDefend() {
    myMove = 'defend';
    socket.emit('pvp:move', { match_id: matchId, move: 'defend' });
    document.querySelectorAll('.move-btn').forEach(b => { b.disabled = true; b.classList.toggle('selected', b.dataset.move === 'defend'); });
    document.getElementById('myMoveIcon').textContent = '🛡️';
    document.getElementById('status').textContent = 'Auto-defended (time ran out)';
  }

  startTimer();

  document.getElementById('movesRow').addEventListener('click', e => {
    const btn = e.target.closest('.move-btn');
    if (!btn || myMove || !turnActive) return;
    myMove = btn.dataset.move;
    clearInterval(timerInterval);
    document.querySelectorAll('.move-btn').forEach(b => { b.disabled = true; b.classList.toggle('selected', b.dataset.move === myMove); });
    document.getElementById('myMoveIcon').textContent = MOVE_EMOJI[myMove];
    document.getElementById('status').textContent = 'Waiting for opponent…';
    socket.emit('pvp:move', { match_id: matchId, move: myMove });
  });

  socket.on('pvp:round_result', ({ your_move, opp_move, your_hp, opp_hp, round: r }) => {
    myHp = your_hp; oppHp = opp_hp;
    document.getElementById('myMoveIcon').textContent  = MOVE_EMOJI[your_move] || '❓';
    document.getElementById('oppMoveIcon').textContent = MOVE_EMOJI[opp_move]  || '❓';
    document.getElementById('myHearts').textContent    = renderHearts(myHp);
    document.getElementById('oppHearts').textContent   = renderHearts(oppHp);
    document.getElementById('roundLbl').textContent    = `Round ${r}`;

    let resultText = '';
    if (your_move === 'attack' && opp_move === 'attack') resultText = 'Both attacked — both took damage!';
    else if (your_move === opp_move) resultText = 'Same move — nothing happened.';
    else resultText = 'Round resolved!';
    document.getElementById('status').textContent = resultText;

    if (myHp <= 0 || oppHp <= 0) return; // pvp:result coming

    setTimeout(() => {
      myMove = null;
      document.getElementById('myMoveIcon').textContent  = '❓';
      document.getElementById('oppMoveIcon').textContent = '❓';
      document.getElementById('status').textContent = 'Choose your move!';
      document.querySelectorAll('.move-btn').forEach(b => { b.disabled = false; b.classList.remove('selected'); });
      startTimer();
    }, 1500);
  });

  socket.on('pvp:result', ({ you_won }) => {
    clearInterval(timerInterval);
    const overlay = document.getElementById('resultOverlay');
    const title   = document.getElementById('resTitle');
    title.textContent = you_won ? '🏆 Victory!' : '💀 Defeated';
    title.style.color = you_won ? '#10b981' : '#ef4444';
    overlay.classList.add('show');
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });

  socket.on('pvp:auto_win', () => {
    clearInterval(timerInterval);
    const overlay = document.getElementById('resultOverlay');
    document.getElementById('resTitle').textContent = '🏆 Victory!';
    document.getElementById('resTitle').style.color = '#10b981';
    document.getElementById('resSub').textContent   = 'Opponent disconnected.';
    overlay.classList.add('show');
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });
}
