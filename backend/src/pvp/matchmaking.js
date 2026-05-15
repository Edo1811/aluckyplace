// Phase 6 — PvP matchmaking + betting phase
// Socket events: pvp:queue:join, pvp:queue:leave, pvp:matched,
//                pvp:bet:set, pvp:bet:ready, pvp:both_ready,
//                pvp:opponent_left, pvp:timeout
//
// Wealth brackets from balance.md:
//   1: 0–5000  2: 5001–15000  3: 15001–40000
//   4: 40001–75000  5: 75001–150000  6: 150001+
//
// Bet cap: your bet cannot exceed 35% of opponent's cc_balance (enforced server-side)

const router = require('express').Router();

function getBracket(ccBalance) {
  if (ccBalance <=   5000) return 1;
  if (ccBalance <=  15000) return 2;
  if (ccBalance <=  40000) return 3;
  if (ccBalance <=  75000) return 4;
  if (ccBalance <= 150000) return 5;
  return 6;
}

function capBet(amount, opponentBalance) {
  return Math.min(amount, Math.floor(opponentBalance * 0.35));
}

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerPvpHandlers(_io, _socket) {
  // Phase 6
}

module.exports = registerPvpHandlers;
module.exports.router = router;
module.exports.getBracket = getBracket;
module.exports.capBet = capBet;
