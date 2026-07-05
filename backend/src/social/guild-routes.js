// Phase 8 — Guild REST endpoints.
// Exported as a factory taking `io` so handlers can emit socket events
// (guild:fund:update to the guild room, notification to a user room).
//
//   GET  /social/guilds                         list all (sorted by fund_balance DESC)
//   GET  /social/guilds/mine                    the viewer's current guild (or null)
//   GET  /social/guilds/:id                     detail: members + fund + viewer status
//   POST /social/guilds                         create
//   POST /social/guilds/:id/join                public → join; private → request
//   GET  /social/guilds/:id/requests            owner: list pending requests
//   POST /social/guilds/:id/requests/:rid/approve
//   POST /social/guilds/:id/requests/:rid/reject
//   POST /social/guilds/:id/leave               non-owner leaves
//   POST /social/guilds/:id/contribute          { amount }  (single txn, latches unlock at 15k)
//   POST /social/guilds/:id/donate              { to_user_id, amount }  (server computes 10% cut)
//
// Invariants honoured: fund contribution + CC debit are one transaction (#4);
// donation net/house-cut computed server-side from gross only (#5).

const FUND_GOAL = 15000;
const DONATE_CUT = 0.10;
const MAX_SENDS = 2;
const MAX_RECVS = 2;

module.exports = function makeGuildRouter(io) {
  const router = require('express').Router();
  const { requireAuth } = require('../auth/middleware');
  const { query, getClient } = require('../db');
  const { redis } = require('../redis');
  const { unlockAchievement, bumpChallengeProgress } = require('../progression');

  const notify = (userId, payload) => {
    try { io.to(`user:${userId}`).emit('notification', payload); } catch { /* noop */ }
  };
  const pct = (fund) => Math.min(100, Math.round((Number(fund) / FUND_GOAL) * 100));

  async function getMyGuild(userId) {
    const r = await query(
      `SELECT g.* FROM guilds g JOIN guild_members gm ON gm.guild_id = g.id WHERE gm.user_id = $1`,
      [userId]
    );
    return r.rows[0] || null;
  }

  // ── GET /guilds — list all, richest fund first ─────────────────────────────
  router.get('/guilds', requireAuth, async (_req, res) => {
    try {
      const r = await query(
        `SELECT g.id, g.name, g.tag, g.description, g.is_private, g.fund_balance,
                g.unlocked, g.owner_id, COUNT(gm.user_id)::int AS member_count
         FROM guilds g LEFT JOIN guild_members gm ON gm.guild_id = g.id
         GROUP BY g.id
         ORDER BY g.fund_balance DESC, member_count DESC, g.created_at ASC`
      );
      res.json({
        guilds: r.rows.map((g) => ({
          id: g.id, name: g.name, tag: g.tag, description: g.description,
          is_private: g.is_private, fund_balance: Number(g.fund_balance),
          unlocked: g.unlocked, owner_id: g.owner_id, member_count: g.member_count,
          progress_pct: pct(g.fund_balance),
        })),
      });
    } catch (err) {
      console.error('[guilds/list]', err.message);
      res.status(500).json({ error: 'Failed to load guilds' });
    }
  });

  // ── GET /guilds/mine — declared before /:id so 'mine' isn't captured ───────
  router.get('/guilds/mine', requireAuth, async (req, res) => {
    try {
      const g = await getMyGuild(req.user.userId);
      if (!g) return res.json({ guild: null });
      res.json({
        guild: {
          id: g.id, name: g.name, tag: g.tag, unlocked: g.unlocked,
          fund_balance: Number(g.fund_balance), progress_pct: pct(g.fund_balance),
          is_owner: g.owner_id === req.user.userId,
        },
      });
    } catch (err) {
      console.error('[guilds/mine]', err.message);
      res.status(500).json({ error: 'Failed to load your guild' });
    }
  });

  // ── GET /guilds/:id — full detail ──────────────────────────────────────────
  router.get('/guilds/:id', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    try {
      const gr = await query(`SELECT * FROM guilds WHERE id = $1`, [guildId]);
      if (!gr.rows.length) return res.status(404).json({ error: 'Guild not found' });
      const g = gr.rows[0];

      const mr = await query(
        `SELECT gm.user_id, gm.joined_at, gm.donations_recv_today, gm.last_donation_reset,
                u.username, u.cc_balance,
                COALESCE(json_agg(json_build_object(
                  'category', cc.category, 'rarity', cc.rarity, 'preview_key', cc.preview_key
                )) FILTER (WHERE uc.id IS NOT NULL), '[]') AS cosmetics
         FROM guild_members gm
         JOIN users u ON u.id = gm.user_id
         LEFT JOIN user_cosmetics uc    ON uc.user_id = u.id AND uc.is_equipped = TRUE
         LEFT JOIN cosmetics_catalog cc ON cc.id = uc.cosmetic_id
         WHERE gm.guild_id = $1
         GROUP BY gm.user_id, gm.joined_at, gm.donations_recv_today, gm.last_donation_reset, u.username, u.cc_balance
         ORDER BY u.cc_balance DESC`,
        [guildId]
      );

      // Presence: one guarded batch call. Online dots are cosmetic, so a Redis
      // hiccup must never fail the whole page — worst case everyone shows offline.
      const today = new Date().toISOString().slice(0, 10);
      const onlineSet = new Set();
      try {
        const keys = mr.rows.map((m) => `presence:${m.user_id}`);
        if (keys.length) {
          const vals = await redis.mget(...keys);
          mr.rows.forEach((m, i) => { if (vals[i] != null) onlineSet.add(m.user_id); });
        }
      } catch (e) {
        console.warn('[guilds/detail] presence lookup skipped:', e.message);
      }

      const members = mr.rows.map((m) => ({
        user_id: m.user_id,
        username: m.username,
        cc_balance: Number(m.cc_balance),
        cosmetics: m.cosmetics,
        joined_at: m.joined_at,
        donations_today: String(m.last_donation_reset).slice(0, 10) < today ? 0 : m.donations_recv_today,
        is_owner: m.user_id === g.owner_id,
        online: onlineSet.has(m.user_id),
      }));

      const isOwner = g.owner_id === req.user.userId;
      const isMember = members.some((m) => m.user_id === req.user.userId);
      let pendingCount = 0;
      if (isOwner) {
        const pc = await query(
          `SELECT COUNT(*)::int AS c FROM guild_join_requests WHERE guild_id = $1 AND status = 'pending'`,
          [guildId]
        );
        pendingCount = pc.rows[0].c;
      }

      res.json({
        guild: {
          id: g.id, name: g.name, tag: g.tag, description: g.description,
          is_private: g.is_private, fund_balance: Number(g.fund_balance),
          unlocked: g.unlocked, owner_id: g.owner_id, progress_pct: pct(g.fund_balance),
          members, member_count: members.length,
          is_member: isMember, is_owner: isOwner, pending_count: pendingCount,
        },
      });
    } catch (err) {
      console.error('[guilds/detail]', err.message);
      res.status(500).json({ error: 'Failed to load guild' });
    }
  });

  // ── POST /guilds — create ──────────────────────────────────────────────────
  router.post('/guilds', requireAuth, async (req, res) => {
    const { name, tag, description, is_private } = req.body || {};
    if (!name || !tag) return res.status(400).json({ error: 'Name and tag are required' });
    if (String(name).length > 64) return res.status(400).json({ error: 'Name too long (max 64)' });
    if (String(tag).length > 8)   return res.status(400).json({ error: 'Tag too long (max 8)' });

    const existing = await getMyGuild(req.user.userId);
    if (existing) return res.status(409).json({ error: 'You are already in a guild' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const gr = await client.query(
        `INSERT INTO guilds (name, tag, description, owner_id, is_private)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [name, tag, description || null, req.user.userId, !!is_private]
      );
      const guildId = gr.rows[0].id;
      await client.query(
        `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2)`,
        [guildId, req.user.userId]
      );
      await unlockAchievement(client, req.user.userId, 15);       // Guild Founder
      await bumpChallengeProgress(client, req.user.userId, 5, 1); // Guild Member (creating counts)
      await client.query('COMMIT');
      res.json({ guild_id: guildId });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if (e.code === '23505') return res.status(409).json({ error: 'That name or tag is already taken' });
      console.error('[guilds/create]', e.message);
      res.status(500).json({ error: 'Failed to create guild' });
    } finally {
      client.release();
    }
  });

  // ── POST /guilds/:id/join ──────────────────────────────────────────────────
  router.post('/guilds/:id/join', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    try {
      const existing = await getMyGuild(req.user.userId);
      if (existing) return res.status(409).json({ error: 'You are already in a guild' });

      const gr = await query(`SELECT id, name, is_private, owner_id FROM guilds WHERE id = $1`, [guildId]);
      if (!gr.rows.length) return res.status(404).json({ error: 'Guild not found' });
      const g = gr.rows[0];

      if (g.is_private) {
        await query(
          `INSERT INTO guild_join_requests (guild_id, user_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (guild_id, user_id)
           DO UPDATE SET status = 'pending', created_at = NOW(), resolved_at = NULL, resolved_by = NULL`,
          [guildId, req.user.userId]
        );
        notify(g.owner_id, {
          type: 'guild_request',
          title: 'New join request',
          text: `${req.user.username} wants to join ${g.name}.`,
          guild_id: guildId,
        });
        return res.json({ status: 'requested' });
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [guildId, req.user.userId]
        );
        await bumpChallengeProgress(client, req.user.userId, 5, 1); // Guild Member
        await client.query('COMMIT');
        res.json({ status: 'joined' });
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[guilds/join]', e.message);
        res.status(500).json({ error: 'Failed to join guild' });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[guilds/join outer]', err.message);
      res.status(500).json({ error: 'Failed to join guild' });
    }
  });

  // ── GET /guilds/:id/requests — owner only ──────────────────────────────────
  router.get('/guilds/:id/requests', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    try {
      const g = await query(`SELECT owner_id FROM guilds WHERE id = $1`, [guildId]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      if (g.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });
      const r = await query(
        `SELECT jr.id, jr.user_id, jr.created_at, u.username
         FROM guild_join_requests jr JOIN users u ON u.id = jr.user_id
         WHERE jr.guild_id = $1 AND jr.status = 'pending'
         ORDER BY jr.created_at ASC`,
        [guildId]
      );
      res.json({ requests: r.rows });
    } catch (err) {
      console.error('[guilds/requests]', err.message);
      res.status(500).json({ error: 'Failed to load requests' });
    }
  });

  // ── POST /guilds/:id/requests/:rid/approve — owner only ────────────────────
  router.post('/guilds/:id/requests/:rid/approve', requireAuth, async (req, res) => {
    const { id: guildId, rid } = req.params;
    const g = await query(`SELECT owner_id, name FROM guilds WHERE id = $1`, [guildId]);
    if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
    if (g.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const jr = await client.query(
        `SELECT user_id FROM guild_join_requests
         WHERE id = $1 AND guild_id = $2 AND status = 'pending' FOR UPDATE`,
        [rid, guildId]
      );
      if (!jr.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Request not found' }); }
      const targetUser = jr.rows[0].user_id;

      const inGuild = await client.query(`SELECT 1 FROM guild_members WHERE user_id = $1`, [targetUser]);
      if (inGuild.rows.length) {
        await client.query(
          `UPDATE guild_join_requests SET status = 'rejected', resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
          [req.user.userId, rid]
        );
        await client.query('COMMIT');
        return res.status(409).json({ error: 'That user already joined another guild' });
      }

      await client.query(
        `INSERT INTO guild_members (guild_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [guildId, targetUser]
      );
      await client.query(
        `UPDATE guild_join_requests SET status = 'approved', resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
        [req.user.userId, rid]
      );
      await bumpChallengeProgress(client, targetUser, 5, 1); // Guild Member
      await client.query('COMMIT');

      notify(targetUser, {
        type: 'guild_approved',
        title: 'Request approved',
        text: `You're now a member of ${g.rows[0].name}.`,
        guild_id: guildId,
      });
      res.json({ status: 'approved' });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[guilds/approve]', e.message);
      res.status(500).json({ error: 'Failed to approve request' });
    } finally {
      client.release();
    }
  });

  // ── POST /guilds/:id/requests/:rid/reject — owner only ─────────────────────
  router.post('/guilds/:id/requests/:rid/reject', requireAuth, async (req, res) => {
    const { id: guildId, rid } = req.params;
    try {
      const g = await query(`SELECT owner_id, name FROM guilds WHERE id = $1`, [guildId]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      if (g.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });

      const r = await query(
        `UPDATE guild_join_requests
         SET status = 'rejected', resolved_at = NOW(), resolved_by = $1
         WHERE id = $2 AND guild_id = $3 AND status = 'pending'
         RETURNING user_id`,
        [req.user.userId, rid, guildId]
      );
      if (!r.rows.length) return res.status(404).json({ error: 'Request not found' });
      notify(r.rows[0].user_id, {
        type: 'guild_rejected',
        title: 'Request declined',
        text: `Your request to join ${g.rows[0].name} was declined.`,
        guild_id: guildId,
      });
      res.json({ status: 'rejected' });
    } catch (err) {
      console.error('[guilds/reject]', err.message);
      res.status(500).json({ error: 'Failed to reject request' });
    }
  });

  // ── POST /guilds/:id/leave — non-owner only ────────────────────────────────
  router.post('/guilds/:id/leave', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    try {
      const g = await query(`SELECT owner_id FROM guilds WHERE id = $1`, [guildId]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      if (g.rows[0].owner_id === req.user.userId) {
        return res.status(400).json({ error: 'Owner cannot leave — transfer or disband (coming soon)' });
      }
      await query(`DELETE FROM guild_members WHERE guild_id = $1 AND user_id = $2`, [guildId, req.user.userId]);
      res.json({ status: 'left' });
    } catch (err) {
      console.error('[guilds/leave]', err.message);
      res.status(500).json({ error: 'Failed to leave guild' });
    }
  });

  // ── POST /guilds/:id/contribute — single transaction, latches unlock ───────
  router.post('/guilds/:id/contribute', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const amount = Math.floor(Number(req.body?.amount));
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const mem = await client.query(
        `SELECT 1 FROM guild_members WHERE guild_id = $1 AND user_id = $2`,
        [guildId, req.user.userId]
      );
      if (!mem.rows.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Not a member of this guild' }); }

      // Debit CC (guarded — never goes negative)
      const debit = await client.query(
        `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
        [amount, req.user.userId]
      );
      if (!debit.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient CC' }); }

      // Credit fund + latch unlock (SET uses OLD row values → old+amount = new total).
      // Contributions never cap — members keep pouring past 15k for flex.
      const gr = await client.query(
        `UPDATE guilds
         SET fund_balance = fund_balance + $1,
             unlocked = ((fund_balance + $1) >= $3) OR unlocked
         WHERE id = $2
         RETURNING fund_balance, unlocked`,
        [amount, guildId, FUND_GOAL]
      );
      await client.query(
        `INSERT INTO guild_fund_contributions (guild_id, user_id, amount) VALUES ($1, $2, $3)`,
        [guildId, req.user.userId, amount]
      );
      await client.query('COMMIT');

      const fund = Number(gr.rows[0].fund_balance);
      const unlocked = gr.rows[0].unlocked;
      io.to(`guild:${guildId}`).emit('guild:fund:update', { guild_id: guildId, fund_balance: fund, unlocked });
      res.json({ fund_balance: fund, unlocked, cc_balance: Number(debit.rows[0].cc_balance) });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[guilds/contribute]', e.message);
      res.status(500).json({ error: 'Failed to contribute' });
    } finally {
      client.release();
    }
  });

  // ── POST /guilds/:id/donate — server computes 10% cut; 2 sends/2 recvs a day ─
  router.post('/guilds/:id/donate', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const senderId = req.user.userId;
    const receiverId = req.body?.to_user_id;
    const gross = Math.floor(Number(req.body?.amount));

    if (!receiverId) return res.status(400).json({ error: 'Recipient required' });
    if (receiverId === senderId) return res.status(400).json({ error: 'Cannot donate to yourself' });
    if (!Number.isFinite(gross) || gross <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const gr = await client.query(`SELECT unlocked FROM guilds WHERE id = $1`, [guildId]);
      if (!gr.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Guild not found' }); }
      if (!gr.rows[0].unlocked) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Guild is not unlocked yet' }); }

      const sender = await client.query(
        `SELECT donations_sent_today, donations_recv_today, last_donation_reset
         FROM guild_members WHERE guild_id = $1 AND user_id = $2 FOR UPDATE`,
        [guildId, senderId]
      );
      const receiver = await client.query(
        `SELECT donations_sent_today, donations_recv_today, last_donation_reset
         FROM guild_members WHERE guild_id = $1 AND user_id = $2 FOR UPDATE`,
        [guildId, receiverId]
      );
      if (!sender.rows.length || !receiver.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Both players must be in this guild' });
      }

      // Lazy daily reset: if last_donation_reset < today, both counters are 0.
      const today = new Date().toISOString().slice(0, 10);
      const sStale = String(sender.rows[0].last_donation_reset).slice(0, 10) < today;
      const rStale = String(receiver.rows[0].last_donation_reset).slice(0, 10) < today;
      const senderSent = sStale ? 0 : sender.rows[0].donations_sent_today;
      const senderRecv = sStale ? 0 : sender.rows[0].donations_recv_today;
      const recvSent   = rStale ? 0 : receiver.rows[0].donations_sent_today;
      const recvRecv   = rStale ? 0 : receiver.rows[0].donations_recv_today;

      if (senderSent >= MAX_SENDS) { await client.query('ROLLBACK'); return res.status(429).json({ error: 'Daily send limit reached (2)' }); }
      if (recvRecv   >= MAX_RECVS) { await client.query('ROLLBACK'); return res.status(429).json({ error: 'Recipient reached their daily receive limit (2)' }); }

      const debit = await client.query(
        `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
        [gross, senderId]
      );
      if (!debit.rows.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Insufficient CC' }); }

      const net = Math.floor(gross * (1 - DONATE_CUT));
      const houseCut = gross - net;
      await client.query(`UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2`, [net, receiverId]);

      // Persist counters with the lazy reset applied
      await client.query(
        `UPDATE guild_members SET donations_sent_today = $1, donations_recv_today = $2, last_donation_reset = CURRENT_DATE
         WHERE guild_id = $3 AND user_id = $4`,
        [senderSent + 1, senderRecv, guildId, senderId]
      );
      await client.query(
        `UPDATE guild_members SET donations_sent_today = $1, donations_recv_today = $2, last_donation_reset = CURRENT_DATE
         WHERE guild_id = $3 AND user_id = $4`,
        [recvSent, recvRecv + 1, guildId, receiverId]
      );

      await client.query(
        `INSERT INTO donations (sender_id, receiver_id, guild_id, gross_amount, net_amount, house_cut)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [senderId, receiverId, guildId, gross, net, houseCut]
      );

      // Progression: Donator (10 distinct receivers) / Generous (20 distinct senders)
      const dRecv = await client.query(
        `SELECT COUNT(DISTINCT receiver_id)::int AS c FROM donations WHERE sender_id = $1`, [senderId]
      );
      await bumpChallengeProgress(client, senderId, 14, dRecv.rows[0].c); // Donator (target 10)
      const dSend = await client.query(
        `SELECT COUNT(DISTINCT sender_id)::int AS c FROM donations WHERE receiver_id = $1`, [receiverId]
      );
      if (dSend.rows[0].c >= 20) await unlockAchievement(client, receiverId, 16); // Generous

      await client.query('COMMIT');

      // Postgres counters are authoritative; Redis is a belt-and-suspenders mirror.
      const rlKey = `ratelimit:donate:${senderId}:${today}`;
      redis.incr(rlKey).then((c) => { if (c === 1) redis.expire(rlKey, 86400).catch(() => {}); }).catch(() => {});

      notify(receiverId, {
        type: 'donation',
        title: 'You received a donation',
        text: `${req.user.username} sent you ${net.toLocaleString('en-US')} CC.`,
        amount: net,
      });
      res.json({ net, house_cut: houseCut, cc_balance: Number(debit.rows[0].cc_balance) });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[guilds/donate]', e.message);
      res.status(500).json({ error: 'Failed to donate' });
    } finally {
      client.release();
    }
  });

  // ── PATCH /guilds/:id — owner edits name/tag/description/privacy ────────────
  router.patch('/guilds/:id', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const { name, tag, description, is_private } = req.body || {};
    try {
      const g = await query(`SELECT owner_id FROM guilds WHERE id = $1`, [guildId]);
      if (!g.rows.length) return res.status(404).json({ error: 'Guild not found' });
      if (g.rows[0].owner_id !== req.user.userId) return res.status(403).json({ error: 'Owner only' });

      if (name !== undefined && (!name || String(name).length > 64)) return res.status(400).json({ error: 'Name must be 1–64 chars' });
      if (tag !== undefined && (!tag || String(tag).length > 8)) return res.status(400).json({ error: 'Tag must be 1–8 chars' });

      const sets = [];
      const vals = [];
      let i = 1;
      if (name !== undefined)        { sets.push(`name = $${i++}`);        vals.push(name); }
      if (tag !== undefined)         { sets.push(`tag = $${i++}`);         vals.push(tag); }
      if (description !== undefined) { sets.push(`description = $${i++}`);  vals.push(description || null); }
      if (is_private !== undefined)  { sets.push(`is_private = $${i++}`);   vals.push(!!is_private); }
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

      vals.push(guildId);
      const upd = await query(
        `UPDATE guilds SET ${sets.join(', ')} WHERE id = $${i}
         RETURNING id, name, tag, description, is_private`,
        vals
      );
      res.json({ guild: upd.rows[0] });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'That name or tag is already taken' });
      console.error('[guilds/patch]', e.message);
      res.status(500).json({ error: 'Failed to update guild' });
    }
  });

  // ── POST /guilds/:id/disband — owner deletes the guild ─────────────────────
  router.post('/guilds/:id/disband', requireAuth, async (req, res) => {
    const guildId = req.params.id;
    const client = await getClient();
    try {
      const g = await client.query(`SELECT owner_id FROM guilds WHERE id = $1`, [guildId]);
      if (!g.rows.length) { client.release(); return res.status(404).json({ error: 'Guild not found' }); }
      if (g.rows[0].owner_id !== req.user.userId) { client.release(); return res.status(403).json({ error: 'Owner only' }); }

      await client.query('BEGIN');
      // Explicit dependent deletes so this works regardless of FK cascade config.
      await client.query(`DELETE FROM guild_join_requests WHERE guild_id = $1`, [guildId]);
      await client.query(`DELETE FROM guild_fund_contributions WHERE guild_id = $1`, [guildId]);
      await client.query(`DELETE FROM donations WHERE guild_id = $1`, [guildId]);
      await client.query(`DELETE FROM guild_members WHERE guild_id = $1`, [guildId]);
      await client.query(`DELETE FROM guilds WHERE id = $1`, [guildId]);
      await client.query('COMMIT');

      io.to(`guild:${guildId}`).emit('guild:disbanded', { guild_id: guildId });
      res.json({ status: 'disbanded' });
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[guilds/disband]', e.message);
      res.status(500).json({ error: 'Failed to disband guild' });
    } finally {
      client.release();
    }
  });

  return router;
};
