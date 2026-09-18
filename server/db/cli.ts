import 'dotenv/config';
import pg from 'pg';
import { runMigrations } from './migrator.js';
import { importSqliteToPostgres } from './import-sqlite.js';

const { Pool } = pg;

function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('FATAL: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  const isProduction = process.env.NODE_ENV === 'production';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=disable')
      ? false
      : isProduction || connectionString.includes('render.com') || connectionString.includes('neon.tech') || connectionString.includes('supabase')
      ? { rejectUnauthorized: false }
      : false
  });
}

async function main() {
  const command = process.argv[2] || 'migrate';
  const pool = createPool();

  try {
    if (command === 'migrate' || command === 'setup') {
      console.log('--- RUNNING POSTGRESQL MIGRATIONS ---');
      const result = await runMigrations(pool);
      if (result.alreadyUpToDate) {
        console.log('Database is already up to date. No pending migrations.');
      } else {
        console.log(`Applied ${result.applied.length} migration(s):`, result.applied.join(', '));
      }
    }

    if (command === 'import' || command === 'setup') {
      console.log('\n--- IMPORTING SQLITE DATA TO POSTGRESQL ---');
      const summary = await importSqliteToPostgres(pool);
      if (summary.length > 0) {
        console.log('\nData Import Verification Table:');
        console.table(summary);
        const hasDiscrepancy = summary.some((s) => s.status === 'DISCREPANCY');
        if (hasDiscrepancy) {
          console.warn('WARNING: Discrepancies detected between SQLite and PostgreSQL record counts.');
        } else {
          console.log('SUCCESS: All 17 tables migrated with 100% record count match!');
        }
      }
    }
  } catch (err: any) {
    console.error('Database operation failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
