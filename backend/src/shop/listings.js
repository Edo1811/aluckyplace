// Phase 7 — Player shop: listings, purchases, cosmetic equip
// GET  /shop/listings
// POST /shop/listings          — create listing
// POST /shop/listings/:id/buy  — purchase (buyer pays price * 1.15, seller gets price)
// DEL  /shop/listings/:id      — cancel listing
// POST /shop/packs/open        — open a pack
//
// House cut: 15% added on top of listed price (invisible to seller)

const router = require('express').Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../auth/middleware');
const { openPack } = require('./packs');

const HOUSE_MARKUP = 1.15; // 15% house cut, added on top of the seller's listed price

function buyerPrice(price_a) {
  return Math.ceil(price_a * HOUSE_MARKUP);
}

// ── GET /shop/listings ──────────────────────────────────────────────────────
// Active listings, optionally filtered by ?category= and ?rarity=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, rarity } = req.query;
    const conditions = ['sl.sold_at IS NULL'];
    const params = [];

    if (category) { params.push(category); conditions.push(`cc.category = $${params.length}`); }
    if (rarity)   { params.push(rarity);   conditions.push(`cc.rarity = $${params.length}`); }

    const result = await query(
      `SELECT sl.id, sl.price_a, sl.listed_at,
              cc.id AS cosmetic_id, cc.name, cc.category, cc.rarity, cc.preview_key,
              u.username AS seller
       FROM shop_listings sl
       JOIN cosmetics_catalog cc ON cc.id = sl.cosmetic_id
       JOIN users u ON u.id = sl.seller_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sl.price_a ASC`,
      params
    );

    const listings = result.rows.map(row => ({
      ...row,
      buyer_price_a: buyerPrice(row.price_a),
    }));

    return res.json({ listings });
  } catch (err) {
    console.error('[shop/listings:get]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /shop/listings ──────────────────────────────────────────────────────
// Body: { user_cosmetic_id, price_a }  — price_a is what the seller receives
router.post('/', requireAuth, async (req, res) => {
  try {
    const { userId } = req.user;
    let { user_cosmetic_id, price_a } = req.body;
    price_a = Math.floor(Number(price_a));

    if (!user_cosmetic_id || !price_a || price_a <= 0)
      return res.status(400).json({ error: 'user_cosmetic_id and a positive price_a are required' });

    const owned = await query(
      `SELECT cosmetic_id FROM user_cosmetics WHERE id = $1 AND user_id = $2`,
      [user_cosmetic_id, userId]
    );
    if (owned.rows.length === 0)
      return res.status(404).json({ error: 'You do not own that cosmetic' });

    const cosmetic_id = owned.rows[0].cosmetic_id;

    const result = await query(
      `INSERT INTO shop_listings (seller_id, cosmetic_id, user_cosmetic_id, price_a)
       VALUES ($1, $2, $3, $4)
       RETURNING id, price_a, listed_at`,
      [userId, cosmetic_id, user_cosmetic_id, price_a]
    );

    return res.status(201).json({ listing: result.rows[0] });
  } catch (err) {
    console.error('[shop/listings:post]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /shop/listings/:id/buy ──────────────────────────────────────────────
router.post('/:id/buy', requireAuth, async (req, res) => {
  const client = await getClient();
  try {
    const buyerId = req.user.userId;
    const { id } = req.params;

    await client.query('BEGIN');

    // Lock the row so two buyers can't both win a race on the same listing
    const listingRes = await client.query(
      `SELECT id, seller_id, cosmetic_id, user_cosmetic_id, price_a
       FROM shop_listings WHERE id = $1 AND sold_at IS NULL FOR UPDATE`,
      [id]
    );
    if (listingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Listing not found or already sold' });
    }
    const listing = listingRes.rows[0];

    if (listing.seller_id === buyerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot buy your own listing' });
    }

    // user_cosmetics has a UNIQUE(user_id, cosmetic_id) constraint — block the
    // purchase outright rather than silently refunding (this isn't a pack pull).
    const dupe = await client.query(
      `SELECT id FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2`,
      [buyerId, listing.cosmetic_id]
    );
    if (dupe.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You already own this cosmetic' });
    }

    const cost = buyerPrice(listing.price_a);

    const debit = await client.query(
      `UPDATE users SET a_balance = a_balance - $1 WHERE id = $2 AND a_balance >= $1 RETURNING a_balance`,
      [cost, buyerId]
    );
    if (debit.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient A balance' });
    }

    await client.query(
      `UPDATE users SET a_balance = a_balance + $1 WHERE id = $2`,
      [listing.price_a, listing.seller_id]
    );

    await client.query(
      `UPDATE shop_listings SET sold_at = NOW(), buyer_id = $1 WHERE id = $2`,
      [buyerId, listing.id]
    );

    // Transfer the actual owned instance to the buyer
    await client.query(
      `UPDATE user_cosmetics
       SET user_id = $1, is_equipped = FALSE, source = 'purchase', acquired_at = NOW()
       WHERE id = $2`,
      [buyerId, listing.user_cosmetic_id]
    );

    await client.query('COMMIT');

    return res.json({
      ok: true,
      cosmetic_id: listing.cosmetic_id,
      paid_a: cost,
      a_balance: debit.rows[0].a_balance,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[shop/listings:buy]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── DELETE /shop/listings/:id ─────────────────────────────────────────────────
// Cancel — never sold, so this hard-deletes the row.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM shop_listings WHERE id = $1 AND seller_id = $2 AND sold_at IS NULL RETURNING id`,
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Listing not found, not yours, or already sold' });

    return res.json({ ok: true });
  } catch (err) {
    console.error('[shop/listings:delete]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /shop/packs/open ─────────────────────────────────────────────────────
// Body: { pack_type }
router.post('/packs/open', requireAuth, async (req, res) => {
  try {
    const result = await openPack(req.user.userId, req.body.pack_type);
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
