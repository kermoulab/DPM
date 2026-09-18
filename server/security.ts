import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

// ─── REQUIRED SECRETS ────────────────────────────────────────────────────────
// Both ENCRYPTION_KEY and JWT_SECRET must be provided via environment variables.
// In development, a deterministic fallback is used IF NODE_ENV is not 'production'.
// In production, missing secrets cause a hard startup failure (see server.ts startup guard).

function requireSecret(envVar: string, devFallback: string, purpose: string): string {
  const val = process.env[envVar];
  if (val && val.trim().length >= 32) {
    return val.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    console.error(`FATAL: Required environment variable ${envVar} is missing or too short (minimum 32 chars). ${purpose} cannot proceed without it. Set it in your environment before starting in production.`);
    process.exit(1);
  }
  // Development-only warning — never reaches production
  console.warn(`[DEV] WARNING: ${envVar} not set. Using insecure development-only fallback. Set this in .env before production deployment.`);
  return devFallback;
}

// Encryption key must be exactly 32 bytes for AES-256-GCM.
// ENCRYPTION_KEY env var should be 64 hex characters (32 bytes).
function deriveEncryptionKey(): Buffer {
  const rawKey = requireSecret(
    'ENCRYPTION_KEY',
    'dev-only-insecure-encryption-key-placeholder-not-for-production',
    'AES-256-GCM credential encryption'
  );
  // If given as 64-char hex, use directly; otherwise hash to 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

const MASTER_ENCRYPTION_KEY: Buffer = deriveEncryptionKey();

const JWT_SECRET: string = requireSecret(
  'JWT_SECRET',
  'dev-only-insecure-jwt-secret-placeholder-not-for-production',
  'Session token signing'
);

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
  avatar?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// Password hashing using PBKDF2 with 100,000 iterations (SHA-512, 64-byte output)
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    // Use timingSafeEqual to prevent timing attacks
    const hashBuf = Buffer.from(hash, 'hex');
    const checkBuf = Buffer.from(checkHash, 'hex');
    if (hashBuf.length !== checkBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, checkBuf);
  } catch {
    return false;
  }
}

// AES-256-GCM symmetric authenticated encryption for sensitive business credentials
export function encryptCredential(plaintext: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', MASTER_ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

export function decryptCredential(encryptedHex: string, ivHex: string, tagHex: string): string {
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', MASTER_ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '***DECRYPTION_ERROR***';
  }
}

// In-memory token revocation set (process-scoped; for cross-process revocation use DB-backed sessions)
const revokedTokens = new Set<string>();

export function revokeToken(token: string): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export function isTokenRevoked(token: string): boolean {
  return revokedTokens.has(token);
}

export function createSessionToken(user: AuthUser & { preferred_currency?: string }, expiresInHours = 24): string {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature, 'base64url');
    const expBuf = Buffer.from(expectedSignature, 'base64url');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      name: payload.name,
      role: payload.role
    };
  } catch {
    return null;
  }
}

// Express authentication middleware
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  const token = authHeader.split(' ')[1];
  if (isTokenRevoked(token)) {
    return res.status(401).json({ error: 'Session has been revoked/terminated. Please log in again.' });
  }

  const user = verifySessionToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }

  // Always re-verify role and status from the database — never trust the token alone
  const dbUser = db.prepare('SELECT id, status, role FROM users WHERE id = ?').get(user.id) as any;
  if (!dbUser || dbUser.status !== 'active') {
    return res.status(401).json({ error: 'User account is inactive or revoked.' });
  }

  req.user = {
    ...user,
    role: dbUser.role // Authoritative role from DB, not from token
  };
  next();
}

// Role-based authorization middleware
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1
};

export function requireRole(minRole: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Forbidden. Requires at least '${minRole}' role.` });
    }
    next();
  };
}

// Unified secret redaction helper (single authoritative implementation)
export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 4) return '****';
  return secret.slice(0, 2) + '*'.repeat(secret.length - 4) + secret.slice(-2);
}
