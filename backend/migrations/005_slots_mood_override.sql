-- ============================================================
-- A "lucky" place — slots warmth overrides
-- An admin can pin a day's slots mood (cold/normal/warm/hot) from the
-- admin panel; days without a row use the random HMAC mood.
-- date is the Berlin calendar day as 'YYYY-MM-DD' text (no timezone
-- conversion surprises). The backend also creates this table on startup
-- (ensureSchema in src/index.js).
-- ============================================================

CREATE TABLE IF NOT EXISTS slots_mood_overrides (
  date   VARCHAR(10) PRIMARY KEY,
  mood   VARCHAR(10) NOT NULL,
  set_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  set_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
