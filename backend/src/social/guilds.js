// Phase 7 — Guilds: chat, fund contributions, donations, member actions
// Socket events: guild:chat:send, guild:chat:message, guild:chat:history,
//                guild:member:online, guild:fund:update
// REST: POST /social/guilds, POST /social/guilds/:id/join,
//       POST /social/guilds/:id/contribute, POST /social/guilds/:id/donate
//
// Guild chat uses Redis with 24h TTL per message (architecture.md)
// Donation: 10% house cut, max 2 sends AND 2 receives per day per member
//
// TODO (Phase 7 progression hooks, see backend/src/progression/index.js):
//   - On guild creation: unlockAchievement(client, ownerId, 15)            // Guild Founder
//   - On donation received: bumpChallengeProgress(client, receiverId, 5, 1) // Guild Member (one-time, on first join — not here)
//   - Generous (achievement 16) and Donator (challenge 14) both need a count
//     of *distinct* senders/receivers, not just a running total — track that
//     separately (e.g. COUNT(DISTINCT sender_id) from the donations table)
//     rather than reusing bumpChallengeProgress's simple counter pattern.

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerGuildHandlers(_io, _socket) {
  // Phase 7
}

module.exports = registerGuildHandlers;
