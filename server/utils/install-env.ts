/**
 * server/utils/install-env.ts
 *
 * Secure utility for writing environment variables to the project .env file
 * during the installation wizard. Used ONLY by the install route — never
 * callable from the browser.
 *
 * Security notes:
 *   - Writes are atomic: tmp file → rename (no partial writes)
 *   - Secrets are generated with crypto.randomBytes (CSPRNG)
 *   - Generated values are hex strings (no special character escaping issues)
 *   - DATABASE_URL is URL-validated before being passed here
 *   - File contents are never returned to the client
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Universal candidate paths for configuration persistence across different hosting environments:
 * 1. Explicit DPM_CONFIG_PATH or DATA_DIR (Docker, Kubernetes, custom PaaS)
 * 2. Standard working directory .env (VPS, PM2, systemd, local)
 * 3. ./data/.env (Docker mounted volume)
 * 4. /data/.env (Standard cloud container volume mount on Linux)
 * 5. ~/.dpm/.env (User home directory storage)
 */
export function getEnvPaths(): string[] {
  const paths: string[] = [];

  if (process.env.DPM_CONFIG_PATH) paths.push(process.env.DPM_CONFIG_PATH);
  if (process.env.DATA_DIR) paths.push(path.join(process.env.DATA_DIR, '.env'));
  paths.push(path.join(process.cwd(), '.env'));
  paths.push(path.join(process.cwd(), 'data', '.env'));

  if (process.platform !== 'win32') {
    paths.push('/data/.env');
  }

  try {
    const homeDir = os.homedir();
    if (homeDir) {
      paths.push(path.join(homeDir, '.dpm', '.env'));
    }
  } catch {}

  return Array.from(new Set(paths));
}

/**
 * Read from a specific .env file, returning an empty string if it doesn't exist.
 */
function readEnvFile(targetPath: string): string {
  try {
    return fs.readFileSync(targetPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Write or update a single key in .env files atomically.
 * Writes to project root .env and any configured persistent volume directories.
 * Values are always double-quoted for safety with special characters.
 */
export function writeEnvVar(key: string, value: string): void {
  const candidatePaths = getEnvPaths();
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const newLine = `${key}="${escaped}"`;
  const regex = new RegExp(`^${key}\\s*=.*$`, 'gm');

  for (const envPath of candidatePaths) {
    try {
      const dir = path.dirname(envPath);
      // Ensure target directory exists if it's a persistent folder
      if (!fs.existsSync(dir)) {
        if (envPath.includes('.dpm') || envPath.includes('data')) {
          try { fs.mkdirSync(dir, { recursive: true }); } catch { continue; }
        } else {
          continue;
        }
      }

      let content = readEnvFile(envPath);
      if (regex.test(content)) {
        content = content.replace(regex, newLine);
      } else {
        content = content ? `${content.trimEnd()}\n${newLine}\n` : `${newLine}\n`;
      }

      const tmpPath = `${envPath}.tmp`;
      fs.writeFileSync(tmpPath, content, { encoding: 'utf-8', flag: 'w' });
      fs.renameSync(tmpPath, envPath);
    } catch {
      // Ignored for inaccessible or read-only candidate paths
    }
  }
}

/**
 * Generate a cryptographically random hex secret of the given byte length.
 * 32 bytes → 64 hex chars (suitable for JWT_SECRET, ENCRYPTION_KEY).
 */
export function generateSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Ensure a secret env var exists and is valid. If it is missing or is a
 * placeholder, generate a new one, write it to .env, and update process.env.
 *
 * Returns the definitive secret value (existing or newly generated).
 */
export function ensureEnvSecret(key: string, bytes = 32): string {
  const existing = process.env[key];
  const placeholder = 'replace_with';

  if (
    existing &&
    existing.length >= bytes * 2 &&
    !existing.startsWith(placeholder)
  ) {
    return existing;
  }

  const secret = generateSecret(bytes);
  try {
    writeEnvVar(key, secret);
    console.log(`[Install] Generated ${key} and wrote to .env`);
  } catch (err: any) {
    console.warn(`[Install] Could not write ${key} to .env (ephemeral/read-only filesystem):`, err.message);
  }
  process.env[key] = secret;
  return secret;
}

/**
 * Write DATABASE_URL to .env and update process.env immediately.
 * The value is validated before this function is called.
 */
export function persistDatabaseUrl(databaseUrl: string): void {
  try {
    writeEnvVar('DATABASE_URL', databaseUrl);
    console.log('[Install] DATABASE_URL written to .env');
  } catch (err: any) {
    console.warn('[Install] Could not write DATABASE_URL to .env (ephemeral/read-only filesystem):', err.message);
  }
  process.env.DATABASE_URL = databaseUrl;
}

/**
 * Sanitize a database error message for safe display to the client.
 * Strips any connection URL, password, or credential references.
 */
export function sanitizeDbError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/postgresql?:\/\/[^\s"'<>]*/gi, 'postgresql://***')
    .replace(/password[^=\s]*\s*=\s*\S+/gi, 'password=***')
    .replace(/pwd[^=\s]*\s*=\s*\S+/gi, 'pwd=***')
    .slice(0, 300);
}

/**
 * Mask a DATABASE_URL for safe display (shows host/db, hides password).
 * Uses the standard URL parser so it handles any valid postgres URL.
 */
export function maskDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    u.password = '****';
    return u.toString();
  } catch {
    return 'postgresql://***';
  }
}
