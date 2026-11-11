const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');
const { recordSoloResult } = require('../progression');

// Multiplier tables, one half per board (mirrored around the middle bucket).
// Every board returns ~99% (exact expected value 0.988–0.992, checked with the binomial
// distribution). 12 rows · high is the original single board, unchanged.
const HALF = {
  8:  { low: [5.6, 2.1, 1.1, 1, 0.5],               medium: [13, 3, 1.3, 0.7, 0.4],              high: [29, 4, 1.5, 0.3, 0.2] },
  9:  { low: [5.6, 2, 1.6, 1, 0.7],                 medium: [18, 4, 1.7, 0.9, 0.5],              high: [43, 7, 2, 0.6, 0.2] },
  10: { low: [8.9, 3, 1.4, 1.1, 1, 0.5],            medium: [22, 5, 2, 1.4, 0.6, 0.4],           high: [76, 10, 3, 0.9, 0.3, 0.2] },
  11: { low: [8.4, 3, 1.9, 1.3, 1, 0.7],            medium: [24, 6, 3, 1.8, 0.7, 0.5],           high: [120, 14, 5.2, 1.4, 0.4, 0.2] },
  12: { low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5],        medium: [33, 11, 4, 2, 1.1, 0.6, 0.3],       high: [250, 30, 6, 2, 0.5, 0.3, 0.2] },
  13: { low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7],       medium: [43, 13, 6, 3, 1.3, 0.7, 0.4],       high: [260, 37, 11, 4, 1, 0.2, 0.2] },
  14: { low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5],  medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2],     high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2] },
  15: { low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7],       medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3],   high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2] },
  16: { low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5], medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3], high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2] },
};
const RISKS = ['low', 'medium', 'high'];
const TABLES = {};
for (const rows of Object.keys(HALF)) {
  TABLES[rows] = {};
  for (const risk of RISKS) TABLES[rows][risk] = Array.from({ length: Number(rows) + 1 }, (_, i) => HALF[rows][risk][Math.min(i, Number(rows) - i)]);
}
const SLOT_MULTIPLIERS = TABLES[12].high; // kept for anything still importing it

function dropBall(floats, rows) {
  // Each float determines left (< 0.5) or right (>= 0.5) at each peg row
  let pos = 0;
  const path = [];
  for (let i = 0; i < rows; i++) {
    const goRight = floats[i] >= 0.5;
    path.push(goRight ? 'R' : 'L');
    if (goRight) pos++;
  }
  return { slot: pos, path };
}

async function drop(userId, betAmount, rows = 12, risk = 'high') {
  betAmount = Math.floor(Number(betAmount));
  if (!Number.isSafeInteger(betAmount) || betAmount < 10) throw new Error('Minimum bet is 10 CC');
  rows = Number(rows);
  if (!TABLES[rows] || !RISKS.includes(risk)) throw new Error('Invalid board');

  const { seed, hash } = generateSeed();
  const nonce  = await nextNonce(userId);
  const floats = deriveFloats(seed, nonce, rows);
  const { slot, path } = dropBall(floats, rows);
  const multiplier = TABLES[rows][risk][slot];
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
      extra: { slot, multiplier, path, rows, risk },
    });

    await recordSoloResult(client, {
      userId, game: 'plinko', betAmount, payoutAmount: payout, ccBalanceAfter: finalBalance,
    });

    await client.query('COMMIT');
    return { slot, path, multiplier, rows, risk, payout, net: payout - betAmount, seed, hash, nonce, cc_balance: finalBalance };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { drop, SLOT_MULTIPLIERS, TABLES };
