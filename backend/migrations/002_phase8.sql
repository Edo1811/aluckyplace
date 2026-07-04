-- ============================================================
-- A "lucky" place — Phase 8 (Guilds & Social)
-- Run once in your Neon SQL console, after 001_initial.sql.
--
-- Everything else Phase 8 needs (guilds, guild_members,
-- guild_fund_contributions, donations, hall_of_fame,
-- hall_of_shame, leaderboard_badges) already exists in 001.
-- This migration only adds the join-request/approval table.
-- ============================================================

CREATE TABLE IF NOT EXISTS guild_join_requests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status      VARCHAR(10) NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID        REFERENCES users(id),
  UNIQUE (guild_id, user_id)   -- one row per (guild,user); re-request via upsert resets to pending
);

CREATE INDEX IF NOT EXISTS idx_guild_join_requests_pending
  ON guild_join_requests (guild_id, status);

CREATE INDEX IF NOT EXISTS idx_guild_join_requests_user
  ON guild_join_requests (user_id);
