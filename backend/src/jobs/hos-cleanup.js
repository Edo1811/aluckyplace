// Phase 8 — Nightly HOS cleanup. Runs 03:00 UTC.
// Removes Hall of Shame entries for users who opted out (retroactive, per balance.md).

const cron = require('node-cron');
const { query } = require('../db');

async function runHosCleanup() {
  try {
    const r = await query(
      `DELETE FROM hall_of_shame h USING users u
       WHERE h.user_id = u.id AND u.hos_opted_out = TRUE`
    );
    console.log(`[cron] hos-cleanup: removed ${r.rowCount} entries`);
  } catch (e) {
    console.error('[cron] hos-cleanup failed:', e.message);
  }
}

function start() {
  cron.schedule('0 3 * * *', runHosCleanup, { timezone: 'UTC' });
  console.log('[cron] hos-cleanup scheduled (03:00 UTC)');
}

module.exports = { start, runHosCleanup };
