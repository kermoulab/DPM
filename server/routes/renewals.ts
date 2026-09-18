import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, type AuthenticatedRequest } from '../security.js';
import { calculateEndDate } from './plans.js';

export const renewalsRouter = Router();

// Get renewal history
renewalsRouter.get('/history', requireAuth, (req, res) => {
  const renewals = db.prepare(`
    SELECT 
      r.*,
      o.order_number,
      c.name as customer_name,
      c.whatsapp as customer_whatsapp,
      p.name as product_name,
      pl.name as plan_name,
      u.name as renewed_by_name
    FROM order_renewals r
    JOIN orders o ON o.id = r.order_id
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    LEFT JOIN users u ON u.id = r.created_by_user_id
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all();

  res.json({ renewals });
});

// Authoritative Order Renewal Operation
renewalsRouter.post('/:orderId', requireAuth, (req: AuthenticatedRequest, res) => {
  const { orderId } = req.params;
  const { custom_price, notes } = req.body;

  const order = db.prepare(`
    SELECT o.*, pl.duration, pl.duration_unit, pl.price as plan_price, pl.cost as plan_cost
    FROM orders o
    JOIN plans pl ON pl.id = o.plan_id
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  if (order.status === 'cancelled') {
    return res.status(400).json({ error: 'Cannot renew a cancelled order.' });
  }

  const today = new Date().toISOString().split('T')[0];
  // Authoritative Renewal Start Date:
  // If the order is still active / expiring in the future or today (order.end_date >= today),
  // the new order duration starts seamlessly from the order's expiration date (order.end_date).
  // If the order has already passed its expiration date (order.end_date < today),
  // the new order duration starts from today (the date of clicking the renew button).
  const newStartDate = order.end_date >= today ? order.end_date : today;
  const newEndDate = calculateEndDate(newStartDate, order.duration, order.duration_unit);

  const price = custom_price !== undefined ? Number(custom_price) : order.plan_price;
  const cost = order.plan_cost || 0;
  const renewalId = 'ren-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  db.exec('BEGIN TRANSACTION;');
  try {
    // 1. Record renewal history entry
    db.prepare(`
      INSERT INTO order_renewals (id, order_id, previous_end_date, new_end_date, price, cost, currency, created_by_user_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(renewalId, orderId, order.end_date, newEndDate, price, cost, order.currency, req.user?.id || null, notes?.trim() || null, now);

    // 2. Update order start_date, end_date, status, and increment renewal_count
    // The order duration is updated to [newStartDate → newEndDate], resetting duration from this renewal period
    // rather than keeping the initial date from when the order was first created.
    db.prepare(`
      UPDATE orders
      SET start_date = ?,
          end_date = ?,
          status = 'active',
          renewal_count = renewal_count + 1
      WHERE id = ?
    `).run(newStartDate, newEndDate, orderId);

    db.exec('COMMIT;');

    logAudit(req.user || null, 'RENEW_ORDER', 'order', orderId, {
      previous_end_date: order.end_date,
      start_date: newStartDate,
      new_end_date: newEndDate,
      duration: order.duration,
      duration_unit: order.duration_unit,
      price
    });

    res.json({
      success: true,
      message: 'Order renewed successfully.',
      start_date: newStartDate,
      new_end_date: newEndDate,
      previous_end_date: order.end_date,
      duration: order.duration,
      duration_unit: order.duration_unit,
      renewal: {
        id: renewalId,
        order_id: orderId,
        start_date: newStartDate,
        previous_end_date: order.end_date,
        new_end_date: newEndDate,
        price,
        currency: order.currency
      }
    });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Failed to process renewal: ' + err.message });
  }
});
