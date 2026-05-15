// Phase 8 — Pack opening logic
// Packs from balance.md:
//   Starter (5A):      Common 72% Rare 28%
//   High Roller (15A): Common 45% Rare 35% Epic 17% Legendary 3%
//   Epic Cache (30A):  Rare 40% Epic 42% Legendary 15% Exotic 3%
//   Exotic Crate (75A):Rare — Epic 55% Legendary 33% Exotic 12%
//
// Duplicate protection: 80% of base rarity value refunded as A

const PACK_ODDS = {
  starter:     { Common: 0.72, Rare: 0.28 },
  high_roller: { Common: 0.45, Rare: 0.35, Epic: 0.17, Legendary: 0.03 },
  epic_cache:  { Rare: 0.40, Epic: 0.42, Legendary: 0.15, Exotic: 0.03 },
  exotic_crate:{ Epic: 0.55, Legendary: 0.33, Exotic: 0.12 },
};

const PACK_PRICES = { starter: 5, high_roller: 15, epic_cache: 30, exotic_crate: 75 };

const DUPE_REFUNDS = { Common: 4, Rare: 12, Epic: 32, Legendary: 96, Exotic: 400 };

async function openPack(_userId, _packType) {
  // Phase 8
  throw new Error('Not implemented yet — Phase 8');
}

module.exports = { openPack, PACK_ODDS, PACK_PRICES, DUPE_REFUNDS };
