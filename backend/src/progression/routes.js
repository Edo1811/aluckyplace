// Phase 7 — Achievements & Challenges REST routes
// GET  /achievements
// GET  /challenges
// POST /challenges/:id/claim

const router = require('express').Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../auth/middleware');
const { ACHIEVEMENTS_META, CHALLENGES_META } = require('./index');

// ── GET /achievements ────────────────────────────────────────────────────────
router.get('/achievements', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = $1`,
      [req.user.userId]
    );
    const unlockedMap = new Map(result.rows.map(r => [r.achievement_id, r.unlocked_at]));

    const achievements = Object.entries(ACHIEVEMENTS_META).map(([id, meta]) => ({
      id: Number(id),
      ...meta,
      unlocked: unlockedMap.has(Number(id)),
      unlocked_at: unlockedMap.get(Number(id)) || null,
    }));

    return res.json({ achievements });
  } catch (err) {
    console.error('[progression/achievements]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /challenges ──────────────────────────────────────────────────────────
router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT challenge_id, progress, completed_at, reward_claimed FROM challenges WHERE user_id = $1`,
      [req.user.userId]
    );
    const progressMap = new Map(result.rows.map(r => [r.challenge_id, r]));

    const challenges = Object.entries(CHALLENGES_META).map(([id, meta]) => {
      const p = progressMap.get(Number(id));
      return {
        id: Number(id),
        ...meta,
        progress: p?.progress ?? 0,
        completed: !!p?.completed_at,
        reward_claimed: p?.reward_claimed ?? false,
      };
    });

    return res.json({ challenges });
  } catch (err) {
    console.error('[progression/challenges]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /challenges/:id/claim ───────────────────────────────────────────────
router.post('/challenges/:id/claim', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    const userId = req.user.userId;
    const challengeId = Number(req.params.id);
    const meta = CHALLENGES_META[challengeId];
    if (!meta) return res.status(404).json({ error: 'Unknown challenge' });

    await client.query('BEGIN');

    const claimed = await client.query(
      `UPDATE challenges SET reward_claimed = TRUE
       WHERE user_id = $1 AND challenge_id = $2 AND completed_at IS NOT NULL AND reward_claimed = FALSE
       RETURNING challenge_id`,
      [userId, challengeId]
    );
    if (claimed.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Challenge not completed or already claimed' });
    }

    const credit = await client.query(
      `UPDATE users SET a_balance = a_balance + $1 WHERE id = $2 RETURNING a_balance`,
      [meta.reward_a, userId]
    );

    await client.query('COMMIT');
    return res.json({ ok: true, reward_a: meta.reward_a, a_balance: credit.rows[0].a_balance });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[progression/claim]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
