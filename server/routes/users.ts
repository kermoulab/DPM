import { Router } from 'express';
import crypto from 'crypto';
import { usersRepo } from '../db/repositories/users.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { hashPassword } from '../utils/crypto.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const usersRouter = Router();

// GET /api/users
usersRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const users = await usersRepo.findAll();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

// POST /api/users
usersRouter.post('/', requireAuth, requireRole('admin'), validateBody({
  username: [v.required('Username is required.'), v.string({ min: 3, max: 50, message: 'Username must be 3-50 characters.' })],
  email: [v.required('Email is required.'), v.email('A valid email address is required.')],
  name: [v.required('Name is required.'), v.string({ min: 1, max: 100 })],
  password: [v.required('Password is required.'), v.string({ min: 8, message: 'Password must be at least 8 characters.' })],
  role: v.enum(['owner', 'admin', 'manager', 'agent', 'viewer'] as const)
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { username, email, name, password, role = 'agent', preferred_currency = 'USD' } = req.body;

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await usersRepo.findByUsernameOrEmail(cleanUsername);
    if (existingUser) {
      res.status(400).json({ error: 'Username already exists.' });
      return;
    }

    const existingEmail = await usersRepo.findByUsernameOrEmail(cleanEmail);
    if (existingEmail) {
      res.status(400).json({ error: 'Email already exists.' });
      return;
    }

    const id = crypto.randomUUID();
    const { hash, salt } = hashPassword(password);

    const created = await usersRepo.create({
      id,
      username: cleanUsername,
      email: cleanEmail,
      name: name.trim(),
      password_hash: hash,
      password_salt: salt,
      role,
      status: 'active',
      preferred_currency
    });

    const { password_hash: _h, password_salt: _s, ...safeCreated } = created;
    await auditRepo.log(req.user || null, 'CREATE_USER', 'user', id, { username: cleanUsername, role });
    res.status(201).json({ success: true, id, user: safeCreated });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id
usersRouter.put('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, status, password, preferred_currency } = req.body;

    const existing = await usersRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Protect owner from being demoted or deactivated by non-owner
    if (existing.role === 'owner' && req.user?.role !== 'owner' && (role !== 'owner' || status !== 'active')) {
      res.status(403).json({ error: 'Cannot modify primary owner account permissions.' });
      return;
    }

    let passwordHash = undefined;
    let passwordSalt = undefined;

    if (password && password.length >= 8) {
      const p = hashPassword(password);
      passwordHash = p.hash;
      passwordSalt = p.salt;
    }

    const updated = await usersRepo.update(id, {
      name: name?.trim(),
      role,
      status,
      preferred_currency,
      password_hash: passwordHash,
      password_salt: passwordSalt
    });

    const safeUpdated = updated ? (({ password_hash, password_salt, ...rest }) => rest)(updated) : null;
    await auditRepo.log(req.user || null, 'UPDATE_USER', 'user', id, { role, status });
    res.json({ success: true, user: safeUpdated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
usersRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;

    if (id === req.user?.id) {
      res.status(400).json({ error: 'Cannot delete your own user account.' });
      return;
    }

    const existing = await usersRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (existing.role === 'owner') {
      res.status(403).json({ error: 'Cannot delete the system owner account.' });
      return;
    }

    await usersRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_USER', 'user', id, { username: existing.username });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
});
