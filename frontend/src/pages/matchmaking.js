import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

let currentGame   = null;
let matchId       = null;
let elapsed       = 0;
let elapsedTimer  = null;
let cdTimer       = null;
let cdVal         = 10;
let myBet         = 0;
let onMatchStart  = null;

export function renderMatchmaking(app, game, onStart) {
  console.log('renderMatchmaking called', game); // ADD THIS
  currentGame  = game;
  onMatchStart = onStart;
  elapsed      = 0;
  matchId      = null;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
      body { background:#050505 }
      .mp { display:flex; flex-direction:column; height:100vh; background:#050505; font-family:'Playfair Display',Georgia,serif; color:#fff; align-items:center; justify-content:center; position:relative }
      .screen { display:none; flex-direction:column; align-items:center; gap:18px; width:100%; max-width:400px; padding:28px; text-align:center }
      .screen.on { display:flex }
      .back { position:absolute; top:16px; left:18px; padding:6px 14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:8px; color:rgba(255,255,255,.5); font-size:12px; cursor:pointer; font-family:'Playfair Display',Georgia,serif }
      .game-lbl { font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:rgba(255,255,255,.3) }
      .big-title { font-size:28px; font-weight:700 }
      .spinner { width:60px; height:60px; border-radius:50%; border:2px solid rgba(16,185,129,.2); border-top-color:#10b981; animation:spin 1s linear infinite }
      @keyframes spin { to { transform:rotate(360deg) } }
      .elapsed { font-size:14px; color:rgba(255,255,255,.4); font-style:italic }
      .q-stats { display:flex; gap:12px }
      .qs { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:11px; padding:12px 18px; text-align:center }
      .qs-n { font-size:20px; font-weight:700; color:#10b981 }
      .qs-l { font-size:9.5px; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.22); margin-top:3px }
      .cancel-btn { padding:11px 32px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:9px; color:rgba(255,255,255,.45); font-size:13px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer }
      .found-ring { width:80px; height:80px; border-radius:50%; background:rgba(16,185,129,.12); border:2px solid rgba(16,185,129,.4); display:flex; align-items:center; justify-content:center; font-size:32px; animation:pop .4s ease-out }
      @keyframes pop { 0%{transform:scale(.7);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
      .players-row { display:flex; gap:12px; align-items:stretch; width:100% }
      .pcard { flex:1; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:13px; transition:border-color .3s }
      .pcard.you { border-color:rgba(16,185,129,.2) }
      .pcard.ready { border-color:rgba(16,185,129,.4); background:rgba(16,185,129,.05) }
      .pc-name { font-size:13px; font-weight:700; margin-bottom:4px }
      .pc-bal  { font-size:10.5px; color:rgba(255,255,255,.3); margin-bottom:8px }
      .pc-bet  { font-size:20px; font-weight:700; color:#D4AF37; min-height:28px }
      .pc-status { font-size:10.5px; margin-top:4px }
      .pc-status.rdy  { color:#10b981 }
      .pc-status.wait { color:rgba(255,255,255,.25); font-style:italic }
      .vs { font-size:16px; color:rgba(255,255,255,.2); font-weight:700; display:flex; align-items:center }
      .bet-section { width:100%; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:16px; display:flex; flex-direction:column; gap:10px }
      .bet-lbl { font-size:9.5px; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.25); text-align:left }
      .bet-inp-row { display:flex; gap:8px }
      .bet-inp { flex:1; padding:10px 12px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:9px; color:#fff; font-size:16px; font-weight:700; font-family:'Playfair Display',Georgia,serif; outline:none }
      .bet-inp:focus { border-color:rgba(16,185,129,.4) }
      .max-btn { padding:10px 14px; background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.2); border-radius:9px; color:#10b981; font-size:12px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer }
      .cap-note { font-size:10px; color:rgba(255,255,255,.25); font-style:italic; text-align:left }
      .ready-btn { width:100%; padding:13px; background:#10b981; border:none; border-radius:10px; color:#fff; font-size:15px; font-weight:700; font-family:'Playfair Display',Georgia,serif; cursor:pointer }
      .ready-btn:disabled { background:rgba(255,255,255,.07); color:rgba(255,255,255,.2); cursor:not-allowed }
      .cd-row { display:flex; align-items:center; justify-content:center; gap:8px }
      .cd-num { font-size:28px; font-weight:700 }
      .cd-num.ok  { color:#10b981 }
      .cd-num.bad { color:#ef4444 }
      .cd-lbl { font-size:11.5px; color:rgba(255,255,255,.28); font-style:italic }
      .notif { position:absolute; top:18px; left:50%; transform:translateX(-50%); padding:10px 20px; border-radius:10px; font-size:13px; font-weight:700; white-space:nowrap; z-index:100; pointer-events:none; animation:slidein .3s ease-out }
      @keyframes slidein { from{transform:translateX(-50%) translateY(-16px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
      .notif.yellow { background:rgba(234,179,8,.15); border:1px solid rgba(234,179,8,.35); color:#eab308 }
      .notif.green  { background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.35); color:#10b981 }
    </style>

    <div class="mp" id="mp">
      <button class="back" id="backBtn">← Games</button>

      <!-- QUEUE -->
      <div class="screen on" id="queueScreen">
        <div class="game-lbl">${game}</div>
        <div class="big-title">Finding an opponent…</div>
        <div class="spinner"></div>
        <div class="elapsed" id="elapsedDisplay">Searching for 0s…</div>
        <div class="q-stats">
          <div class="qs"><div class="qs-n">—</div><div class="qs-l">In Queue</div></div>
          <div class="qs"><div class="qs-n">~8s</div><div class="qs-l">Avg Wait</div></div>
        </div>
        <button class="cancel-btn" id="cancelBtn">Leave Queue</button>
      </div>

      <!-- FOUND -->
      <div class="screen" id="foundScreen">
        <div class="found-ring">🎯</div>
        <div class="big-title">Player Found!</div>
        <div style="font-size:13px;color:#10b981;font-style:italic">Entering betting phase…</div>
      </div>

      <!-- BETTING -->
      <div class="screen" id="bettingScreen">
        <div class="game-lbl">${game} · PvP</div>
        <div class="big-title" style="font-size:22px">Place Your Bets</div>
        <div class="players-row">
          <div class="pcard you" id="myCard">
            <div class="pc-name">${store.user?.username || 'You'}</div>
            <div class="pc-bal">${Number(store.ccBalance).toLocaleString()} CC</div>
            <div class="pc-bet" id="myBetDisplay">—</div>
            <div class="pc-status wait" id="myStatus">Setting bet…</div>
          </div>
          <div class="vs">VS</div>
          <div class="pcard" id="oppCard">
            <div class="pc-name" id="oppName">Opponent</div>
            <div class="pc-bal" id="oppBal">— CC</div>
            <div class="pc-bet" id="oppBetDisplay">—</div>
            <div class="pc-status wait" id="oppStatus">Setting bet…</div>
          </div>
        </div>
        <div class="bet-section">
          <div class="bet-lbl">Your Bet</div>
          <div class="bet-inp-row">
            <input class="bet-inp" id="betInput" type="number" min="10" placeholder="Enter CC…">
            <button class="max-btn" id="maxBtn">Max</button>
          </div>
          <div class="cap-note" id="capNote">Max: 35% of opponent's balance</div>
          <button class="ready-btn" id="readyBtn" disabled>Ready</button>
        </div>
        <div class="cd-row">
          <div class="cd-num" id="cdNum">10</div>
          <div class="cd-lbl" id="cdLbl">seconds to place your bet</div>
        </div>
      </div>

      <div id="notifSlot"></div>
    </div>
  `;

bindUI();
bindSocket();

// Re-emit auth then join queue once confirmed
const token = localStorage.getItem('token');
socket.emit('auth', { token });
socket.once('auth:ok', () => {
  socket.emit('pvp:queue:join', { game });
  startElapsed();
});
}

function startElapsed() {
  elapsed = 0;
  clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    elapsed++;
    const el = document.getElementById('elapsedDisplay');
    if (el) el.textContent = `Searching for ${elapsed}s…`;
  }, 1000);
}

function showScreen(id) {
  ['queueScreen','foundScreen','bettingScreen'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.className = 'screen' + (s === id ? ' on' : '');
  });
}

function showNotif(msg, type = 'yellow') {
  const slot = document.getElementById('notifSlot');
  if (!slot) return;
  const n = document.createElement('div');
  n.className = `notif ${type}`;
  n.textContent = msg;
  slot.innerHTML = '';
  slot.appendChild(n);
  setTimeout(() => n.remove(), 2800);
}

function startCd() {
  cdVal = 10;
  clearInterval(cdTimer);
  cdTimer = setInterval(() => {
    cdVal--;
    const el = document.getElementById('cdNum');
    if (el) { el.textContent = cdVal; el.className = 'cd-num' + (cdVal <= 3 ? ' bad' : ''); }
    if (cdVal <= 0) clearInterval(cdTimer);
  }, 1000);
}

function bindUI() {
  document.getElementById('backBtn').addEventListener('click', () => {
    cleanup(); socket.emit('pvp:queue:leave'); window.__navigate('games');
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    cleanup(); socket.emit('pvp:queue:leave'); window.__navigate('games');
  });

  document.getElementById('betInput').addEventListener('input', () => {
    const val = Math.floor(Number(document.getElementById('betInput').value)) || 0;
    myBet = val;
    const d = document.getElementById('myBetDisplay');
    if (d) d.textContent = val > 0 ? `${val.toLocaleString()} CC` : '—';
    document.getElementById('readyBtn').disabled = val < 10;
    if (matchId) socket.emit('pvp:bet:set', { match_id: matchId, amount: val });
  });

  document.getElementById('maxBtn').addEventListener('click', () => {
    const cap = parseInt(document.getElementById('betInput').max) || 9999;
    document.getElementById('betInput').value = cap;
    document.getElementById('betInput').dispatchEvent(new Event('input'));
  });

  document.getElementById('readyBtn').addEventListener('click', () => {
    if (myBet < 10 || !matchId) return;
    socket.emit('pvp:bet:ready', { match_id: matchId });
    document.getElementById('readyBtn').disabled = true;
    document.getElementById('myCard').classList.add('ready');
    document.getElementById('myStatus').textContent = '✓ Ready';
    document.getElementById('myStatus').className = 'pc-status rdy';
    document.getElementById('cdLbl').textContent = 'waiting for opponent…';
  });
}

function bindSocket() {
  socket.on('pvp:matched', ({ match_id, opponent }) => {
    matchId = match_id;
    clearInterval(elapsedTimer);
    document.getElementById('oppName').textContent = opponent.username;
    document.getElementById('oppBal').textContent  = Number(opponent.cc_balance).toLocaleString() + ' CC';
    const cap = Math.floor(opponent.cc_balance * 0.35);
    document.getElementById('betInput').max = cap;
    document.getElementById('capNote').textContent = `Max: ${cap.toLocaleString()} CC (35% of opponent's balance)`;
    showScreen('foundScreen');
    setTimeout(() => { showScreen('bettingScreen'); startCd(); }, 1800);
  });

  socket.on('pvp:bet:update', ({ your_bet, opp_bet, opp_ready }) => {
    const md = document.getElementById('myBetDisplay');
    const od = document.getElementById('oppBetDisplay');
    if (md) md.textContent = your_bet > 0 ? `${your_bet.toLocaleString()} CC` : '—';
    if (od) od.textContent = opp_bet  > 0 ? `${opp_bet.toLocaleString()} CC`  : '—';
    if (opp_ready) {
      document.getElementById('oppCard').classList.add('ready');
      document.getElementById('oppStatus').textContent = '✓ Ready';
      document.getElementById('oppStatus').className   = 'pc-status rdy';
    }
  });

  socket.on('pvp:both_ready', ({ pot }) => {
    clearInterval(cdTimer);
    const el = document.getElementById('cdNum');
    if (el) { el.textContent = '⚔️'; el.className = 'cd-num ok'; }
    const cl = document.getElementById('cdLbl');
    if (cl) cl.textContent = `Pot: ${pot.toLocaleString()} CC — starting…`;
  });

  socket.on('pvp:start', (data) => {
    cleanup();
    if (onMatchStart) onMatchStart({ matchId, ...data });
  });

  socket.on('pvp:opponent_left', () => {
    showNotif('Opponent left — back to queue');
    setTimeout(() => { showScreen('queueScreen'); startElapsed(); socket.emit('pvp:queue:join', { game: currentGame }); }, 2000);
  });

  socket.on('pvp:auto_win', ({ pot }) => {
    cleanup();
    const mp = document.getElementById('mp');
    if (!mp) return;
    mp.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center;padding:28px">
        <div style="font-size:52px">🏆</div>
        <div style="font-size:28px;font-weight:700;color:#10b981">You Win!</div>
        <div style="font-size:14px;color:rgba(255,255,255,.4);font-style:italic">Opponent disconnected. Full pot is yours.</div>
        <div style="font-size:36px;font-weight:700;color:#D4AF37">+${(pot||0).toLocaleString()} CC</div>
        <button onclick="window.__navigate('games')" style="margin-top:8px;padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer">Back to Games</button>
      </div>`;
  });

  socket.on('pvp:timeout', () => {
    showNotif('Time ran out — back to queue');
    setTimeout(() => { showScreen('queueScreen'); startElapsed(); socket.emit('pvp:queue:join', { game: currentGame }); }, 1500);
  });

  socket.on('pvp:abort', () => {
    showNotif('Match cancelled');
    setTimeout(() => window.__navigate('games'), 2000);
  });
}

function cleanup() {
  clearInterval(elapsedTimer);
  clearInterval(cdTimer);
  ['pvp:matched','pvp:bet:update','pvp:both_ready','pvp:start',
   'pvp:opponent_left','pvp:auto_win','pvp:timeout','pvp:abort'].forEach(e => socket.off(e));
}
