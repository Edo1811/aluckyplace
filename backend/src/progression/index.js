// Phase 7 — Progression engine
// Single place where win streaks, lifetime stats, achievements, and
// challenges get updated. Called from inside the SAME transaction as the
// result write at every solo game, PvP match, and daily-claim call site.
//
// Of the 25 achievements / 24 challenges in balance.md, 9 depend on systems
// that don't exist until Phase 8 (guilds, leaderboard, Hall of Fame/Shame,
// weekly badge) and are NOT implemented here:
//   Achievements: 4 (Top 10), 15 (Guild Founder), 16 (Generous),
//                 17 (Hall of Shame), 18 (Hall of Fame), 22 (Week Champion)
//   Challenges:   5 (Guild Member), 14 (Donator), 17 (Leaderboard Climber)
// unlockAchievement / bumpChallengeProgress are exported so Phase 8 code
// can call them directly once those systems exist — see the TODO comments
// left in social/guilds.js, social/hall.js, and jobs/weekly-badge.js.

// ── Static metadata (balance.md) ─────────────────────────────────────────────

const ACHIEVEMENTS_META = {
  1:  { emoji: '🎰', name: 'First Spin',       description: 'Play Slots for the first time' },
  2:  { emoji: '💀', name: 'First Broke',      description: 'Go bankrupt for the first time' },
  3:  { emoji: '🔥', name: 'Week Streak',      description: 'Maintain a 7-day daily claim streak' },
  4:  { emoji: '👑', name: 'Top 10',           description: 'Reach the top 10 on the leaderboard' },
  5:  { emoji: '⚡', name: 'Speed Gambler',    description: 'Play 10 games within a single hour' },
  6:  { emoji: '🃏', name: 'Card Shark',       description: 'Win 50 Blackjack games' },
  7:  { emoji: '💎', name: 'Hold the Line',    description: 'Cash out at 20× or higher in Crash' },
  8:  { emoji: '🌙', name: 'Night Owl',        description: 'Play between 2:00–4:00 AM server time' },
  9:  { emoji: '🎯', name: 'High Risk',        description: 'Win a Dice bet with ≤5% win chance' },
  10: { emoji: '🏆', name: 'Champion',         description: 'Win 250 total games' },
  11: { emoji: '💸', name: 'Big Spender',      description: 'Place a single bet of 25,000 CC or more' },
  12: { emoji: '🤑', name: 'Jackpot',          description: 'Hit 3× Diamond in Slots (100× payout)' },
  13: { emoji: '👻', name: 'Minefield',        description: 'Reveal 15 or more tiles in a single Mines round' },
  14: { emoji: '🎲', name: 'Hot Dice',         description: 'Win 5 Dice bets in a row' },
  15: { emoji: '🔱', name: 'Guild Founder',    description: 'Create a guild' },
  16: { emoji: '🌟', name: 'Generous',         description: 'Receive 20 lifetime donations from guild members' },
  17: { emoji: '⚰️', name: 'Hall of Shame',    description: 'Appear in the Hall of Shame' },
  18: { emoji: '🏅', name: 'Hall of Fame',     description: 'Appear in the Hall of Fame' },
  19: { emoji: '🎭', name: 'Duelist',          description: 'Win 10 Duels matches' },
  20: { emoji: '🃏', name: 'Uno Out',          description: 'Win 10 Uno matches' },
  21: { emoji: '💔', name: 'Underdog',         description: 'Win a PvP match where the opponent had 5× your balance' },
  22: { emoji: '👑', name: 'Week Champion',    description: 'Win the "Richest MF This Week" badge' },
  23: { emoji: '☠️', name: 'Repeat Offender',  description: 'Go bankrupt 3 times' },
  24: { emoji: '🐉', name: 'Loaded',           description: 'Reach a balance of 100,000 CC' },
  25: { emoji: '♾️', name: 'Devoted',          description: 'Maintain a 30-day daily claim streak' },
};

const CHALLENGES_META = {
  1:  { name: 'First Bet',            description: 'Place your first bet in any game',              reward_a: 1,  target: 1 },
  2:  { name: 'First Win',            description: 'Win your first game',                           reward_a: 1,  target: 1 },
  3:  { name: 'Daily Ritual',         description: 'Maintain a 7-day daily claim streak',            reward_a: 3,  target: 7 },
  4:  { name: 'PvP Debut',            description: 'Complete your first PvP match',                  reward_a: 2,  target: 1 },
  5:  { name: 'Guild Member',         description: 'Join a guild',                                   reward_a: 2,  target: 1 },
  6:  { name: 'Broke Life',           description: 'Go bankrupt for the first time',                 reward_a: 3,  target: 1 },
  7:  { name: 'Crash and Learn',      description: 'Play 10 Crash rounds',                           reward_a: 2,  target: 10 },
  8:  { name: 'Win Streak',           description: 'Win 5 in a row in any single game',              reward_a: 5,  target: 5 },
  9:  { name: 'Century',              description: 'Win 100 total games',                            reward_a: 10, target: 100 },
  10: { name: 'High Roller',          description: 'Reach a balance of 50,000 CC',                   reward_a: 8,  target: 50000 },
  11: { name: 'Double or Nothing',    description: 'Win a Coinflip worth 10,000+ CC',                reward_a: 8,  target: 1 },
  12: { name: 'Mines Expert',         description: 'Reveal 10 tiles in a single Mines round',        reward_a: 10, target: 10 },
  13: { name: 'Crash King',           description: 'Cash out at 10× or higher in Crash',             reward_a: 8,  target: 1 },
  14: { name: 'Donator',              description: 'Donate to 10 different guild members',           reward_a: 5,  target: 10 },
  15: { name: 'PvP Victor',           description: 'Win 25 PvP matches total',                       reward_a: 12, target: 25 },
  16: { name: 'Comeback Kid',         description: 'Return from bankruptcy to 10,000+ CC',           reward_a: 20, target: 1 },
  17: { name: 'Leaderboard Climber',  description: 'Reach top 10 on the all-time leaderboard',       reward_a: 25, target: 1 },
  18: { name: 'Consistent',           description: 'Maintain a 14-day daily claim streak',           reward_a: 20, target: 14 },
  19: { name: 'Crash God',            description: 'Cash out at 25× or higher in Crash',             reward_a: 30, target: 1 },
  20: { name: 'Legend',               description: 'Win 500 total games',                            reward_a: 40, target: 500 },
  21: { name: 'Five Times Under',     description: 'Go bankrupt 5 times total',                      reward_a: 15, target: 5 },
  22: { name: 'Mines Master',         description: 'Clear all 20 safe tiles in a single Mines round', reward_a: 50, target: 1 },
  23: { name: 'True High Roller',     description: 'Reach a balance of 200,000 CC',                  reward_a: 50, target: 200000 },
  24: { name: 'Unstoppable',          description: 'Win 10 PvP matches in a row',                    reward_a: 35, target: 10 },
};

// ── Low-level primitives (exported for Phase 8 reuse) ───────────────────────

// Idempotent — safe to call on every qualifying action, "first time" logic
// falls out of ON CONFLICT DO NOTHING for free.
async function unlockAchievement(client, userId, achievementId) {
  await client.query(
    `INSERT INTO achievements (user_id, achievement_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, achievementId]
  );
}

// progress only ever moves up; completed_at is set once and never cleared,
// matching "one-time completion only" from balance.md.
async function bumpChallengeProgress(client, userId, challengeId, newProgress) {
  const target = CHALLENGES_META[challengeId]?.target;
  if (!target) return; // unknown / Phase 8 challenge — no-op
  const capped = Math.min(newProgress, target);

  await client.query(
    `INSERT INTO challenges (user_id, challenge_id, progress, completed_at)
     VALUES ($1, $2, $3, CASE WHEN $3 >= $4 THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id, challenge_id) DO UPDATE SET
       progress = GREATEST(challenges.progress, $3),
       completed_at = CASE
         WHEN challenges.completed_at IS NOT NULL THEN challenges.completed_at
         WHEN GREATEST(challenges.progress, $3) >= $4 THEN NOW()
         ELSE NULL
       END`,
    [userId, challengeId, capped, target]
  );
}

// ── user_stats helpers ────────────────────────────────────────────────────────

async function ensureUserStatsRow(client, userId) {
  await client.query(`INSERT INTO user_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
}

async function bumpSoloStats(client, userId, { won, net }) {
  await ensureUserStatsRow(client, userId);
  const res = await client.query(
    `UPDATE user_stats SET
       total_games  = total_games + 1,
       total_wins   = total_wins + CASE WHEN $2 THEN 1 ELSE 0 END,
       biggest_win  = GREATEST(biggest_win,  CASE WHEN $3 > 0 THEN $3  ELSE 0 END),
       biggest_loss = GREATEST(biggest_loss, CASE WHEN $3 < 0 THEN -$3 ELSE 0 END),
       updated_at   = NOW()
     WHERE user_id = $1
     RETURNING total_games, total_wins, biggest_win, biggest_loss, bankruptcy_count`,
    [userId, won, net]
  );
  return res.rows[0];
}

async function bumpPvpStats(client, userId, won) {
  await ensureUserStatsRow(client, userId);
  const res = await client.query(
    `UPDATE user_stats SET
       total_pvp_wins      = total_pvp_wins + CASE WHEN $2 THEN 1 ELSE 0 END,
       pvp_win_streak      = CASE WHEN $2 THEN pvp_win_streak + 1 ELSE 0 END,
       best_pvp_win_streak = GREATEST(best_pvp_win_streak, CASE WHEN $2 THEN pvp_win_streak + 1 ELSE best_pvp_win_streak END),
       updated_at = NOW()
     WHERE user_id = $1
     RETURNING total_pvp_wins, pvp_win_streak, best_pvp_win_streak`,
    [userId, won]
  );
  return res.rows[0];
}

async function bumpBankruptcy(client, userId) {
  await ensureUserStatsRow(client, userId);
  const res = await client.query(
    `UPDATE user_stats SET bankruptcy_count = bankruptcy_count + 1, updated_at = NOW()
     WHERE user_id = $1 RETURNING bankruptcy_count`,
    [userId]
  );
  return res.rows[0];
}

// ── Win streak (per specific game — separate axis from user_stats) ──────────

async function updateWinStreak(client, userId, game, outcome) {
  // outcome: 'win' | 'loss' | 'neutral' (push) — neutral leaves the streak untouched
  const existing = await client.query(
    `SELECT current_streak, best_streak FROM win_streaks WHERE user_id = $1 AND game = $2`,
    [userId, game]
  );
  let current = 0, best = 0;
  if (existing.rows.length) ({ current_streak: current, best_streak: best } = existing.rows[0]);

  if (outcome === 'win')  { current += 1; best = Math.max(best, current); }
  else if (outcome === 'loss') { current = 0; }

  await client.query(
    `INSERT INTO win_streaks (user_id, game, current_streak, best_streak, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, game) DO UPDATE SET
       current_streak = $3, best_streak = $4, updated_at = NOW()`,
    [userId, game, current, best]
  );
  return { current_streak: current, best_streak: best };
}

// ── Solo games — call from inside the same transaction as recordResult ──────
// extra: per-game fields used for achievement checks (see call sites for
// exactly what each game passes — pWin for dice, jackpot for slots, picks/
// full_clear for mines, cashout_multiplier for crash).
async function recordSoloResult(client, { userId, game, betAmount, payoutAmount, ccBalanceAfter, extra = {} }) {
  const net = payoutAmount - betAmount;
  const outcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'neutral';
  const won = outcome === 'win';

  // Universal — first bet ever / first win ever (idempotent past completion)
  await bumpChallengeProgress(client, userId, 1, 1);
  if (won) await bumpChallengeProgress(client, userId, 2, 1);

  // Per-game win streak + cross-game "5 in a row" challenge
  const { current_streak } = await updateWinStreak(client, userId, game, outcome);
  if (current_streak >= 5) await bumpChallengeProgress(client, userId, 8, current_streak);

  // Lifetime solo stats
  const stats = await bumpSoloStats(client, userId, { won, net });
  if (stats.total_wins >= 250) await unlockAchievement(client, userId, 10); // Champion
  await bumpChallengeProgress(client, userId, 9, stats.total_wins);   // Century
  await bumpChallengeProgress(client, userId, 20, stats.total_wins);  // Legend

  // Big Spender — single bet size, independent of outcome
  if (betAmount >= 25000) await unlockAchievement(client, userId, 11);

  // Balance milestones
  if (ccBalanceAfter >= 100000) await unlockAchievement(client, userId, 24); // Loaded
  await bumpChallengeProgress(client, userId, 10, ccBalanceAfter); // High Roller
  await bumpChallengeProgress(client, userId, 23, ccBalanceAfter); // True High Roller

  // Bankruptcy / comeback
  if (ccBalanceAfter === 0) {
    const bk = await bumpBankruptcy(client, userId);
    await unlockAchievement(client, userId, 2); // First Broke
    await bumpChallengeProgress(client, userId, 6, 1); // Broke Life
    if (bk.bankruptcy_count >= 3) await unlockAchievement(client, userId, 23); // Repeat Offender
    await bumpChallengeProgress(client, userId, 21, bk.bankruptcy_count); // Five Times Under
  } else if (stats.bankruptcy_count > 0 && ccBalanceAfter >= 10000) {
    await bumpChallengeProgress(client, userId, 16, 1); // Comeback Kid
  }

  // Night Owl — server (UTC) hour 2:00–4:00
  const hourUTC = new Date().getUTCHours();
  if (hourUTC >= 2 && hourUTC < 4) await unlockAchievement(client, userId, 8);

  // Speed Gambler — 10 games within the last hour
  const recent = await client.query(
    `SELECT COUNT(*) FROM game_results WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  if (Number(recent.rows[0].count) >= 10) await unlockAchievement(client, userId, 5);

  // Per-game specific checks
  switch (game) {
    case 'slots':
      await unlockAchievement(client, userId, 1); // First Spin
      if (extra.jackpot) await unlockAchievement(client, userId, 12); // Jackpot
      break;

    case 'dice':
      if (won && typeof extra.pWin === 'number' && extra.pWin <= 0.05) await unlockAchievement(client, userId, 9); // High Risk
      if (won && current_streak >= 5) await unlockAchievement(client, userId, 14); // Hot Dice
      break;

    case 'mines':
      if (extra.picks >= 15) await unlockAchievement(client, userId, 13); // Minefield
      await bumpChallengeProgress(client, userId, 12, extra.picks || 0);  // Mines Expert
      if (extra.full_clear) await bumpChallengeProgress(client, userId, 22, 1); // Mines Master
      break;

    case 'crash': {
      const mult = extra.cashout_multiplier;
      if (mult) {
        if (mult >= 20) await unlockAchievement(client, userId, 7);       // Hold the Line
        if (mult >= 10) await bumpChallengeProgress(client, userId, 13, 1); // Crash King
        if (mult >= 25) await bumpChallengeProgress(client, userId, 19, 1); // Crash God
      }
      const crashCount = await client.query(
        `SELECT COUNT(*) FROM game_results WHERE user_id = $1 AND game = 'crash'`, [userId]
      );
      await bumpChallengeProgress(client, userId, 7, Number(crashCount.rows[0].count)); // Crash and Learn
      break;
    }

    case 'blackjack': {
      const bjWins = await client.query(
        `SELECT COUNT(*) FROM game_results WHERE user_id = $1 AND game = 'blackjack' AND net > 0`, [userId]
      );
      if (Number(bjWins.rows[0].count) >= 50) await unlockAchievement(client, userId, 6); // Card Shark
      break;
    }
  }
}

// ── PvP — call from inside a transaction around the awardWinner/autoWin
// commit point, after the pvp_matches row for this match has been inserted
// (per-game lifetime totals query that table directly). ─────────────────────
async function recordPvpResult(client, match, winnerId, loserId) {
  const { game, bet1, bet2, pot, player1, player2 } = match;
  const winnerBet = player1.userId === winnerId ? bet1 : bet2;
  const loserBet  = player1.userId === winnerId ? bet2 : bet1;

  const balRes = await client.query(
    `SELECT id, cc_balance FROM users WHERE id IN ($1, $2)`,
    [winnerId, loserId]
  );
  const balances = {};
  for (const row of balRes.rows) balances[row.id] = Number(row.cc_balance);
  const winnerBalance = balances[winnerId];
  const loserBalance  = balances[loserId];

  // First PvP match — both players, idempotent
  await bumpChallengeProgress(client, winnerId, 4, 1);
  await bumpChallengeProgress(client, loserId, 4, 1);

  // Big Spender — either player's bet
  if (winnerBet >= 25000) await unlockAchievement(client, winnerId, 11);
  if (loserBet  >= 25000) await unlockAchievement(client, loserId, 11);

  // Lifetime PvP totals + cross-game win streak
  const winnerPvp = await bumpPvpStats(client, winnerId, true);
  await bumpPvpStats(client, loserId, false);
  await bumpChallengeProgress(client, winnerId, 15, winnerPvp.total_pvp_wins); // PvP Victor
  await bumpChallengeProgress(client, winnerId, 24, winnerPvp.pvp_win_streak); // Unstoppable

  // Per-game PvP totals (this match is already in pvp_matches by this point)
  if (game === 'duels' || game === 'uno') {
    const countRes = await client.query(
      `SELECT COUNT(*) FROM pvp_matches WHERE winner_id = $1 AND game = $2`,
      [winnerId, game]
    );
    if (Number(countRes.rows[0].count) >= 10) {
      await unlockAchievement(client, winnerId, game === 'duels' ? 19 : 20);
    }
  }

  // Double or Nothing — win a Coinflip worth 10,000+ CC
  if (game === 'coinflip' && pot >= 10000) await bumpChallengeProgress(client, winnerId, 11, 1);

  // Underdog — opponent had 5x your balance at match (queue) time
  const winnerStartBal = player1.userId === winnerId ? player1.ccBalance : player2.ccBalance;
  const loserStartBal  = player1.userId === winnerId ? player2.ccBalance : player1.ccBalance;
  if (winnerStartBal > 0 && loserStartBal >= winnerStartBal * 5) {
    await unlockAchievement(client, winnerId, 21);
  }

  // Balance milestones — only the winner can newly cross these by winning
  if (winnerBalance >= 100000) await unlockAchievement(client, winnerId, 24); // Loaded
  await bumpChallengeProgress(client, winnerId, 10, winnerBalance); // High Roller
  await bumpChallengeProgress(client, winnerId, 23, winnerBalance); // True High Roller

  // Bankruptcy — only the loser can newly hit 0 by losing
  if (loserBalance === 0) {
    const bk = await bumpBankruptcy(client, loserId);
    await unlockAchievement(client, loserId, 2); // First Broke
    await bumpChallengeProgress(client, loserId, 6, 1); // Broke Life
    if (bk.bankruptcy_count >= 3) await unlockAchievement(client, loserId, 23); // Repeat Offender
    await bumpChallengeProgress(client, loserId, 21, bk.bankruptcy_count); // Five Times Under
  }
}

// ── Daily streaks — call from daily.js right before COMMIT ──────────────────
async function recordDailyStreak(client, userId, newStreak) {
  if (newStreak >= 7)  await unlockAchievement(client, userId, 3);  // Week Streak
  if (newStreak >= 30) await unlockAchievement(client, userId, 25); // Devoted
  await bumpChallengeProgress(client, userId, 3, newStreak);  // Daily Ritual (target 7)
  await bumpChallengeProgress(client, userId, 18, newStreak); // Consistent (target 14)
}

module.exports = {
  ACHIEVEMENTS_META,
  CHALLENGES_META,
  unlockAchievement,
  bumpChallengeProgress,
  recordSoloResult,
  recordPvpResult,
  recordDailyStreak,
};
