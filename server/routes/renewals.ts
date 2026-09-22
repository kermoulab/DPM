import { Router } from 'express';
import { orderService } from '../services/order.service.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const renewalsRouter = Router();

// POST /api/renewals/:orderId
renewalsRouter.post('/:orderId', requireAuth, requireRole('agent'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { orderId } = req.params;
    const { custom_price, notes } = req.body;
    const result = await orderService.renewOrder(orderId, custom_price, notes, req.user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
