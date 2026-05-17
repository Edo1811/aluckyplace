require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');

const { query }             = require('./db');
const { ping: redisPing }   = require('./redis');
const { verifySocketToken } = require('./auth/middleware');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes    = require('./auth/routes');
const dailyRoutes   = require('./economy/daily');
const convertRoutes = require('./economy/balance');
const gameRoutes    = require('./games/routes');
const socialRoutes  = require('./social/leaderboard');
const shopRoutes    = require('./shop/listings');

// ── Socket handlers ───────────────────────────────────────────────────────────
const registerCrashHandlers     = require('./games/crash');
const registerMinesHandlers     = require('./games/mines');
const registerBlackjackHandlers = require('./games/blackjack');
const registerPvpHandlers       = require('./pvp/matchmaking');
const registerGuildHandlers     = require('./social/guilds');

const app    = express();
const server = http.createServer(app);

const allowedOrigins = (origin, callback) => {
  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
  ].filter(Boolean);
  if (!origin || allowed.some(o => origin.startsWith(o.replace(/\/$/, '')))) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth',    authRoutes);
app.use('/daily',   dailyRoutes);
app.use('/convert', convertRoutes);
app.use('/games',   gameRoutes);
app.use('/social',  socialRoutes);
app.use('/shop',    shopRoutes);

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  socket.on('auth', ({ token } = {}) => {
    if (!token) {
      socket.emit('auth:error', { message: 'No token provided' });
      return socket.disconnect(true);
    }
    try {
      const payload = verifySocketToken(token);
      socket.user = { userId: payload.userId, username: payload.username };
      socket.join(`user:${payload.userId}`);
      socket.emit('auth:ok', { user_id: payload.userId, username: payload.username });
      console.log(`[socket] authenticated: ${payload.username}`);

      const pvp = require('./pvp/matchmaking');
      if (pvp.userSocket) pvp.userSocket.set(payload.userId, socket);

      registerCrashHandlers(io, socket);
      registerMinesHandlers(io, socket);
      registerBlackjackHandlers(io, socket);
      registerPvpHandlers(io, socket);    // PvP — needs io for broadcasting
      registerGuildHandlers(io, socket);

    } catch (err) {
      socket.emit('auth:error', { message: 'Invalid or expired token' });
      socket.disconnect(true);
    }
  });

  socket.on('disconnect', () => {
    if (socket.user) console.log(`[socket] disconnected: ${socket.user.username}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`[server] Listening on port ${PORT}`);
  try { await query('SELECT 1'); console.log('[DB] Connected to Neon ✓'); }
  catch (err) { console.error('[DB] Connection failed:', err.message); }
  try { const ok = await redisPing(); console.log('[Redis] Connected to Upstash', ok ? '✓' : '(unexpected)'); }
  catch (err) { console.error('[Redis] Connection failed:', err.message); }
});

module.exports = { app, io };
