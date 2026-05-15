const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const { requireAuth } = require('./middleware');

const SALT_ROUNDS = 12;
const JWT_EXPIRY  = '7d';

// ── POST /auth/register ───────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
      return res.status(400).json({ error: 'username, email and password are required' });

    if (username.length < 3 || username.length > 32)
      return res.status(400).json({ error: 'Username must be 3–32 characters' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Username or email already taken' });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await query(
      `INSERT INTO users (id, username, email, password_hash, cc_balance, a_balance)
       VALUES ($1, $2, $3, $4, 1000, 10)
       RETURNING id, username, cc_balance, a_balance, created_at`,
      [uuidv4(), username, email, password_hash]
    );

    const user = result.rows[0];

    // Seed provably fair nonce row for this user
    await query(
      'INSERT INTO provably_fair_nonces (user_id, nonce) VALUES ($1, 0)',
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(201).json({
      token,
      user: {
        id:         user.id,
        username:   user.username,
        cc_balance: user.cc_balance,
        a_balance:  user.a_balance,
      },
    });

  } catch (err) {
    console.error('[auth/register]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: 'username and password are required' });

    const result = await query(
      'SELECT id, username, password_hash, cc_balance, a_balance FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0)
      return res.status(401).json({ error: 'Invalid username or password' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid)
      return res.status(401).json({ error: 'Invalid username or password' });

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.json({
      token,
      user: {
        id:         user.id,
        username:   user.username,
        cc_balance: user.cc_balance,
        a_balance:  user.a_balance,
      },
    });

  } catch (err) {
    console.error('[auth/login]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
// JWT is stateless — real logout is handled client-side by deleting the token.
router.post('/logout', (_req, res) => res.json({ ok: true }));

// ── GET /auth/me ──────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, username, email, cc_balance, a_balance, created_at, last_login_at
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: 'User not found' });

    return res.json({ user: result.rows[0] });

  } catch (err) {
    console.error('[auth/me]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
