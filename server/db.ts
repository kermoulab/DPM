import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'erp.db');
export const db = new DatabaseSync(DB_PATH);

// Enable foreign key enforcement & WAL journal mode for ACID durability and crash resilience
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

// Initialize tables
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      status TEXT NOT NULL DEFAULT 'active',
      avatar TEXT,
      preferred_currency TEXT DEFAULT 'USD',
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      brand TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      capabilities TEXT NOT NULL, -- JSON array e.g. ["subscription","service_account","profiles"]
      fulfillment_type TEXT NOT NULL DEFAULT 'automatic', -- 'automatic', 'service_account', 'license_key', 'digital_file', 'manual'
      custom_fields TEXT, -- JSON
      icon TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      duration_unit TEXT NOT NULL, -- 'hours', 'days', 'weeks', 'months', 'years'
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      whatsapp TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'blocked'
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_accounts (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      login TEXT NOT NULL,
      encrypted_credential TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'expired'
      expiry_date TEXT,
      capacity INTEGER NOT NULL DEFAULT 5,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_profiles (
      id TEXT PRIMARY KEY,
      service_account_id TEXT NOT NULL REFERENCES service_accounts(id) ON DELETE CASCADE,
      profile_name TEXT NOT NULL,
      pin TEXT,
      status TEXT NOT NULL DEFAULT 'available', -- 'available', 'assigned', 'reserved', 'blocked'
      assigned_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      assigned_order_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license_keys (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      license_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available', -- 'available', 'assigned', 'expired', 'blocked'
      assigned_order_id TEXT,
      assigned_customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      expiry_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS digital_assets (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      asset_type TEXT NOT NULL, -- 'file', 'mockup_template', 'print_ready'
      file_url TEXT NOT NULL,
      specs TEXT, -- JSON
      download_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'active', -- 'pending', 'active', 'expiring', 'expired', 'cancelled', 'completed'
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'USD',
      payment_status TEXT NOT NULL DEFAULT 'paid', -- 'paid', 'pending', 'refunded'
      payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'transfer', 'card', 'crypto'
      fulfillment_type TEXT NOT NULL,
      assigned_service_account_id TEXT,
      assigned_profile_id TEXT,
      assigned_license_key_id TEXT,
      assigned_digital_asset_id TEXT,
      fulfillment_data TEXT, -- JSON
      renewal_count INTEGER NOT NULL DEFAULT 0,
      whatsapp_contacted_at TEXT,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_renewals (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      previous_end_date TEXT NOT NULL,
      new_end_date TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL,
      created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code TEXT PRIMARY KEY,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      exchange_rate REAL NOT NULL,
      decimal_precision INTEGER NOT NULL DEFAULT 2,
      is_base INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'order_created', 'order_expiring', 'order_expired', 'renewal_confirmation', 'credentials_delivery'
      language TEXT NOT NULL, -- 'en', 'fr', 'ar', 'ru'
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paired_devices (
      id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL DEFAULT 'android',
      device_token_hash TEXT NOT NULL,
      paired_by_user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      pairing_code TEXT,
      code_expires_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paired', 'revoked'
      last_seen TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT, -- JSON (sanitized, no secrets)
      ip TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS merch_mockups (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#1e293b',
      placement TEXT NOT NULL DEFAULT 'chest_center',
      logo_url TEXT NOT NULL,
      preview_image_url TEXT,
      print_specs TEXT, -- JSON
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL
    );
  `);

  // Safe schema migrations for stock capacity limits and templates
  try {
    db.prepare('ALTER TABLE products ADD COLUMN stock_limit INTEGER DEFAULT NULL').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE plans ADD COLUMN stock_limit INTEGER DEFAULT NULL').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE notification_templates ADD COLUMN updated_at TEXT').run();
  } catch (_) {}
  try {
    db.prepare('ALTER TABLE orders ADD COLUMN whatsapp_contacted_at TEXT').run();
  } catch (_) {}
  try {
    db.prepare("ALTER TABLE users ADD COLUMN preferred_currency TEXT DEFAULT 'USD'").run();
  } catch (_) {}

  // Seed default currencies if table is empty
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM currencies').get() as any;
    if (!count || count.count === 0) {
      const defaultCurrencies = [
        ['USD', '$', 'US Dollar', 1.0, 2, 1],
        ['EUR', '€', 'Euro', 0.92, 2, 0],
        ['GBP', '£', 'British Pound', 0.78, 2, 0],
        ['AED', 'AED', 'UAE Dirham', 3.67, 2, 0],
        ['SAR', 'SAR', 'Saudi Riyal', 3.75, 2, 0],
        ['CAD', 'CA$', 'Canadian Dollar', 1.35, 2, 0]
      ];
      const now = new Date().toISOString();
      const insertCurr = db.prepare(`
        INSERT OR REPLACE INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [code, symbol, name, rate, precision, isBase] of defaultCurrencies) {
        insertCurr.run(code, symbol, name, rate, precision, isBase, now);
      }
    }
  } catch (err) {
    console.error('Failed seeding default currencies:', err);
  }

  // Seed default multi-language notification templates (Thank You, Expiring, Expired)
  try {
    const defaultTemplates = [
      // 1. Thank You (order_created)
      {
        id: 'tmpl-en-created',
        name: 'Order Delivery (English)',
        event_type: 'order_created',
        language: 'en',
        content: 'Hello {customer_name}! Thank you for your order of {product_name} ({plan_name}). Your access is active until {end_date}. Order ID: #{order_id}. Enjoy!'
      },
      {
        id: 'tmpl-fr-created',
        name: 'Livraison de Commande (Français)',
        event_type: 'order_created',
        language: 'fr',
        content: 'Bonjour {customer_name}! Merci pour votre commande de {product_name} ({plan_name}). Votre accès est actif jusqu au {end_date}. Commande #{order_id}.'
      },
      {
        id: 'tmpl-ar-created',
        name: 'تسليم الطلب (العربية)',
        event_type: 'order_created',
        language: 'ar',
        content: 'مرحباً {customer_name}! شكراً لطلبك {product_name} ({plan_name}). اشتراكك نشط ومفعّل حتى {end_date}. رقم الطلب: #{order_id}.'
      },
      {
        id: 'tmpl-ru-created',
        name: 'Доставка заказа (Русский)',
        event_type: 'order_created',
        language: 'ru',
        content: 'Здравствуйте, {customer_name}! Спасибо за заказ {product_name} ({plan_name}). Ваш доступ активен до {end_date}. Заказ #{order_id}.'
      },
      // 2. Expiring (order_expiring)
      {
        id: 'tmpl-en-expiring',
        name: 'Renewal Reminder (English)',
        event_type: 'order_expiring',
        language: 'en',
        content: 'Dear {customer_name}, your subscription for {product_name} ({plan_name}) will expire in {days_remaining} days on {end_date}. Order #{order_id}. Please reply to renew now and ensure uninterrupted service!'
      },
      {
        id: 'tmpl-fr-expiring',
        name: 'Rappel Expiration (Français)',
        event_type: 'order_expiring',
        language: 'fr',
        content: 'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) expire dans {days_remaining} jours, le {end_date}. Commande #{order_id}. Répondez à ce message pour renouveler et éviter toute coupure de service!'
      },
      {
        id: 'tmpl-ar-expiring',
        name: 'تذكير بقرب الانتهاء (العربية)',
        event_type: 'order_expiring',
        language: 'ar',
        content: 'مرحباً {customer_name}، نود تذكيرك بأن اشتراكك في {product_name} ({plan_name}) سينتهي خلال {days_remaining} أيام بتاريخ {end_date}. رقم الطلب: #{order_id}. يرجى الرد لتجديد اشتراكك وتجنب انقطاع الخدمة!'
      },
      {
        id: 'tmpl-ru-expiring',
        name: 'Напоминание об истечении (Русский)',
        event_type: 'order_expiring',
        language: 'ru',
        content: 'Уважаемый(ая) {customer_name}, ваша подписка на {product_name} ({plan_name}) истекает через {days_remaining} дн. ({end_date}). Заказ #{order_id}. Напишите нам для продления, чтобы не потерять доступ!'
      },
      // 3. Expired (order_expired)
      {
        id: 'tmpl-en-expired',
        name: 'Expired Follow-up (English)',
        event_type: 'order_expired',
        language: 'en',
        content: 'Hello {customer_name}, your subscription for {product_name} ({plan_name}) has expired on {end_date}. Order #{order_id}. Would you like to renew your access today? Reply to this message to reactivate immediately!'
      },
      {
        id: 'tmpl-fr-expired',
        name: 'Abonnement Expiré (Français)',
        event_type: 'order_expired',
        language: 'fr',
        content: 'Bonjour {customer_name}, votre abonnement pour {product_name} ({plan_name}) est désormais expiré (terminé le {end_date}). Commande #{order_id}. Souhaitez-vous renouveler votre accès aujourd\'hui ? Répondez pour le réactiver immédiatement!'
      },
      {
        id: 'tmpl-ar-expired',
        name: 'انتهاء الاشتراك وتجديده (العربية)',
        event_type: 'order_expired',
        language: 'ar',
        content: 'مرحباً {customer_name}، لقد انتهت صلاحية اشتراكك في {product_name} ({plan_name}) بتاريخ {end_date}. رقم الطلب #{order_id}. هل ترغب في تجديد اشتراكك اليوم؟ تواصل معنا للرد وإعادة تفعيل حسابك فوراً!'
      },
      {
        id: 'tmpl-ru-expired',
        name: 'Истекший доступ (Русский)',
        event_type: 'order_expired',
        language: 'ru',
        content: 'Здравствуйте, {customer_name}! Срок действия вашей подписки на {product_name} ({plan_name}) истек ({end_date}). Заказ #{order_id}. Хотите продлить доступ прямо сейчас? Ответьте на это сообщение, чтобы возобновить подписку!'
      }
    ];

    const now = new Date().toISOString();
    const insertTmpl = db.prepare(`
      INSERT OR IGNORE INTO notification_templates (id, name, event_type, language, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const t of defaultTemplates) {
      insertTmpl.run(t.id, t.name, t.event_type, t.language, t.content, now);
    }
  } catch (err) {
    console.error('Failed to seed default templates:', err);
  }
}

// Audit logger helper
export function logAudit(user: { id?: string; username?: string } | null, action: string, entity: string, entityId: string | null, details: Record<string, any>, ip: string = '127.0.0.1') {
  try {
    const id = crypto.randomUUID();
    const safeDetails = { ...details };
    // Redact any password or sensitive keys
    for (const key of Object.keys(safeDetails)) {
      if (/password|secret|credential|token|key/i.test(key) && typeof safeDetails[key] === 'string') {
        safeDetails[key] = '***REDACTED***';
      }
    }
    const stmt = db.prepare(`
      INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      user?.id || 'system',
      user?.username || 'system',
      action,
      entity,
      entityId || null,
      JSON.stringify(safeDetails),
      ip,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
