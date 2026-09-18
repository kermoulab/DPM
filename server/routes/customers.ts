import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const customersRouter = Router();

// List customers with computed totals
customersRouter.get('/', requireAuth, (req, res) => {
  const { search, status } = req.query;

  let query = `
    SELECT 
      c.*,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.price ELSE 0 END), 0) as total_spent,
      COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) as active_orders,
      COUNT(DISTINCT CASE WHEN o.status = 'expired' THEN o.id END) as expired_orders,
      MAX(o.created_at) as last_order_date
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    query += ` AND c.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (c.name LIKE ? OR c.email LIKE ? OR c.whatsapp LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` GROUP BY c.id ORDER BY c.created_at DESC`;

  const customers = db.prepare(query).all(...params);
  res.json({ customers });
});

// Single customer profile with orders & renewals history
customersRouter.get('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const customer = db.prepare(`
    SELECT 
      c.*,
      COUNT(DISTINCT o.id) as total_orders,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.price ELSE 0 END), 0) as total_spent,
      COUNT(DISTINCT CASE WHEN o.status = 'active' THEN o.id END) as active_orders,
      COUNT(DISTINCT CASE WHEN o.status = 'expired' THEN o.id END) as expired_orders
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id) as any;

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  // Fetch all orders for this customer
  const orders = db.prepare(`
    SELECT 
      o.*,
      p.name as product_name,
      p.brand as product_brand,
      p.icon as product_icon,
      pl.name as plan_name,
      pl.duration,
      pl.duration_unit
    FROM orders o
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    WHERE o.customer_id = ?
    ORDER BY o.created_at DESC
  `).all(id);

  // Fetch audit history / notes
  const auditLogs = db.prepare(`
    SELECT action, details, created_at, username
    FROM audit_logs
    WHERE entity = 'customer' AND entity_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).all(id);

  res.json({ customer, orders, auditLogs });
});

// Create customer
customersRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const { name, email, whatsapp, notes } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  const id = 'cust-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO customers (id, name, email, whatsapp, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(id, name.trim(), email?.trim() || null, whatsapp?.trim() || null, notes?.trim() || null, now);

    logAudit(req.user || null, 'CREATE_CUSTOMER', 'customer', id, { name, email, whatsapp });
    res.status(201).json({ success: true, id, name });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create customer: ' + err.message });
  }
});

// Update customer
customersRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, email, whatsapp, notes, status } = req.body;

  const existing = db.prepare('SELECT id, name, status FROM customers WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  db.prepare(`
    UPDATE customers
    SET name = COALESCE(?, name),
        email = COALESCE(?, email),
        whatsapp = COALESCE(?, whatsapp),
        notes = COALESCE(?, notes),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(
    name !== undefined ? name.trim() : null,
    email !== undefined ? email.trim() : null,
    whatsapp !== undefined ? whatsapp.trim() : null,
    notes !== undefined ? notes.trim() : null,
    status !== undefined ? status : null,
    id
  );

  logAudit(req.user || null, 'UPDATE_CUSTOMER', 'customer', id, { name, status });
  res.json({ success: true, message: 'Customer updated successfully.' });
});

// Delete customer
customersRouter.delete('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(id) as any;
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  try {
    db.exec('BEGIN');
    // 1. Unlink and clean orders for this customer
    const orders = db.prepare('SELECT id FROM orders WHERE customer_id = ?').all(id) as { id: string }[];
    for (const ord of orders) {
      db.prepare('DELETE FROM order_renewals WHERE order_id = ?').run(ord.id);
      db.prepare('UPDATE service_profiles SET status = "available", assigned_order_id = NULL, assigned_customer_id = NULL WHERE assigned_order_id = ?').run(ord.id);
      db.prepare('UPDATE license_keys SET status = "available", assigned_order_id = NULL, assigned_customer_id = NULL WHERE assigned_order_id = ?').run(ord.id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(ord.id);
    }

    // 2. Unlink any direct service profile / license assignments
    db.prepare('UPDATE service_profiles SET status = "available", assigned_customer_id = NULL WHERE assigned_customer_id = ?').run(id);
    db.prepare('UPDATE license_keys SET status = "available", assigned_customer_id = NULL WHERE assigned_customer_id = ?').run(id);

    // 3. Clear customer links
    try {
      db.prepare('UPDATE merch_mockups SET customer_id = NULL WHERE customer_id = ?').run(id);
    } catch (_) {}

    // 4. Delete customer audit logs
    db.prepare('DELETE FROM audit_logs WHERE entity = "customer" AND entity_id = ?').run(id);

    // 5. Delete the customer
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);

    db.exec('COMMIT');
    logAudit(req.user || null, 'DELETE_CUSTOMER', 'customer', id, { name: customer.name });
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err: any) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {}
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Failed to delete customer: ' + err.message });
  }
});
