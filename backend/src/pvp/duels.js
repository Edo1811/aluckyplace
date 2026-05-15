// Phase 6 — Duels PvP
// Turn-based bluffing. 3 HP each. Attack / Defend / Special.
// Cycle: Attack beats Special · Special beats Defend · Defend beats Attack

// Resolution table from game_design_detail.md
// [you][opponent] → { youDmg, oppDmg }
const RESOLUTION = {
  attack:  { attack: [1,1], defend: [0,0], special: [1,0] },
  defend:  { attack: [0,0], defend: [0,0], special: [1,0] },
  special: { attack: [0,1], defend: [0,1], special: [1,1] },
};

function resolveRound(moveYou, moveOpp) {
  const [youDmg, oppDmg] = RESOLUTION[moveYou][moveOpp];
  return { youDmg, oppDmg };
}

module.exports = { resolveRound };
