import path from 'path';
import fs from 'fs';
import type pg from 'pg';

export interface MigrationSummary {
  table: string;
  sqliteCount: number;
  postgresCount: number;
  status: 'MATCH' | 'DISCREPANCY';
}

function parseJsonSafe(val: any, defaultVal: any = {}): any {
  if (!val) return defaultVal;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return defaultVal;
  }
}

/**
 * Migrates all records from SQLite data/erp.db into PostgreSQL.
 * Performs idempotent inserts with ON CONFLICT and validates record counts.
 */
export async function importSqliteToPostgres(pool: pg.Pool, sqlitePath?: string): Promise<MigrationSummary[]> {
  const dbPath = sqlitePath || path.join(process.cwd(), 'data', 'erp.db');
  if (!fs.existsSync(dbPath)) {
    console.log(`[Import] No SQLite database found at ${dbPath}. Skipping data migration.`);
    return [];
  }

  console.log(`[Import] Opening source SQLite database: ${dbPath}`);
  const { DatabaseSync } = await import('node:sqlite');
  const sqlite = new DatabaseSync(dbPath);
  const client = await pool.connect();
  const summary: MigrationSummary[] = [];

  try {
    // Disable FK checks momentarily during initial bulk load if needed, or insert in dependency order
    console.log('[Import] Beginning SQLite to PostgreSQL data migration...');

    // 1. system_settings
    const settings = sqlite.prepare('SELECT key, value, updated_at FROM system_settings').all() as any[];
    for (const row of settings) {
      await client.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
        [row.key, row.value, row.updated_at]
      );
    }

    // 2. users
    const users = sqlite.prepare('SELECT * FROM users').all() as any[];
    for (const row of users) {
      await client.query(
        `INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, avatar, preferred_currency, created_at, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.username, row.email, row.name, row.password_hash, row.password_salt,
          row.role, row.status, row.avatar || null, row.preferred_currency || 'USD',
          row.created_at, row.last_login || null
        ]
      );
    }

    // 3. categories
    const categories = sqlite.prepare('SELECT * FROM categories').all() as any[];
    for (const row of categories) {
      await client.query(
        `INSERT INTO categories (id, name, slug, icon, description, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.name, row.slug, row.icon || 'Folder', row.description || null, row.status || 'active', row.created_at]
      );
    }

    // 4. products
    const products = sqlite.prepare('SELECT * FROM products').all() as any[];
    for (const row of products) {
      await client.query(
        `INSERT INTO products (id, category_id, name, slug, brand, description, status, capabilities, fulfillment_type, custom_fields, icon, image_url, stock_limit, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.category_id, row.name, row.slug, row.brand || null, row.description || null,
          row.status || 'active', JSON.stringify(parseJsonSafe(row.capabilities, ['subscription'])),
          row.fulfillment_type || 'automatic', JSON.stringify(parseJsonSafe(row.custom_fields, [])),
          row.icon || 'Box', row.image_url || null, row.stock_limit !== undefined ? row.stock_limit : null,
          row.created_at
        ]
      );
    }

    // 5. plans
    const plans = sqlite.prepare('SELECT * FROM plans').all() as any[];
    for (const row of plans) {
      await client.query(
        `INSERT INTO plans (id, product_id, name, duration, duration_unit, price, cost, currency, status, stock_limit, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.product_id, row.name, row.duration, row.duration_unit,
          row.price, row.cost || 0, row.currency || 'USD', row.status || 'active',
          row.stock_limit !== undefined ? row.stock_limit : null, row.created_at
        ]
      );
    }

    // 6. customers
    const customers = sqlite.prepare('SELECT * FROM customers').all() as any[];
    for (const row of customers) {
      await client.query(
        `INSERT INTO customers (id, name, email, whatsapp, notes, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.name, row.email || null, row.whatsapp || null, row.notes || null, row.status || 'active', row.created_at]
      );
    }

    // 7. service_accounts
    const accounts = sqlite.prepare('SELECT * FROM service_accounts').all() as any[];
    for (const row of accounts) {
      await client.query(
        `INSERT INTO service_accounts (id, product_id, provider, login, encrypted_credential, iv, tag, status, expiry_date, capacity, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.product_id, row.provider, row.login, row.encrypted_credential,
          row.iv, row.tag, row.status || 'active', row.expiry_date || null,
          row.capacity || 5, row.notes || null, row.created_at
        ]
      );
    }

    // 8. service_profiles
    const profiles = sqlite.prepare('SELECT * FROM service_profiles').all() as any[];
    for (const row of profiles) {
      await client.query(
        `INSERT INTO service_profiles (id, service_account_id, profile_name, pin, status, assigned_customer_id, assigned_order_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.service_account_id, row.profile_name, row.pin || null,
          row.status || 'available', row.assigned_customer_id || null, row.assigned_order_id || null,
          row.created_at
        ]
      );
    }

    // 9. license_keys
    const licenses = sqlite.prepare('SELECT * FROM license_keys').all() as any[];
    for (const row of licenses) {
      await client.query(
        `INSERT INTO license_keys (id, product_id, license_key, status, assigned_order_id, assigned_customer_id, expiry_date, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.product_id, row.license_key, row.status || 'available',
          row.assigned_order_id || null, row.assigned_customer_id || null,
          row.expiry_date || null, row.notes || null, row.created_at
        ]
      );
    }

    // 10. digital_assets
    const assets = sqlite.prepare('SELECT * FROM digital_assets').all() as any[];
    for (const row of assets) {
      await client.query(
        `INSERT INTO digital_assets (id, product_id, title, asset_type, file_url, specs, download_count, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.product_id, row.title, row.asset_type, row.file_url,
          JSON.stringify(parseJsonSafe(row.specs, {})), row.download_count || 0, row.created_at
        ]
      );
    }

    // 11. orders
    const orders = sqlite.prepare('SELECT * FROM orders').all() as any[];
    for (const row of orders) {
      await client.query(
        `INSERT INTO orders (
           id, order_number, customer_id, product_id, plan_id, status,
           start_date, end_date, price, cost, currency, payment_status,
           payment_method, fulfillment_type, assigned_service_account_id,
           assigned_profile_id, assigned_license_key_id, assigned_digital_asset_id,
           fulfillment_data, renewal_count, whatsapp_contacted_at, created_by_user_id, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.order_number, row.customer_id, row.product_id, row.plan_id, row.status || 'active',
          row.start_date, row.end_date, row.price, row.cost || 0, row.currency || 'USD',
          row.payment_status || 'paid', row.payment_method || 'cash', row.fulfillment_type || 'automatic',
          row.assigned_service_account_id || null, row.assigned_profile_id || null,
          row.assigned_license_key_id || null, row.assigned_digital_asset_id || null,
          JSON.stringify(parseJsonSafe(row.fulfillment_data, {})), row.renewal_count || 0,
          row.whatsapp_contacted_at || null, row.created_by_user_id || null, row.created_at
        ]
      );
    }

    // 12. order_renewals
    const renewals = sqlite.prepare('SELECT * FROM order_renewals').all() as any[];
    for (const row of renewals) {
      await client.query(
        `INSERT INTO order_renewals (id, order_id, previous_end_date, new_end_date, price, cost, currency, created_by_user_id, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.order_id, row.previous_end_date, row.new_end_date,
          row.price, row.cost || 0, row.currency || 'USD', row.created_by_user_id || null,
          row.notes || null, row.created_at
        ]
      );
    }

    // 13. currencies
    const currencies = sqlite.prepare('SELECT * FROM currencies').all() as any[];
    for (const row of currencies) {
      await client.query(
        `INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (code) DO UPDATE SET exchange_rate = EXCLUDED.exchange_rate, updated_at = EXCLUDED.updated_at`,
        [
          row.code, row.symbol, row.name, row.exchange_rate,
          row.decimal_precision || 2, Boolean(row.is_base), row.updated_at
        ]
      );
    }

    // 14. notification_templates
    const templates = sqlite.prepare('SELECT * FROM notification_templates').all() as any[];
    for (const row of templates) {
      await client.query(
        `INSERT INTO notification_templates (id, name, event_type, language, content, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [row.id, row.name, row.event_type, row.language, row.content, row.created_at, row.updated_at || row.created_at]
      );
    }

    // 15. paired_devices
    const devices = sqlite.prepare('SELECT * FROM paired_devices').all() as any[];
    for (const row of devices) {
      await client.query(
        `INSERT INTO paired_devices (id, device_name, device_type, device_token_hash, paired_by_user_id, pairing_code, code_expires_at, status, last_seen, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.device_name, row.device_type || 'android', row.device_token_hash,
          row.paired_by_user_id || null, row.pairing_code || null, row.code_expires_at || null,
          row.status || 'pending', row.last_seen || null, row.created_at
        ]
      );
    }

    // 16. audit_logs
    const auditLogs = sqlite.prepare('SELECT * FROM audit_logs').all() as any[];
    for (const row of auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (id, user_id, username, action, entity, entity_id, details, ip, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.user_id || null, row.username || null, row.action,
          row.entity, row.entity_id || null, JSON.stringify(parseJsonSafe(row.details, {})),
          row.ip || null, row.created_at
        ]
      );
    }

    // 17. merch_mockups
    const mockups = sqlite.prepare('SELECT * FROM merch_mockups').all() as any[];
    for (const row of mockups) {
      await client.query(
        `INSERT INTO merch_mockups (id, customer_id, product_name, color, placement, logo_url, preview_image_url, print_specs, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          row.id, row.customer_id || null, row.product_name, row.color || '#1e293b',
          row.placement || 'chest_center', row.logo_url, row.preview_image_url || null,
          JSON.stringify(parseJsonSafe(row.print_specs, {})), row.status || 'draft', row.created_at
        ]
      );
    }

    // Verify record counts across all 17 tables
    const tableNames = [
      'system_settings', 'users', 'categories', 'products', 'plans',
      'customers', 'service_accounts', 'service_profiles', 'license_keys',
      'digital_assets', 'orders', 'order_renewals', 'currencies',
      'notification_templates', 'paired_devices', 'audit_logs', 'merch_mockups'
    ];

    for (const tableName of tableNames) {
      const sqliteCountRes = sqlite.prepare(`SELECT COUNT(*) as c FROM ${tableName}`).get() as any;
      const pgCountRes = await client.query(`SELECT COUNT(*) as c FROM ${tableName}`);
      const sqliteCount = Number(sqliteCountRes?.c || 0);
      const postgresCount = Number(pgCountRes.rows[0].c || 0);
      summary.push({
        table: tableName,
        sqliteCount,
        postgresCount,
        status: sqliteCount === postgresCount ? 'MATCH' : 'DISCREPANCY'
      });
    }

    console.log('[Import] Migration completed successfully.');
    return summary;
  } finally {
    client.release();
  }
}
