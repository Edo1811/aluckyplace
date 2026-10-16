// Shared frame for the PvP game pages: header, pot/opponent info, result handling,
// and the events every PvP match can end with.
import socket from '../socket.js';
import { $, fmt, esc, toast, later } from '../ui/core.js';
import { gameShell, on, syncBalance } from './shell.js';
import { api as http } from '../api.js';

// PvP bets and pots move on the server without a balance push — pull it.
const refreshBalance = () => http.get('/auth/me').then((r) => syncBalance(r.user?.cc_balance)).catch(() => {});

const STYLE = `
.pvphead{display:flex;align-items:center;justify-content:space-between;padding:10px 16px 0;font-size:12px;color:rgba(255,255,255,.4)}
.pvphead b{color:#fff}
.pvphead .pot{color:var(--gold);font-weight:700}
.pvptimer{height:3px;background:rgba(255,255,255,.06);margin:8px 16px 0;border-radius:2px;overflow:hidden}
.pvptimer i{display:block;height:100%;width:100%;background:var(--em);transform-origin:left}
`;

/**
 * md: match data from matchmaking ({ match_id, opponent, pot, myBet, hash, your_role, state }).
 * Returns null (and goes back to the hub) when there is no live match — e.g. after a refresh.
 */
export function pvpShell(app, md, { game, title, css = '', stage = '' }) {
  if (!md || !md.match_id) { later(0, () => window.__navigate('games')); return null; }
  const shell = gameShell(app, {
    id: `pvp-${game}`, title, css: STYLE + css,
    stage: `<div class="pvphead"><span>vs <b>${esc(md.opponent || 'Opponent')}</b></span><span>Pot <span class="pot">${fmt(md.pot)} CC</span></span></div>
      <div class="pvptimer" id="pvTimer" style="visibility:hidden"><i id="pvTimerBar"></i></div>${stage}`,
  });
  shell.show('scPlay');
  shell.actions('');
  refreshBalance();
  const myBet = Number(md.myBet) || Math.floor(Number(md.pot) / 2);
  let over = false;

  const api = {
    shell,
    md,
    matchId: md.match_id,
    move(move) { if (!over) socket.emit('pvp:move', { match_id: md.match_id, move }); },
    /** Visual countdown bar for the server's turn timer. */
    timer(ms) {
      const t = $('pvTimer'), b = $('pvTimerBar'); if (!t) return;
      if (!ms) { t.style.visibility = 'hidden'; return; }
      t.style.visibility = 'visible';
      b.style.transition = 'none'; b.style.transform = 'scaleX(1)'; void b.offsetWidth;
      b.style.transition = `transform ${ms}ms linear`; b.style.transform = 'scaleX(0)';
    },
    finish({ won, seed, sub }) {
      if (over) return; over = true; api.timer(0);
      refreshBalance();
      shell.result({
        net: won ? Number(md.pot) - myBet : -myBet,
        sub: sub || (won ? 'The pot is yours' : `${md.opponent || 'Opponent'} takes the pot`),
        seed,
        againLabel: 'Find another match', again: () => window.__navigate(`matchmaking-${game}`),
        changeLabel: 'Back to games', change: () => window.__navigate('games'),
      });
    },
    get over() { return over; },
  };

  on(socket, {
    'pvp:auto_win': ({ pot }) => { md.pot = pot || md.pot; api.finish({ won: true, sub: 'Opponent disconnected. The pot is yours.' }); },
    'pvp:opponent_left': () => toast('Opponent left', 'amber'),
    'pvp:abort': () => { toast('Match cancelled', 'amber'); later(1200, () => window.__navigate('games')); },
    'pvp:error': ({ message }) => toast(message || 'Match error', 'red'),
  });
  return api;
}
