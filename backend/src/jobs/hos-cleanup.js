// Phase 7 — Nightly HOS cleanup cron job
// Removes hall_of_shame entries for users who have hos_opted_out = TRUE

const cron = require('node-cron');

function start() {
  // '0 3 * * *' = every day at 03:00 UTC (quiet hours)
  cron.schedule('0 3 * * *', async () => {
    // Phase 7
    console.log('[cron] hos-cleanup: not implemented yet');
  }, { timezone: 'UTC' });
}

module.exports = { start };
