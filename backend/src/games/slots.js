const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');
const { recordSoloResult } = require('../progression');

const crypto = require('crypto');

const SYMBOLS  = ['Diamond', 'Star', 'Dollar', 'Bell', 'Cherry'];

// ── Daily mood ────────────────────────────────────────────────────────────────
// The machine runs "hot" or "cold" for a whole day. Each mood is a reel-weight
// table; the pay table never changes. Exact RTP / hit rate per table (computed
// over all 125 reel combinations with 2+ Cherry = 1x money back):
//   cold   [3,6,12,16,27]  RTP 80.1%  hits 40.7%
//   normal [3,6,12,19,39]  RTP 91.8%  hits 50.8%
//   warm   [3,6,11,12,37]  RTP 100.0% hits 56.4%
//   hot    [3,6, 7,12,38]  RTP 110.0% hits 62.1%
// Picked 25/40/25/10 → long-run average ≈ 92.7%.
// The day is decided by an HMAC of the Berlin date with a server secret, so
// players can't predict tomorrow; it's stored on every result for the admin view.
const MOODS = [
  { name: 'cold',   weights: [3, 6, 12, 16, 27], rtp: 0.801, chance: 0.25 },
  { name: 'normal', weights: [3, 6, 12, 19, 39], rtp: 0.918, chance: 0.40 },
  { name: 'warm',   weights: [3, 6, 11, 12, 37], rtp: 1.000, chance: 0.25 },
  { name: 'hot',    weights: [3, 6,  7, 12, 38], rtp: 1.100, chance: 0.10 },
];
const berlinDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d); // YYYY-MM-DD

function moodFor(date = berlinDate()) {
  const secret = process.env.SLOTS_MOOD_SECRET || process.env.JWT_SECRET || 'alp';
  const h = crypto.createHmac('sha256', secret).update(`slots:${date}`).digest();
  const x = h.readUInt32BE(0) / 0x100000000;
  let acc = 0;
  for (const m of MOODS) { acc += m.chance; if (x < acc) return { ...m, date }; }
  return { ...MOODS[1], date };
}

const PAY_TABLE = {
  'Diamond,Diamond,Diamond': 100,
  'Star,Star,Star':           40,
  'Dollar,Dollar,Dollar':     15,
  'Bell,Bell,Bell':            8,
  'Cherry,Cherry,Cherry':      3,
};

function pickSymbol(rand, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let cumulative = 0;
  for (let i = 0; i < SYMBOLS.length; i++) {
    cumulative += weights[i] / total;
    if (rand < cumulative) return SYMBOLS[i];
  }
  return SYMBOLS[SYMBOLS.length - 1];
}

function checkPayout(reels) {
  const key = reels.join(',');
  if (PAY_TABLE[key]) return PAY_TABLE[key];
  // 2+ Cherry anywhere: money back
  const cherries = reels.filter(s => s === 'Cherry').length;
  if (cherries >= 2) return 1;
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
  const mood   = moodFor();
  const reels  = floats.map((f) => pickSymbol(f, mood.weights));
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
      extra: { reels, multiplier, nearMiss, mood: mood.name, weights: mood.weights },
    });

    await recordSoloResult(client, {
      userId, game: 'slots', betAmount, payoutAmount: payout, ccBalanceAfter: finalBalance,
      extra: { jackpot: multiplier === 100 },
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

module.exports = { spin, moodFor, MOODS };
