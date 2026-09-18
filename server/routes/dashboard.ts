import { Router } from 'express';
import { dashboardRepo } from '../db/repositories/dashboard.repository.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, async (req, res, next) => {
  try {
    const stats = await dashboardRepo.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
