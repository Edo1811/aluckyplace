// Phase 7 — Hall of Fame / Shame auto-trigger logic
//
// HOF triggers (from balance.md):
//   - Single game win >= 50,000 CC
//   - Win streak >= 10 in any single game
//   - Balance milestones: 100k, 250k, 500k CC
//   - Winning weekly "Richest MF" badge
//
// HOS triggers:
//   - Going bankrupt from balance >= 25,000 CC
//   - Single game loss >= 30,000 CC
//   - Falling 50+ leaderboard positions in one day
//
// Entries are auto-generated with template story text.
// hos_opted_out users are filtered at query time + removed nightly.

async function checkHofTriggers(_userId, _context) {
  // Phase 7
}

async function checkHosTriggers(_userId, _context) {
  // Phase 7
}

module.exports = { checkHofTriggers, checkHosTriggers };
