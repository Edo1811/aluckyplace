const { generateSeed, deriveFloat, recordResult } = require('./provably-fair');
const { query, getClient } = require('../db');
const { recordSoloResult } = require('../progression');

// crash_point = max(1.00, 0.99 / (1 - h))
function calcCrashPoint(h) {
  if (h >= 0.99) return 1.00;
  return Math.max(1.00, 0.99 / (1 - h));
}

let gameState = {
  phase: 'betting',   // 'betting' | 'active' | 'crashed'
  roundId: null,
  seed: null,
  hash: null,
  crashPoint: null,
  startedAt: null,
  bets: {},           // userId -> { amount, username, cashedOut, cashoutMultiplier }
  chat: [],
};

let gameInterval = null;
let io_ref = null;

function currentMultiplier() {
  if (!gameState.startedAt) return 1.00;
  const elapsed = (Date.now() - gameState.startedAt) / 1000;
  return Math.max(1.00, Math.exp(elapsed * 0.35)); // growth rate
}

function startBettingPhase() {
  const { seed, hash } = generateSeed();
  const h = deriveFloat(seed, 0); // nonce 0 for crash (shared game)
  const crashPoint = calcCrashPoint(h);

  gameState = {
    phase: 'betting',
    roundId: require('crypto').randomUUID(),
    seed, hash, crashPoint,
    startedAt: null,
    bets: {},
    chat: [],
  };

  if (io_ref) {
    io_ref.to('crash').emit('crash:betting_open', {
      round_id: gameState.roundId,
      hash: gameState.hash,
    });
  }

  setTimeout(startActivePhase, 6000);
}

function startActivePhase() {
  if (gameState.phase !== 'betting') return;
  gameState.phase    = 'active';
  gameState.startedAt = Date.now();

  if (io_ref) io_ref.to('crash').emit('crash:start', {
    round_id: gameState.roundId,
    started_at: gameState.startedAt,
  });

  gameInterval = setInterval(() => {
    const mult = currentMultiplier();
    if (io_ref) io_ref.to('crash').emit('crash:tick', { multiplier: parseFloat(mult.toFixed(2)) });

    if (mult >= gameState.crashPoint) {
      clearInterval(gameInterval);
      endRound();
    }
  }, 100);
}

async function endRound() {
  gameState.phase = 'crashed';
  const crashedAt = parseFloat(gameState.crashPoint.toFixed(2));

  if (io_ref) io_ref.to('crash').emit('crash:crash', {
    round_id:    gameState.roundId,
    crash_point: crashedAt,
    seed:        gameState.seed,
  });

  // Settle bets — forfeit uncashed
  const bets = Object.entries(gameState.bets);
  for (const [userId, bet] of bets) {
    if (!bet.cashedOut) {
      // Loss — already deducted, nothing to do
      // Record result
      let client;
      try {
        client = await getClient();
        await client.query('BEGIN');
        await recordResult(client, {
          userId, game: 'crash', betAmount: bet.amount, payoutAmount: 0,
          seed: gameState.seed, hash: gameState.hash, nonce: 0,
          extra: { crash_point: crashedAt, cashed_out: false },
        });
        const balRes = await client.query(`SELECT cc_balance FROM users WHERE id = $1`, [userId]);
        await recordSoloResult(client, {
          userId, game: 'crash', betAmount: bet.amount, payoutAmount: 0,
          ccBalanceAfter: balRes.rows[0]?.cc_balance ?? 0,
        });
        await client.query('COMMIT');
      } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[crash] record loss:', e.message);
      } finally {
        if (client) client.release();
      }
    }
  }

  setTimeout(startBettingPhase, 2000);
}

function registerCrashHandlers(io, socket) {
  if (!io_ref) {
    io_ref = io;
    startBettingPhase();
  }

  socket.join('crash');

  // Send current state to new joiner
  socket.emit('crash:state', {
    phase:      gameState.phase,
    round_id:   gameState.roundId,
    hash:       gameState.hash,
    started_at: gameState.startedAt,
    multiplier: gameState.phase === 'active' ? parseFloat(currentMultiplier().toFixed(2)) : 1,
  });

  socket.on('crash:bet', async ({ round_id, amount }) => {
    if (!socket.user) return;
    if (gameState.phase !== 'betting') return socket.emit('crash:error', { message: 'Betting window closed' });
    if (round_id !== gameState.roundId) return;

    const userId   = socket.user.userId;
    const username = socket.user.username;
    const bet      = Math.floor(Number(amount));
    if (!Number.isFinite(bet) || bet < 10) return socket.emit('crash:error', { message: 'Minimum bet is 10 CC' });
    if (gameState.bets[userId]) return socket.emit('crash:error', { message: 'Already bet this round' });

    try {
      const result = await query(
        `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
        [bet, userId]
      );
      if (result.rows.length === 0) return socket.emit('crash:error', { message: 'Insufficient balance' });

      gameState.bets[userId] = { amount: bet, username, cashedOut: false, cashoutMultiplier: null };
      socket.emit('crash:bet:confirm', { round_id, amount: bet, cc_balance: result.rows[0].cc_balance });
    } catch (e) { socket.emit('crash:error', { message: 'Server error' }); }
  });

  socket.on('crash:cashout', async ({ round_id }) => {
    if (!socket.user) return;
    if (gameState.phase !== 'active') return;
    if (round_id !== gameState.roundId) return;

    const userId = socket.user.userId;
    const bet    = gameState.bets[userId];
    if (!bet || bet.cashedOut) return;

    const mult   = currentMultiplier();
    const payout = Math.floor(bet.amount * mult);
    bet.cashedOut = true;
    bet.cashoutMultiplier = mult;

    try {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        const credit = await client.query(
          `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
          [payout, userId]
        );
        await recordResult(client, {
          userId, game: 'crash', betAmount: bet.amount, payoutAmount: payout,
          seed: gameState.seed, hash: gameState.hash, nonce: 0,
          extra: { cashout_multiplier: parseFloat(mult.toFixed(2)), crash_point: gameState.crashPoint, cashed_out: true },
        });
        await recordSoloResult(client, {
          userId, game: 'crash', betAmount: bet.amount, payoutAmount: payout,
          ccBalanceAfter: credit.rows[0].cc_balance,
          extra: { cashout_multiplier: parseFloat(mult.toFixed(2)) },
        });
        await client.query('COMMIT');

        socket.emit('crash:cashout:confirm', { round_id, multiplier: parseFloat(mult.toFixed(2)), payout, cc_balance: credit.rows[0].cc_balance });
        io.to('crash').emit('crash:cashout:broadcast', { username: bet.username, multiplier: parseFloat(mult.toFixed(2)), payout });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    } catch (e) { console.error('[crash] cashout error:', e.message); }
  });

  socket.on('crash:chat', ({ text }) => {
    if (!socket.user || !text) return;
    const msg = { username: socket.user.username, text: String(text).slice(0, 200), ts: Date.now() };
    gameState.chat.push(msg);
    io.to('crash').emit('crash:chat:message', msg);
  });
}

module.exports = registerCrashHandlers;
