// Phase 7 — Weekly badge cron job
// Runs every Sunday at 00:00 UTC
// Awards "Richest MF This Week" to whoever has the highest CC balance at that moment
// Writes to leaderboard_badges table + triggers HOF entry
//
// TODO (Phase 7 progression hook, see backend/src/progression/index.js):
//   - When the badge is awarded: unlockAchievement(client, winnerId, 22)  // Week Champion

const cron = require('node-cron');

function start() {
  // '0 0 * * 0' = Sunday 00:00 UTC
  cron.schedule('0 0 * * 0', async () => {
    // Phase 7
    console.log('[cron] weekly-badge: not implemented yet');
  }, { timezone: 'UTC' });
}

module.exports = { start };
