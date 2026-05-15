const { generateSeed, deriveFloat, nextNonce, recordResult } = require('./provably-fair');
const { getClient } = require('../db');

// European roulette — numbers 0–36
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);

function numberToColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

// Returns true if bet wins, and the payout multiplier (including stake back)
function evaluateBet(bet, result) {
  const { type, numbers } = bet;
  const hits = numbers.includes(result);

  const PAYOUTS = {
    straight: 35, split: 17, street: 11, corner: 8,
    line: 5, column: 2, dozen: 2, even_money: 1,
  };

  if (!hits) return { win: false, multiplier: 0 };

  const multiplier = (PAYOUTS[type] || 1) + 1; // +1 to include stake
  return { win: true, multiplier };
}

// Build number lists for outside bets
function buildBetNumbers(betDef) {
  // betDef: { type, value }  e.g. { type: 'color', value: 'red' }
  const { type, value } = betDef;
  switch (type) {
    case 'straight': return { type: 'straight', numbers: [Number(value)] };
    case 'split':    return { type: 'split',    numbers: value.map(Number) };
    case 'street':   return { type: 'street',   numbers: value.map(Number) };
    case 'corner':   return { type: 'corner',   numbers: value.map(Number) };
    case 'line':     return { type: 'line',      numbers: value.map(Number) };
    case 'column': {
      const col = Number(value); // 1, 2, or 3
      return { type: 'column', numbers: Array.from({length:12},(_,i)=>col + i*3) };
    }
    case 'dozen': {
      const d = Number(value); // 1=1-12, 2=13-24, 3=25-36
      return { type: 'dozen', numbers: Array.from({length:12},(_,i)=>(d-1)*12+i+1) };
    }
    case 'color':
      return { type: 'even_money', numbers: [...RED_NUMBERS].filter(()=>value==='red').concat(
        value === 'black' ? [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35] : []
      )};
    case 'parity':
      return { type: 'even_money', numbers: value === 'even'
        ? [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36]
        : [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35] };
    case 'half':
      return { type: 'even_money', numbers: value === 'low'
        ? Array.from({length:18},(_,i)=>i+1)
        : Array.from({length:18},(_,i)=>i+19) };
    default: throw new Error(`Unknown bet type: ${type}`);
  }
}

async function spin(userId, bets) {
  // bets: array of { type, value, amount }
  if (!bets || bets.length === 0) throw new Error('No bets placed');

  const totalBet = bets.reduce((sum, b) => sum + Math.floor(b.amount), 0);
  if (totalBet < 10) throw new Error('Minimum bet is 10 CC');

  const { seed, hash } = generateSeed();
  const nonce  = await nextNonce(userId);
  const raw    = deriveFloat(seed, nonce);
  const result = Math.floor(raw * 37); // 0–36

  // Evaluate all bets
  const evaluated = bets.map(b => {
    const resolved = buildBetNumbers(b);
    const { win, multiplier } = evaluateBet(resolved, result);
    const amount = Math.floor(b.amount);
    return { ...b, win, multiplier, amount, payout: win ? Math.floor(amount * multiplier) : 0 };
  });

  const totalPayout = evaluated.reduce((sum, b) => sum + b.payout, 0);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const deduct = await client.query(
      `UPDATE users SET cc_balance = cc_balance - $1 WHERE id = $2 AND cc_balance >= $1 RETURNING cc_balance`,
      [totalBet, userId]
    );
    if (deduct.rows.length === 0) { await client.query('ROLLBACK'); throw new Error('Insufficient balance'); }

    let finalBalance = deduct.rows[0].cc_balance;
    if (totalPayout > 0) {
      const credit = await client.query(
        `UPDATE users SET cc_balance = cc_balance + $1 WHERE id = $2 RETURNING cc_balance`,
        [totalPayout, userId]
      );
      finalBalance = credit.rows[0].cc_balance;
    }

    await recordResult(client, {
      userId, game: 'roulette', betAmount: totalBet, payoutAmount: totalPayout,
      seed, hash, nonce, extra: { result, color: numberToColor(result), bets: evaluated },
    });

    await client.query('COMMIT');
    return {
      result, color: numberToColor(result),
      bets: evaluated, totalBet, totalPayout,
      net: totalPayout - totalBet, seed, hash, nonce,
      cc_balance: finalBalance,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { spin, numberToColor };
