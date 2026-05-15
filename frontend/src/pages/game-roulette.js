import { api } from '../api.js';
import { store, updateBalance } from '../store.js';

const RED = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const placedBets = [];
let defaultChip = 100;

export function renderRoulette(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .rp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 40%,#0a1a0a 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff;overflow:hidden}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .main{flex:1;display:flex;flex-direction:column;align-items:center;overflow-y:auto;padding:16px;gap:16px}
      /* Result display */
      .result-ring{width:80px;height:80px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;border:3px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);flex-shrink:0;transition:all .4s}
      .result-ring.red-r{background:rgba(180,0,0,.3);border-color:#b00000}
      .result-ring.black-r{background:rgba(0,0,0,.6);border-color:rgba(255,255,255,.4)}
      .result-ring.green-r{background:rgba(0,100,0,.3);border-color:#10b981}
      /* Table */
      .table-wrap{background:#145a14;border:2px solid rgba(255,255,255,.15);border-radius:14px;padding:12px;overflow-x:auto;max-width:100%}
      .num-grid{display:grid;grid-template-columns:repeat(12,1fr);gap:3px;margin-bottom:6px}
      .zero-row{display:grid;grid-template-columns:1fr;margin-bottom:6px}
      .ncell{padding:7px 4px;border-radius:5px;text-align:center;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;min-width:28px;user-select:none;border:1px solid transparent}
      .ncell:hover{transform:scale(1.08);box-shadow:0 0 8px rgba(255,255,255,.3)}
      .ncell.red-n{background:rgba(180,0,0,.7);color:#fff}
      .ncell.black-n{background:rgba(20,20,20,.9);color:#fff;border-color:rgba(255,255,255,.1)}
      .ncell.green-n{background:#14691e;color:#fff}
      .ncell.win-flash{animation:flash .5s ease 3}
      @keyframes flash{0%,100%{opacity:1}50%{opacity:.3}}
      .ncell.has-bet::after{content:attr(data-bet);position:absolute;top:1px;right:2px;font-size:8px;color:#D4AF37;font-weight:700}
      .ncell{position:relative}
      .outside-row{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:4px}
      .ocell{padding:8px 12px;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;transition:all .15s;user-select:none}
      .ocell:hover{background:rgba(255,255,255,.14)}
      .ocell.red-b{background:rgba(180,0,0,.3);border-color:rgba(180,0,0,.5)}
      .ocell.black-b{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.2)}
      /* Controls */
      .ctrl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
      .chip-inp{width:100px;padding:8px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none;text-align:center}
      .chip-inp:focus{border-color:rgba(212,175,55,.4)}
      .cbtn{padding:9px 18px;border:none;border-radius:9px;font-size:13px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;transition:all .15s}
      .cbtn.spin{background:#10b981;color:#fff}
      .cbtn.spin:hover{background:#0ea472}
      .cbtn.spin:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed}
      .cbtn.clear{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#ef4444}
      .bets-summary{font-size:11.5px;color:rgba(255,255,255,.35)}
      .bets-summary span{color:#D4AF37;font-weight:700}
      .result-bar{font-size:13px;text-align:center;min-height:20px}
    </style>
    <div class="rp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Roulette</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="main">
        <div style="display:flex;align-items:center;gap:16px">
          <div class="result-ring" id="resultRing">?</div>
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,.3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Last Result</div>
            <div style="font-size:13px;color:rgba(255,255,255,.5)" id="lastResultTxt">—</div>
          </div>
        </div>
        <div class="table-wrap">
          <div class="zero-row"><div class="ncell green-n" data-type="straight" data-value="0">0</div></div>
          <div class="num-grid" id="numGrid"></div>
          <div class="outside-row">
            <div class="ocell" data-type="half" data-value="low">1–18</div>
            <div class="ocell" data-type="parity" data-value="even">Even</div>
            <div class="ocell red-b" data-type="color" data-value="red">Red</div>
            <div class="ocell black-b" data-type="color" data-value="black">Black</div>
            <div class="ocell" data-type="parity" data-value="odd">Odd</div>
            <div class="ocell" data-type="half" data-value="high">19–36</div>
          </div>
          <div class="outside-row">
            <div class="ocell" data-type="dozen" data-value="1">1st 12</div>
            <div class="ocell" data-type="dozen" data-value="2">2nd 12</div>
            <div class="ocell" data-type="dozen" data-value="3">3rd 12</div>
            <div class="ocell" data-type="column" data-value="1">Col 1</div>
            <div class="ocell" data-type="column" data-value="2">Col 2</div>
            <div class="ocell" data-type="column" data-value="3">Col 3</div>
          </div>
        </div>
        <div class="ctrl-row">
          <span style="font-size:11px;color:rgba(255,255,255,.3)">Chip:</span>
          <input class="chip-inp" id="chipInput" type="number" min="10" value="100">
          <button class="cbtn clear" id="clearBtn">Clear</button>
          <button class="cbtn spin" id="spinBtn">Spin 🎡</button>
        </div>
        <div class="bets-summary" id="betsSummary">No bets placed</div>
        <div class="result-bar" id="resultBar"></div>
      </div>
    </div>
  `;

  buildNumGrid();
  bindUI();
}

function buildNumGrid() {
  const grid = document.getElementById('numGrid');
  // Numbers 1–36 in 3-row roulette layout (col-by-col): 1,4,7... 2,5,8... 3,6,9...
  const rows = [[], [], []];
  for (let n = 1; n <= 36; n++) {
    const row = (n - 1) % 3;
    rows[row].push(n);
  }
  // Render col by col matching standard table
  const nums = [];
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      nums.push(row * 12 + col + 1);
    }
  }
  // Just render 1–36 in 3 rows of 12
  const sorted = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 12; c++) sorted.push(3 - r + c * 3);
  }
  grid.innerHTML = sorted.map(n => {
    const color = RED.has(n) ? 'red-n' : 'black-n';
    return `<div class="ncell ${color}" data-type="straight" data-value="${n}">${n}</div>`;
  }).join('');
}

function bindUI() {
  document.getElementById('backBtn').addEventListener('click', () => window.__navigate('games'));

  document.getElementById('clearBtn').addEventListener('click', () => {
    placedBets.length = 0;
    document.querySelectorAll('.ncell,.ocell').forEach(el => { el.removeAttribute('data-bet'); el.style.outline = ''; });
    updateBetSummary();
  });

  document.querySelector('.main').addEventListener('click', e => {
    const cell = e.target.closest('[data-type]');
    if (!cell) return;
    const chip = Math.floor(Number(document.getElementById('chipInput').value)) || 100;
    placedBets.push({ type: cell.dataset.type, value: cell.dataset.value, amount: chip });
    const cur = parseInt(cell.getAttribute('data-bet') || '0');
    cell.setAttribute('data-bet', cur + chip);
    cell.style.outline = '2px solid #D4AF37';
    updateBetSummary();
  });

  document.getElementById('spinBtn').addEventListener('click', async () => {
    if (placedBets.length === 0) { document.getElementById('resultBar').textContent = 'Place at least one bet first.'; return; }
    const btn = document.getElementById('spinBtn');
    btn.disabled = true;
    document.getElementById('resultBar').textContent = 'Spinning…';

    try {
      const data = await api.post('/games/roulette/spin', { bets: placedBets });
      const { result, color, bets: settled, totalBet, totalPayout, net, cc_balance } = data;

      // Show result
      const ring = document.getElementById('resultRing');
      ring.textContent = result;
      ring.className = `result-ring ${color === 'red' ? 'red-r' : color === 'black' ? 'black-r' : 'green-r'}`;
      document.getElementById('lastResultTxt').textContent = `${result} — ${color}`;

      // Flash winning numbers
      const winCell = document.querySelector(`.ncell[data-value="${result}"]`);
      if (winCell) winCell.classList.add('win-flash');
      setTimeout(() => winCell?.classList.remove('win-flash'), 1600);

      updateBalance({ cc_balance });
      document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();

      const netStr = net >= 0 ? `+${net.toLocaleString()} CC` : `${net.toLocaleString()} CC`;
      document.getElementById('resultBar').textContent = `Result: ${result} ${color} — ${netStr}`;
      document.getElementById('resultBar').style.color = net >= 0 ? '#10b981' : '#ef4444';

      // Clear bets for next round
      placedBets.length = 0;
      document.querySelectorAll('.ncell,.ocell').forEach(el => { el.removeAttribute('data-bet'); el.style.outline = ''; });
      updateBetSummary();

    } catch (e) {
      document.getElementById('resultBar').textContent = e.message || 'Error';
    } finally {
      btn.disabled = false;
    }
  });
}

function updateBetSummary() {
  const total = placedBets.reduce((s, b) => s + b.amount, 0);
  const el = document.getElementById('betsSummary');
  if (!el) return;
  el.innerHTML = total > 0
    ? `Total bet: <span>${total.toLocaleString()} CC</span> across ${placedBets.length} position${placedBets.length > 1 ? 's' : ''}`
    : 'No bets placed';
}
