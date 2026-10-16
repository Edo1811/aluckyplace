// Admin panel API. Every route re-checks users.is_admin in the database;
// non-admins get a plain 404 so the panel doesn't advertise itself.
// Every write is recorded in admin_log.
const express = require('express');
const jwt = require('jsonwebtoken');
const { query, getClient } = require('../db');
const { markBanned } = require('./bans');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toInt = (v) => (v === undefined || v === null || v === '' ? null : Math.trunc(Number(v)));
const clampLimit = (v, d = 50, max = 200) => Math.max(1, Math.min(max, toInt(v) || d));

// Strip anything that looks like a password hash from query output.
const BCRYPT = /^\$2[aby]?\$\d\d\$/;
function redactRows(rows) {
  return rows.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === 'password_hash') continue;
      o[k] = typeof v === 'string' && BCRYPT.test(v) ? '[redacted]' : v;
    }
    return o;
  });
}

module.exports = function adminRoutes(io) {
  const router = express.Router();

  // ── gate ───────────────────────────────────────────────────────────────────
  router.use(async (req, res, next) => {
    const notFound = () => res.status(404).json({ error: 'Not found' });
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return notFound();
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      const r = await query('SELECT id, username, is_admin, banned_at FROM users WHERE id = $1', [payload.userId]);
      const u = r.rows[0];
      if (!u || !u.is_admin || u.banned_at) return notFound();
      req.admin = { userId: u.id, username: u.username };
      next();
    } catch {
      return notFound();
    }
  });

  async function log(req, action, targetType, targetId, detail, db = { query }) {
    await db.query(
      `INSERT INTO admin_log (admin_id, admin_username, action, target_type, target_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.admin.userId, req.admin.username, action, targetType, targetId ? String(targetId) : null, JSON.stringify(detail || {})]
    );
  }
  const fail = (res, where, err) => { console.error(`[admin/${where}]`, err.message); res.status(500).json({ error: err.message || 'Server error' }); };
  const pushBalance = (userId, row) => io.to(`user:${userId}`).emit('balance:update', { cc_balance: row.cc_balance, a_balance: row.a_balance });
  const onlineIds = () => {
    const ids = new Set();
    for (const s of io.sockets.sockets.values()) if (s.user) ids.add(s.user.userId);
    return ids;
  };

  // ── overview ───────────────────────────────────────────────────────────────
  router.get('/overview', async (_req, res) => {
    try {
      const [totals, today, wins, losses] = await Promise.all([
        query(`SELECT COUNT(*)::int AS users, COALESCE(SUM(cc_balance),0)::text AS cc, COALESCE(SUM(a_balance),0)::text AS a,
                      COUNT(*) FILTER (WHERE banned_at IS NOT NULL)::int AS banned,
                      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_today
               FROM users`),
        query(`SELECT COUNT(*)::int AS games, COALESCE(SUM(bet_amount),0)::text AS wagered, COALESCE(-SUM(net),0)::text AS house_net
               FROM game_results WHERE created_at > NOW() - INTERVAL '24 hours'`),
        query(`SELECT g.game, g.net::text AS net, g.created_at, u.username FROM game_results g JOIN users u ON u.id = g.user_id
               WHERE g.created_at > NOW() - INTERVAL '24 hours' ORDER BY g.net DESC LIMIT 5`),
        query(`SELECT g.game, g.net::text AS net, g.created_at, u.username FROM game_results g JOIN users u ON u.id = g.user_id
               WHERE g.created_at > NOW() - INTERVAL '24 hours' ORDER BY g.net ASC LIMIT 5`),
      ]);
      const ids = [...onlineIds()];
      const online = ids.length ? (await query('SELECT id, username FROM users WHERE id = ANY($1::uuid[]) ORDER BY username', [ids])).rows : [];
      // Slots mood: today and the next 6 days (hidden from players, visible here)
      const { moodFor } = require('../games/slots');
      const slots = Array.from({ length: 7 }, (_, i) => {
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + i * 864e5));
        const m = moodFor(date);
        return { date, mood: m.name, rtp: m.rtp };
      });
      res.json({ totals: totals.rows[0], today: today.rows[0], top_wins: wins.rows, top_losses: losses.rows, online, slots });
    } catch (e) { fail(res, 'overview', e); }
  });

  // ── players ────────────────────────────────────────────────────────────────
  const USER_SORT = { cc: 'cc_balance', a: 'a_balance', created: 'created_at', login: 'last_login_at', name: 'username' };
  router.get('/users', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const sort = USER_SORT[req.query.sort] || 'cc_balance';
      const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
      const limit = clampLimit(req.query.limit), offset = Math.max(0, toInt(req.query.offset) || 0);
      const filter = req.query.filter === 'banned' ? 'AND banned_at IS NOT NULL' : req.query.filter === 'admins' ? 'AND is_admin' : '';
      const r = await query(
        `SELECT id, username, email, cc_balance::text, a_balance::text, created_at, last_login_at, is_admin, banned_at, ban_reason,
                COUNT(*) OVER()::int AS total
         FROM users WHERE ($1 = '' OR username ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%' OR id::text = $1) ${filter}
         ORDER BY ${sort} ${dir} NULLS LAST LIMIT $2 OFFSET $3`,
        [q, limit, offset]
      );
      const on = onlineIds();
      res.json({ users: r.rows.map(({ total, ...u }) => ({ ...u, online: on.has(u.id) })), total: r.rows[0]?.total || 0 });
    } catch (e) { fail(res, 'users', e); }
  });

  router.get('/users/:id', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    try {
      const u = await query(
        `SELECT id, username, email, cc_balance::text, a_balance::text, created_at, last_login_at, is_admin, banned_at, ban_reason, hos_opted_out
         FROM users WHERE id = $1`, [id]);
      if (!u.rows.length) return res.status(404).json({ error: 'User not found' });
      const [stats, games, cos, guild, streak, pvp] = await Promise.all([
        query(`SELECT COUNT(*)::int AS games, COALESCE(SUM(bet_amount),0)::text AS wagered, COALESCE(SUM(net),0)::text AS net,
                      COALESCE(MAX(net),0)::text AS best, COALESCE(MIN(net),0)::text AS worst FROM game_results WHERE user_id = $1`, [id]),
        query(`SELECT id, game, bet_amount::text, payout_amount::text, net::text, created_at FROM game_results WHERE user_id = $1
               ORDER BY created_at DESC LIMIT 25`, [id]),
        query(`SELECT uc.id AS user_cosmetic_id, uc.is_equipped, uc.source, uc.acquired_at, c.id AS cosmetic_id, c.name, c.category, c.rarity, c.preview_key,
                      EXISTS (SELECT 1 FROM shop_listings l WHERE l.user_cosmetic_id = uc.id AND l.sold_at IS NULL) AS listed
               FROM user_cosmetics uc JOIN cosmetics_catalog c ON c.id = uc.cosmetic_id WHERE uc.user_id = $1 ORDER BY c.category, c.name`, [id]),
        query(`SELECT g.id, g.name, g.tag, g.owner_id = $1 AS is_owner FROM guild_members m JOIN guilds g ON g.id = m.guild_id WHERE m.user_id = $1`, [id]),
        query(`SELECT current_streak, last_claimed_at FROM daily_streaks WHERE user_id = $1`, [id]),
        query(`SELECT COUNT(*)::int AS matches, COUNT(*) FILTER (WHERE winner_id = $1)::int AS wins FROM pvp_matches
               WHERE player1_id = $1 OR player2_id = $1`, [id]),
      ]);
      res.json({
        user: { ...u.rows[0], online: onlineIds().has(id) },
        stats: { ...stats.rows[0], pvp: pvp.rows[0] },
        recent: games.rows, cosmetics: cos.rows, guild: guild.rows[0] || null, streak: streak.rows[0] || null,
      });
    } catch (e) { fail(res, 'user', e); }
  });

  // Body: { cc_set | cc_delta, a_set | a_delta } — balances never go below zero.
  router.post('/users/:id/balance', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    const b = req.body || {};
    const ccSet = toInt(b.cc_set), ccDelta = toInt(b.cc_delta), aSet = toInt(b.a_set), aDelta = toInt(b.a_delta);
    if ([ccSet, ccDelta, aSet, aDelta].every((v) => v === null)) return res.status(400).json({ error: 'Nothing to change' });
    if ([ccSet, ccDelta, aSet, aDelta].some((v) => v !== null && !Number.isSafeInteger(v))) return res.status(400).json({ error: 'Amounts must be whole numbers' });
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const before = await client.query('SELECT username, cc_balance::text, a_balance::text FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (!before.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }
      const r = await client.query(
        `UPDATE users SET
           cc_balance = GREATEST(0, COALESCE($2::bigint, cc_balance + COALESCE($3::bigint, 0))),
           a_balance  = GREATEST(0, COALESCE($4::bigint, a_balance  + COALESCE($5::bigint, 0)))
         WHERE id = $1 RETURNING cc_balance::text, a_balance::text`,
        [id, ccSet, ccDelta, aSet, aDelta]
      );
      await log(req, 'balance', 'user', id, { username: before.rows[0].username, before: before.rows[0], after: r.rows[0], input: { ccSet, ccDelta, aSet, aDelta } }, client);
      await client.query('COMMIT');
      pushBalance(id, r.rows[0]);
      res.json(r.rows[0]);
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, 'balance', e); } finally { client.release(); }
  });

  router.get('/cosmetics', async (_req, res) => {
    try { res.json({ cosmetics: (await query('SELECT id, name, category, rarity, preview_key, is_obtainable FROM cosmetics_catalog ORDER BY category, rarity, name')).rows }); }
    catch (e) { fail(res, 'cosmetics', e); }
  });

  router.post('/users/:id/cosmetics', async (req, res) => {
    const id = req.params.id, cid = req.body?.cosmetic_id;
    if (!UUID.test(id) || !UUID.test(String(cid))) return res.status(400).json({ error: 'Bad id' });
    try {
      const r = await query(
        `INSERT INTO user_cosmetics (user_id, cosmetic_id, source) VALUES ($1, $2, 'admin')
         ON CONFLICT (user_id, cosmetic_id) DO NOTHING RETURNING id`, [id, cid]);
      if (!r.rows.length) return res.status(409).json({ error: 'They already own that' });
      await log(req, 'cosmetic_grant', 'user', id, { cosmetic_id: cid });
      res.json({ ok: true, user_cosmetic_id: r.rows[0].id });
    } catch (e) { fail(res, 'grant', e); }
  });

  router.delete('/users/:id/cosmetics/:ucid', async (req, res) => {
    const { id, ucid } = req.params;
    if (!UUID.test(id) || !UUID.test(ucid)) return res.status(400).json({ error: 'Bad id' });
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const sold = await client.query('SELECT 1 FROM shop_listings WHERE user_cosmetic_id = $1 AND sold_at IS NOT NULL LIMIT 1', [ucid]);
      if (sold.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'That item has shop sale history, so it can\'t be deleted' }); }
      await client.query('DELETE FROM shop_listings WHERE user_cosmetic_id = $1 AND sold_at IS NULL', [ucid]);
      const r = await client.query('DELETE FROM user_cosmetics WHERE id = $1 AND user_id = $2 RETURNING cosmetic_id', [ucid, id]);
      if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Not found' }); }
      await log(req, 'cosmetic_remove', 'user', id, { user_cosmetic_id: ucid, cosmetic_id: r.rows[0].cosmetic_id }, client);
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, 'cosmetic_remove', e); } finally { client.release(); }
  });

  router.post('/users/:id/streak/reset', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    try {
      await query('DELETE FROM daily_streaks WHERE user_id = $1', [id]);
      await log(req, 'streak_reset', 'user', id, {});
      res.json({ ok: true });
    } catch (e) { fail(res, 'streak', e); }
  });

  router.post('/users/:id/ban', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    if (id === req.admin.userId) return res.status(400).json({ error: 'You can\'t ban yourself' });
    const reason = String(req.body?.reason || '').trim().slice(0, 200) || null;
    try {
      const r = await query(
        `UPDATE users SET banned_at = NOW(), ban_reason = $2 WHERE id = $1 AND NOT is_admin RETURNING username`, [id, reason]);
      if (!r.rows.length) return res.status(400).json({ error: 'User not found, or they\'re an admin' });
      markBanned(id, true);
      await log(req, 'ban', 'user', id, { username: r.rows[0].username, reason });
      // kick them out right now
      io.to(`user:${id}`).emit('auth:error', { message: 'Account banned' });
      io.in(`user:${id}`).disconnectSockets(true);
      res.json({ ok: true });
    } catch (e) { fail(res, 'ban', e); }
  });

  router.post('/users/:id/unban', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    try {
      const r = await query('UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = $1 RETURNING username', [id]);
      if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
      markBanned(id, false);
      await log(req, 'unban', 'user', id, { username: r.rows[0].username });
      res.json({ ok: true });
    } catch (e) { fail(res, 'unban', e); }
  });

  // ── guilds ─────────────────────────────────────────────────────────────────
  router.get('/guilds', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      const r = await query(
        `SELECT g.id, g.name, g.tag, g.icon, g.icon_bg, g.fund_balance::text, g.unlocked, g.is_private, g.created_at,
                o.username AS owner, (SELECT COUNT(*)::int FROM guild_members m WHERE m.guild_id = g.id) AS members
         FROM guilds g JOIN users o ON o.id = g.owner_id
         WHERE $1 = '' OR g.name ILIKE '%' || $1 || '%' OR g.tag ILIKE '%' || $1 || '%'
         ORDER BY g.fund_balance DESC LIMIT 200`, [q]);
      res.json({ guilds: r.rows });
    } catch (e) { fail(res, 'guilds', e); }
  });

  router.get('/guilds/:id', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    try {
      const g = await query(
        `SELECT g.*, g.fund_balance::text AS fund_balance, o.username AS owner FROM guilds g JOIN users o ON o.id = g.owner_id WHERE g.id = $1`, [id]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      const m = await query(
        `SELECT u.id, u.username, u.cc_balance::text, m.joined_at, u.id = $2 AS is_owner FROM guild_members m JOIN users u ON u.id = m.user_id
         WHERE m.guild_id = $1 ORDER BY u.cc_balance DESC`, [id, g.rows[0].owner_id]);
      res.json({ guild: g.rows[0], members: m.rows });
    } catch (e) { fail(res, 'guild', e); }
  });

  router.patch('/guilds/:id', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    const { name, tag, description } = req.body || {};
    if (name !== undefined && !(String(name).trim().length >= 3 && String(name).trim().length <= 64)) return res.status(400).json({ error: 'Name must be 3–64 characters' });
    if (tag !== undefined && !/^[A-Za-z0-9]{2,8}$/.test(String(tag))) return res.status(400).json({ error: 'Tag must be 2–8 letters or digits' });
    try {
      const before = await query('SELECT name, tag, description FROM guilds WHERE id = $1', [id]);
      if (!before.rows.length) return res.status(404).json({ error: 'Guild not found' });
      const r = await query(
        `UPDATE guilds SET name = COALESCE($2, name), tag = COALESCE($3, tag), description = COALESCE($4, description)
         WHERE id = $1 RETURNING name, tag, description`,
        [id, name !== undefined ? String(name).trim() : null, tag !== undefined ? String(tag).toUpperCase() : null,
          description !== undefined ? String(description).slice(0, 256) : null]);
      await log(req, 'guild_edit', 'guild', id, { before: before.rows[0], after: r.rows[0] });
      res.json({ guild: r.rows[0] });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'That name or tag is taken' });
      fail(res, 'guild_edit', e);
    }
  });

  // Body: { set } or { delta }
  router.post('/guilds/:id/fund', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    const set = toInt(req.body?.set), delta = toInt(req.body?.delta);
    if (set === null && delta === null) return res.status(400).json({ error: 'Nothing to change' });
    try {
      const r = await query(
        `UPDATE guilds SET fund_balance = GREATEST(0, COALESCE($2::bigint, fund_balance + COALESCE($3::bigint, 0)))
         WHERE id = $1 RETURNING fund_balance::text, name`, [id, set, delta]);
      if (!r.rows.length) return res.status(404).json({ error: 'Guild not found' });
      await log(req, 'guild_fund', 'guild', id, { name: r.rows[0].name, set, delta, after: r.rows[0].fund_balance });
      res.json({ fund_balance: r.rows[0].fund_balance });
    } catch (e) { fail(res, 'guild_fund', e); }
  });

  router.delete('/guilds/:id/members/:uid', async (req, res) => {
    const { id, uid } = req.params;
    if (!UUID.test(id) || !UUID.test(uid)) return res.status(400).json({ error: 'Bad id' });
    try {
      const g = await query('SELECT owner_id FROM guilds WHERE id = $1', [id]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      if (g.rows[0].owner_id === uid) return res.status(400).json({ error: 'Can\'t kick the owner — disband instead' });
      const r = await query('DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2 RETURNING user_id', [id, uid]);
      if (!r.rows.length) return res.status(404).json({ error: 'Not a member' });
      await log(req, 'guild_kick', 'guild', id, { user_id: uid });
      res.json({ ok: true });
    } catch (e) { fail(res, 'guild_kick', e); }
  });

  router.post('/guilds/:id/disband', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const g = await client.query('SELECT name, tag FROM guilds WHERE id = $1', [id]);
      if (!g.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Guild not found' }); }
      for (const t of ['guild_join_requests', 'guild_fund_contributions', 'donations', 'guild_members']) {
        await client.query(`DELETE FROM ${t} WHERE guild_id = $1`, [id]);
      }
      await client.query('DELETE FROM guilds WHERE id = $1', [id]);
      await log(req, 'guild_disband', 'guild', id, g.rows[0], client);
      await client.query('COMMIT');
      io.to(`guild:${id}`).emit('guild:disbanded', { guild_id: id });
      res.json({ ok: true });
    } catch (e) { await client.query('ROLLBACK').catch(() => {}); fail(res, 'guild_disband', e); } finally { client.release(); }
  });

  // ── shop ───────────────────────────────────────────────────────────────────
  router.get('/listings', async (_req, res) => {
    try {
      const r = await query(
        `SELECT l.id, l.price_a, l.listed_at, u.username AS seller, u.id AS seller_id, c.name, c.category, c.rarity, c.preview_key
         FROM shop_listings l JOIN users u ON u.id = l.seller_id JOIN cosmetics_catalog c ON c.id = l.cosmetic_id
         WHERE l.sold_at IS NULL ORDER BY l.listed_at DESC LIMIT 300`);
      res.json({ listings: r.rows });
    } catch (e) { fail(res, 'listings', e); }
  });

  // Unsold listings never moved the item, so removing one leaves it with the seller.
  router.delete('/listings/:id', async (req, res) => {
    const id = req.params.id; if (!UUID.test(id)) return res.status(400).json({ error: 'Bad id' });
    try {
      const r = await query('DELETE FROM shop_listings WHERE id = $1 AND sold_at IS NULL RETURNING seller_id, cosmetic_id, price_a', [id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Listing not found or already sold' });
      await log(req, 'listing_remove', 'listing', id, r.rows[0]);
      res.json({ ok: true });
    } catch (e) { fail(res, 'listing_remove', e); }
  });

  // ── halls ──────────────────────────────────────────────────────────────────
  const HALL = { fame: 'hall_of_fame', shame: 'hall_of_shame' };
  router.get('/halls/:kind', async (req, res) => {
    const t = HALL[req.params.kind]; if (!t) return res.status(400).json({ error: 'fame or shame' });
    try {
      const r = await query(
        `SELECT h.id, h.trigger, h.amount::text, h.game, h.created_at, u.username FROM ${t} h JOIN users u ON u.id = h.user_id
         ORDER BY h.created_at DESC LIMIT 300`);
      res.json({ entries: r.rows });
    } catch (e) { fail(res, 'halls', e); }
  });
  router.delete('/halls/:kind/:id', async (req, res) => {
    const t = HALL[req.params.kind], id = req.params.id;
    if (!t || !UUID.test(id)) return res.status(400).json({ error: 'Bad request' });
    try {
      const r = await query(`DELETE FROM ${t} WHERE id = $1 RETURNING user_id, trigger, amount::text`, [id]);
      if (!r.rows.length) return res.status(404).json({ error: 'Entry not found' });
      await log(req, `hall_delete_${req.params.kind}`, 'hall', id, r.rows[0]);
      res.json({ ok: true });
    } catch (e) { fail(res, 'hall_delete', e); }
  });

  // ── database browser (read-only) ───────────────────────────────────────────
  async function tableInfo() {
    const r = await query(
      `SELECT c.table_name, c.column_name, c.data_type, c.ordinal_position,
              COALESCE(s.n_live_tup, 0)::bigint::text AS rows
       FROM information_schema.columns c
       LEFT JOIN pg_stat_user_tables s ON s.relname = c.table_name AND s.schemaname = c.table_schema
       WHERE c.table_schema = 'public' ORDER BY c.table_name, c.ordinal_position`);
    const tables = {};
    r.rows.forEach((x) => {
      const t = tables[x.table_name] || (tables[x.table_name] = { name: x.table_name, rows: x.rows, columns: [] });
      if (x.column_name !== 'password_hash') t.columns.push({ name: x.column_name, type: x.data_type });
    });
    return tables;
  }

  router.get('/db/tables', async (_req, res) => {
    try { res.json({ tables: Object.values(await tableInfo()) }); } catch (e) { fail(res, 'db_tables', e); }
  });

  router.get('/db/tables/:name', async (req, res) => {
    try {
      const tables = await tableInfo();
      const t = tables[req.params.name]; if (!t) return res.status(404).json({ error: 'No such table' });
      const cols = t.columns.map((c) => c.name);
      const sort = cols.includes(req.query.sort) ? req.query.sort : (cols.includes('created_at') ? 'created_at' : cols[0]);
      const dir = req.query.dir === 'asc' ? 'ASC' : 'DESC';
      const limit = clampLimit(req.query.limit, 50, 500), offset = Math.max(0, toInt(req.query.offset) || 0);
      const fcol = cols.includes(req.query.col) ? req.query.col : null;
      const fval = fcol ? String(req.query.val ?? '') : '';
      const where = fcol ? `WHERE "${fcol}"::text ILIKE '%' || $3 || '%'` : '';
      const select = cols.map((c) => `"${c}"`).join(', ');
      const params = fcol ? [limit, offset, fval] : [limit, offset];
      const [rows, count] = await Promise.all([
        query(`SELECT ${select} FROM "${t.name}" ${where} ORDER BY "${sort}" ${dir} NULLS LAST LIMIT $1 OFFSET $2`, params),
        query(`SELECT COUNT(*)::int AS n FROM "${t.name}" ${where.replace('$3', '$1')}`, fcol ? [fval] : []),
      ]);
      res.json({ table: t.name, columns: t.columns, rows: redactRows(rows.rows), total: count.rows[0].n, sort, dir: dir.toLowerCase() });
    } catch (e) { fail(res, 'db_rows', e); }
  });

  // Read-only SQL console: single statement (extended protocol), read-only transaction, 5s timeout, 500 rows.
  const READ_START = /^\s*(select|with|explain|show|table|values)\b/i;
  const DENY = /\b(pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_\w+|dblink\w*|set_config|pg_sleep\w*|copy|pg_advisory\w*)\b/i;
  router.post('/db/query', async (req, res) => {
    const sql = String(req.body?.sql || '').trim().replace(/;\s*$/, '');
    if (!sql) return res.status(400).json({ error: 'Empty query' });
    if (!READ_START.test(sql)) return res.status(400).json({ error: 'Read-only console: start with SELECT, WITH, EXPLAIN, SHOW, TABLE or VALUES' });
    if (DENY.test(sql)) return res.status(400).json({ error: 'That function isn\'t allowed here' });
    const bare = sql.replace(/'(?:[^']|'')*'|"(?:[^"]|"")*"|--[^\n]*|\/\*[\s\S]*?\*\//g, '');
    if (bare.includes(';')) return res.status(400).json({ error: 'One statement at a time' });
    const client = await getClient();
    const t0 = Date.now();
    try {
      await client.query('BEGIN TRANSACTION READ ONLY');
      await client.query("SET LOCAL statement_timeout = '5s'");
      const r = await client.query({ text: sql, queryMode: 'extended' }); // extended protocol => one statement only
      await client.query('ROLLBACK');
      const fields = (r.fields || []).map((f) => f.name).filter((n) => n !== 'password_hash');
      res.json({ fields, rows: redactRows((r.rows || []).slice(0, 500)), row_count: r.rowCount, truncated: (r.rows || []).length > 500, ms: Date.now() - t0 });
      await log(req, 'sql', 'db', null, { sql: sql.slice(0, 1000), rows: r.rowCount });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(400).json({ error: e.message });
    } finally { client.release(); }
  });

  // ── audit log ──────────────────────────────────────────────────────────────
  router.get('/log', async (req, res) => {
    try {
      const r = await query('SELECT id, admin_username, action, target_type, target_id, detail, created_at FROM admin_log ORDER BY created_at DESC LIMIT $1',
        [clampLimit(req.query.limit, 100, 500)]);
      res.json({ entries: r.rows });
    } catch (e) { fail(res, 'log', e); }
  });

  return router;
};
