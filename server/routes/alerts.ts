import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../security.js';

export const alertsRouter = Router();

alertsRouter.get('/', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

    // 1. Expiring orders (within 3 days)
    const expiringOrders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.start_date,
        o.end_date,
        o.price,
        o.currency,
        o.whatsapp_contacted_at,
        c.id as customer_id,
        c.name as customer_name,
        c.whatsapp as customer_whatsapp,
        p.id as product_id,
        p.name as product_name,
        p.brand as product_brand,
        pl.id as plan_id,
        pl.name as plan_name,
        pl.duration,
        pl.duration_unit,
        pl.price as plan_price,
        ROUND((julianday(o.end_date) - julianday('now'))) as days_remaining
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p ON p.id = o.product_id
      JOIN plans pl ON pl.id = o.plan_id
      WHERE o.status != 'cancelled' 
        AND o.end_date >= date('now') 
        AND o.end_date <= ?
      ORDER BY o.end_date ASC
    `).all(threeDaysLater) as any[];

    // 2. Expired orders
    const expiredOrders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.start_date,
        o.end_date,
        o.price,
        o.currency,
        o.whatsapp_contacted_at,
        c.id as customer_id,
        c.name as customer_name,
        c.whatsapp as customer_whatsapp,
        p.id as product_id,
        p.name as product_name,
        pl.id as plan_id,
        pl.name as plan_name,
        pl.duration,
        pl.duration_unit,
        pl.price as plan_price,
        ROUND((julianday('now') - julianday(o.end_date))) as days_expired
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      JOIN products p ON p.id = o.product_id
      JOIN plans pl ON pl.id = o.plan_id
      WHERE o.status != 'cancelled' AND o.end_date < date('now')
      ORDER BY o.end_date DESC
      LIMIT 20
    `).all() as any[];

    // 3. Low inventory alerts
    const lowInventoryProducts = db.prepare(`
      SELECT 
        p.id,
        p.name,
        p.brand,
        p.capabilities,
        COALESCE(prof.avail_profiles, 0) as available_profiles,
        COALESCE(lic.avail_licenses, 0) as available_licenses
      FROM products p
      LEFT JOIN (
        SELECT sa.product_id, COUNT(sp.id) as avail_profiles
        FROM service_profiles sp
        JOIN service_accounts sa ON sa.id = sp.service_account_id
        WHERE sp.status = 'available'
        GROUP BY sa.product_id
      ) prof ON prof.product_id = p.id
      LEFT JOIN (
        SELECT product_id, COUNT(id) as avail_licenses
        FROM license_keys
        WHERE status = 'available'
        GROUP BY product_id
      ) lic ON lic.product_id = p.id
      WHERE (p.capabilities LIKE '%service_account%' AND COALESCE(prof.avail_profiles, 0) <= 2)
         OR (p.capabilities LIKE '%license_key%' AND COALESCE(lic.avail_licenses, 0) <= 2)
    `).all() as any[];

    const badgeCount = expiringOrders.length + expiredOrders.length;

    res.json({
      badgeCount,
      expiringOrders,
      expiredOrders,
      lowInventory: lowInventoryProducts,
      lowStockAccounts: lowInventoryProducts
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
