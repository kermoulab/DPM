# DPM — Database Migrations

## Overview

DPM uses a simple, provider-neutral migration system built on plain SQL files and a
tracking table. No external migration framework is required.

Migrations live in:

    server/db/migrations/
    └── 001_initial_schema.sql   ← All 17 tables

---

## How It Works

1. On startup (or `npm run db:migrate`), the migrator connects to PostgreSQL.
2. It creates a `schema_migrations` table if it does not exist.
3. It reads all `.sql` files from `server/db/migrations/` in alphabetical order.
4. Files already recorded in `schema_migrations` are skipped.
5. Each new file is executed inside a transaction — the file either applies fully or rolls back on error.
6. The filename is recorded in `schema_migrations` on success.

---

## Running Migrations

### Manual run

    npm run db:migrate

### Automatic (on startup)

Migrations run automatically when the Express server starts. This is safe in production:
applied migrations are never re-run.

---

## Migration Files

| File | Description |
|---|---|
| `001_initial_schema.sql` | All 17 tables: system_settings, users, categories, products, plans, customers, service_accounts, service_profiles, license_keys, digital_assets, merch_mockups, orders, order_renewals, currencies, notification_templates, paired_devices, audit_logs |

---

## Adding a New Migration

1. Create a new SQL file with the next sequential number:

    server/db/migrations/002_add_column.sql

2. Write standard PostgreSQL DDL. Example:

    ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

3. Run migrations:

    npm run db:migrate

4. The new migration will be applied and recorded. Existing environments will
   pick it up automatically on their next deploy/startup.

---

## Rollback

There is no automatic rollback command. To undo a migration:

1. Write a new migration file that reverses the change:

    server/db/migrations/003_remove_sku.sql

2. Run `npm run db:migrate`.

This approach preserves a full audit trail of all schema changes.

---

## Schema Migrations Table

    SELECT * FROM schema_migrations ORDER BY applied_at;

| Column | Type | Description |
|---|---|---|
| id | SERIAL | Auto-increment row ID |
| version | VARCHAR(100) | Migration filename (unique) |
| applied_at | TIMESTAMPTZ | When the migration was applied |

---

## Fresh Database

On a brand-new PostgreSQL database, running `npm run db:migrate` will:

1. Create the `schema_migrations` tracking table.
2. Apply `001_initial_schema.sql` (all 17 tables + indexes + constraints).
3. Record the migration.

The database is then ready. No manual SQL editing is required.

---

## PostgreSQL Compatibility

Migrations use only standard PostgreSQL DDL:

- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `ALTER TABLE`
- Standard column types: VARCHAR, TEXT, INTEGER, NUMERIC, BOOLEAN, DATE, TIMESTAMPTZ, JSONB
- Standard constraints: CHECK, UNIQUE, REFERENCES, ON DELETE

Minimum PostgreSQL version: **14**
