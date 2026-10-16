import socket from '../socket.js';
import { $, fmt, toast, later } from '../ui/core.js';
import { gameShell, on, syncBalance } from '../games/shell.js';

// Server: 5 mines on a 5×5 grid. Multipliers by number of safe picks.
const BOMBS = 5;
const MULT = [1, 1.24, 1.56, 2.00, 2.58, 3.39, 4.53, 6.14, 8.51, 12.0, 17.5, 26.3, 40.9, 66.4, 113.9, 208.9, 417.7, 940, 2506, 8769, 52602];

export function renderMines(app) {
  const shell = gameShell(app, {
    id: 'mines', title: 'Mines',
    stage: `<div class="pad">
      <div class="statrow">
        <div><div class="stat-v" id="mnMul">1.00×</div><div class="stat-l">Multiplier</div></div>
        <div><div class="stat-v" id="mnPay">0</div><div class="stat-l">Cash out value</div></div>
        <div><div class="stat-v" id="mnNext">1.24×</div><div class="stat-l">Next tile</div></div>
      </div>
      <div class="mgrid" id="mnGrid"></div>
      <div class="ghint">${BOMBS} mines hidden · every safe tile pays more</div>
    </div>`,
  });

  let bet = 0, picks = 0, busy = false, done = true, pending = -1;

  const tile = (i) => $('mnGrid')?.children[i];
  const hud = () => {
    $('mnMul').textContent = `${(picks ? MULT[picks] : 1).toFixed(2)}×`;
    $('mnPay').textContent = picks ? fmt(Math.floor(bet * MULT[picks])) : '0';
    $('mnNext').textContent = MULT[picks + 1] ? `${MULT[picks + 1].toFixed(2)}×` : '—';
    const c = $('mnCash'); if (c) { c.disabled = !picks || done || busy; c.textContent = picks ? `Cash out ${fmt(Math.floor(bet * MULT[picks]))}` : 'Cash out'; }
  };

  function board() {
    $('mnGrid').innerHTML = Array.from({ length: 25 }, (_, i) => `<button class="mtile" data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('');
    $('mnGrid').querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => pick(Number(b.dataset.i))));
    shell.actions('<button class="ga ga-em" id="mnCash" disabled>Cash out</button>');
    $('mnCash').onclick = cashout;
  }
  function pick(i) {
    if (done || busy) return;
    const t = tile(i); if (!t || t.classList.contains('gem')) return;
    busy = true; pending = i; t.style.opacity = '.55';
    socket.emit('mines:pick', { tile_index: i });
  }
  function cashout() {
    if (done || busy || !picks) return;
    busy = true; hud();
    socket.emit('mines:cashout');
  }
  function reveal(bombs, hit) {
    (bombs || []).forEach((b) => { const t = tile(b); if (t && b !== hit) { t.className = 'mtile boom dim'; t.textContent = '✕'; } });
    $('mnGrid').querySelectorAll('.mtile:not(.gem):not(.boom)').forEach((t) => { t.classList.add('dim'); });
  }
  function start(b) {
    bet = b; picks = 0; done = false; busy = true;
    board(); hud();
    socket.emit('mines:start', { bet: b });
    shell.show('scPlay');
  }
  const again = () => start(bet);
  const change = () => shell.bet({ onPlace: start });

  on(socket, {
    'mines:board': ({ cc_balance }) => { busy = false; syncBalance(cc_balance); hud(); },
    'mines:resume': ({ bet: b, picks: n, revealed }) => {
      bet = Number(b); picks = Number(n) || 0; busy = false; done = false;
      board();
      (revealed || []).forEach((i) => { const t = tile(i); if (t) { t.className = 'mtile gem'; t.textContent = '◆'; } });
      hud(); shell.show('scPlay');
      toast('Picked up your unfinished board', 'amber');
    },
    'mines:safe': ({ tile_index, multiplier }) => {
      busy = false; picks++;
      const t = tile(tile_index); if (t) { t.style.opacity = ''; t.className = 'mtile gem'; t.textContent = '◆'; }
      if (multiplier) MULT[picks] = Number(multiplier);
      hud();
    },
    'mines:bomb': ({ tile_index, bomb_positions, seed, cc_balance }) => {
      busy = false; done = true; syncBalance(cc_balance);
      const t = tile(tile_index); if (t) { t.style.opacity = ''; t.className = 'mtile boom'; t.textContent = '✕'; }
      reveal(bomb_positions, tile_index); hud();
      if ('vibrate' in navigator) navigator.vibrate(80);
      later(1500, () => shell.result({ net: -bet, sub: `Hit a mine after ${picks} safe pick${picks === 1 ? '' : 's'}`, seed, again, change }));
    },
    'mines:cashout:confirm': ({ payout, picks: n, seed, bomb_positions, cc_balance }) => {
      busy = false; done = true; syncBalance(cc_balance);
      reveal(bomb_positions); hud();
      later(900, () => shell.result({ net: Number(payout) - bet, sub: `Cashed out at ${MULT[n || picks].toFixed(2)}× after ${n || picks} picks`, seed, again, change }));
    },
    'mines:error': ({ message }) => {
      busy = false;
      if (pending >= 0) { const t = tile(pending); if (t) t.style.opacity = ''; pending = -1; }
      toast(message || 'Mines error', 'red');
      if (!picks && /balance|minimum|bet/i.test(message || '')) { done = true; change(); }
      hud();
    },
  });

  change();
}
