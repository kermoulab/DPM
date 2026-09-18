-- =============================================================================
-- Recura ERP — Authoritative Database Schema
-- =============================================================================
-- This file is the source of truth for the database structure.
-- The actual database is initialized via server/db.ts:initDatabase() which
-- mirrors this schema exactly. additive migrations (ALTER TABLE) are also
-- in db.ts to handle existing databases.
--
-- SQLite with WAL mode and FK enforcement is used in production.
-- All IDs are application-generated (prefixed UUID fragments).
-- All timestamps are ISO 8601 UTC strings (TEXT).
-- Sensitive credentials are stored AES-256-GCM encrypted, never plaintext.
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

-- =============================================================================
-- SYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS system_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- =============================================================================
-- USERS & AUTH
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  username          TEXT UNIQUE NOT NULL,
  email             TEXT UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  password_hash     TEXT NOT NULL,   -- PBKDF2-SHA512, 100,000 iterations, 64-byte output, hex
  password_salt     TEXT NOT NULL,   -- 16-byte random, hex
  role              TEXT NOT NULL DEFAULT 'admin', -- 'owner' | 'admin' | 'manager' | 'agent' | 'viewer'
  status            TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  avatar            TEXT,
  preferred_currency TEXT DEFAULT 'USD',
  created_at        TEXT NOT NULL,
  last_login        TEXT
);

-- =============================================================================
-- PRODUCT CATALOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  icon        TEXT,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id               TEXT PRIMARY KEY,
  category_id      TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  slug             TEXT UNIQUE NOT NULL,
  brand            TEXT,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  capabilities     TEXT NOT NULL, -- JSON array: ["subscription","service_account","profiles","license_key","digital_file","merch_mockup","manual_fulfillment"]
  fulfillment_type TEXT NOT NULL DEFAULT 'automatic', -- 'automatic' | 'service_account' | 'license_key' | 'digital_file' | 'manual'
  custom_fields    TEXT,          -- JSON array of field definitions
  icon             TEXT,
  image_url        TEXT,
  stock_limit      INTEGER DEFAULT NULL, -- max concurrent active orders; NULL = unlimited
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  duration      INTEGER NOT NULL,
  duration_unit TEXT NOT NULL, -- 'hours' | 'days' | 'weeks' | 'months' | 'years'
  price         REAL NOT NULL,
  cost          REAL NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  status        TEXT NOT NULL DEFAULT 'active',
  stock_limit   INTEGER DEFAULT NULL, -- max concurrent active orders for this plan; NULL = unlimited
  created_at    TEXT NOT NULL
);

-- =============================================================================
-- CUSTOMERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT,
  whatsapp   TEXT,
  notes      TEXT,
  status     TEXT NOT NULL DEFAULT 'active', -- 'active' | 'blocked' | 'inactive'
  created_at TEXT NOT NULL
);

-- =============================================================================
-- INVENTORY — SERVICE ACCOUNTS (streaming/subscription platform accounts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS service_accounts (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,
  login                TEXT NOT NULL,
  encrypted_credential TEXT NOT NULL, -- AES-256-GCM encrypted password (hex)
  iv                   TEXT NOT NULL, -- 12-byte GCM IV (hex)
  tag                  TEXT NOT NULL, -- 16-byte GCM auth tag (hex)
  status               TEXT NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'expired'
  expiry_date          TEXT,
  capacity             INTEGER NOT NULL DEFAULT 5,
  notes                TEXT,
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_profiles (
  id                   TEXT PRIMARY KEY,
  service_account_id   TEXT NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
  profile_name         TEXT NOT NULL,
  pin                  TEXT,
  status               TEXT NOT NULL DEFAULT 'available', -- 'available' | 'assigned' | 'reserved' | 'blocked'
  assigned_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  assigned_order_id    TEXT,
  created_at           TEXT NOT NULL
);

-- =============================================================================
-- INVENTORY — LICENSE KEYS & ACTIVATION CODES
-- =============================================================================

CREATE TABLE IF NOT EXISTS license_keys (
  id                   TEXT PRIMARY KEY,
  product_id           TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  license_key          TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'available', -- 'available' | 'assigned' | 'expired' | 'blocked'
  assigned_order_id    TEXT,
  assigned_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  expiry_date          TEXT,
  notes                TEXT,
  created_at           TEXT NOT NULL
);

-- =============================================================================
-- INVENTORY — DIGITAL ASSETS
-- =============================================================================

CREATE TABLE IF NOT EXISTS digital_assets (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  asset_type     TEXT NOT NULL, -- 'file' | 'mockup_template' | 'print_ready'
  file_url       TEXT NOT NULL,
  specs          TEXT,          -- JSON
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL
);

-- =============================================================================
-- MERCH MOCKUPS
-- =============================================================================

CREATE TABLE IF NOT EXISTS merch_mockups (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT REFERENCES customers(id) ON DELETE SET NULL,
  product_name      TEXT NOT NULL,
  color             TEXT NOT NULL DEFAULT '#1e293b',
  placement         TEXT NOT NULL DEFAULT 'chest_center',
  logo_url          TEXT NOT NULL,
  preview_image_url TEXT,
  print_specs       TEXT,   -- JSON
  status            TEXT NOT NULL DEFAULT 'draft',
  created_at        TEXT NOT NULL
);

-- =============================================================================
-- ORDERS & RENEWALS
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id                          TEXT PRIMARY KEY,
  order_number                TEXT UNIQUE NOT NULL,
  customer_id                 TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id                  TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  plan_id                     TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status                      TEXT NOT NULL DEFAULT 'active', -- 'pending' | 'active' | 'expiring' | 'expired' | 'cancelled' | 'completed'
  start_date                  TEXT NOT NULL,
  end_date                    TEXT NOT NULL,
  price                       REAL NOT NULL,
  cost                        REAL NOT NULL DEFAULT 0,
  currency                    TEXT NOT NULL DEFAULT 'USD',
  payment_status              TEXT NOT NULL DEFAULT 'paid', -- 'paid' | 'pending' | 'refunded'
  payment_method              TEXT NOT NULL DEFAULT 'cash', -- 'cash' | 'transfer' | 'card' | 'crypto'
  fulfillment_type            TEXT NOT NULL,
  assigned_service_account_id TEXT,
  assigned_profile_id         TEXT,
  assigned_license_key_id     TEXT,
  assigned_digital_asset_id   TEXT,
  fulfillment_data            TEXT, -- JSON (decrypted credentials stored at time of order; treat as sensitive)
  renewal_count               INTEGER NOT NULL DEFAULT 0,
  whatsapp_contacted_at       TEXT,
  created_by_user_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at                  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_renewals (
  id                  TEXT PRIMARY KEY,
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_end_date   TEXT NOT NULL,
  new_end_date        TEXT NOT NULL,
  price               REAL NOT NULL,
  cost                REAL NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL,
  created_by_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TEXT NOT NULL
);

-- =============================================================================
-- CURRENCIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS currencies (
  code              TEXT PRIMARY KEY, -- ISO 4217, e.g. 'USD'
  symbol            TEXT NOT NULL,
  name              TEXT NOT NULL,
  exchange_rate     REAL NOT NULL,    -- relative to base currency (USD)
  decimal_precision INTEGER NOT NULL DEFAULT 2,
  is_base           INTEGER NOT NULL DEFAULT 0, -- 1 = this is the base currency
  updated_at        TEXT NOT NULL
);

-- =============================================================================
-- NOTIFICATIONS (WhatsApp message templates)
-- =============================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'order_created' | 'order_expiring' | 'order_expired' | 'renewal_confirmation' | 'credentials_delivery'
  language   TEXT NOT NULL, -- 'en' | 'fr' | 'ar' | 'ru'
  content    TEXT NOT NULL, -- Template string with {customer_name}, {product_name}, {end_date}, etc.
  created_at TEXT NOT NULL,
  updated_at TEXT         -- populated on update
);

-- =============================================================================
-- PAIRED DEVICES (Android Reseller Terminal)
-- =============================================================================

CREATE TABLE IF NOT EXISTS paired_devices (
  id                  TEXT PRIMARY KEY,
  device_name         TEXT NOT NULL,
  device_type         TEXT NOT NULL DEFAULT 'android',
  device_token_hash   TEXT NOT NULL,  -- SHA-256 of pairing code + timestamp
  paired_by_user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  pairing_code        TEXT,           -- 6-digit code; NULL after successful pairing
  code_expires_at     TEXT,
  status              TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paired' | 'revoked'
  last_seen           TEXT,
  created_at          TEXT NOT NULL
);

-- =============================================================================
-- AUDIT LOG (immutable append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,    -- NULL for system events
  username   TEXT,    -- snapshot at time of action
  action     TEXT NOT NULL, -- e.g. 'LOGIN_SUCCESS', 'CREATE_ORDER', 'REVEAL_CREDENTIALS'
  entity     TEXT NOT NULL, -- table name: 'user', 'order', 'service_account', etc.
  entity_id  TEXT,
  details    TEXT,    -- JSON (all secret values REDACTED before insert)
  ip         TEXT,
  created_at TEXT NOT NULL
);

-- =============================================================================
-- DEFAULT REFERENCE DATA (seeded by server/db.ts:initDatabase on first startup)
-- =============================================================================
-- Currencies: USD (base), EUR, GBP, AED, SAR, CAD
-- Notification Templates: 12 templates (3 event types × 4 languages: en, fr, ar, ru)
--
-- Business data (customers, orders, products, etc.) is NEVER pre-seeded by
-- the application. Demo data is only available as an explicit opt-in during
-- the installer setup wizard (seedDemoData: true), and is clearly marked.
-- =============================================================================
