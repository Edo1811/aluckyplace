// Phase 8 — Leaderboard + Hall of Fame/Shame (read endpoints)
//   GET /social/leaderboard    — all-time by CC (top 50), weekly-badge holder flagged
//   GET /social/hall-of-fame
//   GET /social/hall-of-shame
// (GET /social/guilds and all guild mutations live in social/guild-routes.js)

const router = require('express').Router();
const { requireAuth } = require('../auth/middleware');
const { query } = require('../db');

// Equipped-cosmetics aggregate — shared shape so the frontend can render
// names/frames/auras consistently via cosmeticPreview.js.
const EQUIPPED_COSMETICS_JSON = `
  COALESCE(
    json_agg(json_build_object(
      'category', cc.category, 'rarity', cc.rarity, 'preview_key', cc.preview_key
    )) FILTER (WHERE uc.id IS NOT NULL), '[]'
  )`;

async function currentBadgeHolder() {
  const r = await query(
    `SELECT user_id FROM leaderboard_badges ORDER BY week_start DESC LIMIT 1`
  );
  return r.rows[0]?.user_id || null;
}

function fmtHallEntry(row) {
  return {
    id: row.id,
    username: row.username,
    trigger: row.trigger,
    amount: row.amount === null ? null : Number(row.amount),
    game: row.game,
    story: row.extra?.story || null,
    created_at: row.created_at,
  };
}

// ── GET /social/leaderboard ───────────────────────────────────────────────────
router.get('/leaderboard', requireAuth, async (_req, res) => {
  try {
    const badgeHolder = await currentBadgeHolder();
    const r = await query(
      `SELECT u.id, u.username, u.cc_balance, ${EQUIPPED_COSMETICS_JSON} AS cosmetics
       FROM users u
       LEFT JOIN user_cosmetics uc     ON uc.user_id = u.id AND uc.is_equipped = TRUE
       LEFT JOIN cosmetics_catalog cc  ON cc.id = uc.cosmetic_id
       GROUP BY u.id
       ORDER BY u.cc_balance DESC
       LIMIT 50`
    );
    const leaderboard = r.rows.map((row, i) => ({
      rank: i + 1,
      user_id: row.id,
      username: row.username,
      cc_balance: Number(row.cc_balance),
      cosmetics: row.cosmetics,
      weekly_badge: row.id === badgeHolder,
    }));
    res.json({ leaderboard });
  } catch (err) {
    console.error('[social/leaderboard]', err.message);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ── GET /social/hall-of-fame ──────────────────────────────────────────────────
router.get('/hall-of-fame', requireAuth, async (_req, res) => {
  try {
    const r = await query(
      `SELECT h.id, h.trigger, h.amount, h.game, h.extra, h.created_at, u.username
       FROM hall_of_fame h JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC LIMIT 50`
    );
    res.json({ entries: r.rows.map(fmtHallEntry) });
  } catch (err) {
    console.error('[social/hall-of-fame]', err.message);
    res.status(500).json({ error: 'Failed to load Hall of Fame' });
  }
});

// ── GET /social/hall-of-shame ─────────────────────────────────────────────────
// hos_opted_out users are filtered at query time (nightly cron also prunes them).
router.get('/hall-of-shame', requireAuth, async (_req, res) => {
  try {
    const r = await query(
      `SELECT h.id, h.trigger, h.amount, h.game, h.extra, h.created_at, u.username
       FROM hall_of_shame h JOIN users u ON u.id = h.user_id
       WHERE u.hos_opted_out = FALSE
       ORDER BY h.created_at DESC LIMIT 50`
    );
    res.json({ entries: r.rows.map(fmtHallEntry) });
  } catch (err) {
    console.error('[social/hall-of-shame]', err.message);
    res.status(500).json({ error: 'Failed to load Hall of Shame' });
  }
});

// Exported for future real-time pushes: clients viewing the board join the
// 'leaderboard' room; call this after a committed balance change to broadcast.
function broadcastLeaderboardUpdate(io, entry) {
  try { io.to('leaderboard').emit('leaderboard:update', entry); } catch { /* noop */ }
}

module.exports = router;
module.exports.broadcastLeaderboardUpdate = broadcastLeaderboardUpdate;
