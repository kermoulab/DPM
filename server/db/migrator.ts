import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export interface MigrationResult {
  applied: string[];
  alreadyUpToDate: boolean;
}

/**
 * Runs all unapplied PostgreSQL migrations in server/db/migrations/ in alphanumeric order.
 * Each migration file is executed inside an atomic transaction.
 */
export async function runMigrations(pool: pg.Pool): Promise<MigrationResult> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id          SERIAL PRIMARY KEY,
        version     VARCHAR(100) UNIQUE NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already applied migrations
    const { rows: existingRows } = await client.query<{ version: string }>(
      'SELECT version FROM schema_migrations ORDER BY id ASC'
    );
    const appliedSet = new Set(existingRows.map((r) => r.version));

    // 3. Locate migration directory
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
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[Migrator] Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, CURRENT_TIMESTAMP)',
          [file]
        );
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[Migrator] Applied successfully: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migrator] Failed to apply migration ${file}:`, err);
        throw err;
      }
    }

    return {
      applied,
      alreadyUpToDate: applied.length === 0
    };
  } finally {
    client.release();
  }
}
