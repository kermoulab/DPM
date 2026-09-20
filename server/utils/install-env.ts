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
import crypto from 'crypto';

const ENV_PATH = path.join(process.cwd(), '.env');
const ENV_TMP_PATH = path.join(process.cwd(), '.env.tmp');

/**
 * Read the current .env file, returning an empty string if it doesn't exist.
 */
function readEnvFile(): string {
  try {
    return fs.readFileSync(ENV_PATH, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Write or update a single key in the .env file atomically.
 * Values are always double-quoted for safety with special characters.
 */
export function writeEnvVar(key: string, value: string): void {
  let content = readEnvFile();

  // Escape any embedded double-quotes in the value
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const newLine = `${key}="${escaped}"`;

  // Replace existing key or append new one
  const regex = new RegExp(`^${key}\\s*=.*$`, 'gm');
  if (regex.test(content)) {
    content = content.replace(regex, newLine);
  } else {
    content = content
      ? `${content.trimEnd()}\n${newLine}\n`
      : `${newLine}\n`;
  }

  // Atomic write: write to .env.tmp, then rename over .env
  fs.writeFileSync(ENV_TMP_PATH, content, { encoding: 'utf-8', flag: 'w' });
  fs.renameSync(ENV_TMP_PATH, ENV_PATH);
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
