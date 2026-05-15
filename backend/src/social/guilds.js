// Phase 7 — Guilds: chat, fund contributions, donations, member actions
// Socket events: guild:chat:send, guild:chat:message, guild:chat:history,
//                guild:member:online, guild:fund:update
// REST: POST /social/guilds, POST /social/guilds/:id/join,
//       POST /social/guilds/:id/contribute, POST /social/guilds/:id/donate
//
// Guild chat uses Redis with 24h TTL per message (architecture.md)
// Donation: 10% house cut, max 2 sends AND 2 receives per day per member

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerGuildHandlers(_io, _socket) {
  // Phase 7
}

module.exports = registerGuildHandlers;
