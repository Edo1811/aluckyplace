// Phase 8 — Hall of Fame / Shame trigger evaluation.
//
// Called from INSIDE the game-result transaction (progression/index.js), so
// every function takes the same `client` and commits atomically with the
// balance write. This satisfies the intent of the "never speculative" invariant:
// a hall entry can never outlive a result that got rolled back.
//
// Triggers (balance.md):
//   HOF — single win >= 50k · win streak >= 10 in one game · balance milestones
//         (100k/250k/500k) · weekly badge (fired by jobs/weekly-badge.js)
//   HOS — bankruptcy from >= 25k · single loss >= 30k
//         ('fell 50+ leaderboard positions in a day' deferred — needs rank snapshots)

const MILESTONES = [100000, 250000, 500000];
const fmt = (n) => Number(n).toLocaleString('en-US');

async function usernameOf(client, userId) {
  const r = await client.query(`SELECT username FROM users WHERE id = $1`, [userId]);
  return r.rows[0]?.username || 'Someone';
}

async function insertHof(client, userId, trigger, { amount = null, game = null, extra = {}, story }) {
  await client.query(
    `INSERT INTO hall_of_fame (user_id, trigger, amount, game, extra)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, trigger, amount, game, JSON.stringify({ ...extra, story })]
  );
  await client.query(
    `INSERT INTO achievements (user_id, achievement_id) VALUES ($1, 18) ON CONFLICT DO NOTHING`,
    [userId] // 18 = Hall of Fame
  );
}

async function insertHos(client, userId, trigger, { amount = null, game = null, story }) {
  await client.query(
    `INSERT INTO hall_of_shame (user_id, trigger, amount, game, extra)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, trigger, amount, game, JSON.stringify({ story })]
  );
  await client.query(
    `INSERT INTO achievements (user_id, achievement_id) VALUES ($1, 17) ON CONFLICT DO NOTHING`,
    [userId] // 17 = Hall of Shame
  );
}

// ctx: { userId, game, net, balanceBefore, balanceAfter, streak? }
async function checkHofTriggers(client, ctx) {
  const { userId, game, net, balanceAfter, streak } = ctx;
  let name = null;
  const who = async () => (name ??= await usernameOf(client, userId));

  // Single big win >= 50,000 CC
  if (net >= 50000) {
    await insertHof(client, userId, 'big_win', {
      amount: net, game,
      story: `${await who()} won ${fmt(net)} CC in a single ${game} round.`,
    });
  }

  // Win streak — fires once, exactly when it reaches 10 (solo per-game only)
  if (typeof streak === 'number' && streak === 10) {
    await insertHof(client, userId, 'win_streak', {
      amount: streak, game,
      story: `${await who()} rattled off 10 wins in a row at ${game}.`,
    });
  }

  // Balance milestones — once each, ever (idempotent via NOT EXISTS)
  for (const m of MILESTONES) {
    if (balanceAfter >= m) {
      const exists = await client.query(
        `SELECT 1 FROM hall_of_fame
         WHERE user_id = $1 AND trigger = 'balance_milestone'
           AND (extra->>'milestone')::bigint = $2 LIMIT 1`,
        [userId, m]
      );
      if (!exists.rows.length) {
        await insertHof(client, userId, 'balance_milestone', {
          amount: m, extra: { milestone: m },
          story: `${await who()} crossed ${fmt(m)} CC.`,
        });
      }
    }
  }
}

// ctx: { userId, game, net, balanceBefore, balanceAfter }
async function checkHosTriggers(client, ctx) {
  const { userId, game, net, balanceBefore, balanceAfter } = ctx;
  let name = null;
  const who = async () => (name ??= await usernameOf(client, userId));

  // Bankrupt from a balance >= 25,000 CC
  if (balanceAfter === 0 && balanceBefore >= 25000) {
    await insertHos(client, userId, 'bankruptcy_from_high', {
      amount: balanceBefore, game,
      story: `${await who()} torched a ${fmt(balanceBefore)} CC balance all the way to zero.`,
    });
  }

  // Single game loss >= 30,000 CC
  if (net <= -30000) {
    await insertHos(client, userId, 'big_loss', {
      amount: -net, game,
      story: `${await who()} dropped ${fmt(-net)} CC in one ${game} round.`,
    });
  }
}

module.exports = { checkHofTriggers, checkHosTriggers };
