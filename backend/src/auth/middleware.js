const jwt = require('jsonwebtoken');

// ── HTTP middleware ───────────────────────────────────────────────────────────
// Usage: router.get('/protected', requireAuth, handler)
// Attaches req.user = { userId, username } on success.

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];

  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── Socket.io helper ──────────────────────────────────────────────────────────
// Called inside the 'auth' socket event handler in index.js.
// Returns the decoded payload or throws.

function verifySocketToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { requireAuth, verifySocketToken };
