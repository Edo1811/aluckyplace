// Phase 6 — Rock Paper Scissors PvP
// Best of 3 rounds. Simultaneous reveal. Tie = replay that round.

const BEATS = { rock: 'scissors', scissors: 'paper', paper: 'rock' };

function resolveRound(move1, move2) {
  if (move1 === move2) return 'tie';
  return BEATS[move1] === move2 ? 'p1' : 'p2';
}

module.exports = { resolveRound };
