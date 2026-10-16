import socket from '../socket.js';
import { $, fmt, toast, later } from '../ui/core.js';
import { gameShell, on, syncBalance } from '../games/shell.js';
import { cardHTML } from '../games/draw.js';

const STYLE = `
.bjhands{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.bjhand{display:flex;flex-direction:column;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;border:1px solid transparent;transition:border-color .2s}
.bjhand.on{border-color:rgba(16,185,129,.35);background:rgba(16,185,129,.04)}
.bjhand .cardrow{min-height:90px}
.bjout{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.35)}
.bjout.win{color:var(--em)}.bjout.lose{color:#f87171}
.bjstake{text-align:center;font-size:11px;color:rgba(255,255,255,.3)}
`;

function total(hand) {
  let v = 0, a = 0;
  hand.forEach((c) => {
    if (c.rank === '?') return;
    if (c.rank === 'A') { a++; v += 11; } else v += ['J', 'Q', 'K'].includes(c.rank) ? 10 : Number(c.rank) || 0;
  });
  while (v > 21 && a) { v -= 10; a--; }
  return v;
}

export function renderBlackjack(app) {
  const shell = gameShell(app, {
    id: 'blackjack', title: 'Blackjack', css: STYLE,
    stage: `<div class="pad">
      <div class="handlab">Dealer<b id="bjdv"></b></div><div class="cardrow" id="bjd"></div>
      <div class="handlab">You</div><div class="bjhands" id="bjp"></div>
      <div class="bjstake" id="bjStake"></div>
    </div>`,
  });

  let bet = 0, staked = 0, busy = false, live = false;

  function paint({ player_hands, active_hand, dealer_hand, results }) {
    $('bjd').innerHTML = dealer_hand.map(cardHTML).join('');
    const hidden = dealer_hand.some((c) => c.rank === '?');
    $('bjdv').textContent = hidden ? total(dealer_hand) + ' + ?' : total(dealer_hand);
    $('bjp').innerHTML = player_hands.map((h, i) => {
      const r = results && results[i];
      const cards = r ? r.hand : h;
      const out = r ? `<div class="bjout ${['win', 'blackjack'].includes(r.outcome) ? 'win' : ['bust', 'loss'].includes(r.outcome) ? 'lose' : ''}">${r.outcome}</div>` : '';
      return `<div class="bjhand${!r && player_hands.length > 1 && i === active_hand ? ' on' : ''}">
        <div class="cardrow">${cards.map(cardHTML).join('')}</div>
        <div class="handlab"><b>${r ? r.total : total(cards)}</b></div>${out}</div>`;
    }).join('');
    $('bjStake').textContent = staked ? `${fmt(staked)} CC on the table` : '';
  }

  function controls(st) {
    shell.actions(`<button class="ga" data-a="hit">Hit</button><button class="ga ga-em" data-a="stand">Stand</button>
      ${st.can_double ? '<button class="ga ga-gold" data-a="double">Double</button>' : ''}${st.can_split ? '<button class="ga" data-a="split">Split</button>' : ''}`)
      .querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => act(b.dataset.a)));
  }
  function act(a) {
    if (!live || busy) return;
    busy = true;
    document.querySelectorAll('#gactions .ga').forEach((b) => { b.disabled = true; });
    if (a === 'double' || a === 'split') staked += bet;
    socket.emit('blackjack:action', { action: a });
  }

  function deal(b) {
    bet = b; staked = b; busy = true; live = false;
    $('bjd').innerHTML = ''; $('bjp').innerHTML = ''; $('bjdv').textContent = '';
    shell.actions('<button class="ga" disabled>Dealing…</button>');
    shell.show('scPlay');
    socket.emit('blackjack:deal', { bet: b });
  }
  const again = () => deal(bet);
  const change = () => shell.bet({ onPlace: deal });

  on(socket, {
    'blackjack:resume': ({ bet: b, split_count }) => { bet = Number(b); staked = bet * (1 + (Number(split_count) || 0)); toast('Back to your unfinished hand', 'amber'); },
    'blackjack:state': (st) => {
      busy = false; live = true;
      syncBalance(st.cc_balance);
      paint(st); controls(st); shell.show('scPlay');
    },
    'blackjack:result': (r) => {
      busy = false; live = false;
      syncBalance(r.cc_balance);
      paint({ player_hands: r.player_hands.map((h) => h.hand), dealer_hand: r.dealer_hand, results: r.player_hands });
      $('bjdv').textContent = r.dealer_total;
      shell.actions('');
      const net = Number(r.total_payout) - staked;
      const top = r.player_hands[0] || {};
      const sub = r.player_hands.length > 1
        ? r.player_hands.map((h) => `${h.total} ${h.outcome}`).join(' · ') + ` vs ${r.dealer_total}`
        : top.outcome === 'blackjack' ? 'Blackjack! Pays 3:2'
          : top.outcome === 'bust' ? `Bust with ${top.total}`
            : r.dealer_total > 21 ? `Dealer busted with ${r.dealer_total}`
              : top.outcome === 'push' ? `Push on ${top.total}`
                : `${top.total} vs dealer ${r.dealer_total}`;
      later(1300, () => shell.result({ net, sub, seed: r.seed, again, change }));
    },
    'blackjack:error': ({ message }) => {
      toast(message || 'Blackjack error', 'red');
      if (/double|split/i.test(message || '')) staked -= bet;
      busy = false;
      if (!live) change(); else document.querySelectorAll('#gactions .ga').forEach((b) => { b.disabled = false; });
    },
  });

  change();
}
