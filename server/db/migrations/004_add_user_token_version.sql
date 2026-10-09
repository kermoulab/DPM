-- 004_add_user_token_version.sql
-- Invalidate active sessions upon password rotation or credential change

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
