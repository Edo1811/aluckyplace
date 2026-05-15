import socket from '../socket.js';
import { store, updateBalance } from '../store.js';

export function renderBlackjack(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .bjp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 60%,#0a2a14 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .table{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-around;padding:20px;overflow:hidden}
      .zone-label{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:8px;text-align:center}
      .hand{display:flex;gap:-12px;justify-content:center;min-height:90px;align-items:center}
      .card{width:58px;height:84px;border-radius:7px;background:rgba(250,248,242,.95);border:1px solid rgba(0,0,0,.1);display:flex;flex-direction:column;padding:5px;box-shadow:0 4px 14px rgba(0,0,0,.5);flex-shrink:0;margin-left:-10px}
      .card:first-child{margin-left:0}
      .card.hidden{background:linear-gradient(135deg,#1a5c2e,#0d3318);border-color:rgba(255,255,255,.1)}
      .card .cr{font-size:11px;font-weight:700;line-height:1}
      .card .cs{font-size:10px;line-height:1}
      .card .cc{font-size:24px;text-align:center;flex:1;display:flex;align-items:center;justify-content:center}
      .card.red .cr,.card.red .cs,.card.red .cc{color:#b02020}
      .card.black .cr,.card.black .cs,.card.black .cc{color:#111}
      .total-badge{font-size:13px;font-weight:700;padding:3px 10px;border-radius:8px;background:rgba(255,255,255,.08);margin-top:8px;text-align:center}
      .controls{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:380px}
      .bet-row{display:flex;gap:8px;align-items:center}
      .bet-inp{width:120px;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none;text-align:center}
      .bet-inp:focus{border-color:rgba(16,185,129,.4)}
      .deal-btn{padding:10px 28px;background:#10b981;border:none;border-radius:9px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .deal-btn:hover{background:#0ea472}
      .deal-btn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed}
      .action-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
      .abtn{padding:10px 20px;border-radius:9px;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:none;transition:all .15s}
      .abtn.hit{background:#10b981;color:#fff}
      .abtn.stand{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.15)}
      .abtn.double{background:rgba(212,175,55,.15);color:#D4AF37;border:1px solid rgba(212,175,55,.25)}
      .abtn.split{background:rgba(59,130,246,.15);color:#3b82f6;border:1px solid rgba(59,130,246,.25)}
      .abtn:disabled{opacity:.3;cursor:not-allowed}
      .result-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);align-items:center;justify-content:center;z-index:100;flex-direction:column;gap:12px}
      .result-overlay.show{display:flex}
      .res-title{font-size:42px;font-weight:700}
      .res-sub{font-size:16px;color:rgba(255,255,255,.5);font-style:italic}
      .res-amount{font-size:28px;font-weight:700}
      .res-btn{margin-top:8px;padding:12px 32px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .status-bar{font-size:12px;color:rgba(255,255,255,.35);font-style:italic;text-align:center;min-height:18px}
    </style>
    <div class="bjp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Blackjack</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="table">
        <div>
          <div class="zone-label">Dealer</div>
          <div class="hand" id="dealerHand"></div>
          <div class="total-badge" id="dealerTotal" style="visibility:hidden">?</div>
        </div>
        <div class="status-bar" id="statusBar">Place a bet and deal to start.</div>
        <div>
          <div class="zone-label">You</div>
          <div class="hand" id="playerHand"></div>
          <div class="total-badge" id="playerTotal" style="visibility:hidden">0</div>
        </div>
        <div class="controls">
          <div class="bet-row">
            <input class="bet-inp" id="betInput" type="number" min="10" value="100" placeholder="Bet">
            <button class="deal-btn" id="dealBtn">Deal</button>
          </div>
          <div class="action-row" id="actionRow" style="display:none">
            <button class="abtn hit"    id="hitBtn">Hit</button>
            <button class="abtn stand"  id="standBtn">Stand</button>
            <button class="abtn double" id="doubleBtn">Double</button>
            <button class="abtn split"  id="splitBtn" style="display:none">Split</button>
          </div>
        </div>
      </div>
    </div>
    <div class="result-overlay" id="resultOverlay">
      <div class="res-title" id="resTitle"></div>
      <div class="res-sub"   id="resSub"></div>
      <div class="res-amount" id="resAmount"></div>
      <button class="res-btn" id="resBtn">Play Again</button>
    </div>
  `;

  bindUI();
  bindSocket();
}

function renderCard(card, faceDown = false) {
  if (faceDown || card.rank === '?') {
    return `<div class="card hidden"></div>`;
  }
  const red = ['♥','♦'].includes(card.suit);
  return `<div class="card ${red?'red':'black'}">
    <div class="cr">${card.rank}</div>
    <div class="cs">${card.suit}</div>
    <div class="cc">${card.suit}</div>
  </div>`;
}

function handTotal(hand) {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.rank === '?') continue;
    const v = ['J','Q','K'].includes(c.rank) ? 10 : c.rank === 'A' ? 11 : parseInt(c.rank);
    total += v;
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function showHand(id, hand) {
  document.getElementById(id).innerHTML = hand.map(c => renderCard(c)).join('');
}

function setStatus(msg) { const el = document.getElementById('statusBar'); if (el) el.textContent = msg; }

function bindSocket() {
  socket.on('blackjack:state', (data) => {
    const { player_hands, active_hand, dealer_hand, can_double, can_split, cc_balance } = data;
    const hand = player_hands[active_hand];
    showHand('playerHand', hand);
    showHand('dealerHand', dealer_hand);

    const pt = document.getElementById('playerTotal');
    const dt = document.getElementById('dealerTotal');
    pt.textContent = handTotal(hand);
    pt.style.visibility = 'visible';
    dt.textContent = dealer_hand[0].rank !== '?' ? handTotal([dealer_hand[0]]) : '?';
    dt.style.visibility = 'visible';

    document.getElementById('dealBtn').disabled = true;
    document.getElementById('actionRow').style.display = 'flex';
    document.getElementById('doubleBtn').disabled = !can_double;
    document.getElementById('splitBtn').style.display = can_split ? '' : 'none';

    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();

    if (player_hands.length > 1) setStatus(`Hand ${active_hand + 1} of ${player_hands.length}`);
    else setStatus('Your turn — hit or stand?');
  });

  socket.on('blackjack:result', (data) => {
    const { player_hands, dealer_hand, dealer_total, total_payout, net, seed, cc_balance } = data;
    showHand('dealerHand', dealer_hand);
    document.getElementById('dealerTotal').textContent = dealer_total;

    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    document.getElementById('actionRow').style.display = 'none';
    document.getElementById('dealBtn').disabled = false;

    const outcomes = player_hands.map(h => h.outcome);
    const mainOutcome = outcomes[0];

    const overlay = document.getElementById('resultOverlay');
    const title   = document.getElementById('resTitle');
    const sub     = document.getElementById('resSub');
    const amt     = document.getElementById('resAmount');

    if (mainOutcome === 'blackjack') { title.textContent = '🃏 Blackjack!'; title.style.color = '#D4AF37'; }
    else if (mainOutcome === 'win')  { title.textContent = 'You Win!';      title.style.color = '#10b981'; }
    else if (mainOutcome === 'push') { title.textContent = 'Push';           title.style.color = '#fff'; }
    else                              { title.textContent = 'Dealer Wins';   title.style.color = '#ef4444'; }

    sub.textContent = `Dealer: ${dealer_total}`;
    amt.textContent = net >= 0 ? `+${net.toLocaleString()} CC` : `${net.toLocaleString()} CC`;
    amt.style.color = net >= 0 ? '#10b981' : '#ef4444';

    overlay.classList.add('show');
  });

  socket.on('blackjack:error', ({ message }) => setStatus(message));
}

function bindUI() {
  document.getElementById('backBtn').addEventListener('click', () => {
    socket.off('blackjack:state');
    socket.off('blackjack:result');
    socket.off('blackjack:error');
    window.__navigate('games');
  });

  document.getElementById('dealBtn').addEventListener('click', () => {
    const bet = Math.floor(Number(document.getElementById('betInput').value));
    if (bet < 10) return setStatus('Minimum bet is 10 CC');
    socket.emit('blackjack:deal', { bet });
    document.getElementById('dealBtn').disabled = true;
    setStatus('Dealing…');
  });

  document.getElementById('hitBtn').addEventListener('click',    () => socket.emit('blackjack:action', { action: 'hit' }));
  document.getElementById('standBtn').addEventListener('click',  () => socket.emit('blackjack:action', { action: 'stand' }));
  document.getElementById('doubleBtn').addEventListener('click', () => socket.emit('blackjack:action', { action: 'double' }));
  document.getElementById('splitBtn').addEventListener('click',  () => socket.emit('blackjack:action', { action: 'split' }));

  document.getElementById('resBtn').addEventListener('click', () => {
    document.getElementById('resultOverlay').classList.remove('show');
    document.getElementById('dealerHand').innerHTML = '';
    document.getElementById('playerHand').innerHTML = '';
    document.getElementById('dealerTotal').style.visibility = 'hidden';
    document.getElementById('playerTotal').style.visibility = 'hidden';
    setStatus('Place a bet and deal to start.');
  });
}
