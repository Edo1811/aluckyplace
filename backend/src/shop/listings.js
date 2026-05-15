// Phase 8 — Player shop: listings, purchases, cosmetic equip
// GET  /shop/listings
// POST /shop/listings          — create listing
// POST /shop/listings/:id/buy  — purchase (buyer pays price * 1.15, seller gets price)
// DEL  /shop/listings/:id      — cancel listing
// POST /shop/packs/open        — open a pack
// POST /cosmetics/:id/equip
// POST /cosmetics/:id/unequip
//
// House cut: 15% added on top of listed price (invisible to seller)

const router = require('express').Router();

router.get('/',                 (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 8' }));
router.post('/',                (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 8' }));
router.post('/:id/buy',         (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 8' }));
router.delete('/:id',           (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 8' }));
router.post('/packs/open',      (_req, res) => res.status(501).json({ error: 'Not implemented yet — Phase 8' }));

module.exports = router;
