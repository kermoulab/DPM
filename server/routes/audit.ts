import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../security.js';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole('admin'), (req, res) => {
  const { entity, action, limit = 100 } = req.query;

  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params: any[] = [];

  if (entity) {
    query += ' AND entity = ?';
    params.push(entity);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const rawLogs = db.prepare(query).all(...params) as any[];

  const logs = rawLogs.map(log => ({
    ...log,
    details: log.details ? JSON.parse(log.details) : {}
  }));

  res.json({ logs });
});
