import socket from '../socket.js';
import { $, later } from '../ui/core.js';
import { on } from '../games/shell.js';
import { pvpShell } from '../games/pvp.js';

// Server state: { hand, opp_hand_size, top_card, current_color, your_turn }.
// Moves: card index, 'index:color' for wilds, or 'draw'. 10s per turn — no move means draw.
const CLS = { red: 'r', blue: 'b', green: 'g', yellow: 'y', wild: 'k' };
const SHOW = { skip: '⊘', reverse: '⇄', '+2': '+2', wild: 'W', 'wild+4': '+4' };
const STYLE = `
.ucard.k{background:conic-gradient(#c0392b 0 25%,#2563eb 0 50%,#0f9c6c 0 75%,#c9a227 0)}
.ucard.k span i{color:#141414}
.ucolor{display:flex;align-items:center;justify-content:center;gap:8px;font-size:11px;color:rgba(255,255,255,.4);letter-spacing:.12em;text-transform:uppercase}
.ucolor i{width:12px;height:12px;border-radius:50%;display:inline-block}
.uturn{text-align:center;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.3)}
.uturn.me{color:var(--em)}
.wildpick{position:absolute;inset:0;background:rgba(5,5,5,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;z-index:6}
.wildpick div{display:grid;grid-template-columns:repeat(2,72px);gap:10px}
.wildpick button{height:72px;border-radius:14px;border:none;cursor:pointer}
`;
const COLORS = { red: '#c0392b', blue: '#2563eb', green: '#0f9c6c', yellow: '#c9a227' };

const cardHTML = (c, i, cls = '') => `<button class="ucard ${CLS[c.color] || 'k'}${cls}" ${i !== null ? `data-i="${i}"` : ''}><span><i>${SHOW[c.value] || c.value}</i></span></button>`;

export function renderUno(app, md) {
  const p = pvpShell(app, md, {
    game: 'uno', title: 'Uno', css: STYLE,
    stage: `<div class="pad" style="position:relative">
      <div class="uopp"><span id="unOppN"></span> · <span id="unOppC">0</span> cards</div>
      <div class="ubacks" id="unBacks"></div>
      <div class="upile"><div id="unPile"></div></div>
      <div class="ucolor" id="unColor"></div>
      <div class="uturn" id="unTurn"></div>
      <div class="logline" id="unLog">Match the colour or the number</div>
      <div class="ghint">Drag a card up onto the pile to play it</div>
      <div class="uhand" id="unHand"></div>
    </div>`,
  });
  if (!p) return;
  $('unOppN').textContent = md.opponent || 'Opponent';

  let st = md.state || {}, lock = false, result = null, ended = false, prevOpp = st.opp_hand_size;

  const playable = (c) => c.color === 'wild' || c.color === st.current_color || c.value === st.top_card?.value;

  function render() {
    $('unPile').innerHTML = st.top_card ? cardHTML(st.top_card, null, ' big') : '';
    $('unOppC').textContent = st.opp_hand_size ?? 0;
    $('unBacks').innerHTML = '<div class="ub"></div>'.repeat(Math.min(st.opp_hand_size || 0, 12));
    $('unColor').innerHTML = st.current_color ? `<i style="background:${COLORS[st.current_color]}"></i>${st.current_color}` : '';
    const mine = st.your_turn && !ended;
    $('unTurn').textContent = ended ? '' : mine ? 'Your turn' : `${md.opponent}'s turn`;
    $('unTurn').className = `uturn${mine ? ' me' : ''}`;
    $('unHand').innerHTML = (st.hand || []).map((c, i) => cardHTML(c, i, mine && playable(c) ? '' : ' dead')).join('');
    $('unHand').querySelectorAll('[data-i]').forEach(bindDrag);
    const a = p.shell.actions(mine ? '<button class="ga" id="unDraw">Draw a card</button>' : '');
    if (mine) a.querySelector('#unDraw').onclick = () => send('draw');
    p.timer(mine ? 10000 : 0);
    lock = !mine;
  }
  function bindDrag(b) {
    const i = Number(b.dataset.i);
    let down = false, x0 = 0, y0 = 0, dx = 0, dy = 0;
    b.style.touchAction = 'none';
    b.addEventListener('pointerdown', (e) => {
      if (lock || b.classList.contains('dead')) return;
      down = true; x0 = e.clientX; y0 = e.clientY; dx = dy = 0;
      b.style.transition = 'none'; b.classList.add('udrag');
      try { b.setPointerCapture(e.pointerId); } catch { /* */ }
    });
    b.addEventListener('pointermove', (e) => { if (!down) return; dx = e.clientX - x0; dy = e.clientY - y0; b.style.transform = `translate(${dx}px,${dy}px) scale(1.06)`; });
    const up = () => {
      if (!down) return; down = false;
      b.style.transition = 'transform .2s'; b.style.transform = ''; b.classList.remove('udrag');
      if (dy < -60 || Math.hypot(dx, dy) < 9) play(i);
    };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  }
  function play(i) {
    const c = st.hand[i]; if (!c || lock || !playable(c)) return;
    if (c.color !== 'wild') return send(String(i));
    const pick = document.createElement('div'); pick.className = 'wildpick';
    pick.innerHTML = `<div class="logline">Pick a colour</div><div>${Object.entries(COLORS).map(([k, v]) => `<button data-c="${k}" style="background:${v}" aria-label="${k}"></button>`).join('')}</div>`;
    $('gstage').appendChild(pick);
    pick.querySelectorAll('[data-c]').forEach((x) => x.addEventListener('click', () => { pick.remove(); send(`${i}:${x.dataset.c}`); }));
  }
  function send(move) {
    if (lock) return;
    lock = true; p.timer(0);
    $('unHand').querySelectorAll('.ucard').forEach((x) => x.classList.add('dead'));
    const d = $('unDraw'); if (d) d.disabled = true;
    $('unLog').textContent = move === 'draw' ? 'Drawing…' : 'Played';
    p.move(move);
  }

  on(socket, {
    'pvp:round_result': ({ state }) => {
      if (!state) return;
      const wasMine = st.your_turn;
      const oppDelta = (state.opp_hand_size ?? 0) - (prevOpp ?? 0);
      if (!wasMine) $('unLog').textContent = oppDelta < 0 ? `${md.opponent} played ${SHOW[state.top_card.value] || state.top_card.value}` : `${md.opponent} drew`;
      else if (state.top_card && state.hand.length < (st.hand || []).length) $('unLog').textContent = 'Played';
      else $('unLog').textContent = 'You drew a card';
      if (wasMine && state.your_turn && !ended) $('unLog').textContent += ' · go again';
      prevOpp = state.opp_hand_size; st = state;
      if (!state.hand.length || !state.opp_hand_size) ended = true;
      render();
    },
    'pvp:result': (r) => {
      result = r; ended = true; render();
      later(1200, () => p.finish({ won: result.you_won, seed: result.seed, sub: result.you_won ? 'Emptied your hand first' : `${md.opponent} went out first` }));
    },
  });

  render();
}
