const router      = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const { query }   = require('../db');
const dice        = require('./dice');
const slots       = require('./slots');
const roulette    = require('./roulette');
const plinko      = require('./plinko');

// ── GET /games/history ────────────────────────────────────────────────────────
router.get('/history', requireAuth, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0,  0);
    const result = await query(
      `SELECT id, game, bet_amount, payout_amount, net, server_hash, nonce, extra, created_at
       FROM game_results WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.userId, limit, offset]
    );
    return res.json({ results: result.rows, limit, offset });
  } catch (e) {
    console.error('[games/history]', e.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /games/dice/roll ─────────────────────────────────────────────────────
router.post('/dice/roll', requireAuth, async (req, res) => {
  try {
    const { amount, direction, threshold } = req.body;
    const result = await dice.roll(req.user.userId, amount, direction, threshold);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// ── POST /games/slots/spin ────────────────────────────────────────────────────
router.post('/slots/spin', requireAuth, async (req, res) => {
  try {
    const result = await slots.spin(req.user.userId, req.body.amount);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// ── POST /games/roulette/spin ─────────────────────────────────────────────────
router.post('/roulette/spin', requireAuth, async (req, res) => {
  try {
    const result = await roulette.spin(req.user.userId, req.body.bets);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

// ── POST /games/plinko/drop ───────────────────────────────────────────────────
router.post('/plinko/drop', requireAuth, async (req, res) => {
  try {
    const result = await plinko.drop(req.user.userId, req.body.amount);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

module.exports = router;
