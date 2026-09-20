-- =============================================================================
-- Migration 001: Initial PostgreSQL Schema for Vectis
-- =============================================================================

-- Schema Migrations Table
CREATE TABLE IF NOT EXISTS schema_migrations (
  id          SERIAL PRIMARY KEY,
  version     VARCHAR(100) UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1. System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users & Staff
CREATE TABLE IF NOT EXISTS users (
  id                  VARCHAR(64) PRIMARY KEY,
  username            VARCHAR(50) UNIQUE NOT NULL,
  email               VARCHAR(255) UNIQUE NOT NULL,
  name                VARCHAR(100) NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  password_salt       VARCHAR(64) NOT NULL,
  role                VARCHAR(20) NOT NULL DEFAULT 'admin'
                      CHECK (role IN ('owner', 'admin', 'manager', 'agent', 'viewer')),
  status              VARCHAR(20) NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'inactive', 'suspended')),
  avatar              TEXT,
  preferred_currency  VARCHAR(10) DEFAULT 'USD',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 3. Product Categories
CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(64) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  icon        VARCHAR(50) DEFAULT 'Folder',
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);

-- 4. Products
CREATE TABLE IF NOT EXISTS products (
  id                VARCHAR(64) PRIMARY KEY,
  category_id       VARCHAR(64) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name              VARCHAR(150) NOT NULL,
  slug              VARCHAR(150) UNIQUE NOT NULL,
  brand             VARCHAR(100),
  description       TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive', 'archived')),
  capabilities      JSONB NOT NULL DEFAULT '["subscription","manual_fulfillment"]'::jsonb,
  fulfillment_type  VARCHAR(50) NOT NULL DEFAULT 'automatic',
  custom_fields     JSONB DEFAULT '[]'::jsonb,
  icon              VARCHAR(50) DEFAULT 'Box',
  image_url         TEXT,
  stock_limit       INTEGER DEFAULT NULL CHECK (stock_limit IS NULL OR stock_limit >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_fulfillment_type ON products(fulfillment_type);

-- 5. Subscription Plans
CREATE TABLE IF NOT EXISTS plans (
  id             VARCHAR(64) PRIMARY KEY,
  product_id     VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name           VARCHAR(100) NOT NULL,
  duration       INTEGER NOT NULL CHECK (duration > 0),
  duration_unit  VARCHAR(20) NOT NULL
                 CHECK (duration_unit IN ('hours', 'days', 'weeks', 'months', 'years')),
  price          NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  cost           NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
  currency       VARCHAR(10) NOT NULL DEFAULT 'USD',
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'inactive')),
  stock_limit    INTEGER DEFAULT NULL CHECK (stock_limit IS NULL OR stock_limit >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_product_id ON plans(product_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);

-- 6. Customers
CREATE TABLE IF NOT EXISTS customers (
  id          VARCHAR(64) PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  email       VARCHAR(255),
  whatsapp    VARCHAR(50),
  notes       TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'blocked', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_whatsapp ON customers(whatsapp);

-- 7. Service Accounts (Inventory)
CREATE TABLE IF NOT EXISTS service_accounts (
  id                    VARCHAR(64) PRIMARY KEY,
  product_id            VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider              VARCHAR(100) NOT NULL,
  login                 VARCHAR(255) NOT NULL,
  encrypted_credential  TEXT NOT NULL,
  iv                    VARCHAR(64) NOT NULL,
  tag                   VARCHAR(64) NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'expired')),
  expiry_date           DATE,
  capacity              INTEGER NOT NULL DEFAULT 5 CHECK (capacity > 0),
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_accounts_product_id ON service_accounts(product_id);
CREATE INDEX IF NOT EXISTS idx_service_accounts_status ON service_accounts(status);

-- 8. Service Profiles (Inventory sub-slots)
CREATE TABLE IF NOT EXISTS service_profiles (
  id                    VARCHAR(64) PRIMARY KEY,
  service_account_id    VARCHAR(64) NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
  profile_name          VARCHAR(100) NOT NULL,
  pin                   VARCHAR(20),
  status                VARCHAR(20) NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available', 'assigned', 'reserved', 'blocked')),
  assigned_customer_id  VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
  assigned_order_id     VARCHAR(64),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_profiles_account_id ON service_profiles(service_account_id);
CREATE INDEX IF NOT EXISTS idx_service_profiles_status ON service_profiles(status);
CREATE INDEX IF NOT EXISTS idx_service_profiles_assigned_customer ON service_profiles(assigned_customer_id);

-- 9. License Keys (Inventory)
CREATE TABLE IF NOT EXISTS license_keys (
  id                    VARCHAR(64) PRIMARY KEY,
  product_id            VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  license_key           TEXT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'available'
                        CHECK (status IN ('available', 'assigned', 'expired', 'blocked')),
  assigned_order_id     VARCHAR(64),
  assigned_customer_id  VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
  expiry_date           DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_license_keys_product_id ON license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_status ON license_keys(status);
CREATE INDEX IF NOT EXISTS idx_license_keys_assigned_customer ON license_keys(assigned_customer_id);

-- 10. Digital Assets
CREATE TABLE IF NOT EXISTS digital_assets (
  id              VARCHAR(64) PRIMARY KEY,
  product_id      VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  asset_type      VARCHAR(50) NOT NULL,
  file_url        TEXT NOT NULL,
  specs           JSONB DEFAULT '{}'::jsonb,
  download_count  INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_digital_assets_product_id ON digital_assets(product_id);

-- 11. Merch Mockups
CREATE TABLE IF NOT EXISTS merch_mockups (
  id                 VARCHAR(64) PRIMARY KEY,
  customer_id        VARCHAR(64) REFERENCES customers(id) ON DELETE SET NULL,
  product_name       VARCHAR(150) NOT NULL,
  color              VARCHAR(30) NOT NULL DEFAULT '#1e293b',
  placement          VARCHAR(50) NOT NULL DEFAULT 'chest_center',
  logo_url           TEXT NOT NULL,
  preview_image_url  TEXT,
  print_specs        JSONB DEFAULT '{}'::jsonb,
  status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merch_mockups_customer_id ON merch_mockups(customer_id);
CREATE INDEX IF NOT EXISTS idx_merch_mockups_status ON merch_mockups(status);

-- 12. Orders
CREATE TABLE IF NOT EXISTS orders (
  id                           VARCHAR(64) PRIMARY KEY,
  order_number                 VARCHAR(50) UNIQUE NOT NULL,
  customer_id                  VARCHAR(64) NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id                   VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  plan_id                      VARCHAR(64) NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status                       VARCHAR(20) NOT NULL DEFAULT 'active'
                               CHECK (status IN ('pending', 'active', 'expiring', 'expired', 'cancelled', 'completed')),
  start_date                   DATE NOT NULL,
  end_date                     DATE NOT NULL,
  price                        NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  cost                         NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
  currency                     VARCHAR(10) NOT NULL DEFAULT 'USD',
  payment_status               VARCHAR(20) NOT NULL DEFAULT 'paid'
                               CHECK (payment_status IN ('paid', 'pending', 'refunded')),
  payment_method               VARCHAR(20) NOT NULL DEFAULT 'cash'
                               CHECK (payment_method IN ('cash', 'transfer', 'card', 'crypto')),
  fulfillment_type             VARCHAR(50) NOT NULL,
  assigned_service_account_id  VARCHAR(64) REFERENCES service_accounts(id) ON DELETE SET NULL,
  assigned_profile_id          VARCHAR(64) REFERENCES service_profiles(id) ON DELETE SET NULL,
  assigned_license_key_id      VARCHAR(64) REFERENCES license_keys(id) ON DELETE SET NULL,
  assigned_digital_asset_id    VARCHAR(64) REFERENCES digital_assets(id) ON DELETE SET NULL,
  fulfillment_data             JSONB NOT NULL DEFAULT '{}'::jsonb,
  renewal_count                INTEGER NOT NULL DEFAULT 0 CHECK (renewal_count >= 0),
  whatsapp_contacted_at        TIMESTAMPTZ,
  created_by_user_id           VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_plan_id ON orders(plan_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_start_date ON orders(start_date);
CREATE INDEX IF NOT EXISTS idx_orders_end_date ON orders(end_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 13. Order Renewals
CREATE TABLE IF NOT EXISTS order_renewals (
  id                  VARCHAR(64) PRIMARY KEY,
  order_id            VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_end_date   DATE NOT NULL,
  new_end_date        DATE NOT NULL,
  price               NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  cost                NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost >= 0),
  currency            VARCHAR(10) NOT NULL,
  created_by_user_id  VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_renewals_order_id ON order_renewals(order_id);
CREATE INDEX IF NOT EXISTS idx_order_renewals_created_at ON order_renewals(created_at);

-- 14. Currencies
CREATE TABLE IF NOT EXISTS currencies (
  code               VARCHAR(10) PRIMARY KEY,
  symbol             VARCHAR(10) NOT NULL,
  name               VARCHAR(100) NOT NULL,
  exchange_rate      NUMERIC(14, 6) NOT NULL CHECK (exchange_rate > 0),
  decimal_precision  SMALLINT NOT NULL DEFAULT 2 CHECK (decimal_precision >= 0 AND decimal_precision <= 8),
  is_base            BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_currencies_is_base ON currencies(is_base);

-- 15. Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id          VARCHAR(64) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  event_type  VARCHAR(50) NOT NULL,
  language    VARCHAR(10) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_notification_event_lang UNIQUE (event_type, language)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_event_lang ON notification_templates(event_type, language);

-- 16. Paired Devices (Android Reseller Terminals)
CREATE TABLE IF NOT EXISTS paired_devices (
  id                 VARCHAR(64) PRIMARY KEY,
  device_name        VARCHAR(100) NOT NULL,
  device_type        VARCHAR(50) NOT NULL DEFAULT 'android',
  device_token_hash  VARCHAR(255) NOT NULL,
  paired_by_user_id  VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  pairing_code       VARCHAR(10),
  code_expires_at    TIMESTAMPTZ,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paired', 'revoked')),
  last_seen          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paired_devices_status ON paired_devices(status);
CREATE INDEX IF NOT EXISTS idx_paired_devices_user_id ON paired_devices(paired_by_user_id);

-- 17. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(64),
  username    VARCHAR(100),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50) NOT NULL,
  entity_id   VARCHAR(64),
  details     JSONB DEFAULT '{}'::jsonb,
  ip          VARCHAR(50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
