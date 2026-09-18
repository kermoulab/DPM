import pg from 'pg';
import { config } from '../../config/index.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const connectionString = config.databaseUrl;
  if (!connectionString) {
    console.warn('[DB] WARNING: DATABASE_URL is not configured.');
  }

  const isProduction = config.isProduction;
  const isCloudProvider =
    connectionString.includes('render.com') ||
    connectionString.includes('neon.tech') ||
    connectionString.includes('supabase') ||
    connectionString.includes('aws') ||
    connectionString.includes('pooler.');

  const useSsl =
    connectionString.includes('sslmode=require') ||
    (isCloudProvider && !connectionString.includes('sslmode=disable')) ||
    (isProduction && !connectionString.includes('sslmode=disable'));

  pool = new Pool({
    connectionString,
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });

  pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

/**
 * Executes a parameterized SQL query on the PostgreSQL connection pool.
 */
export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const p = getPool();
  const start = Date.now();
  try {
    const res = await p.query<T>(text, params);
    return res;
  } catch (err: any) {
    console.error(`[DB Query Error] ${err.message}\nQuery: ${text}\nParams:`, params);
    throw err;
  }
}

/**
 * Executes a callback within a managed PostgreSQL transaction on a dedicated checked-out client.
 * Guarantees COMMIT on success or ROLLBACK on failure, and ensures client is released.
 */
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[DB] Failed to rollback transaction:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check to verify PostgreSQL connectivity and measure query latency.
 */
export async function testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await query('SELECT 1 as ping');
    return {
      ok: res.rows[0]?.ping === 1,
      latencyMs: Date.now() - start
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
