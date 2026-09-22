import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { usersRepo, type UserRow } from '../db/repositories/users.repository.js';
import { devicesRepo } from '../db/repositories/devices.repository.js';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
  avatar?: string | null;
  preferred_currency?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

// In-memory revoked tokens set (scoped to process; cleared on token expiry)
const revokedTokens = new Set<string>();

export function revokeToken(token: string): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export function isTokenRevoked(token: string): boolean {
  return revokedTokens.has(token);
}

export function createSessionToken(user: AuthUser, expiresInHours = 24): string {
  const payload = {
    sub: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    preferred_currency: user.preferred_currency || 'USD',
    exp: Math.floor(Date.now() / 1000) + expiresInHours * 3600
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;

    // JWT Algorithm Pinning & Header Integrity
    const headerObj = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (!headerObj || headerObj.alg !== 'HS256' || headerObj.typ !== 'JWT') {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature, 'base64url');
    const expBuf = Buffer.from(expectedSignature, 'base64url');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      preferred_currency: payload.preferred_currency || 'USD'
    };
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (isTokenRevoked(token)) {
    res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
    return;
  }

  const tokenUser = verifySessionToken(token);
  if (!tokenUser) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }

  // Always re-verify user status and authoritative role from PostgreSQL
  try {
    const deviceId = req.headers['x-device-id'] as string | undefined;
    if (deviceId) {
      const device = await devicesRepo.findById(deviceId);
      if (!device || device.status === 'revoked') {
        res.status(401).header('X-Device-Revoked', 'true').json({ error: 'Device has been revoked or unlinked.' });
        return;
      }
    }

    const dbUser = await usersRepo.findById(tokenUser.id);
    if (!dbUser || dbUser.status !== 'active') {
      res.status(401).json({ error: 'User account is inactive or revoked.' });
      return;
    }

    req.user = {
      ...tokenUser,
      role: dbUser.role,
      preferred_currency: dbUser.preferred_currency || 'USD'
    };
    next();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify session status.' });
  }
}

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 5,
  admin: 4,
  manager: 3,
  agent: 2,
  viewer: 1
};

export function requireRole(minRole: 'owner' | 'admin' | 'manager' | 'agent' | 'viewer') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;
    if (userLevel < requiredLevel) {
      res.status(403).json({ error: `Forbidden. Requires at least '${minRole}' role.` });
      return;
    }
    next();
  };
}
