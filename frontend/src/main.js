import './socket.js';
import { setUser } from './store.js';
import { renderLanding }    from './pages/landing.js';
import { renderHome }       from './pages/home.js';
import { renderGames }      from './pages/games.js';
import { renderMatchmaking } from './pages/matchmaking.js';
import { renderCrash }      from './pages/game-crash.js';
import { renderBlackjack }  from './pages/game-blackjack.js';
import { renderSlots }      from './pages/game-slots.js';
import { renderDice }       from './pages/game-dice.js';
import { renderMines }      from './pages/game-mines.js';
import { renderRoulette }   from './pages/game-roulette.js';
import { renderPlinko }     from './pages/game-plinko.js';
import { renderCoinflip }   from './pages/game-coinflip.js';
import { renderRps }        from './pages/game-rps.js';
import { renderHigherLow }  from './pages/game-higherlow.js';
import { renderDuels }      from './pages/game-duels.js';
import { renderUno }        from './pages/game-uno.js';
import { renderShop }       from './pages/shop.js';
import { renderProfile }    from './pages/profile.js';

const app = document.getElementById('app');

// ── Boot ──────────────────────────────────────────────────────────────────────
const token   = localStorage.getItem('token');
const userRaw = localStorage.getItem('user');

if (token && userRaw) {
  try {
    const user = JSON.parse(userRaw);
    setUser(user);
    renderHome(app);
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    renderLanding(app);
  }
} else {
  renderLanding(app);
}

// ── Router ─────────────────────────────────────────────────────────────────────
// matchData is passed from matchmaking → game page
let pendingMatchData = null;

export function navigate(page, data) {
  if (data) pendingMatchData = data;

  // Matchmaking routes — format: 'matchmaking-coinflip'
  if (page.startsWith('matchmaking-')) {
    const game = page.replace('matchmaking-', '');
    return renderMatchmaking(app, game, (matchData) => {
      // Called by matchmaking when pvp:start fires
      navigate('pvp-' + game, matchData);
    });
  }

  // PvP game routes — format: 'pvp-coinflip'
  if (page.startsWith('pvp-')) {
    const game = page.replace('pvp-', '');
    const md   = data || pendingMatchData;
    pendingMatchData = null;
    switch (game) {
      case 'coinflip': return renderCoinflip(app, md);
      case 'rps':      return renderRps(app, md);
      case 'highlow':  return renderHigherLow(app, md);
      case 'duels':    return renderDuels(app, md);
      case 'uno':      return renderUno(app, md);
    }
  }

  switch (page) {
    case 'home':           return renderHome(app);
    case 'landing':        return renderLanding(app);
    case 'games':          return renderGames(app);
    case 'game-crash':     return renderCrash(app);
    case 'game-blackjack': return renderBlackjack(app);
    case 'game-slots':     return renderSlots(app);
    case 'game-dice':      return renderDice(app);
    case 'game-mines':     return renderMines(app);
    case 'game-roulette':  return renderRoulette(app);
    case 'game-plinko':    return renderPlinko(app);
    case 'shop':           return renderShop(app, data);
    case 'profile':        return renderProfile(app);
    default:               return renderHome(app);
  }
}

window.__navigate = navigate;
