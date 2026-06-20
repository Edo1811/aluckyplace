const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient, query } = require('../db');
const { recordSoloResult } = require('../progression');

const GRID_SIZE = 25;
const BOMB_COUNT = 5;

const MULTIPLIERS = [
  0, 1.24, 1.56, 2.00, 2.58, 3.39,
  4.53, 6.14, 8.51, 12.0, 17.5,
  26.3, 40.9, 66.4, 113.9, 208.9,
  417.7, 940, 2506, 8769, 52602,
];

// Active games: userId -> gameState
const activeGames = new Map();

function placeBombs(floats) {
  const positions = new Set();
  const shuffled = Array.from({ length: GRID_SIZE }, (_, i) => i)
    .sort((a, b) => floats[a % floats.length] - floats[b % floats.length]);
  for (let i = 0; i < BOMB_COUNT; i++) positions.add(shuffled[i]);
  return positions;
}

function registerMinesHandlers(io, socket) {

  socket.on('mines:start', async ({ bet }) => {
    if (!socket.user) return;
    const userId = socket.user.userId;
    bet = Math.floor(Number(bet));
    if (!Number.isFinite(bet) || bet < 10) return socket.emit('mines:error', { message: 'Minimum bet is 10 CC' });
    if (activeGames.has(userId)) return socket.emit('mines:error', { message: 'Game already in progress' });

    try {
      const deduct = await query(
        `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
        [bet, userId]
      );
      if (deduct.rows.length === 0) return socket.emit('mines:error', { message: 'Insufficient balance' });

      const { seed, hash } = generateSeed();
      const nonce  = await nextNonce(userId);
      const floats = deriveFloats(seed, nonce, GRID_SIZE);
      const bombs  = placeBombs(floats);

      activeGames.set(userId, {
        userId, bet, seed, hash, nonce, bombs,
        picks: 0, revealed: new Set(), phase: 'active',
        cc_balance: deduct.rows[0].cc_balance,
      });

      socket.emit('mines:board', {
        game_id:     userId,
        hash,
        cc_balance:  deduct.rows[0].cc_balance,
        multiplier:  MULTIPLIERS[0],
        potential:   0,
      });

    } catch (e) { console.error('[mines:start]', e.message); socket.emit('mines:error', { message: 'Server error' }); }
  });

  socket.on('mines:pick', async ({ tile_index }) => {
    if (!socket.user) return;
    const userId = socket.user.userId;
    const game   = activeGames.get(userId);
    if (!game || game.phase !== 'active') return;

    tile_index = Number(tile_index);
    if (tile_index < 0 || tile_index >= GRID_SIZE) return;
    if (game.revealed.has(tile_index)) return;

    game.revealed.add(tile_index);

    if (game.bombs.has(tile_index)) {
      // BOOM
      game.phase = 'ended';
      activeGames.delete(userId);

      let client;
      try {
        client = await getClient();
        await client.query('BEGIN');
        await recordResult(client, {
          userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: 0,
          seed: game.seed, hash: game.hash, nonce: game.nonce,
          extra: { picks: game.picks, hit_tile: tile_index, bomb_positions: [...game.bombs] },
        });
        await recordSoloResult(client, {
          userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: 0,
          ccBalanceAfter: game.cc_balance,
          extra: { picks: game.picks },
        });
        await client.query('COMMIT');
      } catch (e) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('[mines:pick bomb]', e.message);
      } finally {
        if (client) client.release();
      }

      // The bomb result and bet are already final (bet was taken in
      // mines:start) — tell the player regardless of whether the history
      // write above succeeded, so the UI never just hangs waiting.
      socket.emit('mines:bomb', {
        tile_index,
        bomb_positions: [...game.bombs],
        seed: game.seed,
        cc_balance: game.cc_balance,
      });

    } else {
      game.picks++;
      const multiplier     = MULTIPLIERS[game.picks];
      const potentialPayout = Math.floor(game.bet * multiplier);

      // Auto-cashout at full clear
      if (game.picks === GRID_SIZE - BOMB_COUNT) {
        game.phase = 'ended';
        activeGames.delete(userId);
        let client;
        try {
          client = await getClient();
          await client.query('BEGIN');
          const credit = await client.query(
            `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
            [potentialPayout, game.userId]
          );
          await recordResult(client, {
            userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: potentialPayout,
            seed: game.seed, hash: game.hash, nonce: game.nonce,
            extra: { picks: game.picks, bomb_positions: [...game.bombs], full_clear: true },
          });
          await recordSoloResult(client, {
            userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: potentialPayout,
            ccBalanceAfter: credit.rows[0].cc_balance,
            extra: { picks: game.picks, full_clear: true },
          });
          await client.query('COMMIT');

          socket.emit('mines:safe', { tile_index, multiplier, potential_payout: potentialPayout });
          socket.emit('mines:cashout:confirm', {
            payout: potentialPayout, picks: game.picks,
            seed: game.seed, bomb_positions: [...game.bombs],
            cc_balance: credit.rows[0].cc_balance,
          });
        } catch (e) {
          if (client) await client.query('ROLLBACK').catch(() => {});
          console.error('[mines:pick full-clear]', e.message);
          socket.emit('mines:error', { message: 'Server error while crediting your payout — check your balance and contact support if it looks wrong' });
        } finally {
          if (client) client.release();
        }
        return;
      }

      socket.emit('mines:safe', { tile_index, multiplier, potential_payout: potentialPayout });
    }
  });

  socket.on('mines:cashout', async () => {
    if (!socket.user) return;
    const userId = socket.user.userId;
    const game   = activeGames.get(userId);
    if (!game || game.phase !== 'active' || game.picks === 0) return;

    game.phase = 'ended';
    activeGames.delete(userId);

    const multiplier = MULTIPLIERS[game.picks];
    const payout     = Math.floor(game.bet * multiplier);

    let client;
    try {
      client = await getClient();
      await client.query('BEGIN');
      const credit = await client.query(
        `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
        [payout, game.userId]
      );
      await recordResult(client, {
        userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: payout,
        seed: game.seed, hash: game.hash, nonce: game.nonce,
        extra: { picks: game.picks, bomb_positions: [...game.bombs], cashed_out: true },
      });
      await recordSoloResult(client, {
        userId: game.userId, game: 'mines', betAmount: game.bet, payoutAmount: payout,
        ccBalanceAfter: credit.rows[0].cc_balance,
        extra: { picks: game.picks },
      });
      await client.query('COMMIT');

      socket.emit('mines:cashout:confirm', {
        payout, picks: game.picks,
        seed: game.seed, bomb_positions: [...game.bombs],
        cc_balance: credit.rows[0].cc_balance,
      });

    } catch (e) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.error('[mines:cashout]', e.message);
      socket.emit('mines:error', { message: 'Server error during cashout — check your balance and contact support if it looks wrong' });
    } finally {
      if (client) client.release();
    }
  });
}

module.exports = registerMinesHandlers;
