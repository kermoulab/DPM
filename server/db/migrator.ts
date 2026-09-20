import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import type pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Advisory lock key for migrations — prevents concurrent execution across processes.
// This is a stable application-level constant: hash('vectis_migrations') clamped to int32.
const MIGRATION_LOCK_KEY = 1874952739;

function resolveMigrationsDir(): string | null {
  const candidateDirs = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', 'server', 'db', 'migrations'),
    path.join(process.cwd(), 'server', 'db', 'migrations'),
    path.join(process.cwd(), 'dist', 'migrations'),
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return null;
}

function sha256File(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export interface MigrationResult {
  applied: string[];
  alreadyUpToDate: boolean;
  alreadyRunning?: boolean;
}

export interface PendingMigrationInfo {
  pendingCount: number;
  pendingFiles: string[];
}

/**
 * Returns information about migrations that have not yet been applied.
 * Does NOT run any SQL. Safe to call at any time.
 */
export async function getPendingMigrations(pool: pg.Pool): Promise<PendingMigrationInfo> {
  const client = await pool.connect();
  try {
    // If schema_migrations doesn't exist yet, ALL migrations are pending
    const tableCheck = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'schema_migrations'
       ) AS exists`
    );
    if (!tableCheck.rows[0]?.exists) {
      const dir = resolveMigrationsDir();
      if (!dir) return { pendingCount: 0, pendingFiles: [] };
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
      return { pendingCount: files.length, pendingFiles: files };
    }

    const { rows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations'
    );
    const applied = new Set(rows.map((r) => r.version));

    const dir = resolveMigrationsDir();
    if (!dir) return { pendingCount: 0, pendingFiles: [] };
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const pending = files.filter((f) => !applied.has(f));
    return { pendingCount: pending.length, pendingFiles: pending };
  } finally {
    client.release();
  }
}

/**
 * Runs all unapplied PostgreSQL migrations in server/db/migrations/ in alphanumeric order.
 * Each migration file is executed inside an atomic transaction.
 *
 * Concurrency: Uses a PostgreSQL session-level advisory lock to prevent two processes
 * from running migrations simultaneously. Returns { alreadyRunning: true } if the
 * lock cannot be acquired.
 *
 * Checksums: Records a SHA-256 checksum of each applied migration file. If a
 * previously-applied file's checksum changes, emits a warning but does not fail
 * (manual intervention may be needed).
 */
export async function runMigrations(pool: pg.Pool): Promise<MigrationResult> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    // 1. Acquire advisory lock — prevents concurrent migration runs
    const { rows: lockRows } = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [MIGRATION_LOCK_KEY]
    );
    if (!lockRows[0]?.acquired) {
      console.warn('[Migrator] Another migration process is already running (advisory lock held).');
      return { applied: [], alreadyUpToDate: false, alreadyRunning: true };
    }

    try {
      // 2. Ensure migration tracking table exists with checksum column
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id          SERIAL PRIMARY KEY,
          version     VARCHAR(100) UNIQUE NOT NULL,
          checksum    VARCHAR(64),
          applied_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Add checksum column to existing installations that pre-date this change
      await client.query(`
        ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS checksum VARCHAR(64);
      `);

      // 4. Query already-applied migrations
      const { rows: existingRows } = await client.query<{ version: string; checksum: string | null }>(
        'SELECT version, checksum FROM schema_migrations ORDER BY id ASC'
      );
      const appliedMap = new Map(existingRows.map((r) => [r.version, r.checksum]));

      // 5. Locate migration directory
      const migrationsDir = resolveMigrationsDir();
      if (!migrationsDir) {
        console.warn('[Migrator] No migrations directory found in any candidate path.');
        return { applied: [], alreadyUpToDate: true };
      }

      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const checksum = sha256File(filePath);

        if (appliedMap.has(file)) {
          // Checksum verification — warn if file changed since it was applied
          const recordedChecksum = appliedMap.get(file);
          if (recordedChecksum && recordedChecksum !== checksum) {
            console.warn(
              `[Migrator] WARNING: Checksum mismatch for already-applied migration "${file}". ` +
              `Recorded: ${recordedChecksum.slice(0, 12)}... Current: ${checksum.slice(0, 12)}... ` +
              `The migration file may have been modified after application.`
            );
          }
          continue;
        }

        console.log(`[Migrator] Applying migration: ${file} (sha256: ${checksum.slice(0, 12)}...)`);
        const sql = fs.readFileSync(filePath, 'utf-8');

        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query(
            'INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ($1, $2, CURRENT_TIMESTAMP)',
            [file, checksum]
          );
          await client.query('COMMIT');
          applied.push(file);
          console.log(`[Migrator] Applied successfully: ${file}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Migrator] Failed to apply migration ${file}:`, (err as Error).message);
          throw err;
        }
      }

      return {
        applied,
        alreadyUpToDate: applied.length === 0
      };
    } finally {
      // Always release advisory lock
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
