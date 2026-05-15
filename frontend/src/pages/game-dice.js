import { api } from '../api.js';
import { store, updateBalance } from '../store.js';

export function renderDice(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .dp{display:flex;flex-direction:column;height:100vh;background:#050505;font-family:'Playfair Display',Georgia,serif;color:#fff}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .main{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px}
      .roll-display{width:120px;height:120px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:56px;font-weight:700;transition:all .3s;box-shadow:0 4px 24px rgba(0,0,0,.4)}
      .card{width:100%;max-width:400px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:16px}
      .label{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25)}
      .dir-row{display:flex;gap:8px}
      .dir-btn{flex:1;padding:10px;border-radius:9px;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);transition:all .15s}
      .dir-btn.on.over{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.35);color:#10b981}
      .dir-btn.on.under{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.3);color:#ef4444}
      .slider-wrap{position:relative}
      input[type=range]{width:100%;height:6px;border-radius:3px;outline:none;-webkit-appearance:none;cursor:pointer}
      input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#10b981;cursor:pointer;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)}
      .slider-labels{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.25);margin-top:4px}
      .stats-row{display:flex;gap:12px}
      .stat{flex:1;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px;text-align:center}
      .stat-n{font-size:18px;font-weight:700;color:#10b981}
      .stat-l{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-top:3px}
      .bet-row{display:flex;gap:8px;align-items:center}
      .bet-inp{flex:1;padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none}
      .bet-inp:focus{border-color:rgba(16,185,129,.4)}
      .roll-btn{padding:11px 28px;background:#10b981;border:none;border-radius:9px;color:#fff;font-size:14px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;transition:all .15s;white-space:nowrap}
      .roll-btn:hover{background:#0ea472}
      .roll-btn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed}
      .result-row{text-align:center;font-size:15px;min-height:22px;transition:color .3s}
    </style>
    <div class="dp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Dice</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="main">
        <div class="roll-display" id="rollDisplay">?</div>
        <div class="card">
          <div class="label">Direction</div>
          <div class="dir-row">
            <button class="dir-btn on over" id="overBtn" data-dir="over">▲ Over</button>
            <button class="dir-btn under"    id="underBtn" data-dir="under">▼ Under</button>
          </div>
          <div class="label">Threshold: <span id="threshVal">50</span></div>
          <div class="slider-wrap">
            <input type="range" id="threshSlider" min="2" max="98" value="50">
            <div class="slider-labels"><span>2</span><span>50</span><span>98</span></div>
          </div>
          <div class="stats-row">
            <div class="stat"><div class="stat-n" id="pWinDisplay">50%</div><div class="stat-l">Win Chance</div></div>
            <div class="stat"><div class="stat-n" id="multDisplay">1.98×</div><div class="stat-l">Multiplier</div></div>
          </div>
          <div class="bet-row">
            <input class="bet-inp" id="betInput" type="number" min="10" value="100" placeholder="Bet CC">
            <button class="roll-btn" id="rollBtn">🎲 Roll</button>
          </div>
          <div class="result-row" id="resultRow"></div>
        </div>
      </div>
    </div>
  `;

  let direction = 'over';

  const updateStats = () => {
    const t = parseInt(document.getElementById('threshSlider').value);
    document.getElementById('threshVal').textContent = t;
    const pWin = direction === 'over' ? (100 - t) / 100 : (t - 1) / 100;
    const mult = (0.99 / pWin).toFixed(2);
    document.getElementById('pWinDisplay').textContent = (pWin * 100).toFixed(0) + '%';
    document.getElementById('multDisplay').textContent = mult + '×';
    // Colour the slider track
    const pct = ((t - 2) / 96) * 100;
    const col = direction === 'over' ? '#10b981' : '#ef4444';
    document.getElementById('threshSlider').style.background =
      `linear-gradient(to right, rgba(255,255,255,.15) 0%, rgba(255,255,255,.15) ${pct}%, ${col}44 ${pct}%, ${col}44 100%)`;
  };

  document.getElementById('overBtn').addEventListener('click', () => {
    direction = 'over';
    document.getElementById('overBtn').classList.add('on');
    document.getElementById('underBtn').classList.remove('on');
    updateStats();
  });
  document.getElementById('underBtn').addEventListener('click', () => {
    direction = 'under';
    document.getElementById('underBtn').classList.add('on');
    document.getElementById('overBtn').classList.remove('on');
    updateStats();
  });
  document.getElementById('threshSlider').addEventListener('input', updateStats);
  updateStats();

  document.getElementById('backBtn').addEventListener('click', () => window.__navigate('games'));

  document.getElementById('rollBtn').addEventListener('click', async () => {
    const bet       = Math.floor(Number(document.getElementById('betInput').value));
    const threshold = parseInt(document.getElementById('threshSlider').value);
    if (bet < 10) { setResult('Minimum bet is 10 CC', '#ef4444'); return; }

    const btn = document.getElementById('rollBtn');
    btn.disabled = true;

    // Animate
    const disp = document.getElementById('rollDisplay');
    let flicker = 0;
    const flickInterval = setInterval(() => {
      disp.textContent = Math.floor(Math.random() * 100) + 1;
      disp.style.color = 'rgba(255,255,255,.4)';
    }, 60);

    try {
      const data = await api.post('/games/dice/roll', { amount: bet, direction, threshold });
      clearInterval(flickInterval);

      disp.textContent = data.roll;
      disp.style.color = data.win ? '#10b981' : '#ef4444';
      disp.style.boxShadow = `0 4px 28px ${data.win ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.35)'}`;
      setTimeout(() => { disp.style.boxShadow = '0 4px 24px rgba(0,0,0,.4)'; }, 1500);

      updateBalance({ cc_balance: data.cc_balance });
      document.getElementById('balDisplay').textContent = Number(data.cc_balance).toLocaleString();
      setResult(data.win ? `+${data.payout.toLocaleString()} CC (${data.multiplier.toFixed(2)}×)` : `-${bet.toLocaleString()} CC`,
        data.win ? '#10b981' : '#ef4444');

    } catch (e) {
      clearInterval(flickInterval);
      disp.textContent = '?';
      setResult(e.message || 'Error', '#ef4444');
    } finally {
      setTimeout(() => { btn.disabled = false; }, 700);
    }
  });
}

function setResult(msg, color) {
  const el = document.getElementById('resultRow');
  if (el) { el.textContent = msg; el.style.color = color; }
}
