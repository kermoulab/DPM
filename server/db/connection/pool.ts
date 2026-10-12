import pg from 'pg';
import { config, updateConfig } from '../../config/index.js';
import { resolveSslConfig } from './ssl.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPoolConfig(connectionString: string): pg.PoolConfig {
  const isServerless = Boolean(
    process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );
  // Default to 2 on serverless to avoid exhausting Supabase's 15-connection ceiling; 5 on dedicated server.
  const defaultMax = isServerless ? 2 : 5;
  const max = Math.max(1, parseInt(process.env.DATABASE_POOL_MAX || process.env.DB_POOL_MAX || String(defaultMax), 10));

  return {
    connectionString,
    max,
    idleTimeoutMillis: isServerless ? 1000 : 5000,
    connectionTimeoutMillis: 10000,
    ssl: resolveSslConfig(connectionString)
  };
}

export function getPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const connectionString = (config.databaseUrl || process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('Database is not configured. On Netlify or Vercel, please add DATABASE_URL in your hosting platform dashboard under Site configuration > Environment variables.');
  }

  pool = new Pool(getPoolConfig(connectionString));

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
 * Guarantees resolution within timeoutMs (default: 5000ms) to prevent probe hang.
 */
export async function testConnection(
  timeoutMs: number = 5000
): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  const connectionString = config.databaseUrl;
  if (!connectionString) {
    return {
      ok: false,
      latencyMs: 0,
      error: 'DATABASE_URL is not configured'
    };
  }

  let timer: NodeJS.Timeout | undefined;
  try {
    const p = getPool();
    const pingPromise = p.query('SELECT 1 as ping');
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)),
        timeoutMs
      );
    });

    const res = await Promise.race([pingPromise, timeoutPromise]);
    return {
      ok: res.rows[0]?.ping === 1,
      latencyMs: Date.now() - start
    };
  } catch (err: any) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message || 'Database connection error'
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Hot-swap the global PostgreSQL pool with a new connection string.
 * Called by the installer after the operator enters their DATABASE_URL.
 *
 * Flow:
 *   1. Close and discard the existing pool (if any)
 *   2. Create a new pool with the provided URL
 *   3. Update process.env and the config singleton so all subsequent
 *      code (auth, routes, migrator) uses the new connection
 */
export async function reinitializePool(connectionString: string): Promise<void> {
  if (pool) {
    try {
      await pool.end();
    } catch {
      /* best-effort cleanup */
    }
    pool = null;
  }

  const newPool = new Pool(getPoolConfig(connectionString));

  newPool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
  });

  pool = newPool;
  process.env.DATABASE_URL = connectionString;
  updateConfig({ databaseUrl: connectionString });
  console.log('[DB] Pool reinitialized with new connection string.');
}

