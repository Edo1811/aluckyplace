const router = require('express').Router();
const { getClient } = require('../db');
const { requireAuth } = require('../auth/middleware');

const RATE    = 1000; // 1000 CC = 1 A
const MINIMUM = 1000; // minimum CC to convert

// ── GET /convert ──────────────────────────────────────────────────────────────
// Returns the current rate and user's balances.
router.get('/', requireAuth, async (req, res) => {
  const { query } = require('../db');
  try {
    const result = await query(
      'SELECT cc_balance, a_balance FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found' });

    const { cc_balance, a_balance } = result.rows[0];
    return res.json({ cc_balance, a_balance, rate: RATE, minimum: MINIMUM });
  } catch (err) {
    console.error('[convert/get]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /convert ─────────────────────────────────────────────────────────────
// Body: { amount_cc: number }
// Deducts CC, credits A at 1000:1. Atomic, one-way, irreversible.
router.post('/', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    const { userId } = req.user;
    let { amount_cc } = req.body;
    amount_cc = Math.floor(Number(amount_cc));

    if (!amount_cc || amount_cc < MINIMUM)
      return res.status(400).json({ error: `Minimum conversion is ${MINIMUM} CC` });

    // Must convert in exact multiples of RATE
    const tokens = Math.floor(amount_cc / RATE);
    const actual_cc = tokens * RATE; // trim any remainder

    await client.query('BEGIN');

    // Deduct CC — guard ensures balance never goes below 0 (architecture invariant #1)
    const result = await client.query(
      `UPDATE users
       SET cc_balance = cc_balance - $1,
           a_balance  = a_balance  + $2
       WHERE id = $3
         AND cc_balance >= $1
       RETURNING cc_balance, a_balance`,
      [actual_cc, tokens, userId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient CC balance' });
    }

    await client.query('COMMIT');

    const { cc_balance, a_balance } = result.rows[0];
    return res.json({ ok: true, converted_cc: actual_cc, received_a: tokens, cc_balance, a_balance });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[convert/post]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
