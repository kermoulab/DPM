import { Router } from 'express';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { entity, action, limit } = req.query;
    const logs = await auditRepo.findLogs({
      entity: entity as string,
      action: action as string,
      limit: limit ? parseInt(limit as string, 10) : 100
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
});
