const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');

const SLOT_MULTIPLIERS = [250, 30, 6, 2, 0.5, 0.3, 0.2, 0.3, 0.5, 2, 6, 30, 250];
const ROWS = 12;

function dropBall(floats) {
  // Each float determines left (< 0.5) or right (>= 0.5) at each peg row
  let pos = 0;
  const path = [];
  for (let i = 0; i < ROWS; i++) {
    const goRight = floats[i] >= 0.5;
    path.push(goRight ? 'R' : 'L');
    if (goRight) pos++;
  }
  return { slot: pos, path };
}

async function drop(userId, betAmount) {
  betAmount = Math.floor(betAmount);
  if (betAmount < 10) throw new Error('Minimum bet is 10 CC');

  const { seed, hash } = generateSeed();
  const nonce  = await nextNonce(userId);
  const floats = deriveFloats(seed, nonce, ROWS);
  const { slot, path } = dropBall(floats);
  const multiplier = SLOT_MULTIPLIERS[slot];
  const payout = Math.floor(betAmount * multiplier);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const deduct = await client.query(
      `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
      [betAmount, userId]
    );
    if (deduct.rows.length === 0) { await client.query('ROLLBACK'); throw new Error('Insufficient balance'); }

    let finalBalance = deduct.rows[0].cc_balance;
    if (payout > 0) {
      const credit = await client.query(
        `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
        [payout, userId]
      );
      finalBalance = credit.rows[0].cc_balance;
    }

    await recordResult(client, {
      userId, game: 'plinko', betAmount, payoutAmount: payout, seed, hash, nonce,
      extra: { slot, multiplier, path },
    });

    await client.query('COMMIT');
    return { slot, path, multiplier, payout, net: payout - betAmount, seed, hash, nonce, cc_balance: finalBalance };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { drop, SLOT_MULTIPLIERS };
