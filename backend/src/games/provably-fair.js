const crypto  = require('crypto');
const { query, getClient } = require('../db');

function generateSeed() {
  const seed = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return { seed, hash };
}

function deriveFloat(seed, nonce) {
  const hmac = crypto.createHmac('sha256', seed).update(String(nonce)).digest('hex');
  return parseInt(hmac.slice(0, 8), 16) / 0xffffffff;
}

// Returns a float array of `count` values derived from seed+nonce+index
function deriveFloats(seed, nonce, count) {
  return Array.from({ length: count }, (_, i) => {
    const hmac = crypto.createHmac('sha256', seed).update(`${nonce}:${i}`).digest('hex');
    return parseInt(hmac.slice(0, 8), 16) / 0xffffffff;
  });
}

async function nextNonce(userId) {
  const result = await query(
    `UPDATE provably_fair_nonces SET nonce = nonce + 1 WHERE user_id = $1 RETURNING nonce`,
    [userId]
  );
  if (result.rows.length === 0) {
    // Row missing — insert it (shouldn't happen after register, but safe)
    await query(
      `INSERT INTO provably_fair_nonces (user_id, nonce) VALUES ($1, 1)
       ON CONFLICT (user_id) DO UPDATE SET nonce = provably_fair_nonces.nonce + 1`,
      [userId]
    );
    return 1;
  }
  return result.rows[0].nonce;
}

async function recordResult(client, { userId, game, betAmount, payoutAmount, seed, hash, nonce, extra }) {
  const net = payoutAmount - betAmount;
  await client.query(
    `INSERT INTO game_results (user_id, game, bet_amount, payout_amount, net, server_seed, server_hash, nonce, extra)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [userId, game, betAmount, payoutAmount, net, seed, hash, nonce, extra ? JSON.stringify(extra) : null]
  );
}

module.exports = { generateSeed, deriveFloat, deriveFloats, nextNonce, recordResult };
