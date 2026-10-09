import { Router } from 'express';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { orderService } from '../services/order.service.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { notificationService } from '../services/notification.service.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const ordersRouter = Router();

// GET /api/orders
ordersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { status, customer_id, product_id, search } = req.query;
    const [orders, counts] = await Promise.all([
      ordersRepo.findAll({
        status: status as string,
        customer_id: customer_id as string,
        product_id: product_id as string,
        search: search as string
      }),
      ordersRepo.getStatusCounts()
    ]);
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
ordersRouter.post('/', requireAuth, requireRole('agent'), validateBody({
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
    notificationService.notifyOrderCreated(order).catch(err => console.error('[Notification] Order create error:', err));
    setImmediate(() => {
      notificationService.checkExpiringOrders().catch(err => console.error('[Notification] Expiration check error:', err));
    });

    res.status(201).json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/renew (unified alias for /api/renewals/:id)
ordersRouter.post('/:id/renew', requireAuth, requireRole('agent'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { custom_price, notes } = req.body;
    const result = await orderService.renewOrder(id, custom_price, notes, req.user);
    if (result && result.order) {
      notificationService.notifyOrderRenewed(result.order).catch(err => console.error('[Notification] Order renew error:', err));
    }
    setImmediate(() => {
      notificationService.checkExpiringOrders().catch(err => console.error('[Notification] Expiration check error:', err));
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/cancel
ordersRouter.post('/:id/cancel', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existingOrder = await ordersRepo.findById(id);
    await orderService.cancelOrder(id, reason, req.user);
    if (existingOrder) {
      notificationService.notifyOrderCancelled(existingOrder).catch(err => console.error('[Notification] Order cancel error:', err));
    }

    res.json({ success: true, message: 'Order cancelled and allocated inventory restored to available.' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id
ordersRouter.put('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await ordersRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const {
      status, payment_status, payment_method, notes,
      start_date, end_date, price, cost, whatsapp_contacted_at
    } = req.body || {};

    if (existing.status === 'cancelled' && status && status !== 'cancelled') {
      res.status(400).json({ error: 'Cancelled orders cannot be reactivated directly.' });
      return;
    }

    const cleanUpdates: Partial<typeof existing> = {};
    if (status !== undefined) cleanUpdates.status = status;
    if (payment_status !== undefined) cleanUpdates.payment_status = payment_status;
    if (payment_method !== undefined) cleanUpdates.payment_method = payment_method;
    if (notes !== undefined) (cleanUpdates as any).notes = notes;
    if (start_date !== undefined) cleanUpdates.start_date = start_date;
    if (end_date !== undefined) cleanUpdates.end_date = end_date;
    if (price !== undefined) cleanUpdates.price = Number(price);
    if (cost !== undefined) cleanUpdates.cost = Number(cost);
    if (whatsapp_contacted_at !== undefined) cleanUpdates.whatsapp_contacted_at = whatsapp_contacted_at;

    const updated = await ordersRepo.update(id, cleanUpdates);
    await auditRepo.log(req.user || null, 'UPDATE_ORDER', 'order', id, cleanUpdates);
    setImmediate(() => {
      notificationService.checkExpiringOrders().catch(err => console.error('[Notification] Expiration check error:', err));
    });

    res.json({ success: true, order: updated, message: 'Order updated.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/orders/:id
ordersRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existingOrder = await ordersRepo.findById(id);
    await ordersRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_ORDER', 'order', id, { order_number: existingOrder?.order_number });
    if (existingOrder) {
      notificationService.notifyOrderDeleted(existingOrder).catch(err => console.error('[Notification] Order delete error:', err));
    }
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    next(err);
  }
});

