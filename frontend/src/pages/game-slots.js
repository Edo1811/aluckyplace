import { api } from '../api.js';
import { store, updateBalance } from '../store.js';

const SYMBOLS = ['💎','⭐','💵','🔔','🍒'];
const NAMES   = ['Diamond','Star','Dollar','Bell','Cherry'];
const COLORS  = ['#10b981','#D4AF37','#3b82f6','#a855f7','#ef4444'];

export function renderSlots(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .sp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,#150a2a 0%,#050505 65%);font-family:'Playfair Display',Georgia,serif;color:#fff}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .slot-area{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px}
      .machine{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px}
      .reels{display:flex;gap:12px}
      .reel-wrap{width:88px;height:88px;border-radius:12px;background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.1);overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center}
      .reel-win{position:absolute;inset:0;border-radius:12px;border:2px solid transparent;transition:border-color .3s,box-shadow .3s}
      .reel-sym{font-size:44px;transition:transform .1s;user-select:none}
      .payline{height:2px;background:rgba(212,175,55,.3);border-radius:1px;width:100%;margin:-4px 0}
      .result-msg{font-size:22px;font-weight:700;min-height:32px;text-align:center;transition:color .3s}
      .controls{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:320px}
      .bet-row{display:flex;gap:8px;align-items:center}
      .bet-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.3)}
      .bet-inp{width:110px;padding:9px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none;text-align:center}
      .bet-inp:focus{border-color:rgba(168,85,247,.4)}
      .spin-btn{padding:13px 48px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;border-radius:12px;color:#fff;font-size:16px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;transition:all .15s;box-shadow:0 4px 20px rgba(168,85,247,.3)}
      .spin-btn:hover{transform:translateY(-1px);box-shadow:0 6px 24px rgba(168,85,247,.4)}
      .spin-btn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed;transform:none;box-shadow:none}
      .paytable{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:340px}
      .prow{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:9px;padding:8px 10px;text-align:center}
      .prow-sym{font-size:18px;margin-bottom:3px}
      .prow-mult{font-size:13px;font-weight:700;color:#D4AF37}
      .prow-name{font-size:9px;color:rgba(255,255,255,.25);letter-spacing:.06em}
    </style>
    <div class="sp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Slots</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="slot-area">
        <div class="machine">
          <div class="reels" id="reels">
            ${[0,1,2].map(i => `
              <div class="reel-wrap" id="reel${i}">
                <div class="reel-win" id="reelWin${i}"></div>
                <div class="reel-sym" id="reelSym${i}">🍒</div>
              </div>`).join('')}
          </div>
          <div class="payline"></div>
          <div class="result-msg" id="resultMsg">—</div>
        </div>
        <div class="controls">
          <div class="bet-row">
            <span class="bet-label">Bet</span>
            <input class="bet-inp" id="betInput" type="number" min="10" value="100">
          </div>
          <button class="spin-btn" id="spinBtn">🎰 Spin</button>
        </div>
        <div class="paytable">
          <div class="prow"><div class="prow-sym">💎💎💎</div><div class="prow-mult">100×</div><div class="prow-name">JACKPOT</div></div>
          <div class="prow"><div class="prow-sym">⭐⭐⭐</div><div class="prow-mult">40×</div><div class="prow-name">STAR</div></div>
          <div class="prow"><div class="prow-sym">💵💵💵</div><div class="prow-mult">15×</div><div class="prow-name">DOLLAR</div></div>
          <div class="prow"><div class="prow-sym">🔔🔔🔔</div><div class="prow-mult">8×</div><div class="prow-name">BELL</div></div>
          <div class="prow"><div class="prow-sym">🍒🍒🍒</div><div class="prow-mult">3×</div><div class="prow-name">CHERRY</div></div>
          <div class="prow"><div class="prow-sym">🍒🍒</div><div class="prow-mult">2×</div><div class="prow-name">ANY TWO</div></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => window.__navigate('games'));
  document.getElementById('spinBtn').addEventListener('click', doSpin);
}

async function doSpin() {
  const bet = Math.floor(Number(document.getElementById('betInput').value));
  if (bet < 10) return setMsg('Minimum bet is 10 CC', '#ef4444');

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  setMsg('Spinning…', 'rgba(255,255,255,.4)');

  // Animate reels spinning
  animateReels(true);

  try {
    const data = await api.post('/games/slots/spin', { amount: bet });
    await new Promise(r => setTimeout(r, 600)); // let animation run

    // Stop reels on result
    animateReels(false);
    await showResult(data);

    updateBalance({ cc_balance: data.cc_balance });
    document.getElementById('balDisplay').textContent = Number(data.cc_balance).toLocaleString();

  } catch (e) {
    animateReels(false);
    setMsg(e.message || 'Error', '#ef4444');
  } finally {
    btn.disabled = false;
  }
}

let spinIntervals = [];
function animateReels(spinning) {
  spinIntervals.forEach(clearInterval);
  spinIntervals = [];
  if (spinning) {
    [0,1,2].forEach(i => {
      spinIntervals.push(setInterval(() => {
        document.getElementById(`reelSym${i}`).textContent = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      }, 80));
    });
  }
}

async function showResult(data) {
  const { reels, multiplier, nearMiss, payout, net } = data;
  const symMap = { Diamond:'💎', Star:'⭐', Dollar:'💵', Bell:'🔔', Cherry:'🍒' };

  // Set final symbols with staggered delay
  for (let i = 0; i < 3; i++) {
    await new Promise(r => setTimeout(r, 120 * i));
    document.getElementById(`reelSym${i}`).textContent = symMap[reels[i]] || reels[i];
  }

  await new Promise(r => setTimeout(r, 100));

  if (multiplier > 0) {
    // Flash winning reels
    reels.forEach((_, i) => {
      const win = document.getElementById(`reelWin${i}`);
      const col = multiplier >= 40 ? '#D4AF37' : '#10b981';
      win.style.borderColor = col;
      win.style.boxShadow = `0 0 16px ${col}66`;
    });
    setMsg(multiplier >= 100 ? `🎰 JACKPOT! +${payout.toLocaleString()} CC` : `+${payout.toLocaleString()} CC (${multiplier}×)`,
      multiplier >= 40 ? '#D4AF37' : '#10b981');
    setTimeout(() => reels.forEach((_, i) => {
      const w = document.getElementById(`reelWin${i}`);
      w.style.borderColor = 'transparent'; w.style.boxShadow = 'none';
    }), 2000);
  } else if (nearMiss) {
    setMsg('So close… 😬', 'rgba(255,255,255,.5)');
  } else {
    setMsg(`-${Math.abs(net).toLocaleString()} CC`, '#ef4444');
  }
}

function setMsg(msg, color = '#fff') {
  const el = document.getElementById('resultMsg');
  if (el) { el.textContent = msg; el.style.color = color; }
}
