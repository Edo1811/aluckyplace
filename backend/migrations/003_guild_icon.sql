-- ============================================================
-- A "lucky" place — guild crest (icon + background colour)
-- The backend also applies this automatically on startup (ensureSchema in
-- src/index.js), so running it by hand is optional.
-- ============================================================

ALTER TABLE guilds ADD COLUMN IF NOT EXISTS icon    VARCHAR(16) NOT NULL DEFAULT '🏰';
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS icon_bg VARCHAR(9)  NOT NULL DEFAULT '#10b981';
