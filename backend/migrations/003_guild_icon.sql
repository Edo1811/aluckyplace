-- ============================================================
-- A "lucky" place — guild crest (icon + background colour)
-- Run once in your Neon SQL console, after 002_phase8.sql,
-- BEFORE deploying the backend that selects these columns.
-- ============================================================

ALTER TABLE guilds ADD COLUMN IF NOT EXISTS icon    VARCHAR(16) NOT NULL DEFAULT '🏰';
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS icon_bg VARCHAR(9)  NOT NULL DEFAULT '#10b981';
