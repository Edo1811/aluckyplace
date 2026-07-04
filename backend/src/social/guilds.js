// Phase 8 — Guild socket handlers: presence, chat, room membership.
// Registered once per socket from index.js (the auth guard there prevents
// the duplicate-listener stacking that bit us in the game modules).
//
// REST guild mutations (create/join/contribute/donate/approve) live in
// social/guild-routes.js. Fund/donation broadcasts are emitted from there.
//
// Events:
//   C→S guild:enter        — join your guild room, get presence + history
//   C→S guild:chat:send    { text }
//   S→C guild:chat:message { message_id, username, text, ts }
//   S→C guild:chat:history { messages: [...] }   (only if guild unlocked)
//   S→C guild:member:online{ user_id, online }
//   S→C guild:fund:update  { guild_id, fund_balance, unlocked }  (from guild-routes)

const { query } = require('../db');
const { redis } = require('../redis');
const { v4: uuidv4 } = require('uuid');

const CHAT_TTL = 60 * 60 * 24; // 24h, per architecture.md
const CHAT_MAX = 50;

async function membershipInfo(userId) {
  const r = await query(
    `SELECT g.id, g.unlocked
     FROM guilds g JOIN guild_members gm ON gm.guild_id = g.id
     WHERE gm.user_id = $1`,
    [userId]
  );
  return r.rows[0] || null;
}

function registerGuildHandlers(io, socket) {
  if (!socket.user) return;
  const { userId, username } = socket.user;

  // Mark online (best-effort; guild member lists read presence:{id})
  redis.set(`presence:${userId}`, '1').catch(() => {});

  socket.on('guild:enter', async () => {
    try {
      const info = await membershipInfo(userId);
      if (!info) return;
      const room = `guild:${info.id}`;
      socket.join(room);
      socket.data.guildId = info.id;
      io.to(room).emit('guild:member:online', { user_id: userId, online: true });

      if (info.unlocked) {
        const raw = await redis.lrange(`guild:chat:${info.id}`, 0, CHAT_MAX - 1);
        const messages = (raw || [])
          .map((x) => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } })
          .filter(Boolean)
          .reverse(); // lpush stores newest-first; reverse → chronological
        socket.emit('guild:chat:history', { messages });
      }
    } catch (e) {
      console.error('[guild:enter]', e.message);
    }
  });

  socket.on('guild:chat:send', async ({ text } = {}) => {
    try {
      if (!text || !String(text).trim()) return;
      const info = await membershipInfo(userId);
      if (!info || !info.unlocked) return; // chat gated on the 15k unlock
      const msg = {
        message_id: uuidv4(),
        username,
        text: String(text).slice(0, 500),
        ts: Date.now(),
      };
      const key = `guild:chat:${info.id}`;
      await redis.lpush(key, JSON.stringify(msg));
      await redis.ltrim(key, 0, CHAT_MAX - 1);
      await redis.expire(key, CHAT_TTL);
      io.to(`guild:${info.id}`).emit('guild:chat:message', msg);
    } catch (e) {
      console.error('[guild:chat:send]', e.message);
    }
  });

  socket.on('disconnect', () => {
    redis.del(`presence:${userId}`).catch(() => {});
    if (socket.data && socket.data.guildId) {
      io.to(`guild:${socket.data.guildId}`).emit('guild:member:online', { user_id: userId, online: false });
    }
  });
}

module.exports = registerGuildHandlers;
