require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors    = require('cors');
const helmet  = require('helmet');

const { query }            = require('./db');
const { ping: redisPing }  = require('./redis');
const { verifySocketToken } = require('./auth/middleware');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes    = require('./auth/routes');
const dailyRoutes   = require('./economy/daily');
const convertRoutes = require('./economy/balance');
const gameRoutes    = require('./games/routes');
const socialRoutes  = require('./social/leaderboard');
const shopRoutes    = require('./shop/listings');

// ── Socket handler stubs ──────────────────────────────────────────────────────
const registerCrashHandlers     = require('./games/crash');
const registerMinesHandlers     = require('./games/mines');
const registerBlackjackHandlers = require('./games/blackjack');
const registerPvpHandlers       = require('./pvp/matchmaking');
const registerGuildHandlers     = require('./social/guilds');

// ─────────────────────────────────────────────────────────────────────────────

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
  ].filter(Boolean);
  if (!origin || allowed.some(o => origin.startsWith(o.replace(/\/$/, '')))) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
},
    credentials: true,
  },
});

// ── Global middleware ─────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
  ].filter(Boolean);
  if (!origin || allowed.some(o => origin.startsWith(o.replace(/\/$/, '')))) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
},
  credentials: true,
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── REST routes ───────────────────────────────────────────────────────────────
app.use('/auth',    authRoutes);
app.use('/daily',   dailyRoutes);
app.use('/convert', convertRoutes);
app.use('/games',   gameRoutes);
app.use('/social',  socialRoutes);
app.use('/shop',    shopRoutes);

// ── Socket.io — auth handshake ────────────────────────────────────────────────
// Every socket must send { token } as the first event after connecting.
// On success: socket.user is set and socket joins room `user:<userId>`.
// On failure: an error is emitted and the socket is disconnected.

io.on('connection', (socket) => {

  socket.on('auth', ({ token } = {}) => {
    if (!token) {
      socket.emit('auth:error', { message: 'No token provided' });
      return socket.disconnect(true);
    }

    try {
      const payload = verifySocketToken(token);
      socket.user = { userId: payload.userId, username: payload.username };

      // Join a personal room so the server can target this user directly
      socket.join(`user:${payload.userId}`);

      socket.emit('auth:ok', {
        user_id:  payload.userId,
        username: payload.username,
      });

      console.log(`[socket] authenticated: ${payload.username} (${socket.id})`);

      // Register game / feature handlers now that we know who this is
      registerCrashHandlers(io, socket);
      registerMinesHandlers(io, socket);
      registerBlackjackHandlers(io, socket);
      registerPvpHandlers(io, socket);
      registerGuildHandlers(io, socket);

    } catch (err) {
      socket.emit('auth:error', { message: 'Invalid or expired token' });
      socket.disconnect(true);
    }
  });

  socket.on('disconnect', () => {
    if (socket.user) {
      console.log(`[socket] disconnected: ${socket.user.username} (${socket.id})`);
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  console.log(`[server] Listening on port ${PORT}`);

  try {
    await query('SELECT 1');
    console.log('[DB] Connected to Neon ✓');
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
  }

  try {
    const ok = await redisPing();
    console.log('[Redis] Connected to Upstash', ok ? '✓' : '(unexpected response)');
  } catch (err) {
    console.error('[Redis] Connection failed:', err.message);
  }
});

module.exports = { app, io };
