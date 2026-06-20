// Phase 7 — Cosmetic equip / unequip
// POST /cosmetics/:id/equip    — :id is the cosmetics_catalog id
// POST /cosmetics/:id/unequip
//
// Only one cosmetic per category can be equipped at a time (architecture.md
// invariant) — equip unequips anything else in the same category first.

const router = require('express').Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../auth/middleware');

// ── POST /cosmetics/:id/equip ────────────────────────────────────────────────
router.post('/:id/equip', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    const userId = req.user.userId;
    const cosmeticId = req.params.id;

    await client.query('BEGIN');

    const owned = await client.query(
      `SELECT uc.id, cc.category
       FROM user_cosmetics uc
       JOIN cosmetics_catalog cc ON cc.id = uc.cosmetic_id
       WHERE uc.user_id = $1 AND uc.cosmetic_id = $2`,
      [userId, cosmeticId]
    );
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'You do not own that cosmetic' });
    }
    const { id: rowId, category } = owned.rows[0];

    // Unequip anything else currently equipped in this category
    await client.query(
      `UPDATE user_cosmetics SET is_equipped = FALSE
       WHERE user_id = $1 AND is_equipped = TRUE
         AND cosmetic_id IN (SELECT id FROM cosmetics_catalog WHERE category = $2)`,
      [userId, category]
    );

    await client.query(`UPDATE user_cosmetics SET is_equipped = TRUE WHERE id = $1`, [rowId]);

    await client.query('COMMIT');
    return res.json({ ok: true, equipped: cosmeticId, category });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[cosmetics/equip]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /cosmetics/:id/unequip ──────────────────────────────────────────────
router.post('/:id/unequip', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `UPDATE user_cosmetics SET is_equipped = FALSE
       WHERE user_id = $1 AND cosmetic_id = $2
       RETURNING id`,
      [req.user.userId, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'You do not own that cosmetic' });

    return res.json({ ok: true, unequipped: req.params.id });
  } catch (err) {
    console.error('[cosmetics/unequip]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
