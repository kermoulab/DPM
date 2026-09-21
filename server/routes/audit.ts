import { Router } from 'express';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';

export const auditRouter = Router();

auditRouter.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { entity, action, page, limit } = req.query;
    const result = await auditRepo.findLogs({
      entity: entity as string,
      action: action as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? Math.min(parseInt(limit as string, 10) || 30, 30) : 30
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
