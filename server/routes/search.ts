import { Router } from 'express';
import { query } from '../db/connection/pool.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const searchRouter = Router();

searchRouter.get('/', requireAuth, async (req, res, next) => {
  const q = req.query.q as string;
  if (!q || !q.trim()) {
    res.json({ results: [] });
    return;
  }

  const term = `%${q.trim()}%`;
  const results: any[] = [];

  try {
    // 1. Customers
    const customers = await query<any>(
      'SELECT id, name, email, whatsapp FROM customers WHERE name ILIKE $1 OR email ILIKE $1 OR whatsapp ILIKE $1 LIMIT 5',
      [term]
    );
    for (const c of customers.rows) {
      results.push({
        id: c.id,
        title: c.name,
        subtitle: c.whatsapp || c.email || 'Customer',
        type: 'customer',
        route: 'customers'
      });
    }

    // 2. Orders
    const orders = await query<any>(
      `SELECT o.id, o.order_number, o.status, c.name as customer_name, p.name as product_name
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN products p ON p.id = o.product_id
       WHERE o.order_number ILIKE $1 OR c.name ILIKE $1 OR p.name ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const o of orders.rows) {
      results.push({
        id: o.id,
        title: o.order_number,
        subtitle: `${o.customer_name} • ${o.product_name} (${o.status})`,
        type: 'order',
        route: 'orders'
      });
    }

    // 3. Products
    const products = await query<any>(
      'SELECT id, name, brand, status FROM products WHERE name ILIKE $1 OR brand ILIKE $1 LIMIT 5',
      [term]
    );
    for (const p of products.rows) {
      results.push({
        id: p.id,
        title: p.name,
        subtitle: p.brand ? `${p.brand} • ${p.status}` : p.status,
        type: 'product',
        route: 'products'
      });
    }

    // 4. Accounts
    const accounts = await query<any>(
      `SELECT sa.id, sa.login, sa.provider, p.name as product_name
       FROM service_accounts sa
       JOIN products p ON p.id = sa.product_id
       WHERE sa.login ILIKE $1 OR sa.provider ILIKE $1
       LIMIT 5`,
      [term]
    );
    for (const a of accounts.rows) {
      results.push({
        id: a.id,
        title: a.login,
        subtitle: `${a.provider} • ${a.product_name}`,
        type: 'account',
        route: 'inventory'
      });
    }

    res.json({ results: results.slice(0, 15) });
  } catch (err) {
    next(err);
  }
});
