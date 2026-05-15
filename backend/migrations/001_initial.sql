-- ============================================================
-- A "lucky" place — Initial Schema
-- Run once in your Neon SQL console.
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username        VARCHAR(32) NOT NULL UNIQUE,
  email           VARCHAR(255) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,
  cc_balance      BIGINT      NOT NULL DEFAULT 1000,
  a_balance       BIGINT      NOT NULL DEFAULT 10,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at   TIMESTAMPTZ,
  hos_opted_out   BOOLEAN     NOT NULL DEFAULT FALSE
);

-- Daily streaks
CREATE TABLE IF NOT EXISTS daily_streaks (
  user_id         UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak  SMALLINT    NOT NULL DEFAULT 0,
  last_claimed_at TIMESTAMPTZ NOT NULL
);

-- Solo game results (immutable log)
CREATE TABLE IF NOT EXISTS game_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game          VARCHAR(20) NOT NULL,
  bet_amount    BIGINT      NOT NULL,
  payout_amount BIGINT      NOT NULL,
  net           BIGINT      NOT NULL,
  server_seed   VARCHAR(64) NOT NULL,
  server_hash   VARCHAR(64) NOT NULL,
  nonce         BIGINT      NOT NULL,
  extra         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_results_user
  ON game_results (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_results_hall
  ON game_results (game, net DESC);

-- PvP matches
CREATE TABLE IF NOT EXISTS pvp_matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game          VARCHAR(20) NOT NULL,
  player1_id    UUID        NOT NULL REFERENCES users(id),
  player2_id    UUID        NOT NULL REFERENCES users(id),
  bet_p1        BIGINT      NOT NULL,
  bet_p2        BIGINT      NOT NULL,
  pot           BIGINT      NOT NULL,
  winner_id     UUID        REFERENCES users(id),
  server_seed   VARCHAR(64),
  server_hash   VARCHAR(64),
  extra         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pvp_matches_p1
  ON pvp_matches (player1_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pvp_matches_p2
  ON pvp_matches (player2_id, created_at DESC);

-- Win streaks (per user per game)
CREATE TABLE IF NOT EXISTS win_streaks (
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game           VARCHAR(20) NOT NULL,
  current_streak SMALLINT    NOT NULL DEFAULT 0,
  best_streak    SMALLINT    NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game)
);

-- Achievements (sparse — missing row = locked)
CREATE TABLE IF NOT EXISTS achievements (
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id SMALLINT    NOT NULL,
  unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Challenges progress
CREATE TABLE IF NOT EXISTS challenges (
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id   SMALLINT    NOT NULL,
  progress       INT         NOT NULL DEFAULT 0,
  completed_at   TIMESTAMPTZ,
  reward_claimed BOOLEAN     NOT NULL DEFAULT FALSE,
  PRIMARY KEY (user_id, challenge_id)
);

-- Guilds
CREATE TABLE IF NOT EXISTS guilds (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(64) NOT NULL UNIQUE,
  tag           VARCHAR(8)  NOT NULL UNIQUE,
  description   VARCHAR(256),
  owner_id      UUID        NOT NULL REFERENCES users(id),
  is_private    BOOLEAN     NOT NULL DEFAULT FALSE,
  fund_balance  BIGINT      NOT NULL DEFAULT 0,
  unlocked      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guild members
CREATE TABLE IF NOT EXISTS guild_members (
  guild_id              UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  donations_sent_today  SMALLINT    NOT NULL DEFAULT 0,
  donations_recv_today  SMALLINT    NOT NULL DEFAULT 0,
  last_donation_reset   DATE        NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_guild_members_user
  ON guild_members (user_id);

-- Guild fund contribution log
CREATE TABLE IF NOT EXISTS guild_fund_contributions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id),
  amount      BIGINT      NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CC donations between members
CREATE TABLE IF NOT EXISTS donations (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     UUID        NOT NULL REFERENCES users(id),
  receiver_id   UUID        NOT NULL REFERENCES users(id),
  guild_id      UUID        NOT NULL REFERENCES guilds(id),
  gross_amount  BIGINT      NOT NULL,
  net_amount    BIGINT      NOT NULL,
  house_cut     BIGINT      NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cosmetics catalog (seeded separately, never mutated by users)
CREATE TABLE IF NOT EXISTS cosmetics_catalog (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(64) NOT NULL,
  category      VARCHAR(32) NOT NULL,
  rarity        VARCHAR(16) NOT NULL,
  preview_key   VARCHAR(64),
  is_obtainable BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Player cosmetic inventory
CREATE TABLE IF NOT EXISTS user_cosmetics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cosmetic_id  UUID        NOT NULL REFERENCES cosmetics_catalog(id),
  acquired_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_equipped  BOOLEAN     NOT NULL DEFAULT FALSE,
  source       VARCHAR(20) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cosmetics_unique
  ON user_cosmetics (user_id, cosmetic_id);

-- Player shop listings
CREATE TABLE IF NOT EXISTS shop_listings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id        UUID        NOT NULL REFERENCES users(id),
  cosmetic_id      UUID        NOT NULL REFERENCES cosmetics_catalog(id),
  user_cosmetic_id UUID        NOT NULL REFERENCES user_cosmetics(id),
  price_a          INT         NOT NULL,
  listed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sold_at          TIMESTAMPTZ,
  buyer_id         UUID        REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shop_listings_active
  ON shop_listings (sold_at) WHERE sold_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_shop_listings_cosmetic
  ON shop_listings (cosmetic_id) WHERE sold_at IS NULL;

-- Hall of Fame entries
CREATE TABLE IF NOT EXISTS hall_of_fame (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger     VARCHAR(32) NOT NULL,
  amount      BIGINT,
  game        VARCHAR(20),
  extra       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hall of Shame entries
CREATE TABLE IF NOT EXISTS hall_of_shame (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger     VARCHAR(32) NOT NULL,
  amount      BIGINT,
  game        VARCHAR(20),
  extra       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weekly leaderboard badge log
CREATE TABLE IF NOT EXISTS leaderboard_badges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id),
  week_start   DATE        NOT NULL,
  cc_at_award  BIGINT      NOT NULL,
  awarded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (week_start)
);

-- Provably fair nonces (one row per user, increments each game)
CREATE TABLE IF NOT EXISTS provably_fair_nonces (
  user_id  UUID   PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nonce    BIGINT NOT NULL DEFAULT 0
);
