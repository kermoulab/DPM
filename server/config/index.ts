/**
 * server/config/index.ts
 *
 * Application configuration — reads from environment variables and provides
 * a typed configuration object.
 *
 * WordPress-style installer behaviour:
 *   The server must be able to start with NO DATABASE_URL, JWT_SECRET, or
 *   ENCRYPTION_KEY configured, so the installer wizard can collect them from
 *   the operator and write them to .env. Once the installer writes secrets and
 *   calls updateConfig(), all subsequent requests use the updated values without
 *   a server restart.
 *
 * Production deployments (pre-configured via env vars or platform secrets):
 *   Set DATABASE_URL, JWT_SECRET, and ENCRYPTION_KEY before starting the server.
 *   The installer detects they are already configured and skips those steps.
 */

import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Universal multi-path environment loader:
 * Resolves .env files across different hosting environments:
 * - Vectis_CONFIG_PATH / DATA_DIR (Custom paths, Docker, Kubernetes)
 * - /data/.env (Standard cloud/Docker persistent volume mounts)
 * - ~/.vectis/.env (User home directory storage)
 * - ./data/.env and ./.env (Local project and volume directories)
 */
function loadUniversalDotenv(): void {
  const candidatePaths: string[] = [];

  if (process.env.Vectis_CONFIG_PATH) candidatePaths.push(process.env.Vectis_CONFIG_PATH);
  if (process.env.DATA_DIR) candidatePaths.push(path.join(process.env.DATA_DIR, '.env'));
  candidatePaths.push(path.join(process.cwd(), '.env'));
  candidatePaths.push(path.join(process.cwd(), 'data', '.env'));

  if (process.platform !== 'win32') {
    candidatePaths.push('/data/.env');
  }

  try {
    const home = os.homedir();
    if (home) candidatePaths.push(path.join(home, '.vectis', '.env'));
  } catch {}

  // Load from candidate paths without overwriting existing process.env variables
  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
      }
    } catch {}
  }
}

loadUniversalDotenv();

export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  databaseUrl: string;
  jwtSecret: string;
  encryptionKey: Buffer;
}

// Insecure dev-only fallbacks — never used in production after install
const DEV_FALLBACK_JWT_SECRET = 'dev-insecure-jwt-secret-placeholder-minimum-32c';
const DEV_FALLBACK_ENCRYPTION_KEY = 'dev-insecure-encryption-key-placeholder-minimum-32b';

function buildEncryptionKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function loadConfig(): AppConfig {
  const nodeEnv = (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test';
  const isProduction = nodeEnv === 'production';

  // PORT — the only truly fatal misconfiguration (invalid port means the server can't bind)
  const rawPort = process.env.PORT || '3000';
  const port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.error(`FATAL: Invalid PORT specified: "${rawPort}". Must be an integer between 1 and 65535.`);
    process.exit(1);
  }

  // DATABASE_URL — optional at startup (installer will configure it)
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.warn('[Config] DATABASE_URL not set. Vectis will operate in installer mode until a database is configured.');
  } else if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    console.warn('[Config] WARNING: DATABASE_URL does not start with "postgresql://" or "postgres://". Connection may fail.');
  }

  // JWT_SECRET — generate secure random secret in production if missing/weak
  const rawJwtSecret = (process.env.JWT_SECRET || '').trim();
  let jwtSecret = rawJwtSecret;
  if (!jwtSecret || jwtSecret.length < 32) {
    if (isProduction) {
      console.warn('[Security] CRITICAL: JWT_SECRET missing or weak in production. Generating secure ephemeral 256-bit key.');
      jwtSecret = crypto.randomBytes(32).toString('hex');
    } else {
      jwtSecret = DEV_FALLBACK_JWT_SECRET;
    }
  }

  // ENCRYPTION_KEY — generate secure random key in production if missing/weak
  const rawEncKey = (process.env.ENCRYPTION_KEY || '').trim();
  let encKeyString = rawEncKey;
  if (!encKeyString || encKeyString.length < 32) {
    if (isProduction) {
      console.warn('[Security] CRITICAL: ENCRYPTION_KEY missing or weak in production. Generating secure ephemeral 256-bit key.');
      encKeyString = crypto.randomBytes(32).toString('hex');
    } else {
      encKeyString = DEV_FALLBACK_ENCRYPTION_KEY;
    }
  }
  const encryptionKey = buildEncryptionKey(encKeyString);

  // Summary warning for development
  if (!isProduction) {
    const missing: string[] = [];
    if (!databaseUrl) missing.push('DATABASE_URL');
    if (!rawJwtSecret) missing.push('JWT_SECRET');
    if (!rawEncKey) missing.push('ENCRYPTION_KEY');
    if (missing.length > 0) {
      console.warn(`[Config] Development mode: ${missing.join(', ')} not configured. Open the browser to start the installer.`);
    }
  }

  return { port, nodeEnv, isProduction, databaseUrl, jwtSecret, encryptionKey };
}

export const config: AppConfig = loadConfig();

/**
 * Hot-update the in-process config object.
 * Called by the installer after writing secrets to .env and reloading them.
 * Changes take effect immediately for all subsequent requests.
 */
export function updateConfig(updates: Partial<AppConfig>): void {
  if (updates.encryptionKey instanceof Buffer) {
    config.encryptionKey = updates.encryptionKey;
  }
  if (typeof updates.jwtSecret === 'string' && updates.jwtSecret) {
    config.jwtSecret = updates.jwtSecret;
  }
  if (typeof updates.databaseUrl === 'string') {
    config.databaseUrl = updates.databaseUrl;
  }
}
