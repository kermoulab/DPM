import { Router } from 'express';
import { db, logAudit } from '../db.js';
import { verifyPassword, hashPassword, createSessionToken, requireAuth, revokeToken, type AuthenticatedRequest } from '../security.js';

export const authRouter = Router();

// In-memory rate limiter (per IP). For multi-instance deployments, use a shared store like Redis.
const loginAttempts: Record<string, { count: number; lastAttempt: number }> = {};

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 60 * 1000; // 1 minute lockout window

authRouter.post('/login', (req, res) => {
  const ip = req.ip || '127.0.0.1';
  const now = Date.now();
  const attempt = loginAttempts[ip] || { count: 0, lastAttempt: now };

  // Reset counter if window has elapsed
  if (now - attempt.lastAttempt > LOGIN_WINDOW_MS) {
    attempt.count = 0;
  }

  if (attempt.count >= LOGIN_MAX_ATTEMPTS && now - attempt.lastAttempt < LOGIN_WINDOW_MS) {
    return res.status(429).json({ error: 'Too many failed login attempts. Please wait 1 minute.' });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const trimmedIdentifier = username.trim();

  // Look up by username OR email (case-insensitive)
  const user = db.prepare(`
    SELECT id, username, email, name, password_hash, password_salt, role, status, avatar, preferred_currency
    FROM users
    WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)
  `).get(trimmedIdentifier, trimmedIdentifier) as any;

  // Constant-time: always run verifyPassword even if user not found (to prevent timing oracle)
  const dummyHash = 'a'.repeat(128);
  const dummySalt = 'b'.repeat(32);
  const isValid = user
    ? verifyPassword(password, user.password_hash, user.password_salt)
    : (verifyPassword(password, dummyHash, dummySalt), false); // always false for non-existent user

  if (!user || !isValid) {
    attempt.count += 1;
    attempt.lastAttempt = now;
    loginAttempts[ip] = attempt;
    logAudit(null, 'LOGIN_FAILED', 'user', null, { attemptedUsername: trimmedIdentifier }, ip);
    return res.status(401).json({
      error: 'Invalid username or password.'
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'This user account has been deactivated.' });
  }

  // Clear attempts on success
  delete loginAttempts[ip];

  // Update last login
  db.prepare("UPDATE users SET last_login = ? WHERE id = ?").run(new Date().toISOString(), user.id);

  const authUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    preferred_currency: user.preferred_currency || 'USD'
  };

  const token = createSessionToken(authUser);
  logAudit(authUser, 'LOGIN_SUCCESS', 'user', user.id, {}, ip);

  res.json({
    success: true,
    token,
    user: authUser
  });
});

// Current user profile
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = db.prepare(`
    SELECT id, username, email, name, role, status, avatar, preferred_currency, created_at, last_login
    FROM users
    WHERE id = ?
  `).get(req.user!.id) as any;

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (!user.preferred_currency) {
    user.preferred_currency = 'USD';
  }

  res.json({ user });
});

// Logout — revokes the current session token server-side
authRouter.post('/logout', requireAuth, (req: AuthenticatedRequest, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    revokeToken(token);
  }
  logAudit(req.user || null, 'LOGOUT', 'user', req.user?.id || null, {}, req.ip || '127.0.0.1');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// Input validation helpers (positive validation, not regex denylist)
function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 70;
}

function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(username.trim());
}

function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

function isValidPassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 8) return { valid: false, reason: 'Password must be at least 8 characters long.' };
  if (!/[A-Z]/.test(password)) return { valid: false, reason: 'Password must contain at least one uppercase letter.' };
  if (!/[a-z]/.test(password)) return { valid: false, reason: 'Password must contain at least one lowercase letter.' };
  if (!/[0-9]/.test(password)) return { valid: false, reason: 'Password must contain at least one number.' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password)) {
    return { valid: false, reason: 'Password must contain at least one special character (e.g. !@#$%^&*).' };
  }
  return { valid: true };
}

// Update Active User Profile
authRouter.put('/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { name, username, email, preferred_currency, currentPassword, newPassword, confirmPassword } = req.body;

  // Validate required fields with positive validation
  if (!name || !isValidName(name)) {
    return res.status(400).json({ error: 'Full name must be between 2 and 70 characters.' });
  }
  if (!username || !isValidUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters: letters, numbers, hyphens, dots, underscores only.' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const cleanName = name.trim();
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  // Fetch current user record
  const currentUser = db.prepare(`
    SELECT id, username, email, name, role, status, avatar, preferred_currency, password_hash, password_salt
    FROM users
    WHERE id = ?
  `).get(userId) as any;

  if (!currentUser) {
    return res.status(404).json({ error: 'User profile not found.' });
  }

  // Check uniqueness of username and email (excluding current user)
  const conflict = db.prepare(`
    SELECT id, username, email FROM users
    WHERE (LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)) AND id != ?
  `).get(cleanUsername, cleanEmail, userId) as any;

  if (conflict) {
    if (conflict.username.toLowerCase() === cleanUsername.toLowerCase()) {
      return res.status(400).json({ error: 'This username is already registered to another account.' });
    }
    return res.status(400).json({ error: 'This email is already registered to another account.' });
  }

  let updatedPasswordHash = currentUser.password_hash;
  let updatedPasswordSalt = currentUser.password_salt;
  let passwordChanged = false;

  // Password change flow
  if (currentPassword || newPassword || confirmPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change your password.' });
    }

    if (!verifyPassword(currentPassword, currentUser.password_hash, currentUser.password_salt)) {
      logAudit(req.user || null, 'FAILED_PROFILE_PASSWORD_VERIFY', 'user', userId, {});
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    if (!newPassword) {
      return res.status(400).json({ error: 'New password cannot be empty.' });
    }

    const passwordCheck = isValidPassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.reason });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match.' });
    }

    const { hash, salt } = hashPassword(newPassword);
    updatedPasswordHash = hash;
    updatedPasswordSalt = salt;
    passwordChanged = true;
  }

  const cleanCurrency = (typeof preferred_currency === 'string' && preferred_currency.trim())
    ? preferred_currency.trim().toUpperCase()
    : (currentUser.preferred_currency || 'USD');

  // Update — role is preserved from DB, never modified by profile update
  db.prepare(`
    UPDATE users
    SET name = ?,
        username = ?,
        email = ?,
        preferred_currency = ?,
        password_hash = ?,
        password_salt = ?
    WHERE id = ?
  `).run(cleanName, cleanUsername, cleanEmail, cleanCurrency, updatedPasswordHash, updatedPasswordSalt, userId);

  logAudit(req.user || null, 'UPDATE_PROFILE', 'user', userId, {
    username: cleanUsername,
    email: cleanEmail,
    preferred_currency: cleanCurrency,
    passwordChanged
  });

  const updatedAuthUser = {
    id: userId,
    username: cleanUsername,
    email: cleanEmail,
    name: cleanName,
    role: currentUser.role,
    avatar: currentUser.avatar,
    preferred_currency: cleanCurrency
  };

  const newToken = createSessionToken(updatedAuthUser);

  res.json({
    success: true,
    message: passwordChanged
      ? 'Profile and password updated successfully.'
      : 'Profile saved successfully.',
    user: updatedAuthUser,
    token: newToken
  });
});

// Update preferred currency (used by currency switcher)
authRouter.put('/currency', requireAuth, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { currency } = req.body;
  if (!currency || typeof currency !== 'string') {
    return res.status(400).json({ error: 'Currency code is required.' });
  }

  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    return res.status(400).json({ error: 'Invalid currency code format.' });
  }

  db.prepare('UPDATE users SET preferred_currency = ? WHERE id = ?').run(code, userId);
  logAudit(req.user || null, 'UPDATE_PREFERRED_CURRENCY', 'user', userId, { currency: code });

  res.json({
    success: true,
    preferred_currency: code,
    message: `Currency preference saved: ${code}`
  });
});

// Change password (standalone endpoint)
authRouter.post('/change-password', requireAuth, (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const passwordCheck = isValidPassword(newPassword);
  if (!passwordCheck.valid) {
    return res.status(400).json({ error: passwordCheck.reason });
  }

  const user = db.prepare('SELECT id, password_hash, password_salt FROM users WHERE id = ?').get(req.user!.id) as any;
  if (!verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const { hash, salt } = hashPassword(newPassword);
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, req.user!.id);
  logAudit(req.user || null, 'PASSWORD_CHANGED', 'user', req.user!.id, {}, req.ip || '127.0.0.1');

  res.json({ success: true, message: 'Password updated successfully.' });
});
