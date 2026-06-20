const { generateSeed, deriveFloats, nextNonce, recordResult } = require('./provably-fair');
const { getClient, query } = require('../db');
const { recordSoloResult } = require('../progression');

// Active games: userId -> gameState
const activeGames = new Map();

// ── Deck helpers ──────────────────────────────────────────────────────────────
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit });
  return deck;
}

function buildShoe(decks = 6) {
  const shoe = [];
  for (let i = 0; i < decks; i++) shoe.push(...buildDeck());
  return shoe;
}

function cardValue(rank) {
  if (['J','Q','K'].includes(rank)) return 10;
  if (rank === 'A') return 11;
  return parseInt(rank);
}

function handTotal(hand) {
  let total = 0, aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isSoft(hand) {
  let total = 0, aces = 0;
  for (const c of hand) { total += cardValue(c.rank); if (c.rank === 'A') aces++; }
  return aces > 0 && total <= 21 && total - 10 >= 1;
}

function shuffleWithSeed(shoe, floats) {
  const arr = [...shoe];
  // Fisher-Yates with provably fair floats (cycle through floats)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(floats[i % floats.length] * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealerShouldHit(hand) {
  const total = handTotal(hand);
  if (total < 17) return true;
  if (total === 17 && isSoft(hand)) return true; // stands on soft 17
  return false;
}

function sanitizeHand(hand, hideSecond = false) {
  if (!hideSecond) return hand;
  return [hand[0], { rank: '?', suit: '?' }];
}

// ── Register handlers ─────────────────────────────────────────────────────────
function registerBlackjackHandlers(io, socket) {

  socket.on('blackjack:deal', async ({ bet }) => {
    if (!socket.user) return;
    const userId = socket.user.userId;
    bet = Math.floor(Number(bet));
    if (!Number.isFinite(bet) || bet < 10) return socket.emit('blackjack:error', { message: 'Minimum bet is 10 CC' });
    if (activeGames.has(userId)) return socket.emit('blackjack:error', { message: 'Game already in progress' });

    try {
      // Deduct bet
      const deduct = await query(
        `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
        [bet, userId]
      );
      if (deduct.rows.length === 0) return socket.emit('blackjack:error', { message: 'Insufficient balance' });

      const { seed, hash } = generateSeed();
      const nonce  = await nextNonce(userId);
      const floats = deriveFloats(seed, nonce, 312); // 6 decks = 312 cards
      const shoe   = shuffleWithSeed(buildShoe(6), floats);

      let idx = 0;
      const draw = () => shoe[idx++];

      const playerHand = [draw(), draw()];
      const dealerHand = [draw(), draw()];

      const gameData = {
        userId, bet, seed, hash, nonce, shoe, idx,
        playerHands: [playerHand],
        activeHandIdx: 0,
        splitCount: 0,
        dealerHand,
        phase: 'player',
        cc_balance: deduct.rows[0].cc_balance,
      };
      activeGames.set(userId, gameData);

      // Check for natural blackjack
      const playerTotal = handTotal(playerHand);
      const dealerTotal = handTotal(dealerHand);

      if (playerTotal === 21) {
        // Blackjack — check if dealer also has 21 (push) or player wins 3:2
        if (dealerTotal === 21) {
          await settleGame(socket, gameData, 'push');
        } else {
          await settleGame(socket, gameData, 'blackjack');
        }
        return;
      }

      socket.emit('blackjack:state', {
        game_id:     userId,
        player_hands: gameData.playerHands,
        active_hand:  0,
        dealer_hand:  sanitizeHand(dealerHand, true),
        phase:        'player',
        hash,
        can_double:   true,
        can_split:    playerHand[0].rank === playerHand[1].rank,
        cc_balance:   deduct.rows[0].cc_balance,
      });

    } catch (e) { console.error('[bj:deal]', e.message); socket.emit('blackjack:error', { message: 'Server error' }); }
  });

  socket.on('blackjack:action', async ({ action }) => {
    if (!socket.user) return;
    const userId = socket.user.userId;
    const game   = activeGames.get(userId);
    if (!game || game.phase !== 'player') return;

    const hand   = game.playerHands[game.activeHandIdx];
    const draw   = () => game.shoe[game.idx++];

    try {
      if (action === 'hit') {
        hand.push(draw());
        const total = handTotal(hand);

        if (total > 21) {
          // Bust this hand
          const morHands = game.activeHandIdx < game.playerHands.length - 1;
          if (morHands) {
            game.activeHandIdx++;
            emitState(socket, game);
          } else {
            await settleGame(socket, game, 'resolve');
          }
        } else {
          emitState(socket, game);
        }

      } else if (action === 'stand') {
        const moreHands = game.activeHandIdx < game.playerHands.length - 1;
        if (moreHands) {
          game.activeHandIdx++;
          emitState(socket, game);
        } else {
          await settleGame(socket, game, 'resolve');
        }

      } else if (action === 'double') {
        if (hand.length !== 2) return;
        // Deduct extra bet
        const extra = await query(
          `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
          [game.bet, userId]
        );
        if (extra.rows.length === 0) return socket.emit('blackjack:error', { message: 'Insufficient balance for double' });
        game.bet *= 2;
        game.cc_balance = extra.rows[0].cc_balance;
        hand.push(draw());
        await settleGame(socket, game, 'resolve');

      } else if (action === 'split') {
        if (hand.length !== 2 || hand[0].rank !== hand[1].rank || game.splitCount >= 2) return;
        // Deduct extra bet
        const extra = await query(
          `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
          [game.bet, userId]
        );
        if (extra.rows.length === 0) return socket.emit('blackjack:error', { message: 'Insufficient balance for split' });
        game.cc_balance = extra.rows[0].cc_balance;
        game.splitCount++;
        // Split the hand
        const newHand = [hand.pop()];
        hand.push(draw());
        newHand.push(draw());
        game.playerHands.splice(game.activeHandIdx + 1, 0, newHand);
        emitState(socket, game);
      }
    } catch (e) {
      console.error('[bj:action]', e.message);
      socket.emit('blackjack:error', { message: 'Server error — please refresh your balance' });
    }
  });
}

function emitState(socket, game) {
  const hand = game.playerHands[game.activeHandIdx];
  socket.emit('blackjack:state', {
    game_id:      game.userId,
    player_hands: game.playerHands,
    active_hand:  game.activeHandIdx,
    dealer_hand:  sanitizeHand(game.dealerHand, true),
    phase:        'player',
    can_double:   hand.length === 2,
    can_split:    hand.length === 2 && hand[0].rank === hand[1].rank && game.splitCount < 2,
    cc_balance:   game.cc_balance,
  });
}

async function settleGame(socket, game, reason) {
  const { userId, bet, seed, hash, nonce, dealerHand, playerHands } = game;
  activeGames.delete(userId);

  // Dealer draws
  if (reason === 'resolve' || reason === 'blackjack') {
    if (reason === 'resolve') {
      const anyAlive = playerHands.some(h => handTotal(h) <= 21);
      if (anyAlive) {
        while (dealerShouldHit(dealerHand)) {
          dealerHand.push(game.shoe[game.idx++]);
        }
      }
    }
  }

  const dealerTotal = handTotal(dealerHand);

  // Calculate payout per hand
  let totalPayout = 0;
  const results = playerHands.map(hand => {
    const total = handTotal(hand);
    let outcome, payout;

    if (reason === 'push') { outcome = 'push'; payout = bet; }
    else if (reason === 'blackjack') { outcome = 'blackjack'; payout = Math.floor(bet * 2.5); }
    else if (total > 21) { outcome = 'bust'; payout = 0; }
    else if (dealerTotal > 21) { outcome = 'win'; payout = bet * 2; }
    else if (total > dealerTotal) { outcome = 'win'; payout = bet * 2; }
    else if (total === dealerTotal) { outcome = 'push'; payout = bet; }
    else { outcome = 'loss'; payout = 0; }

    totalPayout += payout;
    return { hand, total, outcome, payout };
  });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    let finalBalance = game.cc_balance;
    if (totalPayout > 0) {
      const credit = await client.query(
        `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
        [totalPayout, userId]
      );
      finalBalance = credit.rows[0].cc_balance;
    }
    await recordResult(client, {
      userId, game: 'blackjack', betAmount: bet, payoutAmount: totalPayout,
      seed, hash, nonce,
      extra: { results: results.map(r => ({ outcome: r.outcome, total: r.total, payout: r.payout })), dealer_total: dealerTotal },
    });
    await recordSoloResult(client, {
      userId, game: 'blackjack', betAmount: bet, payoutAmount: totalPayout, ccBalanceAfter: finalBalance,
    });
    await client.query('COMMIT');
    client.release();

    socket.emit('blackjack:result', {
      player_hands: results,
      dealer_hand:  dealerHand,
      dealer_total: dealerTotal,
      total_payout: totalPayout,
      net:          totalPayout - bet,
      seed, cc_balance: finalBalance,
    });

  } catch (e) {
    await client.query('ROLLBACK');
    client.release();
    console.error('[bj:settle]', e.message);
  }
}

module.exports = registerBlackjackHandlers;
