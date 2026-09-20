import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db/connection/pool.js';
import { plansRepo } from '../db/repositories/plans.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { calculateEndDate } from '../services/order.service.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const plansRouter = Router();

// GET /api/plans
plansRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { product_id } = req.query;
    const plans = await plansRepo.findAll(product_id as string);
    res.json({ plans });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/calculate-dates
plansRouter.post('/calculate-dates', requireAuth, async (req, res, next) => {
  try {
    const { plan_id, start_date } = req.body;
    const plan = await plansRepo.findById(plan_id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = calculateEndDate(startDate, plan.duration, plan.duration_unit);

    res.json({
      start_date: startDate,
      end_date: endDate,
      duration: plan.duration,
      duration_unit: plan.duration_unit,
      price: Number(plan.price),
      cost: Number(plan.cost),
      currency: plan.currency
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans
plansRouter.post('/', requireAuth, requireRole('manager'), validateBody({
  product_id: v.required('Product ID is required.'),
  name: [v.required('Plan name is required.'), v.string({ min: 1, max: 100 })],
  duration: [v.required('Duration is required.'), v.number({ min: 1, integer: true, message: 'Duration must be a positive whole number.' })],
  price: [v.required('Price is required.'), v.number({ min: 0, message: 'Price cannot be negative.' })],
  duration_unit: v.enum(['hours', 'days', 'weeks', 'months', 'years'] as const)
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { product_id, name, duration, duration_unit, price, cost, currency, stock_limit } = req.body;

    const id = 'plan-' + crypto.randomUUID().slice(0, 8);
    const plan = await plansRepo.create({
      id,
      product_id,
      name: name.trim(),
      duration: parseInt(duration, 10),
      duration_unit: duration_unit || 'months',
      price: parseFloat(price),
      cost: cost !== undefined ? parseFloat(cost) : 0,
      currency: currency || 'USD',
      status: 'active',
      stock_limit: stock_limit !== undefined ? Number(stock_limit) : null
    });

    await auditRepo.log(req.user || null, 'CREATE_PLAN', 'plan', id, { name });
    res.status(201).json({ success: true, id: plan.id, plan });
  } catch (err) {
    next(err);
  }
});

// PUT /api/plans/:id
plansRouter.put('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await plansRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    const updated = await plansRepo.update(id, req.body);
    await auditRepo.log(req.user || null, 'UPDATE_PLAN', 'plan', id, { name: updated?.name });
    res.json({ success: true, plan: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plans/:id
plansRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const plan = await plansRepo.findById(id);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found.' });
      return;
    }

    const ordersRes = await query<{ count: string }>('SELECT COUNT(*) as count FROM orders WHERE plan_id = $1', [id]);
    if (parseInt(ordersRes.rows[0]?.count || '0', 10) > 0) {
      res.status(400).json({ error: 'Cannot delete plan with existing orders. Please cancel or remove associated orders first.' });
      return;
    }

    await plansRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_PLAN', 'plan', id, { name: plan.name });
    res.json({ success: true, message: `Plan "${plan.name}" deleted.` });
  } catch (err) {
    next(err);
  }
});
