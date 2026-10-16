// One source of truth for the 12 games: names, copy, routes, preview scene.
// Used by the games hub, home quick-play, and history rows.

export const GAMES = [
  { id: 'crash',     name: 'Crash',               type: 'solo', route: 'game-crash',     scene: 'crash',    icon: '📈',
    desc: 'Cash out before it crashes.',          rules: 'A multiplier climbs from 1×. Hold to ride, let go to cash out. Everyone watches the same graph in real time.' },
  { id: 'blackjack', name: 'Blackjack',           type: 'solo', route: 'game-blackjack', scene: 'bj',       icon: '🃏',
    desc: 'Pick cards, beat the dealer.',          rules: 'Get closer to 21 than the dealer without going over. Hit, stand, or double down. Blackjack pays 3:2.' },
  { id: 'slots',     name: 'Slots',               type: 'solo', route: 'game-slots',     scene: 'slots',    icon: '🎰',
    desc: 'Spin to win. Probably lose.',           rules: 'Pull the lever, then tap the reels to slam them to a stop. Three of a kind pays up to 100×.' },
  { id: 'roulette',  name: 'Roulette',            type: 'solo', route: 'game-roulette',  scene: 'roulette', icon: '🎡',
    desc: 'Big swings. Classic.',                  rules: 'European wheel, single zero. Place chips on the felt, flick the wheel, then flick the ball.' },
  { id: 'dice',      name: 'Dice',                type: 'solo', route: 'game-dice',      scene: 'dice',     icon: '🎲',
    desc: 'Bet over/under. Done in seconds.',      rules: 'Set a target from 1–100, choose over or under, then pull back and throw.' },
  { id: 'mines',     name: 'Mines',               type: 'solo', route: 'game-mines',     scene: 'mines',    icon: '💣',
    desc: 'One wrong tile ends everything.',       rules: 'A 5×5 grid hides mines. Every safe tile multiplies your bet. Cash out whenever — one mine and it\'s gone.' },
  { id: 'plinko',    name: 'Plinko',              type: 'solo', route: 'game-plinko',    scene: 'plinko',   icon: '🔻',
    desc: 'Drop the ball, collect the chaos.',     rules: 'Every ball costs your bet. Drop as many as you like — each pays the slot it lands in.' },
  { id: 'coinflip',  name: 'Coinflip',            type: 'pvp',  route: 'matchmaking-coinflip', scene: 'coin', icon: '🪙',
    desc: 'Heads or tails. Classic.',              rules: 'Both players bet, then you flick the coin. Winner takes the whole pot.' },
  { id: 'rps',       name: 'Rock Paper Scissors', type: 'pvp',  route: 'matchmaking-rps',      scene: 'rps',  icon: '✊',
    desc: 'Fast, dumb, perfect.',                  rules: 'Both players pick at the same time. Best of three takes the pot.' },
  { id: 'uno',       name: 'Uno',                 type: 'pvp',  route: 'matchmaking-uno',      scene: 'uno',  icon: '🟥',
    desc: 'Bet on every card.',                    rules: 'Match colour or number. Drag a card onto the pile to play it. Empty your hand first to win.' },
  { id: 'highlow',   name: 'Higher or Lower',     type: 'pvp',  route: 'matchmaking-highlow',  scene: 'highlow', icon: '🔢',
    desc: 'Whose number wins?',                    rules: 'Both players get a hidden number. Higher number takes the pot.' },
  { id: 'duels',     name: 'Duels',               type: 'pvp',  route: 'matchmaking-duels',    scene: 'duels', icon: '⚔️',
    desc: 'Bluff. Attack. Survive.',               rules: 'Each round pick attack, defend or special. Last one standing wins the pot.' },
];
export const GAME_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
// history rows sometimes use 'higherlow' for the same game
GAME_BY_ID.higherlow = GAME_BY_ID.highlow;
export const gameName = (id) => (GAME_BY_ID[id] ? GAME_BY_ID[id].name : String(id || '').replace(/^\w/, (c) => c.toUpperCase()));
