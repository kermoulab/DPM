/**
 * server/routes/install.ts
 *
 * WordPress-style installation API.
 *
 * Endpoints:
 *   GET  /api/install/status          — installation state + system requirements
 *   POST /api/install/test-connection — test a user-submitted DATABASE_URL (temporary client)
 *   POST /api/install/configure-db    — persist DATABASE_URL, reinitialise pool, mark INSTALLING
 *   POST /api/install/run-migrations  — apply pending migrations (requires INSTALLING state)
 *   POST /api/install/create-admin    — create first administrator (advisory-locked)
 *   POST /api/install/finalize        — generate secrets, mark INSTALLED, return JWT
 *
 * Security invariants:
 *   - DATABASE_URL / passwords are NEVER echoed back in responses
 *   - All pg errors are sanitized before being sent to the client
 *   - Advisory lock prevents concurrent admin creation race conditions
 *   - Every mutating endpoint checks install state before acting
 *   - Rate limiting: 10 requests per 60 s per IP on all install endpoints
 */

import { Router } from 'express';
import crypto from 'crypto';
import pg from 'pg';
import { getPool, reinitializePool, testConnection } from '../db/connection/pool.js';
import { resolveSslConfig } from '../db/connection/ssl.js';
import { runMigrations, getPendingMigrations } from '../db/migrator.js';
import { systemSettingsRepo } from '../db/repositories/system-settings.repository.js';
import { usersRepo } from '../db/repositories/users.repository.js';
import { hashPassword } from '../utils/crypto.js';
import { createSessionToken } from '../middleware/auth.middleware.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { validateBody, v } from '../middleware/validation.middleware.js';
import {
  persistDatabaseUrl,
  sanitizeDbError,
  maskDatabaseUrl,
  ensureEnvSecret,
} from '../utils/install-env.js';
import { updateConfig } from '../config/index.js';

export const installRouter = Router();

// ──────────────────────────────────────────────────────────────────────────────
// Rate Limiting (simple in-memory, per-IP)
// ──────────────────────────────────────────────────────────────────────────────

const installRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = installRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    installRateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function rateLimitMiddleware(req: any, res: any, next: any): void {
  const ip = req.ip || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      success: false,
      error: 'Too many installation requests. Please wait 1 minute and try again.'
    });
    return;
  }
  next();
}

installRouter.use(rateLimitMiddleware);

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate a PostgreSQL connection URL.
 * Only allows postgres:// or postgresql:// schemes.
 * Never accepts file://, javascript://, or other dangerous schemes.
 */
function validateDatabaseUrl(url: unknown): { valid: boolean; error?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Database URL is required.' };
  }
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Database URL is required.' };
  }
  if (trimmed.length > 2048) {
    return { valid: false, error: 'Database URL exceeds the maximum allowed length.' };
  }
  if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
    return {
      valid: false,
      error: 'Database URL must start with "postgresql://" or "postgres://". Other protocols are not supported.'
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) {
      return { valid: false, error: 'Database URL must include a hostname.' };
    }
  } catch {
    return { valid: false, error: 'Database URL is not a valid URL. Please check the format.' };
  }
  return { valid: true };
}

/**
 * Create a temporary single-use pg.Client for testing a URL.
 * Uses a short timeout (8 s). Never adds to the global pool.
 */
async function probeConnection(
  connectionString: string
): Promise<{ ok: boolean; postgresVersion?: string; isAlreadyInstalled?: boolean; error?: string }> {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 8000,
    ssl: resolveSslConfig(connectionString)
  });
  try {
    await client.connect();
    const res = await client.query<{ version: string }>('SELECT version()');
    // Parse "PostgreSQL 16.2 on ..." → "PostgreSQL 16.2"
    const full = res.rows[0]?.version || '';
    const short = full.split(' on ')[0] || full;

    // Check if this database already contains an installed Vectis instance
    let isAlreadyInstalled = false;
    try {
      const tableCheck = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'system_settings'
        ) as exists
      `);
      if (tableCheck.rows[0]?.exists) {
        const stateRes = await client.query<{ key: string; value: string }>(
          `SELECT key, value FROM system_settings WHERE key IN ('install_state', 'installed')`
        );
        for (const row of stateRes.rows) {
          if (
            (row.key === 'install_state' && (row.value === 'installed' || row.value === 'upgrade_required')) ||
            (row.key === 'installed' && row.value === 'true')
          ) {
            isAlreadyInstalled = true;
            break;
          }
        }
      }
    } catch {
      // Table check or query failed (e.g. fresh DB with no tables), ignore and treat as not installed
    }

    return { ok: true, postgresVersion: short, isAlreadyInstalled };
  } catch (err) {
    return { ok: false, error: sanitizeDbError(err) };
  } finally {
    try {
      await client.end();
    } catch { /* ignore cleanup errors */ }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/install/status
// ──────────────────────────────────────────────────────────────────────────────

installRouter.get('/status', async (req, res) => {
  try {
    const installState = await systemSettingsRepo.getInstallState();
    const installed = installState === 'installed';
    const dbConfigured = Boolean(process.env.DATABASE_URL?.trim());

    // Pending migration count for UPGRADE_REQUIRED detection
    let pendingMigrations = 0;
    if (installed && dbConfigured) {
      try {
        const info = await getPendingMigrations(getPool());
        pendingMigrations = info.pendingCount;
      } catch { /* ignore — DB may not be reachable */ }
    }

    // Live DB connectivity check (non-fatal)
    const dbTest = await testConnection(3000);

    res.json({
      installed,
      installState,
      upgradeRequired: installed && pendingMigrations > 0,
      pendingMigrations,
      dbConfigured,
      requirements: {
        nodeVersion: process.version,
        nodeOk: parseInt(process.version.slice(1).split('.')[0], 10) >= 18,
        postgresReady: dbTest.ok,
        cryptoAvailable: Boolean(crypto.randomUUID)
      }
    });
  } catch {
    // Table doesn't exist yet — definitely not installed
    res.json({
      installed: false,
      installState: 'not_installed',
      upgradeRequired: false,
      pendingMigrations: 0,
      dbConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      requirements: {
        nodeVersion: process.version,
        nodeOk: parseInt(process.version.slice(1).split('.')[0], 10) >= 18,
        postgresReady: false,
        cryptoAvailable: Boolean(crypto.randomUUID)
      }
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/test-connection
// ──────────────────────────────────────────────────────────────────────────────
//
// Tests a user-submitted DATABASE_URL using a one-off client.
// NEVER returns the password or full connection string.

installRouter.post('/test-connection', async (req, res) => {
  // If active pool is already installed AND DATABASE_URL is configured in environment, deny external probing
  const currentDbConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const installState = await systemSettingsRepo.getInstallState().catch(() => 'not_installed' as const);
  if (installState === 'installed' && currentDbConfigured) {
    res.status(403).json({ success: false, error: 'Vectis is already installed and running.' });
    return;
  }

  const { databaseUrl } = req.body || {};
  const validation = validateDatabaseUrl(databaseUrl);
  if (!validation.valid) {
    res.status(400).json({ success: false, error: validation.error });
    return;
  }

  const result = await probeConnection(databaseUrl.trim());

  if (result.ok) {
    res.json({
      success: true,
      alreadyInstalled: Boolean(result.isAlreadyInstalled),
      message: result.isAlreadyInstalled
        ? `Connection successful. Existing Vectis database detected (${result.postgresVersion || 'PostgreSQL'}).`
        : `Connection successful. ${result.postgresVersion || 'PostgreSQL'} detected.`,
      // Never echo the URL or password
      maskedUrl: maskDatabaseUrl(databaseUrl.trim())
    });
  } else {
    res.status(422).json({
      success: false,
      error: result.error || 'Could not connect to the database. Please verify the connection details.',
      hint: 'Check the hostname, port, database name, username, password, and SSL settings.'
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/configure-db
// ──────────────────────────────────────────────────────────────────────────────
//
// Persists DATABASE_URL to .env, reinitialises the global pool, marks INSTALLING.

installRouter.post('/configure-db', async (req, res) => {
  const currentDbConfigured = Boolean(process.env.DATABASE_URL?.trim());
  const installState = await systemSettingsRepo.getInstallState().catch(() => 'not_installed' as const);
  if (installState === 'installed' && currentDbConfigured) {
    res.status(403).json({ success: false, error: 'Vectis is already installed and configured.' });
    return;
  }

  const { databaseUrl } = req.body || {};
  const validation = validateDatabaseUrl(databaseUrl);
  if (!validation.valid) {
    res.status(400).json({ success: false, error: validation.error });
    return;
  }

  const url = databaseUrl.trim();

  // Re-test before committing
  const probe = await probeConnection(url);
  if (!probe.ok) {
    res.status(422).json({
      success: false,
      error: probe.error || 'Could not connect to the database.',
      hint: 'Verify the connection details and try again.'
    });
    return;
  }

  try {
    // Persist to .env and update process.env
    persistDatabaseUrl(url);
    // Hot-swap the global pool with the new URL
    await reinitializePool(url);
    console.log('[Install] Database configured and pool reinitialized.');

    // Ensure JWT_SECRET and ENCRYPTION_KEY exist (or generate them if new container boot)
    const jwtSecret = ensureEnvSecret('JWT_SECRET', 32);
    const encKeyHex  = ensureEnvSecret('ENCRYPTION_KEY', 32);
    updateConfig({
      jwtSecret,
      encryptionKey: Buffer.from(encKeyHex, 'hex')
    });

    const isExistingInstalled = probe.isAlreadyInstalled || (await systemSettingsRepo.isInstalled().catch(() => false));
    if (isExistingInstalled) {
      console.log('[Install] Reconnected to existing Vectis database. System is operational.');
      res.json({
        success: true,
        alreadyInstalled: true,
        message: 'Existing Vectis database connected successfully. Redirecting to login...',
        maskedUrl: maskDatabaseUrl(url)
      });
      return;
    }

    res.json({
      success: true,
      alreadyInstalled: false,
      message: 'Database connection configured successfully.',
      maskedUrl: maskDatabaseUrl(url)
    });
  } catch (err) {
    console.error('[Install] Failed to reinitialize pool:', (err as Error).message);
    res.status(500).json({
      success: false,
      error: 'Database configuration saved but pool initialization failed. Please restart the server.'
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/run-migrations
// ──────────────────────────────────────────────────────────────────────────────

installRouter.post('/run-migrations', async (req, res) => {
  const installState = await systemSettingsRepo.getInstallState().catch(() => 'not_installed' as const);
  if (installState === 'installed') {
    try {
      const info = await getPendingMigrations(getPool());
      if (info.pendingCount === 0) {
        res.json({
          success: true,
          applied: [],
          alreadyUpToDate: true,
          alreadyInstalled: true,
          message: 'Database schema is already installed and up to date.'
        });
        return;
      }
    } catch {
      res.json({
        success: true,
        applied: [],
        alreadyUpToDate: true,
        alreadyInstalled: true,
        message: 'Database schema is already installed.'
      });
      return;
    }
  }

  if (!process.env.DATABASE_URL?.trim()) {
    res.status(400).json({ success: false, error: 'No database connection configured. Complete the database step first.' });
    return;
  }

  try {
    const result = await runMigrations(getPool());

    if (result.alreadyRunning) {
      res.status(409).json({
        success: false,
        error: 'Another migration process is already running. Please wait and try again.'
      });
      return;
    }

    console.log(`[Install] Migrations applied: ${result.applied.length} file(s).`);

    res.json({
      success: true,
      applied: result.applied,
      alreadyUpToDate: result.alreadyUpToDate,
      message: result.alreadyUpToDate
        ? 'Database schema is already up to date.'
        : `Applied ${result.applied.length} migration(s) successfully.`
    });
  } catch (err) {
    console.error('[Install] Migration failed:', (err as Error).message);
    res.status(500).json({
      success: false,
      error: 'Database migration failed. No data was destroyed. Check server logs for details.',
      details: (err as Error).message?.slice(0, 200)
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/create-admin
// ──────────────────────────────────────────────────────────────────────────────

installRouter.post('/create-admin', validateBody({
  adminUsername: [v.required('Username is required.'), v.string({ min: 3, max: 50 })],
  adminEmail:    [v.required('Email address is required.'), v.email('Invalid email address.')],
  adminPassword: [v.required('Password is required.'), v.string({ min: 8, message: 'Password must be at least 8 characters.' })]
}), async (req, res) => {
  const installState = await systemSettingsRepo.getInstallState().catch(() => 'not_installed' as const);
  if (installState === 'installed') {
    const existingOwner = await usersRepo.findByRole('owner').catch(() => null);
    if (existingOwner) {
      res.json({
        success: true,
        alreadyInstalled: true,
        message: 'Administrator account already exists. Redirecting to login...'
      });
      return;
    }
    res.status(403).json({ success: false, error: 'Vectis is already installed.' });
    return;
  }

  const {
    adminUsername,
    adminEmail,
    adminPassword,
    adminName,
    companyName,
    baseCurrency,
    currencySymbol,
    supportPhone
  } = req.body;

  // Password strength check: at least 1 uppercase, 1 lowercase, 1 digit
  const pwd = String(adminPassword);
  if (!/[A-Z]/.test(pwd) || !/[a-z]/.test(pwd) || !/[0-9]/.test(pwd)) {
    res.status(400).json({
      success: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
      code: 'WEAK_PASSWORD'
    });
    return;
  }

  try {
    // Advisory lock prevents race if two browsers submit simultaneously
    await getPool().query('SELECT pg_advisory_lock(424242)');
    try {
      // Idempotency: check if admin already exists
      const existingOwner = await usersRepo.findByRole('owner').catch(() => null);
      if (existingOwner) {
        res.status(409).json({
          success: false,
          error: 'An administrator account already exists.'
        });
        return;
      }

      const adminId = crypto.randomUUID();
      const { hash, salt } = hashPassword(pwd);
      const currency = (baseCurrency?.trim().toUpperCase()) || 'USD';
      const symbol = (currencySymbol?.trim()) || (currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$');

      // All inserts in a single transaction
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');

        // 1. Create owner user
        await client.query(
          `INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, preferred_currency, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'owner', 'active', $7, CURRENT_TIMESTAMP)`,
          [
            adminId,
            adminUsername.trim(),
            adminEmail.trim().toLowerCase(),
            (adminName?.trim()) || adminUsername.trim(),
            hash,
            salt,
            currency
          ]
        );

        // 2. System settings
        const settings: [string, string][] = [
          ['company_name', (companyName?.trim()) || 'Vectis'],
          ['base_currency', currency],
          ['currency_symbol', symbol],
          ['support_phone', (supportPhone?.trim()) || '']
        ];
        for (const [k, val] of settings) {
          await client.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
            [k, val]
          );
        }

        // 3. Seed base currencies
        const defaultCurrencies = [
          ['USD', '$',   'US Dollar',       1.0,  2, currency === 'USD'],
          ['EUR', '€',   'Euro',            0.92, 2, currency === 'EUR'],
          ['GBP', '£',   'British Pound',   0.78, 2, currency === 'GBP'],
          ['AED', 'AED', 'UAE Dirham',      3.67, 2, currency === 'AED'],
          ['SAR', 'SAR', 'Saudi Riyal',     3.75, 2, currency === 'SAR'],
          ['CAD', 'CA$', 'Canadian Dollar', 1.35, 2, currency === 'CAD']
        ] as const;
        for (const [code, sym, name, rate, prec, isBase] of defaultCurrencies) {
          await client.query(
            `INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT (code) DO NOTHING`,
            [code, sym, name, rate, prec, isBase]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      console.log(`[Install] Administrator "${adminUsername.trim()}" created successfully.`);

      // Set install state to INSTALLING (admin created, awaiting finalize)
      await systemSettingsRepo.setInstallState('installing');

      // Audit (best-effort — table may not be ready yet in all edge cases)
      try {
        await auditRepo.log(
          { id: adminId, username: adminUsername.trim() } as any,
          'ADMIN_CREATED',
          'system',
          adminId,
          { companyName: companyName?.trim() || 'Vectis' }
        );
      } catch { /* non-fatal */ }

      res.json({
        success: true,
        message: 'Administrator account created successfully.'
      });
    } finally {
      await getPool().query('SELECT pg_advisory_unlock(424242)').catch(() => {});
    }
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({
        success: false,
        error: 'An account with this username or email already exists.'
      });
      return;
    }
    console.error('[Install] Failed to create administrator:', err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create administrator account. Please check server logs.'
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/finalize
// ──────────────────────────────────────────────────────────────────────────────
//
// Generates application secrets (if missing), marks installation INSTALLED,
// and returns a JWT so the operator is logged in immediately.

installRouter.post('/finalize', async (req, res) => {
  const installState = await systemSettingsRepo.getInstallState().catch(() => 'not_installed' as const);
  if (installState === 'installed') {
    const owner = await usersRepo.findByRole('owner').catch(() => null);
    if (owner) {
      const authUser = {
        id: owner.id,
        username: owner.username,
        email: owner.email,
        name: owner.name,
        role: owner.role as 'owner',
        preferred_currency: owner.preferred_currency || 'USD'
      };
      const token = createSessionToken(authUser);
      res.json({
        success: true,
        alreadyInstalled: true,
        message: 'System is already installed. Welcome back to Vectis.',
        token,
        user: authUser
      });
      return;
    }
    res.status(403).json({ success: false, error: 'Vectis is already installed.' });
    return;
  }

  try {
    // 1. Generate JWT_SECRET and ENCRYPTION_KEY if not already set
    const jwtSecret = ensureEnvSecret('JWT_SECRET', 32);
    const encKeyHex  = ensureEnvSecret('ENCRYPTION_KEY', 32);

    // 2. Hot-reload into the running config so auth works immediately
    updateConfig({
      jwtSecret,
      encryptionKey: Buffer.from(encKeyHex, 'hex')
    });

    // 3. Mark as installed
    await systemSettingsRepo.setInstallState('installed');

    console.log('[Install] Installation finalized. System is now operational.');

    // 4. Retrieve the owner account to issue a session token
    const owner = await usersRepo.findByRole('owner').catch(() => null);
    if (!owner) {
      res.status(500).json({
        success: false,
        error: 'Installation finalized but no administrator account was found. Please contact support.'
      });
      return;
    }

    const authUser = {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      name: owner.name,
      role: owner.role as 'owner',
      preferred_currency: owner.preferred_currency || 'USD'
    };

    const token = createSessionToken(authUser);

    try {
      await auditRepo.log(authUser, 'SYSTEM_INSTALLED', 'system', null, {
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch { /* non-fatal */ }

    res.json({
      success: true,
      message: 'Installation complete. Welcome to Vectis.',
      token,
      user: authUser
    });
  } catch (err) {
    console.error('[Install] Finalization failed:', (err as Error).message);
    res.status(500).json({
      success: false,
      error: 'Installation finalization failed. Please check server logs.'
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/test-db   (legacy alias — kept for backward compatibility)
// ──────────────────────────────────────────────────────────────────────────────

installRouter.post('/test-db', async (req, res) => {
  const dbTest = await testConnection(5000);
  if (dbTest.ok) {
    res.json({ success: true, message: `PostgreSQL connection verified (latency: ${dbTest.latencyMs}ms).` });
  } else {
    res.status(500).json({ success: false, error: 'Database connection failed. Check server configuration.' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/install/setup   (legacy — kept for backward compatibility during transition)
// ──────────────────────────────────────────────────────────────────────────────

installRouter.post('/setup', validateBody({
  adminUsername: [v.required('Administrator username is required.'), v.string({ min: 3, max: 50 })],
  adminEmail:    [v.required('Administrator email is required.'), v.email('Invalid administrator email address format.')],
  adminPassword: [v.required('Administrator password is required.'), v.string({ min: 8, message: 'Password must be at least 8 characters.' })]
}), async (req, res, next) => {
  try {
    const alreadyInstalled = await systemSettingsRepo.isInstalled();
    if (alreadyInstalled) {
      res.status(403).json({ error: 'System is already installed. Setup wizard is locked.' });
      return;
    }

    const { adminUsername, adminEmail, adminName, adminPassword, companyName, baseCurrency, currencySymbol, supportPhone } = req.body;
    const adminId = crypto.randomUUID();
    const { hash, salt } = hashPassword(adminPassword);

    await (await import('../db/connection/pool.js')).transaction(async (client) => {
      await client.query(
        `INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, preferred_currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'owner', 'active', $7, CURRENT_TIMESTAMP)`,
        [adminId, adminUsername.trim(), adminEmail.trim().toLowerCase(), (adminName?.trim()) || 'Administrator', hash, salt, (baseCurrency?.trim().toUpperCase()) || 'USD']
      );
      const settings = [
        ['installed', 'true'], ['install_state', 'installed'],
        ['company_name', (companyName?.trim()) || 'Vectis'],
        ['base_currency', (baseCurrency?.trim().toUpperCase()) || 'USD'],
        ['currency_symbol', (currencySymbol?.trim()) || '$'],
        ['support_phone', (supportPhone?.trim()) || '']
      ];
      for (const [k, v] of settings) {
        await client.query(
          `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [k, v]
        );
      }
      const currencies = [['USD','$','US Dollar',1.0,2,true],['EUR','€','Euro',0.92,2,false],['GBP','£','British Pound',0.78,2,false],['AED','AED','UAE Dirham',3.67,2,false],['SAR','SAR','Saudi Riyal',3.75,2,false],['CAD','CA$','Canadian Dollar',1.35,2,false]];
      for (const [c,s,n,r,p,b] of currencies) {
        await client.query(`INSERT INTO currencies (code,symbol,name,exchange_rate,decimal_precision,is_base,updated_at) VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP) ON CONFLICT (code) DO NOTHING`, [c,s,n,r,p,b]);
      }
    });

    const jwtSecret = ensureEnvSecret('JWT_SECRET', 32);
    const encKeyHex  = ensureEnvSecret('ENCRYPTION_KEY', 32);
    updateConfig({ jwtSecret, encryptionKey: Buffer.from(encKeyHex, 'hex') });

    const authUser = { id: adminId, username: adminUsername.trim(), email: adminEmail.trim().toLowerCase(), name: (adminName?.trim()) || 'Administrator', role: 'owner' as const, preferred_currency: (baseCurrency?.trim().toUpperCase()) || 'USD' };
    const token = createSessionToken(authUser);
    await auditRepo.log(authUser, 'SYSTEM_INSTALLED', 'system', null, { companyName }).catch(() => {});

    res.json({ success: true, token, user: authUser });
  } catch (err: any) {
    next(err);
  }
});
