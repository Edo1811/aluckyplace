const { generateSeed, deriveFloat, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');
const { recordSoloResult } = require('../progression');

const HOUSE_EDGE = 0.01;

function calcPayout(direction, threshold) {
  const pWin = direction === 'over'
    ? (100 - threshold) / 100
    : (threshold - 1) / 100;
  return { pWin, multiplier: (1 - HOUSE_EDGE) / pWin };
}

async function roll(userId, betAmount, direction, threshold) {
  betAmount  = Math.floor(betAmount);
  threshold  = Math.floor(threshold);
  direction  = direction === 'under' ? 'under' : 'over';

  if (betAmount < 10) throw new Error('Minimum bet is 10 CC');

  // Validate threshold
  if (direction === 'over'  && (threshold < 1  || threshold > 99)) throw new Error('OVER threshold must be 1–99');
  if (direction === 'under' && (threshold < 2  || threshold > 100)) throw new Error('UNDER threshold must be 2–100');

  const { seed, hash } = generateSeed();
  const nonce = await nextNonce(userId);
  const raw   = deriveFloat(seed, nonce);          // [0, 1)
  const roll  = Math.floor(raw * 100) + 1;         // 1–100

  const win = direction === 'over' ? roll > threshold : roll < threshold;
  const { pWin, multiplier } = calcPayout(direction, threshold);
  const payout = win ? Math.floor(betAmount * multiplier) : 0;
  const net    = payout - betAmount;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Deduct bet (guard: balance must cover it)
    const deduct = await client.query(
      `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
      [betAmount, userId]
    );
    if (deduct.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient balance');
    }

    // Credit winnings
    let finalBalance = deduct.rows[0].cc_balance;
    if (payout > 0) {
      const credit = await client.query(
        `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
        [payout, userId]
      );
      finalBalance = credit.rows[0].cc_balance;
    }

    await recordResult(client, {
      userId, game: 'dice', betAmount, payoutAmount: payout, seed, hash, nonce,
      extra: { roll, direction, threshold, multiplier: multiplier.toFixed(4), win },
    });

    await recordSoloResult(client, {
      userId, game: 'dice', betAmount, payoutAmount: payout, ccBalanceAfter: finalBalance,
      extra: { pWin, win },
    });

    await client.query('COMMIT');
    return { roll, win, payout, net, multiplier, seed, hash, nonce, cc_balance: finalBalance };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { roll, calcPayout };
