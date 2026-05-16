const { query, getClient } = require('../db');
const { redis } = require('../redis');
const { v4: uuidv4 } = require('uuid');

const router = require('express').Router();

// Wealth brackets from balance.md
function getBracket(cc) {
  if (cc <=   5000) return 1;
  if (cc <=  15000) return 2;
  if (cc <=  40000) return 3;
  if (cc <=  75000) return 4;
  if (cc <= 150000) return 5;
  return 6;
}

function capBet(amount, opponentBalance) {
  return Math.min(Math.floor(amount), Math.floor(opponentBalance * 0.35));
}

// In-memory match state: matchId -> matchData
const matches = new Map();
// userId -> matchId (for reconnect)
const userMatch = new Map();
// userId -> socket
const userSocket = new Map();
// queue: game+bracket -> [{ userId, username, ccBalance, socketId }]
const queues = new Map();

function queueKey(game, bracket) { return `${game}:${bracket}`; }

function registerPvpHandlers(io, socket) {

  if (socket.user) {
    userSocket.set(socket.user.userId, socket);
  }

  // ── JOIN QUEUE ──────────────────────────────────────────────────────────────
  socket.on('pvp:queue:join', async ({ game }) => {
    if (!socket.user) return;
    const { userId, username } = socket.user;

    const userResult = await query('SELECT cc_balance FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) return;
    const ccBalance = Number(userResult.rows[0].cc_balance);
    const bracket   = getBracket(ccBalance);
    const key       = queueKey(game, bracket);

    if (!queues.has(key)) queues.set(key, []);
    const q = queues.get(key);

    // Don't double-add
    if (q.find(p => p.userId === userId)) return;
    q.push({ userId, username, ccBalance, socketId: socket.id });

    socket.emit('pvp:queue:joined', { game, bracket, queue_size: q.length });

    // Try to pair
    if (q.length >= 2) {
      const [p1, p2] = q.splice(0, 2);
      createMatch(io, game, p1, p2);
    }

    // Cross-bracket fallback: if no pair after 15s, try adjacent brackets
    setTimeout(() => tryBroadMatch(io, game, userId, bracket), 15000);
  });

  // ── LEAVE QUEUE ────────────────────────────────────────────────────────────
  socket.on('pvp:queue:leave', () => {
    if (!socket.user) return;
    removeFromAllQueues(socket.user.userId);
    socket.emit('pvp:queue:left', {});
  });

  // ── BETTING PHASE ──────────────────────────────────────────────────────────
  socket.on('pvp:bet:set', ({ match_id, amount }) => {
    if (!socket.user) return;
    const match = matches.get(match_id);
    if (!match || match.phase !== 'betting') return;

    const userId = socket.user.userId;
    const isP1   = match.player1.userId === userId;
    const isP2   = match.player2.userId === userId;
    if (!isP1 && !isP2) return;

    const opponent    = isP1 ? match.player2 : match.player1;
    const capped      = capBet(amount, opponent.ccBalance);
    if (isP1) match.bet1 = capped; else match.bet2 = capped;

    broadcastBettingState(io, match);
  });

  socket.on('pvp:bet:ready', async ({ match_id }) => {
    if (!socket.user) return;
    const match = matches.get(match_id);
    if (!match || match.phase !== 'betting') return;

    const userId = socket.user.userId;
    const isP1   = match.player1.userId === userId;
    const isP2   = match.player2.userId === userId;
    if (!isP1 && !isP2) return;

    const myBet = isP1 ? match.bet1 : match.bet2;
    if (!myBet || myBet < 10) {
      socket.emit('pvp:error', { message: 'Minimum bet is 10 CC' });
      return;
    }

    if (isP1) match.ready1 = true; else match.ready2 = true;
    broadcastBettingState(io, match);

    if (match.ready1 && match.ready2) {
      clearTimeout(match.bettingTimer);
      await lockBets(io, match);
    }
  });

  // ── IN-GAME MOVE ───────────────────────────────────────────────────────────
  socket.on('pvp:move', ({ match_id, move }) => {
    if (!socket.user) return;
    const match = matches.get(match_id);
    if (!match || match.phase !== 'active') return;

    const userId = socket.user.userId;
    const isP1   = match.player1.userId === userId;
    const isP2   = match.player2.userId === userId;
    if (!isP1 && !isP2) return;

    if (isP1) match.move1 = move; else match.move2 = move;

    // Notify opponent that the player has moved (without revealing the move)
    const opponentId = isP1 ? match.player2.userId : match.player1.userId;
    const oppSocket  = userSocket.get(opponentId);
    if (oppSocket) oppSocket.emit('pvp:opponent_moved', { match_id });

    // If both moved, resolve
    if (match.move1 !== null && match.move2 !== null) {
      clearTimeout(match.turnTimer);
      resolveMove(io, match);
    }
  });

  // ── DISCONNECT ─────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (!socket.user) return;
    const { userId } = socket.user;
    userSocket.delete(userId);
    removeFromAllQueues(userId);

    const matchId = userMatch.get(userId);
    if (!matchId) return;
    const match = matches.get(matchId);
    if (!match) return;

    const isP1     = match.player1.userId === userId;
    const winnerId = isP1 ? match.player2.userId : match.player1.userId;

    if (match.phase === 'betting') {
      // Both back to queue
      endMatch(match, null, 'opponent_left_betting');
      const p1s = userSocket.get(match.player1.userId);
      const p2s = userSocket.get(match.player2.userId);
      if (p1s) p1s.emit('pvp:opponent_left', { match_id: matchId, phase: 'betting' });
      if (p2s) p2s.emit('pvp:opponent_left', { match_id: matchId, phase: 'betting' });
    } else if (match.phase === 'active') {
      autoWin(io, match, winnerId);
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMatch(io, game, p1, p2) {
  const matchId = uuidv4();
  const match = {
    matchId, game,
    player1: p1, player2: p2,
    bet1: 0, bet2: 0,
    ready1: false, ready2: false,
    phase: 'betting',
    state: {},   // game-specific state
    move1: null, move2: null,
    bettingTimer: null, turnTimer: null,
  };
  matches.set(matchId, match);
  userMatch.set(p1.userId, matchId);
  userMatch.set(p2.userId, matchId);

  const s1 = userSocket.get(p1.userId);
  const s2 = userSocket.get(p2.userId);

  if (s1) s1.emit('pvp:matched', { match_id: matchId, opponent: { username: p2.username, cc_balance: p2.ccBalance } });
  if (s2) s2.emit('pvp:matched', { match_id: matchId, opponent: { username: p1.username, cc_balance: p1.ccBalance } });

  // 10s betting timer
  match.bettingTimer = setTimeout(() => {
    if (matches.get(matchId)?.phase === 'betting') {
      endMatch(match, null, 'timeout');
      if (s1) s1.emit('pvp:timeout', { match_id: matchId });
      if (s2) s2.emit('pvp:timeout', { match_id: matchId });
    }
  }, 10000);
}

function broadcastBettingState(io, match) {
  const { matchId, player1, player2, bet1, bet2, ready1, ready2 } = match;
  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  if (s1) s1.emit('pvp:bet:update', { match_id: matchId, your_bet: bet1, opp_bet: bet2, opp_ready: ready2 });
  if (s2) s2.emit('pvp:bet:update', { match_id: matchId, your_bet: bet2, opp_bet: bet1, opp_ready: ready1 });
}

async function lockBets(io, match) {
  const { matchId, player1, player2, bet1, bet2, game } = match;
  const pot = bet1 + bet2;
  match.phase = 'deducting';

  // Deduct both bets atomically
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const d1 = await client.query(
      `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
      [bet1, player1.userId]
    );
    if (!d1.rows.length) { await client.query('ROLLBACK'); client.release(); return abortMatch(io, match, 'p1_insufficient'); }
    const d2 = await client.query(
      `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
      [bet2, player2.userId]
    );
    if (!d2.rows.length) {
      await client.query('ROLLBACK'); client.release();
      // Refund p1
      await query(`UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2`, [bet1, player1.userId]);
      return abortMatch(io, match, 'p2_insufficient');
    }
    await client.query('COMMIT');
    client.release();
  } catch (e) {
    await client.query('ROLLBACK'); client.release();
    return abortMatch(io, match, 'error');
  }

  match.phase = 'active';
  match.pot   = pot;

  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);

  // Emit both_ready then start
  if (s1) s1.emit('pvp:both_ready', { match_id: matchId, pot });
  if (s2) s2.emit('pvp:both_ready', { match_id: matchId, pot });

  setTimeout(() => startGame(io, match), 1500);
}

function startGame(io, match) {
  const { matchId, game, player1, player2, bet1, bet2 } = match;
  const { generateSeed } = require('../games/provably-fair');
  const { seed, hash } = generateSeed();
  match.seed = seed; match.hash = hash;
  match.move1 = null; match.move2 = null;

  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);

  // Game-specific init
  if (game === 'coinflip') {
    match.state.p1role = Math.random() < 0.5 ? 'heads' : 'tails';
    match.state.p2role = match.state.p1role === 'heads' ? 'tails' : 'heads';
    if (s1) s1.emit('pvp:start', { match_id: matchId, game, your_role: match.state.p1role, pot: match.pot, hash });
    if (s2) s2.emit('pvp:start', { match_id: matchId, game, your_role: match.state.p2role, pot: match.pot, hash });
    // Auto-resolve coinflip
    setTimeout(() => resolveCoinflip(io, match), 2000);
    return;
  }

  if (game === 'higherlow') {
    const { deriveFloat } = require('../games/provably-fair');
    match.state.n1 = Math.floor(deriveFloat(seed, 1) * 100) + 1;
    match.state.n2 = Math.floor(deriveFloat(seed, 2) * 100) + 1;
    if (s1) s1.emit('pvp:start', { match_id: matchId, game, pot: match.pot, hash });
    if (s2) s2.emit('pvp:start', { match_id: matchId, game, pot: match.pot, hash });
    setTimeout(() => resolveHigherLow(io, match), 3000);
    return;
  }

  if (game === 'rps') {
    match.state.scores   = { [player1.userId]: 0, [player2.userId]: 0 };
    match.state.round    = 1;
  } else if (game === 'duels') {
    match.state.hp       = { [player1.userId]: 3, [player2.userId]: 3 };
    match.state.round    = 1;
  } else if (game === 'uno') {
    initUno(match);
  }

  if (s1) s1.emit('pvp:start', { match_id: matchId, game, pot: match.pot, hash, state: getPlayerState(match, player1.userId) });
  if (s2) s2.emit('pvp:start', { match_id: matchId, game, pot: match.pot, hash, state: getPlayerState(match, player2.userId) });

  startTurnTimer(io, match);
}

function startTurnTimer(io, match) {
  const timeout = match.game === 'rps' ? 5000 : 10000;
  match.turnTimer = setTimeout(() => {
    if (match.phase !== 'active') return;
    // Auto-move for players who haven't moved
    if (match.move1 === null) match.move1 = getAutoMove(match.game);
    if (match.move2 === null) match.move2 = getAutoMove(match.game);
    resolveMove(io, match);
  }, timeout);
}

function getAutoMove(game) {
  if (game === 'rps')   return 'rock';
  if (game === 'duels') return 'defend';
  if (game === 'uno')   return 'draw';
  return null;
}

function resolveMove(io, match) {
  const { game } = match;
  if (game === 'rps')   return resolveRps(io, match);
  if (game === 'duels') return resolveDuels(io, match);
  if (game === 'uno')   return resolveUno(io, match);
}

// ── Coinflip ──────────────────────────────────────────────────────────────────
function resolveCoinflip(io, match) {
  const { matchId, player1, player2, seed } = match;
  const { deriveFloat } = require('../games/provably-fair');
  const flip  = deriveFloat(seed, 1) < 0.5 ? 'heads' : 'tails';
  const winnerId = match.state.p1role === flip ? player1.userId : player2.userId;

  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  if (s1) s1.emit('pvp:round_result', { match_id: matchId, flip, your_role: match.state.p1role });
  if (s2) s2.emit('pvp:round_result', { match_id: matchId, flip, your_role: match.state.p2role });

  setTimeout(() => awardWinner(io, match, winnerId), 1500);
}

// ── Higher or Lower ───────────────────────────────────────────────────────────
function resolveHigherLow(io, match) {
  const { matchId, player1, player2, state } = match;
  let { n1, n2 } = state;

  if (n1 === n2) {
    // Redraw
    const { deriveFloat } = require('../games/provably-fair');
    const salt = Date.now();
    n1 = Math.floor(deriveFloat(match.seed, salt)     * 100) + 1;
    n2 = Math.floor(deriveFloat(match.seed, salt + 1) * 100) + 1;
    match.state.n1 = n1; match.state.n2 = n2;
    const s1 = userSocket.get(player1.userId);
    const s2 = userSocket.get(player2.userId);
    if (s1) s1.emit('pvp:round_result', { match_id: matchId, tie: true });
    if (s2) s2.emit('pvp:round_result', { match_id: matchId, tie: true });
    return setTimeout(() => resolveHigherLow(io, match), 2000);
  }

  const winnerId = n1 > n2 ? player1.userId : player2.userId;
  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  if (s1) s1.emit('pvp:round_result', { match_id: matchId, your_number: n1, opp_number: n2 });
  if (s2) s2.emit('pvp:round_result', { match_id: matchId, your_number: n2, opp_number: n1 });

  setTimeout(() => awardWinner(io, match, winnerId), 1500);
}

// ── RPS ───────────────────────────────────────────────────────────────────────
const RPS_BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

function resolveRps(io, match) {
  const { matchId, player1, player2, move1, move2, state } = match;
  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);

  let roundWinner = null;
  if (move1 === move2) {
    // Tie — replay
    if (s1) s1.emit('pvp:round_result', { match_id: matchId, your_move: move1, opp_move: move2, result: 'tie', scores: state.scores, round: state.round });
    if (s2) s2.emit('pvp:round_result', { match_id: matchId, your_move: move2, opp_move: move1, result: 'tie', scores: state.scores, round: state.round });
  } else {
    roundWinner = RPS_BEATS[move1] === move2 ? player1.userId : player2.userId;
    state.scores[roundWinner]++;
    if (s1) s1.emit('pvp:round_result', { match_id: matchId, your_move: move1, opp_move: move2, result: roundWinner === player1.userId ? 'win' : 'loss', scores: state.scores, round: state.round });
    if (s2) s2.emit('pvp:round_result', { match_id: matchId, your_move: move2, opp_move: move1, result: roundWinner === player2.userId ? 'win' : 'loss', scores: state.scores, round: state.round });
    state.round++;
  }

  // Check match winner (first to 2)
  const p1score = state.scores[player1.userId];
  const p2score = state.scores[player2.userId];
  if (p1score >= 2 || p2score >= 2) {
    const winnerId = p1score >= 2 ? player1.userId : player2.userId;
    return setTimeout(() => awardWinner(io, match, winnerId), 1500);
  }

  // Next round
  match.move1 = null; match.move2 = null;
  startTurnTimer(io, match);
}

// ── Duels ─────────────────────────────────────────────────────────────────────
const DUELS_TABLE = {
  attack:  { attack: [1,1], defend: [0,0], special: [1,0] },
  defend:  { attack: [0,0], defend: [0,0], special: [1,0] },
  special: { attack: [0,1], defend: [0,1], special: [1,1] },
};

function resolveDuels(io, match) {
  const { matchId, player1, player2, move1, move2, state } = match;
  const [dmg1, dmg2] = DUELS_TABLE[move1][move2];
  state.hp[player1.userId] -= dmg1;
  state.hp[player2.userId] -= dmg2;

  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);

  const hp1 = state.hp[player1.userId];
  const hp2 = state.hp[player2.userId];

  if (s1) s1.emit('pvp:round_result', { match_id: matchId, your_move: move1, opp_move: move2, your_hp: hp1, opp_hp: hp2, round: state.round });
  if (s2) s2.emit('pvp:round_result', { match_id: matchId, your_move: move2, opp_move: move1, your_hp: hp2, opp_hp: hp1, round: state.round });
  state.round++;

  // Both dead → reset to 3 HP each (simultaneous kill)
  if (hp1 <= 0 && hp2 <= 0) {
    state.hp[player1.userId] = 3;
    state.hp[player2.userId] = 3;
    match.move1 = null; match.move2 = null;
    setTimeout(() => startTurnTimer(io, match), 1500);
    return;
  }

  if (hp1 <= 0 || hp2 <= 0) {
    const winnerId = hp2 <= 0 ? player1.userId : player2.userId;
    return setTimeout(() => awardWinner(io, match, winnerId), 1500);
  }

  match.move1 = null; match.move2 = null;
  startTurnTimer(io, match);
}

// ── Uno ───────────────────────────────────────────────────────────────────────
function buildUnoDeck() {
  const colors  = ['red','blue','green','yellow'];
  const numbers = ['0','1','2','3','4','5','6','7','8','9'];
  const specials = ['skip','reverse','+2'];
  const deck = [];
  for (const c of colors) {
    for (const n of numbers) deck.push({ color: c, value: n });
    for (const s of specials) { deck.push({ color: c, value: s }); deck.push({ color: c, value: s }); }
  }
  for (let i = 0; i < 4; i++) { deck.push({ color: 'wild', value: 'wild' }); deck.push({ color: 'wild', value: 'wild+4' }); }
  return deck;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function initUno(match) {
  const deck = shuffleArray(buildUnoDeck());
  const { player1, player2 } = match;
  match.state = {
    deck,
    hands: {
      [player1.userId]: deck.splice(0, 5),
      [player2.userId]: deck.splice(0, 5),
    },
    discard: [deck.splice(0, 1)[0]],
    currentColor: null,
    currentPlayer: player1.userId,
    unoFlag: {},   // userId -> true if they called uno
    round: 1,
  };
  match.state.currentColor = match.state.discard[0].color;
}

function canPlay(card, topCard, currentColor) {
  if (card.color === 'wild') return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function getPlayerState(match, userId) {
  if (match.game !== 'uno') return {};
  const { state, player1, player2 } = match;
  const oppId = player1.userId === userId ? player2.userId : player1.userId;
  return {
    hand:          state.hands[userId],
    opp_hand_size: state.hands[oppId]?.length,
    top_card:      state.discard[state.discard.length - 1],
    current_color: state.currentColor,
    your_turn:     state.currentPlayer === userId,
  };
}

function resolveUno(io, match) {
  const { matchId, player1, player2, state, move1, move2 } = match;
  const currId = state.currentPlayer;
  const move   = currId === player1.userId ? move1 : move2;
  const oppId  = currId === player1.userId ? player2.userId : player1.userId;
  const cs     = userSocket.get(currId);
  const os     = userSocket.get(oppId);
  const hand   = state.hands[currId];

  if (move === 'draw' || !move) {
    // Draw a card
    if (state.deck.length === 0) state.deck = shuffleArray(state.discard.splice(0, state.discard.length - 1));
    const drawn = state.deck.splice(0, 1)[0];
    hand.push(drawn);
    if (canPlay(drawn, state.discard[state.discard.length-1], state.currentColor)) {
      // Play it
      applyCard(match, currId, drawn);
    } else {
      state.currentPlayer = oppId;
    }
  } else {
    // move is a card index
    const cardIdx = parseInt(move);
    if (isNaN(cardIdx) || !hand[cardIdx]) { state.currentPlayer = oppId; }
    else {
      const card = hand[cardIdx];
      if (!canPlay(card, state.discard[state.discard.length-1], state.currentColor)) { state.currentPlayer = oppId; }
      else {
        hand.splice(cardIdx, 1);
        state.discard.push(card);
        applyCard(match, currId, card);
      }
    }
  }

  // Check win
  if (state.hands[currId].length === 0) {
    const s1 = userSocket.get(player1.userId);
    const s2 = userSocket.get(player2.userId);
    if (s1) s1.emit('pvp:round_result', { match_id: matchId, state: getPlayerState(match, player1.userId) });
    if (s2) s2.emit('pvp:round_result', { match_id: matchId, state: getPlayerState(match, player2.userId) });
    return setTimeout(() => awardWinner(io, match, currId), 1000);
  }

  // Emit updated state
  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  if (s1) s1.emit('pvp:round_result', { match_id: matchId, state: getPlayerState(match, player1.userId) });
  if (s2) s2.emit('pvp:round_result', { match_id: matchId, state: getPlayerState(match, player2.userId) });

  match.move1 = null; match.move2 = null;
  startTurnTimer(io, match);
}

function applyCard(match, playerId, card) {
  const { state, player1, player2 } = match;
  const oppId = player1.userId === playerId ? player2.userId : player1.userId;
  if (card.color !== 'wild') state.currentColor = card.color;

  if (card.value === 'skip' || card.value === 'reverse') {
    state.currentPlayer = playerId; // stay on same player (2-player reverse = skip)
  } else if (card.value === '+2') {
    // Opponent draws 2
    for (let i = 0; i < 2; i++) {
      if (!state.deck.length) state.deck = shuffleArray(state.discard.splice(0, state.discard.length - 1));
      state.hands[oppId].push(state.deck.splice(0, 1)[0]);
    }
    state.currentPlayer = playerId;
  } else if (card.value === 'wild') {
    state.currentPlayer = oppId;
    // Color chosen client-side via move format "wild:red"
  } else if (card.value === 'wild+4') {
    for (let i = 0; i < 4; i++) {
      if (!state.deck.length) state.deck = shuffleArray(state.discard.splice(0, state.discard.length - 1));
      state.hands[oppId].push(state.deck.splice(0, 1)[0]);
    }
    state.currentPlayer = playerId;
  } else {
    state.currentPlayer = oppId;
  }
}

// ── Award winner ──────────────────────────────────────────────────────────────
async function awardWinner(io, match, winnerId) {
  if (match.phase === 'ended') return;
  match.phase = 'ended';

  const { matchId, player1, player2, pot, seed } = match;
  const loserId = player1.userId === winnerId ? player2.userId : player1.userId;

  try {
    await query(`UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2`, [pot, winnerId]);
  } catch (e) { console.error('[pvp] award winner:', e.message); }

  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  const winnerIsP1 = player1.userId === winnerId;
  if (s1) s1.emit('pvp:result', { match_id: matchId, winner_id: winnerId, pot, seed, you_won: winnerIsP1 });
  if (s2) s2.emit('pvp:result', { match_id: matchId, winner_id: winnerId, pot, seed, you_won: !winnerIsP1 });

  endMatch(match, winnerId, 'completed');
}

async function autoWin(io, match, winnerId) {
  if (match.phase === 'ended') return;
  const { matchId } = match;
  match.phase = 'ended';

  const { player1, player2, pot } = match;
  if (pot) await query(`UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2`, [pot, winnerId]).catch(() => {});

  const ws = userSocket.get(winnerId);
  if (ws) ws.emit('pvp:auto_win', { match_id: matchId, pot: pot || 0, reason: 'opponent_disconnected' });
  endMatch(match, winnerId, 'auto_win');
}

function abortMatch(io, match, reason) {
  const { matchId, player1, player2 } = match;
  const s1 = userSocket.get(player1.userId);
  const s2 = userSocket.get(player2.userId);
  if (s1) s1.emit('pvp:abort', { match_id: matchId, reason });
  if (s2) s2.emit('pvp:abort', { match_id: matchId, reason });
  endMatch(match, null, reason);
}

function endMatch(match, winnerId, reason) {
  clearTimeout(match.bettingTimer);
  clearTimeout(match.turnTimer);
  matches.delete(match.matchId);
  userMatch.delete(match.player1.userId);
  userMatch.delete(match.player2.userId);
}

function removeFromAllQueues(userId) {
  for (const [key, q] of queues.entries()) {
    const idx = q.findIndex(p => p.userId === userId);
    if (idx !== -1) q.splice(idx, 1);
  }
}

function tryBroadMatch(io, game, userId, bracket) {
  // Check if still in queue
  const key = queueKey(game, bracket);
  const q   = queues.get(key) || [];
  if (!q.find(p => p.userId === userId)) return;

  // Try adjacent brackets
  for (const b of [bracket - 1, bracket + 1]) {
    if (b < 1 || b > 6) continue;
    const adjKey = queueKey(game, b);
    const adjQ   = queues.get(adjKey) || [];
    if (adjQ.length > 0) {
      const myIdx = q.findIndex(p => p.userId === userId);
      if (myIdx === -1) return;
      const me   = q.splice(myIdx, 1)[0];
      const them = adjQ.splice(0, 1)[0];
      createMatch(io, game, me, them);
      return;
    }
  }
}

module.exports = registerPvpHandlers;
module.exports.router = router;
module.exports.getBracket = getBracket;
module.exports.capBet = capBet;
