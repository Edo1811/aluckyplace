import socket from '../socket.js';
import { $, later } from '../ui/core.js';
import { on } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';

// Both players get a hidden number 1–100; higher wins. The server resolves ~3s after start
// (ties redraw). The player swipes their own card up to turn it, then the opponent's turns.
const STYLE = `
.hlrow{display:flex;justify-content:center;gap:28px;align-items:flex-end}
.hlcol{display:flex;flex-direction:column;align-items:center;gap:10px}
.hlcard{width:92px;height:132px;border-radius:12px;position:relative;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.2,1,.3,1);touch-action:none;cursor:grab}
.hlcard .f,.hlcard .b{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;display:flex;align-items:center;justify-content:center}
.hlcard .b{background:#0e1a16;border:1px solid rgba(16,185,129,.4);background-image:repeating-linear-gradient(135deg,rgba(16,185,129,.14) 0 6px,transparent 6px 12px)}
.hlcard .f{background:#faf8f2;color:#141414;font-size:44px;font-weight:700;transform:rotateY(180deg);box-shadow:0 10px 26px rgba(0,0,0,.5)}
.hlcard.up{transform:rotateY(180deg)}
.hlcard.win .f{box-shadow:0 0 0 3px var(--em),0 10px 26px rgba(0,0,0,.5)}
.hlcard.lose .f{opacity:.55}
@media(min-width:900px){.hlcard{width:120px;height:172px}.hlcard .f{font-size:56px}}
`;

export function renderHigherLow(app, md) {
  const p = pvpShell(app, md, {
    game: 'highlow', title: 'Higher or Lower', css: STYLE,
    stage: `<div class="pad">
      <div class="hlrow">
        <div class="hlcol"><div class="hlcard" id="hlMe"><div class="b"></div><div class="f" id="hlMeN"></div></div><div class="handlab">You</div></div>
        <div class="hlcol"><div class="hlcard" id="hlOpp"><div class="b"></div><div class="f" id="hlOppN"></div></div><div class="handlab" id="hlOppL"></div></div>
      </div>
      <div class="logline" id="hlLog">Higher number takes the pot</div>
      <div class="ghint" id="hlHint">Swipe your card up to turn it</div>
    </div>`,
  });
  if (!p) return;
  $('hlOppL').textContent = md.opponent || 'Opponent';

  let nums = null, swiped = false, shown = false, result = null, autoT = 0;
  const card = $('hlMe');

  function reveal() {
    if (shown || !nums || !swiped) return;
    shown = true;
    $('hlMeN').textContent = nums.your_number; card.classList.add('up');
    $('hlHint').textContent = '';
    later(900, () => {
      $('hlOppN').textContent = nums.opp_number; $('hlOpp').classList.add('up');
      const won = nums.your_number > nums.opp_number;
      later(600, () => {
        card.classList.add(won ? 'win' : 'lose'); $('hlOpp').classList.add(won ? 'lose' : 'win');
        $('hlLog').textContent = `${nums.your_number} vs ${nums.opp_number}`;
        $('hlLog').style.color = won ? 'var(--em)' : '#f87171';
        if (result) done();
      });
    });
  }
  const done = () => later(1000, () => p.finish({ won: result.you_won, seed: result.seed, sub: `${nums.your_number} vs ${nums.opp_number}` }));

  // swipe gesture
  let down = false, y0 = 0, dy = 0;
  card.addEventListener('pointerdown', (e) => { if (swiped) return; down = true; y0 = e.clientY; dy = 0; card.style.transition = 'none'; try { card.setPointerCapture(e.pointerId); } catch { /* */ } });
  card.addEventListener('pointermove', (e) => { if (!down) return; dy = Math.min(0, e.clientY - y0); card.style.transform = `translateY(${dy * 0.6}px) rotate(${dy * -0.03}deg)`; });
  const up = () => {
    if (!down) return; down = false;
    card.style.transition = ''; card.style.transform = '';
    if (dy < -50) { swiped = true; clearTimeout(autoT); $('hlHint').textContent = nums ? '' : 'Waiting for the deal…'; reveal(); }
  };
  card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);

  on(socket, {
    'pvp:round_result': (r) => {
      if (r.tie) {
        $('hlLog').textContent = 'Same number — redrawing'; nums = null;
        return;
      }
      nums = r;
      if (swiped) reveal();
      else autoT = later(4000, () => { if (!swiped) { swiped = true; $('hlHint').textContent = 'Turned for you'; reveal(); } });
    },
    'pvp:result': (r) => { result = r; if (shown && card.classList.contains('win') !== card.classList.contains('lose')) done(); },
  });
}
