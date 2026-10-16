import socket from '../socket.js';
import { $, later } from '../ui/core.js';
import { on } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';

// First to 2 round wins. 5s per round — no pick means rock.
const ICON = { rock: '✊', paper: '✋', scissors: '✌️' };
const STYLE = `
.rpsslot.shake{animation:rpsShake .32s ease-in-out 3}
@keyframes rpsShake{50%{transform:translateY(-10px)}}
.rpspick{display:flex;gap:8px;width:100%}
.rpspick .ga{font-size:22px;padding:12px 0}
.rpspick .ga.on{background:rgba(16,185,129,.16);border-color:rgba(16,185,129,.45)}
.rpsscore{text-align:center;font-size:30px;font-weight:700;letter-spacing:.08em}
`;

export function renderRps(app, md) {
  const p = pvpShell(app, md, {
    game: 'rps', title: 'Rock Paper Scissors', css: STYLE,
    stage: `<div class="pad">
      <div class="rpsscore" id="rpScore">0 – 0</div>
      <div class="pips" id="rpPips"></div>
      <div class="rpsrow"><div class="rpsslot" id="rpMe">?</div><div class="muted">vs</div><div class="rpsslot" id="rpOpp">?</div></div>
      <div class="logline" id="rpLog">Round 1 · pick your move</div>
    </div>`,
  });
  if (!p) return;

  let me = 0, opp = 0, picked = null, locked = false, result = null, hist = [];
  const pips = () => { $('rpPips').innerHTML = hist.map((h) => `<div class="pip ${h}"></div>`).join(''); $('rpScore').textContent = `${me} – ${opp}`; };

  function buttons() {
    const a = p.shell.actions(`<div class="rpspick">${Object.entries(ICON).map(([k, v]) => `<button class="ga" data-m="${k}" aria-label="${k}">${v}</button>`).join('')}</div>`);
    a.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.m, b)));
  }
  function pick(m, b) {
    if (locked || picked) return;
    picked = m; p.move(m);
    document.querySelectorAll('[data-m]').forEach((x) => { x.disabled = x !== b; x.classList.toggle('on', x === b); });
    $('rpMe').textContent = ICON[m];
    $('rpLog').textContent = 'Locked in · waiting';
  }
  function newRound(n, ms = 5000) {
    picked = null; locked = false;
    ['rpMe', 'rpOpp'].forEach((id) => { $(id).textContent = '✊'; $(id).className = 'rpsslot shake'; });
    later(1000, () => { if (!picked) { $('rpMe').textContent = '?'; $('rpMe').className = 'rpsslot'; } $('rpOpp').textContent = '?'; $('rpOpp').className = 'rpsslot'; });
    $('rpLog').textContent = `Round ${n} · pick your move`;
    buttons(); p.timer(ms);
  }

  on(socket, {
    'pvp:opponent_moved': () => { if (!picked) $('rpLog').textContent = `${md.opponent} picked · your turn`; },
    'pvp:round_result': ({ your_move, opp_move, result: r, round }) => {
      locked = true; p.timer(0);
      $('rpMe').textContent = ICON[your_move]; $('rpOpp').textContent = ICON[opp_move];
      $('rpMe').className = `rpsslot${r === 'win' ? ' win' : r === 'loss' ? ' lose' : ''}`;
      $('rpOpp').className = `rpsslot${r === 'loss' ? ' win' : r === 'win' ? ' lose' : ''}`;
      if (r === 'win') { me++; hist.push('w'); } else if (r === 'loss') { opp++; hist.push('l'); }
      pips();
      $('rpLog').textContent = r === 'tie' ? 'Draw — replay the round' : r === 'win' ? 'Round won' : 'Round lost';
      if (!picked) $('rpLog').textContent += ' (auto-picked rock)';
      if (me < 2 && opp < 2) later(1400, () => newRound(r === 'tie' ? round : round + 1, 3600)); // server's 5s clock is already running
      else if (result) end();
    },
    'pvp:result': (r) => { result = r; if (me >= 2 || opp >= 2) end(); },
  });
  const end = () => later(1100, () => p.finish({ won: result.you_won, seed: result.seed, sub: `${result.you_won ? 'Won' : 'Lost'} the series ${me}–${opp}` }));

  pips();
  newRound(1);
}
