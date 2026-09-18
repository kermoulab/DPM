import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, hashPassword, type AuthenticatedRequest } from '../security.js';

export const usersRouter = Router();

// List users
usersRouter.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const users = db.prepare(`
    SELECT id, username, email, name, role, status, avatar, preferred_currency, created_at, last_login
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json({ users });
});

// Create new user
usersRouter.post('/', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { username, email, name, password, role = 'agent' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required.' });
  }

  const validRoles = ['owner', 'admin', 'manager', 'agent', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  // Non-owner cannot create an owner
  if (role === 'owner' && req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Only an owner can grant the owner role.' });
  }

  const id = crypto.randomUUID();
  const { hash, salt } = hashPassword(password);
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, username.trim(), email.trim(), name?.trim() || username.trim(), hash, salt, role, now);

    logAudit(req.user || null, 'CREATE_USER', 'user', id, { username, role });
    res.status(201).json({ success: true, id, username, role });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update user
usersRouter.put('/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, role, status, password } = req.body;

  const targetUser = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id) as any;
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (targetUser.role === 'owner' && req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Cannot modify an owner account.' });
  }

  let hash = null;
  let salt = null;
  if (password && password.length >= 8) {
    const p = hashPassword(password);
    hash = p.hash;
    salt = p.salt;
  }

  db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        role = COALESCE(?, role),
        status = COALESCE(?, status),
        password_hash = COALESCE(?, password_hash),
        password_salt = COALESCE(?, password_salt)
    WHERE id = ?
  `).run(name?.trim(), role, status, hash, salt, id);

  logAudit(req.user || null, 'UPDATE_USER', 'user', id, { role, status });
  res.json({ success: true, message: 'User updated.' });
});

// Delete user
usersRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  if (id === req.user?.id) {
    return res.status(400).json({ error: 'Cannot delete your own account.' });
  }

  const target = db.prepare('SELECT id, role, username FROM users WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (target.role === 'admin' || target.role === 'owner') {
    return res.status(403).json({ error: 'Admin accounts cannot be deleted.' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_USER', 'user', id, { username: target.username, role: target.role });
  res.json({ success: true, message: 'User deleted from database.' });
});
