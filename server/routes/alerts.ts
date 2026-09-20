import { Router } from 'express';
import { query } from '../db/connection/pool.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const alertsRouter = Router();

alertsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    // 1. Orders expiring in <= 3 days
    const expiringOrdersRes = await query<any>(
      `SELECT o.*,
              c.name as customer_name, c.whatsapp as customer_whatsapp, c.email as customer_email,
              p.name as product_name,
              pl.name as plan_name,
              (o.end_date - CURRENT_DATE)::int as days_remaining
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       JOIN plans pl ON pl.id = o.plan_id
       WHERE o.status IN ('active', 'expiring')
         AND o.end_date >= CURRENT_DATE
         AND o.end_date <= (CURRENT_DATE + INTERVAL '3 days')
       ORDER BY o.end_date ASC`
    );

    // 2. Expired orders within last 30 days
    const expiredOrdersRes = await query<any>(
      `SELECT o.*,
              c.name as customer_name, c.whatsapp as customer_whatsapp, c.email as customer_email,
              p.name as product_name,
              pl.name as plan_name,
              (CURRENT_DATE - o.end_date)::int as days_expired
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       JOIN plans pl ON pl.id = o.plan_id
       WHERE (o.status = 'expired' OR (o.status = 'active' AND o.end_date < CURRENT_DATE))
         AND o.end_date >= (CURRENT_DATE - INTERVAL '30 days')
       ORDER BY o.end_date DESC`
    );

    // 3. Low stock accounts (available profiles <= 1)
    const lowStockAccountsRes = await query<any>(
      `SELECT sa.*, p.name as product_name,
              COUNT(sp.id)::int as total_profiles,
              COUNT(CASE WHEN sp.status = 'available' THEN 1 END)::int as available_profiles
       FROM service_accounts sa
       JOIN products p ON p.id = sa.product_id
       LEFT JOIN service_profiles sp ON sp.service_account_id = sa.id
       WHERE sa.status = 'active'
       GROUP BY sa.id, p.name
       HAVING COUNT(CASE WHEN sp.status = 'available' THEN 1 END) <= 1`
    );

    // 4. Low stock licenses (< 3 available)
    const lowInventoryRes = await query<any>(
      `SELECT p.id, p.name, p.fulfillment_type,
              COUNT(lk.id)::int as available_count
       FROM products p
       LEFT JOIN license_keys lk ON lk.product_id = p.id AND lk.status = 'available'
       WHERE p.fulfillment_type = 'license_key' AND p.status = 'active'
       GROUP BY p.id
       HAVING COUNT(lk.id) < 3`
    );

    const expiringOrders = expiringOrdersRes.rows;
    const expiredOrders = expiredOrdersRes.rows;
    const lowStockAccounts = lowStockAccountsRes.rows;
    const lowInventory = lowInventoryRes.rows;

    const badgeCount = expiringOrders.length + expiredOrders.length;

    res.json({
      badgeCount,
      expiringOrders,
      expiredOrders,
      lowStockAccounts,
      lowInventory
    });
  } catch (err) {
    next(err);
  }
});
