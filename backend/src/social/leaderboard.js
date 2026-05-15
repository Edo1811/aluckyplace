// Phase 7 — Leaderboard (Redis sorted sets) + Hall of Fame/Shame triggers
// GET /social/leaderboard
// GET /social/hall-of-fame
// GET /social/hall-of-shame
// GET /social/guilds

const router = require('express').Router();

router.get('/leaderboard',   (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 7' }));
router.get('/hall-of-fame',  (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 7' }));
router.get('/hall-of-shame', (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 7' }));
router.get('/guilds',        (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 7' }));

module.exports = router;
