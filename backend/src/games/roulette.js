const { generateSeed, deriveFloat, nextNonce, recordResult } = require('./provably-fair');
const { getClient, query } = require('../db');
const { recordSoloResult } = require('../progression');

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

// ── Bet validation ────────────────────────────────────────────────────────────
// Inside bets must be real shapes on the layout, otherwise a "split" could cover
// every number. Layout: 1 2 3 / 4 5 6 / … rows of three, 0 above 1-2-3.
const isNum = (n) => Number.isInteger(n) && n >= 0 && n <= 36;
function insideNumbers(type, value) {
  if (!Array.isArray(value)) throw new Error(`Invalid ${type} bet`);
  const n = value.map(Number).sort((a, b) => a - b);
  if (!n.every(isNum) || new Set(n).size !== n.length) throw new Error(`Invalid ${type} bet`);
  const [a, b] = n;
  const eq = (arr) => arr.length === n.length && arr.every((x, i) => x === n[i]);
  let ok = false;
  if (type === 'split') ok = n.length === 2 && (
    (a === 0 && b >= 1 && b <= 3) || (a >= 1 && (b - a === 3 || (b - a === 1 && a % 3 !== 0))));
  else if (type === 'street') ok = eq([0, 1, 2]) || eq([0, 2, 3]) || (a % 3 === 1 && eq([a, a + 1, a + 2]));
  else if (type === 'corner') ok = eq([0, 1, 2, 3]) || (a >= 1 && a % 3 !== 0 && a <= 32 && eq([a, a + 1, a + 3, a + 4]));
  else if (type === 'line') ok = a % 3 === 1 && a <= 31 && eq([a, a + 1, a + 2, a + 3, a + 4, a + 5]);
  if (!ok) throw new Error(`Invalid ${type} bet`);
  return n;
}
const pick = (v, allowed, what) => { if (!allowed.includes(v)) throw new Error(`Invalid ${what} bet`); return v; };

// Build number lists for outside bets
function buildBetNumbers(betDef) {
  // betDef: { type, value }  e.g. { type: 'color', value: 'red' }
  const { type, value } = betDef;
  switch (type) {
    case 'straight': {
      const n = Number(value);
      if (!isNum(n)) throw new Error('Invalid straight bet');
      return { type: 'straight', numbers: [n] };
    }
    case 'split':
    case 'street':
    case 'corner':
    case 'line':     return { type, numbers: insideNumbers(type, value) };
    case 'column': {
      const col = pick(Number(value), [1, 2, 3], 'column'); // 1, 2, or 3
      return { type: 'column', numbers: Array.from({length:12},(_,i)=>col + i*3) };
    }
    case 'dozen': {
      const d = pick(Number(value), [1, 2, 3], 'dozen'); // 1=1-12, 2=13-24, 3=25-36
      return { type: 'dozen', numbers: Array.from({length:12},(_,i)=>(d-1)*12+i+1) };
    }
    case 'color':
      pick(value, ['red', 'black'], 'color');
      return { type: 'even_money', numbers: [...RED_NUMBERS].filter(()=>value==='red').concat(
        value === 'black' ? [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35] : []
      )};
    case 'parity':
      pick(value, ['even', 'odd'], 'parity');
      return { type: 'even_money', numbers: value === 'even'
        ? [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36]
        : [1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35] };
    case 'half':
      pick(value, ['low', 'high'], 'half');
      return { type: 'even_money', numbers: value === 'low'
        ? Array.from({length:18},(_,i)=>i+1)
        : Array.from({length:18},(_,i)=>i+19) };
    default: throw new Error(`Unknown bet type: ${type}`);
  }
}

async function spin(userId, bets) {
  // bets: array of { type, value, amount }
  if (!Array.isArray(bets) || bets.length === 0) throw new Error('No bets placed');
  if (bets.length > 60) throw new Error('Too many bets');
  // Every amount must be a positive whole number — negative chips used to offset the total.
  bets = bets.map((b) => {
    const amount = Number(b && b.amount);
    if (!Number.isSafeInteger(amount) || amount < 1) throw new Error('Invalid bet amount');
    buildBetNumbers(b); // throws on anything that isn't a real bet
    return { type: b.type, value: b.value, amount };
  });

  const totalBet = bets.reduce((sum, b) => sum + b.amount, 0);
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

    await recordSoloResult(client, {
      userId, game: 'roulette', betAmount: totalBet, payoutAmount: totalPayout, ccBalanceAfter: finalBalance,
    });

    await client.query('COMMIT');
    pushRecent(result);
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

// ── Recent results across the whole site (history strip + hot/cold) ──────────
const RECENT_MAX = 100;
let recent = null; // newest first
let loading = null;
async function getRecent() {
  if (recent) return recent;
  if (!loading) {
    loading = query(
      `SELECT (extra->>'result')::int AS n FROM game_results
       WHERE game = 'roulette' AND extra ? 'result' ORDER BY created_at DESC LIMIT $1`,
      [RECENT_MAX]
    ).then((r) => { recent = r.rows.map((x) => x.n).filter(isNum); return recent; })
      .finally(() => { loading = null; });
  }
  return loading;
}
function pushRecent(n) {
  if (!recent) return; // loads from the DB (including this spin) on first request
  recent.unshift(n);
  if (recent.length > RECENT_MAX) recent.length = RECENT_MAX;
}

module.exports = { spin, numberToColor, getRecent };
