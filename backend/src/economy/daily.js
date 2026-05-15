const router = require('express').Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../auth/middleware');

// Reward table from balance.md — index 0 = Day 1
const DAILY_REWARDS = [100, 200, 250, 300, 400, 500, 750, 800, 1000];

function rewardForDay(day) {
  // Day 9+ stays at 1000 CC
  return DAILY_REWARDS[Math.min(day - 1, 8)];
}

// ── GET /daily ────────────────────────────────────────────────────────────────
// Returns current streak info and whether the player can claim today.
router.get('/', requireAuth, async (req, res) => {
  try {
    const { userId } = req.user;

    const result = await query(
      'SELECT current_streak, last_claimed_at FROM daily_streaks WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Never claimed before
      return res.json({
        current_streak: 0,
        next_day:       1,
        reward:         rewardForDay(1),
        can_claim:      true,
        last_claimed_at: null,
      });
    }

    const { current_streak, last_claimed_at } = result.rows[0];
    const now      = new Date();
    const lastDate = new Date(last_claimed_at);

    // Compare UTC dates only
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastUTC  = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
    const diffDays = Math.round((todayUTC - lastUTC) / 86400000);

    const claimed_today = diffDays === 0;
    const streak_alive  = diffDays <= 1;

    // What streak/day will the NEXT claim be?
    let next_streak;
    if (claimed_today)   next_streak = current_streak;       // already claimed
    else if (streak_alive) next_streak = current_streak + 1; // continuing streak
    else                   next_streak = 1;                  // reset

    return res.json({
      current_streak,
      next_day:        claimed_today ? current_streak : next_streak,
      reward:          rewardForDay(next_streak),
      can_claim:       !claimed_today,
      last_claimed_at,
    });

  } catch (err) {
    console.error('[daily/get]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /daily/claim ─────────────────────────────────────────────────────────
// Awards CC and updates streak. Atomic — uses a transaction.
router.post('/claim', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    const { userId } = req.user;
    await client.query('BEGIN');

    // Lock the user row to prevent double-claim race conditions
    const userResult = await client.query(
      'SELECT cc_balance FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check existing streak
    const streakResult = await client.query(
      'SELECT current_streak, last_claimed_at FROM daily_streaks WHERE user_id = $1',
      [userId]
    );

    const now     = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let new_streak = 1;

    if (streakResult.rows.length > 0) {
      const { current_streak, last_claimed_at } = streakResult.rows[0];
      const lastDate = new Date(last_claimed_at);
      const lastUTC  = new Date(Date.UTC(lastDate.getUTCFullYear(), lastDate.getUTCMonth(), lastDate.getUTCDate()));
      const diffDays = Math.round((todayUTC - lastUTC) / 86400000);

      if (diffDays === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Already claimed today' });
      }

      new_streak = diffDays === 1 ? current_streak + 1 : 1;
    }

    const reward = rewardForDay(new_streak);

    // Credit CC (architecture invariant: always use += not SET)
    const updated = await client.query(
      'UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance, a_balance',
      [reward, userId]
    );

    // Upsert streak row
    await client.query(
      `INSERT INTO daily_streaks (user_id, current_streak, last_claimed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET current_streak  = $2,
             last_claimed_at = NOW()`,
      [userId, new_streak]
    );

    await client.query('COMMIT');

    const { cc_balance, a_balance } = updated.rows[0];

    return res.json({
      ok:             true,
      reward,
      new_streak,
      cc_balance,
      a_balance,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[daily/claim]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
