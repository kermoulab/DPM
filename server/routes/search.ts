import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../security.js';

export const searchRouter = Router();

searchRouter.get('/', requireAuth, (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim().length < 2) {
    return res.json({ results: [] });
  }

  const searchTerm = `%${String(q).trim()}%`;

  // 1. Customers
  const customers = db.prepare(`
    SELECT id, name as title, email as subtitle, 'customer' as type, '/customers' as route
    FROM customers
    WHERE name LIKE ? OR email LIKE ? OR whatsapp LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);

  // 2. Orders
  const orders = db.prepare(`
    SELECT o.id, o.order_number as title, (c.name || ' • ' || p.name) as subtitle, 'order' as type, '/orders' as route
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    WHERE o.order_number LIKE ? OR c.name LIKE ? OR p.name LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);

  // 3. Products
  const products = db.prepare(`
    SELECT id, name as title, (brand || ' • ' || fulfillment_type) as subtitle, 'product' as type, '/products' as route
    FROM products
    WHERE name LIKE ? OR brand LIKE ? OR description LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm, searchTerm);

  // 4. Service Accounts
  const accounts = db.prepare(`
    SELECT id, login as title, provider as subtitle, 'service_account' as type, '/inventory' as route
    FROM service_accounts
    WHERE login LIKE ? OR provider LIKE ?
    LIMIT 5
  `).all(searchTerm, searchTerm);

  res.json({
    results: [
      ...customers,
      ...orders,
      ...products,
      ...accounts
    ]
  });
});
