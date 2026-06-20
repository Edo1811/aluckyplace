// Phase 7 — Profile routes
// GET /profile/:username             — summary: balances, lifetime stats,
//                                       top win streaks, equipped cosmetics
// GET /profile/:username/cosmetics   — full inventory if viewing your own
//                                       profile, equipped-only otherwise
//
// Only "own profile" is reachable from the UI right now (Social, which is
// what links to OTHER players' profiles, is Phase 8). Built against
// :username rather than hardcoded to the caller so it's ready for that
// without changes later.

const router = require('express').Router();
const { query } = require('../db');
const { requireAuth } = require('../auth/middleware');

const EMPTY_STATS = {
  total_games: 0, total_wins: 0, biggest_win: 0, biggest_loss: 0,
  bankruptcy_count: 0, total_pvp_wins: 0, pvp_win_streak: 0, best_pvp_win_streak: 0,
};

// ── GET /profile/:username ───────────────────────────────────────────────────
router.get('/:username', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const isOwn = username === req.user.username;

    const userRes = await query(
      `SELECT id, username, cc_balance, a_balance, created_at FROM users WHERE username = $1`,
      [username]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const profile = userRes.rows[0];

    const statsRes = await query(`SELECT * FROM user_stats WHERE user_id = $1`, [profile.id]);
    const stats = statsRes.rows[0] || EMPTY_STATS;
    const win_rate = stats.total_games > 0 ? Math.round((stats.total_wins / stats.total_games) * 100) : 0;

    const streaksRes = await query(
      `SELECT game, current_streak, best_streak FROM win_streaks
       WHERE user_id = $1 AND current_streak > 0
       ORDER BY current_streak DESC LIMIT 3`,
      [profile.id]
    );

    const bestRes = await query(`SELECT MAX(best_streak) AS best FROM win_streaks WHERE user_id = $1`, [profile.id]);
    const best_streak_overall = bestRes.rows[0]?.best || 0;

    const equippedRes = await query(
      `SELECT cc.category, cc.name, cc.rarity, cc.preview_key
       FROM user_cosmetics uc JOIN cosmetics_catalog cc ON cc.id = uc.cosmetic_id
       WHERE uc.user_id = $1 AND uc.is_equipped = TRUE`,
      [profile.id]
    );
    const equipped = {};
    for (const row of equippedRes.rows) {
      equipped[row.category] = { name: row.name, rarity: row.rarity, preview_key: row.preview_key };
    }

    return res.json({
      username: profile.username,
      is_own: isOwn,
      cc_balance: profile.cc_balance,
      a_balance: profile.a_balance,
      member_since: profile.created_at,
      stats: { ...stats, win_rate, best_streak_overall },
      win_streaks: streaksRes.rows,
      equipped,
    });
  } catch (err) {
    console.error('[profile/get]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /profile/:username/cosmetics ─────────────────────────────────────────
router.get('/:username/cosmetics', requireAuth, async (req, res) => {
  try {
    const { username } = req.params;
    const isOwn = username === req.user.username;

    const userRes = await query(`SELECT id FROM users WHERE username = $1`, [username]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    const userId = userRes.rows[0].id;

    const result = await query(
      `SELECT uc.id AS user_cosmetic_id, cc.id AS cosmetic_id, cc.name, cc.category, cc.rarity, cc.preview_key, uc.is_equipped
       FROM user_cosmetics uc JOIN cosmetics_catalog cc ON cc.id = uc.cosmetic_id
       WHERE uc.user_id = $1 ${isOwn ? '' : 'AND uc.is_equipped = TRUE'}
       ORDER BY cc.category, cc.rarity`,
      [userId]
    );

    return res.json({ is_own: isOwn, cosmetics: result.rows });
  } catch (err) {
    console.error('[profile/cosmetics]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
