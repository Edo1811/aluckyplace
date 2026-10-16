import socket from '../socket.js';
import { $, later } from '../ui/core.js';
import { on } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';

// 3 HP each. Both pick at once; 10s per round — no pick means defend.
const MAX = 3;
const LABEL = { attack: 'Attack', defend: 'Defend', special: 'Special' };
const STYLE = `
.hearts{display:flex;gap:4px;justify-content:center;margin-bottom:8px;font-size:15px}
.hearts i{font-style:normal;transition:opacity .3s,transform .3s}
.hearts i.gone{opacity:.15;transform:scale(.7)}
.dmove{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.35);min-height:14px;margin-top:6px}
.duelpick{display:flex;gap:8px;width:100%}
.duelpick .ga.on{outline:2px solid var(--em)}
`;

export function renderDuels(app, md) {
  const p = pvpShell(app, md, {
    game: 'duels', title: 'Duels', css: STYLE,
    stage: `<div class="pad" style="position:relative">
      <div class="hpwrap">
        <div class="fighter me"><div class="hearts" id="hpMe"></div><div class="fbody" id="fbMe"></div><div class="handlab" style="margin-top:10px">You</div><div class="dmove" id="mvMe"></div></div>
        <div class="fighter"><div class="hearts" id="hpOpp"></div><div class="fbody" id="fbOpp"></div><div class="handlab" id="duOppN" style="margin-top:10px"></div><div class="dmove" id="mvOpp"></div></div>
      </div>
      <div class="logline" id="duLog">Round 1 · pick your move</div>
      <div class="ghint">Defend blocks Attack · Special breaks Defend · Attack beats Special</div>
    </div>`,
  });
  if (!p) return;
  $('duOppN').textContent = md.opponent || 'Opponent';

  let picked = null, result = null, hpMe = MAX, hpOpp = MAX, over = false;
  const hearts = (id, hp) => { $(id).innerHTML = Array.from({ length: MAX }, (_, i) => `<i class="${i < hp ? '' : 'gone'}">♥</i>`).join(''); };
  const bars = () => { hearts('hpMe', hpMe); hearts('hpOpp', hpOpp); };

  function buttons() {
    const a = p.shell.actions(`<div class="duelpick"><button class="ga ga-red" data-m="attack">Attack</button><button class="ga" data-m="defend">Defend</button><button class="ga ga-gold" data-m="special">Special</button></div>`);
    a.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      if (picked || over) return;
      picked = b.dataset.m; p.move(picked);
      a.querySelectorAll('[data-m]').forEach((x) => { x.disabled = x !== b; x.classList.toggle('on', x === b); });
      $('mvMe').textContent = LABEL[picked]; $('duLog').textContent = 'Locked in · waiting';
    }));
  }
  function hit(who) {
    const el = $(who === 'me' ? 'fbMe' : 'fbOpp'); el.classList.add('hurt'); later(220, () => el.classList.remove('hurt'));
    const d = document.createElement('div'); d.className = 'dmg'; d.textContent = '−1';
    d.style.left = who === 'me' ? '26%' : '70%'; d.style.top = '40%';
    $('gstage').appendChild(d); later(900, () => d.remove());
  }
  function newRound(n, ms) {
    picked = null; $('mvMe').textContent = ''; $('mvOpp').textContent = '';
    $('duLog').textContent = `Round ${n} · pick your move`;
    buttons(); p.timer(ms);
  }

  on(socket, {
    'pvp:opponent_moved': () => { $('mvOpp').textContent = 'Ready'; },
    'pvp:round_result': ({ your_move, opp_move, your_hp, opp_hp, round }) => {
      p.timer(0); p.shell.actions('');
      $('mvMe').textContent = LABEL[your_move]; $('mvOpp').textContent = LABEL[opp_move];
      const lostMe = hpMe - your_hp, lostOpp = hpOpp - opp_hp;
      if (your_move !== 'defend') $('fbMe').classList.add('atkR');
      if (opp_move !== 'defend') $('fbOpp').classList.add('atkL');
      later(220, () => {
        $('fbMe').classList.remove('atkR'); $('fbOpp').classList.remove('atkL');
        hpMe = your_hp; hpOpp = opp_hp;
        if (lostOpp > 0) hit('opp'); if (lostMe > 0) hit('me');
        bars();
        const auto = picked ? '' : ' (auto-defended)';
        if (hpMe <= 0 && hpOpp <= 0) { $('duLog').textContent = 'Double knockout — both back to full'; later(900, () => { hpMe = MAX; hpOpp = MAX; bars(); }); }
        else $('duLog').textContent = (lostOpp && lostMe ? 'You traded blows' : lostOpp ? 'Clean hit' : lostMe ? 'You got hit' : 'Nothing landed') + auto;
        if (hpMe <= 0 !== hpOpp <= 0) { over = true; if (result) end(); return; }
        later(1200, () => newRound(round + 1, 8600)); // server's 10s clock started already (1.5s on a double KO)
      });
    },
    'pvp:result': (r) => { result = r; if (over) end(); },
  });
  const end = () => later(1100, () => p.finish({ won: result.you_won, seed: result.seed, sub: result.you_won ? `${md.opponent} is down` : 'You were knocked out' }));

  bars();
  newRound(1, 10000);
}
