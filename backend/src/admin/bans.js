// In-memory set of banned user ids, so every request can be checked without a DB hit.
// Loaded at startup and kept in sync by the admin ban/unban routes.
const { query } = require('../db');

const banned = new Set();

async function loadBans() {
  try {
    const r = await query('SELECT id FROM users WHERE banned_at IS NOT NULL');
    banned.clear();
    r.rows.forEach((u) => banned.add(u.id));
  } catch (err) {
    console.error('[bans] load failed:', err.message);
  }
}

const isBanned = (userId) => banned.has(userId);
const markBanned = (userId, on) => (on ? banned.add(userId) : banned.delete(userId));

module.exports = { loadBans, isBanned, markBanned };
