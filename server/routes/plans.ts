import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const plansRouter = Router();

// Calculate end date based on plan duration and unit (timezone-safe calendar calculation)
export function calculateEndDate(startDateStr: string, duration: number, unit: string): string {
  const cleanDateStr = startDateStr.split('T')[0];
  const parts = cleanDateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);

  // Use noon UTC to prevent DST border crossings or local timezone offsets from shifting the day
  const date = new Date(Date.UTC(year, month, day, 12, 0, 0));

  switch (unit) {
    case 'hours':
      date.setUTCHours(date.getUTCHours() + duration);
      break;
    case 'days':
      date.setUTCDate(date.getUTCDate() + duration);
      break;
    case 'weeks':
      date.setUTCDate(date.getUTCDate() + duration * 7);
      break;
    case 'months': {
      date.setUTCMonth(date.getUTCMonth() + duration);
      break;
    }
    case 'years':
      date.setUTCFullYear(date.getUTCFullYear() + duration);
      break;
    default:
      date.setUTCDate(date.getUTCDate() + duration);
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// List plans
plansRouter.get('/', requireAuth, (req, res) => {
  const { product_id, category_id } = req.query;
  let query = `
    SELECT pl.*, p.name as product_name, p.category_id, p.fulfillment_type, p.capabilities, p.stock_limit as product_stock_limit
    FROM plans pl
    JOIN products p ON p.id = pl.product_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (product_id) {
    query += ` AND pl.product_id = ?`;
    params.push(product_id);
  }
  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }
  query += ` ORDER BY pl.price ASC`;

  const rawPlans = db.prepare(query).all(...params) as any[];

  const plans = rawPlans.map((pl) => {
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE plan_id = ? AND status IN ('active', 'expiring')
    `).get(pl.id) as any;
    const activeCount = activeOrders?.count || 0;

    let isPlanFull = false;
    if (pl.stock_limit && pl.stock_limit > 0 && activeCount >= pl.stock_limit) {
      isPlanFull = true;
    }

    return {
      ...pl,
      active_orders_count: activeCount,
      is_stock_full: isPlanFull
    };
  });

  res.json({ plans });
});

// Server-side authoritative date calculation
plansRouter.post('/calculate-dates', requireAuth, (req, res) => {
  const { plan_id, start_date } = req.body;
  if (!plan_id) {
    return res.status(400).json({ error: 'Plan ID is required.' });
  }

  const plan = db.prepare('SELECT duration, duration_unit, price, cost, currency FROM plans WHERE id = ?').get(plan_id) as any;
  if (!plan) {
    return res.status(404).json({ error: 'Plan not found.' });
  }

  const start = start_date ? new Date(start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const end = calculateEndDate(start, plan.duration, plan.duration_unit);

  res.json({
    start_date: start,
    end_date: end,
    duration: plan.duration,
    duration_unit: plan.duration_unit,
    price: plan.price,
    cost: plan.cost,
    currency: plan.currency
  });
});

// Create plan
plansRouter.post('/', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { product_id, name, duration, duration_unit, price, cost, currency, stock_limit } = req.body;

  if (!product_id || !name?.trim() || !duration || !duration_unit || price === undefined) {
    return res.status(400).json({ error: 'Product, name, duration, duration unit, and price are required.' });
  }

  const validUnits = ['hours', 'days', 'weeks', 'months', 'years'];
  if (!validUnits.includes(duration_unit)) {
    return res.status(400).json({ error: 'Invalid duration unit. Allowed: ' + validUnits.join(', ') });
  }

  const id = 'plan-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const parsedLimit = stock_limit !== undefined && stock_limit !== null && stock_limit !== '' ? Number(stock_limit) : null;

  try {
    db.prepare(`
      INSERT INTO plans (id, product_id, name, duration, duration_unit, price, cost, currency, stock_limit, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, product_id, name.trim(), Number(duration), duration_unit, Number(price), Number(cost || 0), currency || 'USD', parsedLimit, now);

    logAudit(req.user || null, 'CREATE_PLAN', 'plan', id, { name, product_id, price, stock_limit: parsedLimit });
    res.status(201).json({ success: true, id, name });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create plan: ' + err.message });
  }
});

// Update plan
plansRouter.put('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, duration, duration_unit, price, cost, currency, status, stock_limit } = req.body;

  const parsedLimit = stock_limit !== undefined ? (stock_limit !== null && stock_limit !== '' ? Number(stock_limit) : null) : undefined;

  db.prepare(`
    UPDATE plans
    SET name = COALESCE(?, name),
        duration = COALESCE(?, duration),
        duration_unit = COALESCE(?, duration_unit),
        price = COALESCE(?, price),
        cost = COALESCE(?, cost),
        currency = COALESCE(?, currency),
        status = COALESCE(?, status),
        stock_limit = CASE WHEN ? = 1 THEN ? ELSE stock_limit END
    WHERE id = ?
  `).run(
    name?.trim(),
    duration,
    duration_unit,
    price,
    cost,
    currency,
    status,
    parsedLimit !== undefined ? 1 : 0,
    parsedLimit !== undefined ? parsedLimit : null,
    id
  );

  logAudit(req.user || null, 'UPDATE_PLAN', 'plan', id, { name, price });
  res.json({ success: true, message: 'Plan updated successfully.' });
});

// Delete plan
plansRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  // Prevent deleting plan referenced by active orders
  const activeCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE plan_id = ? AND status = 'active'").get(id) as any;
  if (activeCount?.count > 0) {
    return res.status(400).json({ error: `Cannot delete plan with ${activeCount.count} active orders.` });
  }

  db.prepare('DELETE FROM plans WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_PLAN', 'plan', id, {});
  res.json({ success: true, message: 'Plan deleted successfully.' });
});
