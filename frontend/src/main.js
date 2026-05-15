import './socket.js';
import { setUser } from './store.js';
import { renderLanding }    from './pages/landing.js';
import { renderHome }       from './pages/home.js';
import { renderGames }      from './pages/games.js';
import { renderCrash }      from './pages/game-crash.js';
import { renderBlackjack }  from './pages/game-blackjack.js';
import { renderSlots }      from './pages/game-slots.js';
import { renderDice }       from './pages/game-dice.js';
import { renderMines }      from './pages/game-mines.js';
import { renderRoulette }   from './pages/game-roulette.js';
import { renderPlinko }     from './pages/game-plinko.js';

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

// ── Router ────────────────────────────────────────────────────────────────────
export function navigate(page) {
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
    // Phase 6: pvp games
    // Phase 7: social, guild
    // Phase 8: shop
    default: return renderHome(app);
  }
}

window.__navigate = navigate;
