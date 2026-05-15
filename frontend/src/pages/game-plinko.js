import { api } from '../api.js';
import { store, updateBalance } from '../store.js';

const MULT = [250, 30, 6, 2, 0.5, 0.3, 0.2, 0.3, 0.5, 2, 6, 30, 250];
const ROWS  = 12;

export function renderPlinko(app) {
  app.innerHTML = `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5/index.css">
    <style>
      *, *::before, *::after{margin:0;padding:0;box-sizing:border-box}
      body{background:#050505}
      .pp{display:flex;flex-direction:column;height:100vh;background:radial-gradient(ellipse at 50% 30%,#0d0a20 0%,#050505 70%);font-family:'Playfair Display',Georgia,serif;color:#fff}
      .topbar{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
      .back{padding:6px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:8px;color:rgba(255,255,255,.5);font-size:12px;cursor:pointer;font-family:'Playfair Display',Georgia,serif}
      .game-title{font-size:16px;font-weight:700}
      .bal-chip{margin-left:auto;font-size:12px;color:rgba(255,255,255,.4)}
      .bal-chip span{color:#10b981;font-weight:700}
      .main{flex:1;display:flex;align-items:center;justify-content:center;gap:20px;padding:16px;flex-wrap:wrap}
      canvas#plinkoCanvas{border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.07)}
      .side{display:flex;flex-direction:column;gap:12px;width:170px}
      .bet-label{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25)}
      .bet-inp{width:100%;padding:10px 12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;outline:none;text-align:center}
      .bet-inp:focus{border-color:rgba(168,85,247,.4)}
      .drop-btn{width:100%;padding:13px;background:linear-gradient(135deg,#a855f7,#7c3aed);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:700;font-family:'Playfair Display',Georgia,serif;cursor:pointer;transition:all .15s;box-shadow:0 4px 18px rgba(168,85,247,.3)}
      .drop-btn:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(168,85,247,.4)}
      .drop-btn:disabled{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25);cursor:not-allowed;transform:none;box-shadow:none}
      .result-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;text-align:center}
      .res-mult{font-size:28px;font-weight:700;color:#10b981;min-height:36px}
      .res-cc{font-size:13px;color:rgba(255,255,255,.4);margin-top:4px;min-height:18px}
      .slots-label{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.2);margin-top:4px}
      .slots-list{display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;scrollbar-width:none}
      .srow{display:flex;justify-content:space-between;font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.03)}
      .srow.hl{background:rgba(168,85,247,.12);color:#a855f7;font-weight:700}
    </style>
    <div class="pp">
      <div class="topbar">
        <button class="back" id="backBtn">← Games</button>
        <span class="game-title">Plinko</span>
        <span class="bal-chip">Balance: <span id="balDisplay">${Number(store.ccBalance).toLocaleString()}</span> CC</span>
      </div>
      <div class="main">
        <canvas id="plinkoCanvas" width="340" height="380"></canvas>
        <div class="side">
          <div class="bet-label">Bet per ball</div>
          <input class="bet-inp" id="betInput" type="number" min="10" value="100">
          <button class="drop-btn" id="dropBtn">⬇ Drop Ball</button>
          <div class="result-card">
            <div class="res-mult" id="resMult">—</div>
            <div class="res-cc"   id="resCc"></div>
          </div>
          <div class="slots-label">Slots (L→R)</div>
          <div class="slots-list">
            ${MULT.map((m,i) => `<div class="srow" id="slot${i}"><span>Slot ${i}</span><span>${m}×</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;

  drawBoard();
  document.getElementById('backBtn').addEventListener('click', () => window.__navigate('games'));
  document.getElementById('dropBtn').addEventListener('click', doDrop);
}

function slotColor(mult) {
  if (mult >= 100) return '#D4AF37';
  if (mult >= 6)   return '#a855f7';
  if (mult >= 1)   return '#3b82f6';
  return 'rgba(255,255,255,.2)';
}

function drawBoard(activeBall = null, activeSlot = -1) {
  const canvas = document.getElementById('plinkoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const pegR   = 4;
  const topPad = 28, botPad = 44;
  const usableH = H - topPad - botPad;
  const usableW = W - 40;

  // Draw pegs
  for (let row = 0; row < ROWS; row++) {
    const pegsInRow = row + 2;
    const y = topPad + (usableH / ROWS) * row + usableH / ROWS / 2;
    for (let col = 0; col < pegsInRow; col++) {
      const x = W / 2 - (usableW / (pegsInRow - 1)) * (pegsInRow - 1) / 2 + (usableW / (pegsInRow - 1)) * col;
      ctx.beginPath();
      ctx.arc(x, y, pegR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fill();
    }
  }

  // Draw slot buckets
  const slotW = W / MULT.length;
  MULT.forEach((m, i) => {
    const x = i * slotW;
    const y = H - botPad;
    const col = activeSlot === i ? '#fff' : slotColor(m);
    ctx.fillStyle = activeSlot === i ? col + 'aa' : col + '33';
    ctx.strokeStyle = col;
    ctx.lineWidth = activeSlot === i ? 2 : 1;
    ctx.beginPath();
    ctx.rect(x + 2, y, slotW - 4, botPad - 4);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = activeSlot === i ? '#fff' : col;
    ctx.font = `bold ${m >= 10 ? 9 : 10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m + '×', x + slotW / 2, y + (botPad - 4) / 2);
  });

  // Animate ball
  if (activeBall) {
    ctx.beginPath();
    ctx.arc(activeBall.x, activeBall.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#D4AF37';
    ctx.shadowColor = '#D4AF37';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

async function doDrop() {
  const bet = Math.floor(Number(document.getElementById('betInput').value));
  if (bet < 10) { document.getElementById('resMult').textContent = 'Min 10 CC'; return; }
  const btn = document.getElementById('dropBtn');
  btn.disabled = true;

  try {
    const data = await api.post('/games/plinko/drop', { amount: bet });
    const { slot, path, multiplier, payout, net, cc_balance } = data;

    // Animate the ball following the actual path
    await animateBall(path, slot);

    updateBalance({ cc_balance });
    document.getElementById('balDisplay').textContent = Number(cc_balance).toLocaleString();
    document.getElementById('resMult').textContent = multiplier + '×';
    document.getElementById('resMult').style.color = slotColor(multiplier);
    document.getElementById('resCc').textContent = net >= 0 ? `+${net.toLocaleString()} CC` : `${net.toLocaleString()} CC`;
    document.getElementById('resCc').style.color = net >= 0 ? '#10b981' : '#ef4444';

    // Highlight slot in list
    document.querySelectorAll('.srow').forEach(r => r.classList.remove('hl'));
    document.getElementById(`slot${slot}`)?.classList.add('hl');

  } catch (e) {
    document.getElementById('resMult').textContent = 'Error';
  } finally {
    btn.disabled = false;
  }
}

async function animateBall(path, finalSlot) {
  const canvas = document.getElementById('plinkoCanvas');
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const topPad = 28, botPad = 44, usableH = H - topPad - botPad, usableW = W - 40;

  let col = 0;
  const startX = W / 2;
  const startY = topPad - 10;

  for (let row = 0; row < path.length; row++) {
    const dir = path[row] === 'R' ? 1 : 0;
    col += dir;
    const pegsInRow = row + 2;
    const pegX = W / 2 - (usableW / (pegsInRow - 1)) * (pegsInRow - 1) / 2 + (usableW / (pegsInRow - 1)) * col;
    const pegY = topPad + (usableH / ROWS) * row + usableH / ROWS / 2;

    // Animate to this peg
    const fromX = row === 0 ? startX : undefined;
    await tweenBall(fromX !== undefined ? fromX : null, null, pegX, pegY);
  }
  // Final drop to slot
  const slotW = W / MULT.length;
  const slotX = finalSlot * slotW + slotW / 2;
  await tweenBall(null, null, slotX, H - botPad - 4);
  drawBoard(null, finalSlot);
  await new Promise(r => setTimeout(r, 600));
  drawBoard(null, -1);
}

let ballPos = null;
async function tweenBall(fromX, fromY, toX, toY, ms = 80) {
  const canvas = document.getElementById('plinkoCanvas');
  if (!canvas) return;
  const start = ballPos || { x: fromX || toX, y: fromY || 20 };
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    ballPos = { x: start.x + (toX - start.x) * t, y: start.y + (toY - start.y) * t };
    drawBoard(ballPos);
    await new Promise(r => setTimeout(r, ms / steps));
  }
  ballPos = { x: toX, y: toY };
}
