-- ============================================================
-- A "lucky" place — per-user lifetime stats (progression)
-- Used by src/progression (game counters, PvP streaks, bankruptcies)
-- and GET /profile/:username. The live database already has this
-- table; this file makes fresh installs match. The backend also
-- creates it on startup (ensureSchema in src/index.js).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_stats (
  user_id             UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_games         INT         NOT NULL DEFAULT 0,
  total_wins          INT         NOT NULL DEFAULT 0,
  biggest_win         BIGINT      NOT NULL DEFAULT 0,
  biggest_loss        BIGINT      NOT NULL DEFAULT 0,
  bankruptcy_count    INT         NOT NULL DEFAULT 0,
  total_pvp_wins      INT         NOT NULL DEFAULT 0,
  pvp_win_streak      INT         NOT NULL DEFAULT 0,
  best_pvp_win_streak INT         NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
