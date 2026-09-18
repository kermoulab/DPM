import { Router } from 'express';
import { authService } from '../services/auth.service.js';
import { requireAuth, revokeToken, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { usersRepo } from '../db/repositories/users.repository.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const authRouter = Router();

// In-memory rate limiting
const loginAttempts: Record<string, { count: number; lastAttempt: number }> = {};
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000;

// POST /api/auth/login
authRouter.post('/login', validateBody({
  username: v.required('Username is required.'),
  password: v.required('Password is required.')
}), async (req, res, next) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const attempt = loginAttempts[ip] || { count: 0, lastAttempt: now };

  if (now - attempt.lastAttempt > LOGIN_WINDOW_MS) {
    attempt.count = 0;
  }

  if (attempt.count >= LOGIN_MAX_ATTEMPTS && now - attempt.lastAttempt < LOGIN_WINDOW_MS) {
    res.status(429).json({ error: 'Too many failed login attempts. Please wait 1 minute.' });
    return;
  }

  const { username, password } = req.body;

  try {
    const result = await authService.login(username, password, ip);
    delete loginAttempts[ip];
    res.json({ success: true, ...result });
  } catch (err: any) {
    attempt.count += 1;
    attempt.lastAttempt = now;
    loginAttempts[ip] = attempt;
    res.status(err.statusCode || 401).json({ error: err.message || 'Invalid credentials.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await authService.getMe(req.user!.id);
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
      }
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
