import { Router } from 'express';
import { dashboardRepo } from '../db/repositories/dashboard.repository.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const dashboardRouter = Router();

let cachedStats: { data: any; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 1000; // 15 seconds cache to avoid slamming PostgreSQL

dashboardRouter.get('/stats', requireAuth, async (req, res, next) => {
  const now = Date.now();
  if (cachedStats && cachedStats.expiresAt > now) {
    res.setHeader('X-Cache', 'HIT');
    res.json(cachedStats.data);
    return;
  }

  try {
    const start = Date.now();
    const stats = await dashboardRepo.getStats();
    const duration = Date.now() - start;

    cachedStats = {
      data: stats,
      expiresAt: now + CACHE_TTL_MS
    };

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});
