// Phase 8 — Weekly badge cron. Runs every Sunday 00:00 UTC.
// Awards "👑 Richest MF This Week" to the highest CC balance at that moment,
// logs it to leaderboard_badges, mirrors it into the Hall of Fame, and
// unlocks Week Champion (22) + Hall of Fame (18). Also clears the weekly set.

const cron = require('node-cron');
const { getClient } = require('../db');
const { redis } = require('../redis');

async function runWeeklyBadge() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const top = await client.query(`SELECT id, cc_balance FROM users ORDER BY cc_balance DESC LIMIT 1`);
    if (!top.rows.length) { await client.query('ROLLBACK'); return; }

    const winnerId = top.rows[0].id;
    const cc = Number(top.rows[0].cc_balance);
    const weekStart = new Date().toISOString().slice(0, 10); // the Sunday (UTC)

    const ins = await client.query(
      `INSERT INTO leaderboard_badges (user_id, week_start, cc_at_award)
       VALUES ($1, $2, $3) ON CONFLICT (week_start) DO NOTHING RETURNING id`,
      [winnerId, weekStart, cc]
    );

    if (ins.rows.length) {
      await client.query(
        `INSERT INTO hall_of_fame (user_id, trigger, amount, extra)
         VALUES ($1, 'weekly_badge', $2, $3)`,
        [winnerId, cc, JSON.stringify({ story: `Crowned 👑 Richest MF of the week with ${cc.toLocaleString('en-US')} CC.` })]
      );
      await client.query(
        `INSERT INTO achievements (user_id, achievement_id) VALUES ($1, 22), ($1, 18) ON CONFLICT DO NOTHING`,
        [winnerId] // 22 = Week Champion, 18 = Hall of Fame
      );
    }
    await client.query('COMMIT');
    await redis.del('leaderboard:weekly').catch(() => {});
    console.log(`[cron] weekly-badge: awarded to ${winnerId} (${cc} CC)`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cron] weekly-badge failed:', e.message);
  } finally {
    client.release();
  }
}

function start() {
  cron.schedule('0 0 * * 0', runWeeklyBadge, { timezone: 'UTC' });
  console.log('[cron] weekly-badge scheduled (Sun 00:00 UTC)');
}

module.exports = { start, runWeeklyBadge };
