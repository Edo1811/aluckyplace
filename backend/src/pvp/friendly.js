// Phase 8 — Friendly (guild) matches: a direct challenge between two members
// of the same UNLOCKED guild that bypasses matchmaking and the 35% bet cap.
//
// Flow:
//   challenger  -> friendly:challenge { opponent_id, game, bet }
//   server      -> friendly:invite    (to opponent)  /  friendly:sent (to challenger)
//   opponent    -> friendly:accept { challenge_id }  |  friendly:decline { challenge_id }
//   server      -> friendly:launch { friendly_id, game, bet } (to BOTH)
//   both clients navigate to the queue-less matchmaking screen, then:
//   client      -> friendly:enter { friendly_id }
//   server (once BOTH entered) -> launchFriendlyMatch() -> normal pvp:* start flow
//
// The enter-handshake guarantees both clients are mounted and listening for
// pvp:matched/pvp:start before the match is created, so there's no race.

const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');
const mm = require('./matchmaking');

// Client-facing game ids (used for navigation) → engine ids (used by startGame).
// Higher-or-Lower is 'highlow' on the client but 'higherlow' in the engine.
const CLIENT_GAMES = new Set(['coinflip', 'rps', 'uno', 'highlow', 'duels']);
const ENGINE_GAME = { highlow: 'higherlow' };
const engineId = (g) => ENGINE_GAME[g] || g;

const CHALLENGE_TTL = 30000; // invite expires
const ENTER_TTL = 15000;     // both must land on the match screen

const challenges = new Map(); // challengeId -> { fromId, fromName, toId, game, bet, timer }
const sessions = new Map();   // friendlyId  -> { p1, p2, game, bet, entered:Set, timer }

async function sameUnlockedGuild(a, b) {
  const r = await query(
    `SELECT gm1.guild_id
     FROM guild_members gm1
     JOIN guild_members gm2 ON gm1.guild_id = gm2.guild_id
     JOIN guilds g ON g.id = gm1.guild_id
     WHERE gm1.user_id = $1 AND gm2.user_id = $2 AND g.unlocked = TRUE`,
    [a, b]
  );
  return r.rows.length > 0;
}

async function userInfo(userId) {
  const r = await query(`SELECT username, cc_balance FROM users WHERE id = $1`, [userId]);
  if (!r.rows.length) return null;
  return { username: r.rows[0].username, ccBalance: Number(r.rows[0].cc_balance) };
}

function registerFriendlyHandlers(io, socket) {
  if (!socket.user) return;
  const meId = socket.user.userId;
  const meName = socket.user.username;

  // ── challenge ────────────────────────────────────────────────────────────
  socket.on('friendly:challenge', async ({ opponent_id, game, bet } = {}) => {
    try {
      bet = Math.floor(Number(bet));
      if (!CLIENT_GAMES.has(game)) return socket.emit('friendly:error', { message: 'Pick a valid game' });
      if (!opponent_id || opponent_id === meId) return socket.emit('friendly:error', { message: 'Invalid opponent' });
      if (!Number.isFinite(bet) || bet < 10) return socket.emit('friendly:error', { message: 'Minimum bet is 10 CC' });
      if (mm.isBusy(meId) || mm.isBusy(opponent_id)) return socket.emit('friendly:error', { message: 'One of you is already in a match' });
      if (!(await sameUnlockedGuild(meId, opponent_id))) return socket.emit('friendly:error', { message: 'You must be in the same unlocked guild' });

      const me = await userInfo(meId);
      const opp = await userInfo(opponent_id);
      if (!opp) return socket.emit('friendly:error', { message: 'Opponent not found' });
      if (me.ccBalance < bet) return socket.emit('friendly:error', { message: "You can't cover that bet" });
      if (opp.ccBalance < bet) return socket.emit('friendly:error', { message: "They can't cover that bet" });

      const oppSocket = mm.userSocket.get(opponent_id);
      if (!oppSocket) return socket.emit('friendly:error', { message: "They're offline" });

      const challengeId = uuidv4();
      const timer = setTimeout(() => {
        if (challenges.delete(challengeId)) socket.emit('friendly:cancelled', { reason: 'expired' });
      }, CHALLENGE_TTL);
      challenges.set(challengeId, { fromId: meId, fromName: meName, toId: opponent_id, game, bet, timer });

      oppSocket.emit('friendly:invite', { challenge_id: challengeId, from_username: meName, game, bet });
      socket.emit('friendly:sent', { challenge_id: challengeId, game, bet, opponent: opp.username });
    } catch (e) {
      console.error('[friendly:challenge]', e.message);
      socket.emit('friendly:error', { message: 'Could not send challenge' });
    }
  });

  // ── decline ──────────────────────────────────────────────────────────────
  socket.on('friendly:decline', ({ challenge_id } = {}) => {
    const ch = challenges.get(challenge_id);
    if (!ch || ch.toId !== meId) return;
    clearTimeout(ch.timer);
    challenges.delete(challenge_id);
    const fromSocket = mm.userSocket.get(ch.fromId);
    if (fromSocket) fromSocket.emit('friendly:declined', { by: meName });
  });

  // ── accept ───────────────────────────────────────────────────────────────
  socket.on('friendly:accept', async ({ challenge_id } = {}) => {
    try {
      const ch = challenges.get(challenge_id);
      if (!ch || ch.toId !== meId) return socket.emit('friendly:error', { message: 'That challenge expired' });
      clearTimeout(ch.timer);
      challenges.delete(challenge_id);

      if (mm.isBusy(ch.fromId) || mm.isBusy(ch.toId)) return socket.emit('friendly:error', { message: 'Someone is already in a match' });
      const from = await userInfo(ch.fromId);
      const to = await userInfo(ch.toId);
      if (!from || !to || from.ccBalance < ch.bet || to.ccBalance < ch.bet)
        return socket.emit('friendly:error', { message: 'Someone can no longer cover the bet' });

      const fromSocket = mm.userSocket.get(ch.fromId);
      const toSocket = mm.userSocket.get(ch.toId);
      if (!fromSocket || !toSocket) return socket.emit('friendly:error', { message: 'Opponent went offline' });

      const friendlyId = uuidv4();
      const session = {
        friendlyId, game: ch.game, bet: ch.bet,
        p1: { userId: ch.fromId, username: from.username },
        p2: { userId: ch.toId, username: to.username },
        entered: new Set(),
        timer: null,
      };
      session.timer = setTimeout(() => {
        if (sessions.delete(friendlyId)) {
          [fromSocket, toSocket].forEach((s) => s && s.emit('friendly:cancelled', { reason: 'timeout' }));
        }
      }, ENTER_TTL);
      sessions.set(friendlyId, session);

      // Both go to the queue-less matchmaking screen (client game id for nav).
      [fromSocket, toSocket].forEach((s) => s && s.emit('friendly:launch', { friendly_id: friendlyId, game: ch.game, bet: ch.bet }));
    } catch (e) {
      console.error('[friendly:accept]', e.message);
      socket.emit('friendly:error', { message: 'Could not start the match' });
    }
  });

  // ── enter (client is mounted & listening) ─────────────────────────────────
  socket.on('friendly:enter', async ({ friendly_id } = {}) => {
    try {
      const session = sessions.get(friendly_id);
      if (!session) return;
      if (meId !== session.p1.userId && meId !== session.p2.userId) return;
      session.entered.add(meId);
      if (session.entered.size < 2) return;

      clearTimeout(session.timer);
      sessions.delete(friendly_id);

      const b1 = await userInfo(session.p1.userId);
      const b2 = await userInfo(session.p2.userId);
      if (!b1 || !b2 || b1.ccBalance < session.bet || b2.ccBalance < session.bet) {
        [session.p1.userId, session.p2.userId].forEach((uid) => {
          const s = mm.userSocket.get(uid);
          if (s) s.emit('friendly:cancelled', { reason: 'insufficient' });
        });
        return;
      }
      const p1 = { userId: session.p1.userId, username: b1.username, ccBalance: b1.ccBalance };
      const p2 = { userId: session.p2.userId, username: b2.username, ccBalance: b2.ccBalance };
      mm.launchFriendlyMatch(io, engineId(session.game), p1, p2, session.bet);
    } catch (e) {
      console.error('[friendly:enter]', e.message);
    }
  });
}

module.exports = registerFriendlyHandlers;
