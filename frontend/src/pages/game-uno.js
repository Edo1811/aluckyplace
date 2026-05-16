import socket from '../socket.js';
import { store } from '../store.js';

const COLOR_CSS = { red:'#ef4444', blue:'#3b82f6', green:'#10b981', yellow:'#eab308', wild:'#a855f7' };

export function renderUno(app, matchData) {
  const { matchId, pot, state: initState } = matchData;
  let gameState = initState || {};
  let pendingWild = false;

  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .up{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 30%,#1a0814 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff;overflow:hidden}
      .topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .game-lbl{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .pot-lbl{font-size:13px;color:rgba(255,255,255,.4)}
      .pot-lbl span{color:#D4AF37;font-weight:700}
      .main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:space-around;padding:14px;gap:10px;overflow:hidden}
      .opp-info{display:flex;align-items:center;gap:10px;font-size:13px;color:rgba(255,255,255,.5)}
      .opp-count{font-size:22px;font-weight:700;color:#ef4444}
      .center-area{display:flex;gap:20px;align-items:center}
      .draw-pile{width:70px;height:98px;border-radius:9px;background:linear-gradient(135deg,#3b1f6b,#1a0835);border:2px solid rgba(168,85,247,.3);display:flex;align-items:center;justify-content:center;font-size:28px;cursor:pointer;transition:all .15s}
      .draw-pile:hover{transform:scale(1.05)}
      .top-card{width:70px;height:98px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:22px;font-weight:700;border:2px solid rgba(255,255,255,.2);gap:4px}
      .turn-indicator{font-size:12px;letter-spacing:.1em;text-transform:uppercase;min-height:18px}
      .turn-indicator.your-turn{color:#10b981}
      .turn-indicator.their-turn{color:rgba(255,255,255,.3)}
      .hand-area{display:flex;flex-direction:column;align-items:center;gap:10px;width:100%}
      .hand{display:flex;gap:6px;overflow-x:auto;padding:6px 2px;scrollbar-width:none;max-width:100%;justify-content:center;flex-wrap:wrap}
      .hand::-webkit-scrollbar{display:none}
      .hcard{width:58px;height:82px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:16px;font-weight:700;cursor:pointer;border:2px solid transparent;transition:all .15s;gap:3px;flex-shrink:0}
      .hcard:hover{transform:translateY(-8px)}
      .hcard.unplayable{opacity:.4;cursor:not-allowed;transform:none}
      .hcard.disabled{pointer-events:none}
      .action-row{display:flex;gap:8px}
      .uno-btn{padding:8px 20px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:#ef4444;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
      .uno-btn:hover{background:rgba(239,68,68,.25)}
      /* Color picker */
      .color-picker{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);align-items:center;justify-content:center;z-index:100;flex-direction:column;gap:14px}
      .color-picker.show{display:flex}
      .cp-title{font-size:18px;font-weight:700}
      .cp-colors{display:flex;gap:12px}
      .cp-col{width:60px;height:60px;border-radius:50%;cursor:pointer;border:3px solid rgba(255,255,255,.2);transition:all .15s}
      .cp-col:hover{transform:scale(1.12);border-color:#fff}
      /* Result */
      .result-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);align-items:center;justify-content:center;flex-direction:column;gap:14px;z-index:200}
      .result-overlay.show{display:flex}
      .res-title{font-size:42px;font-weight:700}
      .res-btn{padding:12px 36px;background:#10b981;border:none;border-radius:10px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer}
    </style>
    <div class="up">
      <div class="topbar">
        <div class="game-lbl">Uno · PvP</div>
        <div class="pot-lbl">Pot: <span>${pot.toLocaleString()} CC</span></div>
      </div>
      <div class="main">
        <div class="opp-info">Opponent: <span class="opp-count" id="oppCount">5</span> cards</div>
        <div class="center-area">
          <div class="draw-pile" id="drawPile" title="Draw a card">🂠</div>
          <div class="top-card" id="topCard">?</div>
        </div>
        <div class="turn-indicator" id="turnIndicator"></div>
        <div class="hand-area">
          <div class="hand" id="hand"></div>
          <div class="action-row">
            <button class="uno-btn" id="unoBtn" style="display:none">UNO!</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Color picker -->
    <div class="color-picker" id="colorPicker">
      <div class="cp-title">Choose a color</div>
      <div class="cp-colors">
        ${['red','blue','green','yellow'].map(c =>
          `<div class="cp-col" style="background:${COLOR_CSS[c]}" data-color="${c}"></div>`
        ).join('')}
      </div>
    </div>

    <!-- Result overlay -->
    <div class="result-overlay" id="resultOverlay">
      <div class="res-title" id="resTitle"></div>
      <button class="res-btn" onclick="window.__navigate('games')">Back to Games</button>
    </div>
  `;

  function renderState(state) {
    if (!state) return;
    gameState = state;
    const { hand, opp_hand_size, top_card, current_color, your_turn } = state;

    // Top card
    const tc = document.getElementById('topCard');
    if (tc && top_card) {
      const col = current_color || top_card.color;
      tc.style.background = COLOR_CSS[col] || '#555';
      tc.style.borderColor = 'rgba(255,255,255,.3)';
      tc.innerHTML = `<span style="font-size:11px;opacity:.7;text-transform:uppercase">${col}</span><span>${top_card.value}</span>`;
    }

    // Opp count
    const oc = document.getElementById('oppCount');
    if (oc) oc.textContent = opp_hand_size ?? '?';

    // Turn indicator
    const ti = document.getElementById('turnIndicator');
    if (ti) {
      ti.textContent   = your_turn ? '⬆ Your Turn' : 'Opponent\'s Turn';
      ti.className     = `turn-indicator ${your_turn ? 'your-turn' : 'their-turn'}`;
    }

    // Hand
    const handEl = document.getElementById('hand');
    if (handEl && hand) {
      handEl.innerHTML = hand.map((card, i) => {
        const col = COLOR_CSS[card.color] || '#555';
        const playable = your_turn && canPlay(card, top_card, current_color);
        return `<div class="hcard${playable ? '' : ' unplayable'}" data-idx="${i}"
          style="background:${col};color:#fff;border-color:rgba(255,255,255,.2)">
          <span style="font-size:9px;opacity:.7">${card.color}</span>
          <span>${card.value}</span>
        </div>`;
      }).join('');

      // Draw pile click
      document.getElementById('drawPile').onclick = () => {
        if (!gameState.your_turn) return;
        socket.emit('pvp:move', { match_id: matchId, move: 'draw' });
        disableHand();
      };

      // Card click
      handEl.querySelectorAll('.hcard:not(.unplayable)').forEach(el => {
        el.addEventListener('click', () => {
          const idx = el.dataset.idx;
          const card = hand[idx];
          if (!card) return;
          if (card.color === 'wild') {
            pendingWild = idx;
            document.getElementById('colorPicker').classList.add('show');
          } else {
            socket.emit('pvp:move', { match_id: matchId, move: idx });
            disableHand();
          }
        });
      });
    }

    // Uno button
    const unoBtn = document.getElementById('unoBtn');
    if (unoBtn) unoBtn.style.display = hand?.length === 1 && your_turn ? 'block' : 'none';
  }

  function canPlay(card, topCard, currentColor) {
    if (!topCard) return true;
    if (card.color === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value) return true;
    return false;
  }

  function disableHand() {
    document.querySelectorAll('.hcard').forEach(c => c.classList.add('disabled'));
    document.getElementById('drawPile').onclick = null;
  }

  // Color picker
  document.getElementById('colorPicker').addEventListener('click', e => {
    const col = e.target.dataset.color;
    if (!col) return;
    document.getElementById('colorPicker').classList.remove('show');
    if (pendingWild !== null) {
      socket.emit('pvp:move', { match_id: matchId, move: `${pendingWild}:${col}` });
      pendingWild = null;
      disableHand();
    }
  });

  // Uno button
  document.getElementById('unoBtn').addEventListener('click', () => {
    socket.emit('pvp:move', { match_id: matchId, move: 'uno' });
  });

  // Initial render
  renderState(initState);

  socket.on('pvp:round_result', ({ state }) => {
    renderState(state);
  });

  socket.on('pvp:result', ({ you_won }) => {
    const overlay = document.getElementById('resultOverlay');
    const title   = document.getElementById('resTitle');
    title.textContent = you_won ? '🃏 You Win!' : 'You Lose';
    title.style.color = you_won ? '#10b981' : '#ef4444';
    overlay.classList.add('show');
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });

  socket.on('pvp:auto_win', () => {
    const overlay = document.getElementById('resultOverlay');
    document.getElementById('resTitle').textContent = '🃏 You Win!';
    document.getElementById('resTitle').style.color = '#10b981';
    overlay.classList.add('show');
    socket.off('pvp:round_result');
    socket.off('pvp:result');
    socket.off('pvp:auto_win');
  });
}
