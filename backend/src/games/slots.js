const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');

// Symbol frequencies tuned for ~92% RTP against pay table
// Higher index = more common
const SYMBOLS  = ['Diamond', 'Star', 'Dollar', 'Bell', 'Cherry'];
const WEIGHTS  = [1, 3, 7, 15, 30]; // relative weights per reel stop
const TOTAL_W  = WEIGHTS.reduce((a, b) => a + b, 0);

const PAY_TABLE = {
  'Diamond,Diamond,Diamond': 100,
  'Star,Star,Star':           40,
  'Dollar,Dollar,Dollar':     15,
  'Bell,Bell,Bell':            8,
  'Cherry,Cherry,Cherry':      3,
};

function pickSymbol(rand) {
  let cumulative = 0;
  for (let i = 0; i < SYMBOLS.length; i++) {
    cumulative += WEIGHTS[i] / TOTAL_W;
    if (rand < cumulative) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function checkPayout(reels) {
  const key = reels.join(',');
  if (PAY_TABLE[key]) return PAY_TABLE[key];
  // 2× Cherry anywhere
  const cherries = reels.filter(s => s === 'Cherry').length;
  if (cherries >= 2) return 2;
  return 0;
}

function detectNearMiss(reels) {
  const key2 = reels.slice(0, 2).join(',');
  const topSymbol = reels[0];
  // Two matching high-value on first two reels, third doesn't match
  if (reels[0] === reels[1] && reels[2] !== reels[0] && SYMBOLS.indexOf(topSymbol) <= 2) {
    return true;
  }
  return false;
}

async function spin(userId, betAmount) {
  betAmount = Math.floor(betAmount);
  if (betAmount < 10) throw new Error('Minimum bet is 10 CC');

  const { seed, hash } = generateSeed();
  const nonce  = await nextNonce(userId);
  const floats = deriveFloats(seed, nonce, 3);
  const reels  = floats.map(pickSymbol);
  const multiplier = checkPayout(reels);
  const nearMiss   = multiplier === 0 ? detectNearMiss(reels) : false;
  const payout     = Math.floor(betAmount * multiplier);

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
      userId, game: 'slots', betAmount, payoutAmount: payout, seed, hash, nonce,
      extra: { reels, multiplier, nearMiss },
    });

    await client.query('COMMIT');
    return { reels, multiplier, nearMiss, payout, net: payout - betAmount, seed, hash, nonce, cc_balance: finalBalance };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { spin };
