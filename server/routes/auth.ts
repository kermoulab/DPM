import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { requireAuth, revokeToken, createSessionToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { usersRepo } from '../db/repositories/users.repository.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const authRouter = Router();

// Rate limiting with attempt count and progressive lockout (keyed by IP and target username)
interface AttemptState {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const loginAttempts: Record<string, AttemptState> = {};
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15-minute lockout

function getRateLimitState(key: string, now: number): { isLocked: boolean; retryAfterSeconds: number; remainingAttempts: number } {
  const attempt = loginAttempts[key];
  if (!attempt) {
    return { isLocked: false, retryAfterSeconds: 0, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  // Check if currently locked
  if (attempt.lockedUntil && attempt.lockedUntil > now) {
    const retryAfter = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { isLocked: true, retryAfterSeconds: retryAfter, remainingAttempts: 0 };
  }

  // Check if window has expired
  if (now - attempt.firstAttempt > LOGIN_WINDOW_MS) {
    delete loginAttempts[key];
    return { isLocked: false, retryAfterSeconds: 0, remainingAttempts: LOGIN_MAX_ATTEMPTS };
  }

  if (attempt.count >= LOGIN_MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
    const retryAfter = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return { isLocked: true, retryAfterSeconds: retryAfter, remainingAttempts: 0 };
  }

  return {
    isLocked: false,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, LOGIN_MAX_ATTEMPTS - attempt.count)
  };
}

function recordFailure(key: string, now: number): { count: number; remaining: number; lockedUntil?: number } {
  const attempt = loginAttempts[key] || { count: 0, firstAttempt: now, lastAttempt: now };
  if (now - attempt.firstAttempt > LOGIN_WINDOW_MS) {
    attempt.count = 0;
    attempt.firstAttempt = now;
    delete attempt.lockedUntil;
  }
  attempt.count += 1;
  attempt.lastAttempt = now;

  if (attempt.count >= LOGIN_MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttempts[key] = attempt;
  const remaining = Math.max(0, LOGIN_MAX_ATTEMPTS - attempt.count);
  return { count: attempt.count, remaining, lockedUntil: attempt.lockedUntil };
}

// POST /api/auth/login
authRouter.post('/login', validateBody({
  username: v.required('Username is required.'),
  password: v.required('Password is required.')
}), async (req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const { username, password } = req.body;
  const cleanUsername = String(username).trim().toLowerCase();
  const userKey = `user:${cleanUsername}`;
  const ipKey = `ip:${ip}`;
  const now = Date.now();

  const ipState = getRateLimitState(ipKey, now);
  const userState = getRateLimitState(userKey, now);

  if (ipState.isLocked || userState.isLocked) {
    const retryAfter = Math.max(ipState.retryAfterSeconds, userState.retryAfterSeconds);
    const minutesLeft = Math.ceil(retryAfter / 60);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({
      error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      locked: true,
      retry_after_seconds: retryAfter
    });
    return;
  }

  try {
    const result = await authService.login(username, password, ip);
    delete loginAttempts[ipKey];
    delete loginAttempts[userKey];
    res.json({ success: true, ...result });
  } catch (err: any) {
    const ipFail = recordFailure(ipKey, now);
    const userFail = recordFailure(userKey, now);
    const minRemaining = Math.min(ipFail.remaining, userFail.remaining);

    // Audit failed attempt
    try {
      await auditRepo.log(null, 'LOGIN_FAILED', 'auth', cleanUsername, { ip, remaining_attempts: minRemaining });
    } catch (_auditErr) {}

    if (ipFail.lockedUntil || userFail.lockedUntil) {
      const retryAfter = Math.ceil(LOCKOUT_DURATION_MS / 1000);
      const minutesLeft = Math.ceil(retryAfter / 60);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${minutesLeft} minutes.`,
        locked: true,
        retry_after_seconds: retryAfter,
        remaining_attempts: 0
      });
      return;
    }

    res.status(err.statusCode || 401).json({
      error: err.message || 'Invalid credentials.',
      remaining_attempts: minRemaining,
      max_attempts: LOGIN_MAX_ATTEMPTS
    });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await authService.getMe(req.user!.id);
    const refreshedToken = createSessionToken(req.user!, 24 * 30);
    res.setHeader('X-New-Token', refreshedToken);
    res.setHeader('Access-Control-Expose-Headers', 'X-New-Token, X-Device-Revoked');
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        preferred_currency: user.preferred_currency || 'USD',
        created_at: user.created_at,
        last_login: user.last_login
      },
      token: refreshedToken
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      revokeToken(authHeader.split(' ')[1]);
    }
    await auditRepo.log(req.user || null, 'LOGOUT', 'user', req.user?.id || null, {}, req.ip || '127.0.0.1');
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/profile
authRouter.put('/profile', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const result = await authService.updateProfile(req.user!.id, req.body, req.ip || '127.0.0.1');
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});

// PUT /api/auth/currency
authRouter.put('/currency', requireAuth, validateBody({
  currency: [v.required('Currency code is required.'), v.currencyCode()]
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { currency } = req.body;
    const code = await authService.updateCurrency(req.user!.id, currency);
    await auditRepo.log(req.user || null, 'UPDATE_CURRENCY', 'user', req.user!.id, { currency: code });
    res.json({ success: true, preferred_currency: code, message: `Currency preference updated to ${code}.` });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, validateBody({
  currentPassword: v.required('Current password is required.'),
  newPassword: [
    v.required('New password is required.'),
    v.string({ min: 8, message: 'New password must be at least 8 characters.' })
  ]
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.id, currentPassword, newPassword, req.ip || '127.0.0.1');
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    res.status(err.statusCode || 400).json({ error: err.message });
  }
});
