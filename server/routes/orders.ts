import { Router } from 'express';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { orderService } from '../services/order.service.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const ordersRouter = Router();

// GET /api/orders
ordersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, customer_id, product_id, search } = req.query;
    const orders = await ordersRepo.findAll({
      status: status as string,
      customer_id: customer_id as string,
      product_id: product_id as string,
      search: search as string
    });
    const counts = await ordersRepo.getStatusCounts();
    res.json({ orders, counts });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
ordersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await ordersRepo.findById(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    const renewals = await ordersRepo.findRenewals(id);
    res.json({ order, renewals });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders
ordersRouter.post('/', requireAuth, validateBody({
  customer_id: v.required('Customer is required.'),
  product_id: v.required('Product is required.'),
  plan_id: v.required('Subscription plan is required.')
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { customer_id, product_id, plan_id, start_date, custom_price, custom_cost, payment_method, payment_status, notes, assigned_service_account_id, assigned_profile_id, assigned_license_key_id } = req.body;

    const order = await orderService.createOrder({
      customer_id,
      product_id,
      plan_id,
      start_date,
      custom_price,
      custom_cost,
      payment_method,
      payment_status,
      notes,
      assigned_service_account_id,
      assigned_profile_id,
      assigned_license_key_id,
      userId: req.user?.id
    });

    await auditRepo.log(req.user || null, 'CREATE_ORDER', 'order', order.id, { order_number: order.order_number });
    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/cancel
ordersRouter.post('/:id/cancel', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await orderService.cancelOrder(id, reason, req.user);
    res.json({ success: true, message: 'Order cancelled and allocated inventory restored to available.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id
ordersRouter.put('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const updated = await ordersRepo.update(id, req.body);
    if (!updated) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }
    await auditRepo.log(req.user || null, 'UPDATE_ORDER', 'order', id, req.body);
    res.json({ success: true, order: updated, message: 'Order updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
ordersRouter.delete('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    await ordersRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_ORDER', 'order', id, {});
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    next(err);
  }
});
