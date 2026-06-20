// Phase 7 — Pack opening logic
// Packs from balance.md:
//   Starter (15A):      Common 72% Rare 28%
//   High Roller (40A):  Common 45% Rare 35% Epic 17% Legendary 3%
//   Epic Cache (75A):   Rare 40% Epic 42% Legendary 15% Exotic 3%
//   Exotic Crate (250A):Epic 55% Legendary 33% Exotic 12%
//
// Duplicate protection: 80% of base rarity value refunded as A

const { getClient } = require('../db');

const PACK_ODDS = {
  starter:      { Common: 0.72, Rare: 0.28 },
  high_roller:  { Common: 0.45, Rare: 0.35, Epic: 0.17, Legendary: 0.03 },
  epic_cache:   { Rare: 0.40, Epic: 0.42, Legendary: 0.15, Exotic: 0.03 },
  exotic_crate: { Epic: 0.55, Legendary: 0.33, Exotic: 0.12 },
};

const PACK_PRICES = { starter: 15, high_roller: 40, epic_cache: 75, exotic_crate: 250 };

const DUPE_REFUNDS = { Common: 4, Rare: 12, Epic: 32, Legendary: 96, Exotic: 400 };

const RARITY_ORDER = ['Common', 'Rare', 'Epic', 'Legendary', 'Exotic'];

// Weighted random pick across whichever rarities are defined for this pack.
function rollRarity(odds) {
  const roll = Math.random();
  let cumulative = 0;
  for (const rarity of RARITY_ORDER) {
    if (!odds[rarity]) continue;
    cumulative += odds[rarity];
    if (roll < cumulative) return rarity;
  }
  // Floating point safety net — fall back to the highest defined rarity.
  const defined = RARITY_ORDER.filter(r => odds[r]);
  return defined[defined.length - 1];
}

async function openPack(userId, packType) {
  const price = PACK_PRICES[packType];
  if (!price) throw new Error('Unknown pack type');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Atomic debit — guard ensures balance never goes below 0
    const debit = await client.query(
      `UPDATE users SET a_balance = a_balance - $1 WHERE id = $2 AND a_balance >= $1 RETURNING a_balance`,
      [price, userId]
    );
    if (debit.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient A balance');
    }

    const rarity = rollRarity(PACK_ODDS[packType]);

    const itemRes = await client.query(
      `SELECT id, name, category, rarity FROM cosmetics_catalog
       WHERE rarity = $1 AND is_obtainable = TRUE
       ORDER BY random() LIMIT 1`,
      [rarity]
    );
    if (itemRes.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new Error(`No obtainable items found for rarity ${rarity}`);
    }
    const item = itemRes.rows[0];

    const dupe = await client.query(
      `SELECT id FROM user_cosmetics WHERE user_id = $1 AND cosmetic_id = $2`,
      [userId, item.id]
    );

    let outcome, a_balance;

    if (dupe.rows.length > 0) {
      // Already owned — refund A instead of granting a second copy
      const refund = DUPE_REFUNDS[rarity];
      const credit = await client.query(
        `UPDATE users SET a_balance = a_balance + $1 WHERE id = $2 RETURNING a_balance`,
        [refund, userId]
      );
      a_balance = credit.rows[0].a_balance;
      outcome = { duplicate: true, item, refund_a: refund };
    } else {
      await client.query(
        `INSERT INTO user_cosmetics (user_id, cosmetic_id, source) VALUES ($1, $2, 'pack')`,
        [userId, item.id]
      );
      a_balance = debit.rows[0].a_balance;
      outcome = { duplicate: false, item };
    }

    await client.query('COMMIT');
    return { pack_type: packType, rarity, ...outcome, a_balance };

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { openPack, PACK_ODDS, PACK_PRICES, DUPE_REFUNDS };
