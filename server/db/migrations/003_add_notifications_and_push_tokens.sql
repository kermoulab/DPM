-- =============================================================================
-- Migration 003: Push Device Tokens and Notifications Schema for Vectis
-- =============================================================================

-- 1. Push Device Tokens (Multi-device support per user)
CREATE TABLE IF NOT EXISTS push_tokens (
  id              VARCHAR(64) PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id       VARCHAR(64),
  token           TEXT NOT NULL,
  platform        VARCHAR(20) NOT NULL DEFAULT 'android',
  app_version     VARCHAR(30),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at    TIMESTAMPTZ,
  CONSTRAINT uq_user_device_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_is_active ON push_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_push_tokens_device_id ON push_tokens(device_id);

-- 2. In-App Notifications and Duplicate Delivery Prevention Ledger
CREATE TABLE IF NOT EXISTS notifications (
  id              VARCHAR(64) PRIMARY KEY,
  user_id         VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            VARCHAR(50) NOT NULL,
  title           VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  entity_type     VARCHAR(50),
  entity_id       VARCHAR(64),
  dedup_key       VARCHAR(150),
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_dedup ON notifications(user_id, dedup_key);
