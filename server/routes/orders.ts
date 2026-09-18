import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, decryptCredential, type AuthenticatedRequest } from '../security.js';
import { calculateEndDate } from './plans.js';

export const ordersRouter = Router();

// List orders with complete relational details and authoritative status
ordersRouter.get('/', requireAuth, (req, res) => {
  const { status, customer_id, product_id, search, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT 
      o.*,
      c.name as customer_name,
      c.email as customer_email,
      c.whatsapp as customer_whatsapp,
      p.name as product_name,
      p.brand as product_brand,
      p.icon as product_icon,
      pl.name as plan_name,
      pl.duration,
      pl.duration_unit,
      u.name as created_by_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    if (status === 'expiring') {
      query += ` AND o.status != 'cancelled' AND o.status != 'completed' AND o.status != 'pending' AND (o.status = 'expiring' OR (o.status = 'active' AND o.end_date >= date('now') AND o.end_date <= date('now', '+3 days')))`;
    } else if (status === 'expired') {
      query += ` AND o.status != 'cancelled' AND o.status != 'completed' AND o.status != 'pending' AND (o.status = 'expired' OR (o.status = 'active' AND o.end_date < date('now')))`;
    } else if (status === 'active') {
      query += ` AND o.status = 'active' AND o.end_date > date('now', '+3 days')`;
    } else {
      query += ` AND o.status = ?`;
      params.push(status);
    }
  }

  if (customer_id) {
    query += ` AND o.customer_id = ?`;
    params.push(customer_id);
  }

  if (product_id) {
    query += ` AND o.product_id = ?`;
    params.push(product_id);
  }

  if (search) {
    query += ` AND (o.order_number LIKE ? OR c.name LIKE ? OR p.name LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const rawOrders = db.prepare(query).all(...params) as any[];

  const today = new Date().toISOString().split('T')[0];
  const threeDaysAhead = new Date();
  threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
  const threeDaysStr = threeDaysAhead.toISOString().split('T')[0];

  // Reconcile dynamic authoritative status
  const orders = rawOrders.map(o => {
    let effectiveStatus = o.status;
    if (o.status === 'active') {
      if (o.end_date < today) {
        effectiveStatus = 'expired';
      } else if (o.end_date <= threeDaysStr) {
        effectiveStatus = 'expiring';
      } else {
        effectiveStatus = 'active';
      }
    }

    return {
      ...o,
      status: effectiveStatus,
      fulfillment_data: o.fulfillment_data ? JSON.parse(o.fulfillment_data) : {}
    };
  });

  // Calculate global status counts
  const allOrdersList = db.prepare(`SELECT status, end_date FROM orders`).all() as any[];

  const counts = {
    all: allOrdersList.length,
    pending: 0,
    active: 0,
    expiring: 0,
    completed: 0,
    expired: 0,
    cancelled: 0
  };

  for (const item of allOrdersList) {
    if (item.status === 'cancelled') {
      counts.cancelled++;
    } else if (item.status === 'completed') {
      counts.completed++;
    } else if (item.status === 'pending') {
      counts.pending++;
    } else if (item.status === 'expired') {
      counts.expired++;
    } else if (item.status === 'expiring') {
      counts.expiring++;
    } else if (item.status === 'active') {
      if (item.end_date < today) {
        counts.expired++;
      } else if (item.end_date <= threeDaysStr) {
        counts.expiring++;
      } else {
        counts.active++;
      }
    } else {
      counts.active++;
    }
  }

  res.json({ orders, counts });
});

// Single order with fulfillment details
ordersRouter.get('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const order = db.prepare(`
    SELECT 
      o.*,
      c.name as customer_name,
      c.email as customer_email,
      c.whatsapp as customer_whatsapp,
      p.name as product_name,
      p.brand as product_brand,
      p.icon as product_icon,
      p.capabilities as product_capabilities,
      pl.name as plan_name,
      pl.duration,
      pl.duration_unit,
      u.name as created_by_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    WHERE o.id = ?
  `).get(id) as any;

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Renewal history for this order
  const renewals = db.prepare(`
    SELECT r.*, u.name as renewed_by_name
    FROM order_renewals r
    LEFT JOIN users u ON u.id = r.created_by_user_id
    WHERE r.order_id = ?
    ORDER BY r.created_at DESC
  `).all(id);

  res.json({
    order: {
      ...order,
      product_capabilities: order.product_capabilities ? JSON.parse(order.product_capabilities) : [],
      fulfillment_data: order.fulfillment_data ? JSON.parse(order.fulfillment_data) : {}
    },
    renewals
  });
});

// UNIVERSAL ORDER CREATION (Atomic, Server-Authoritative)
ordersRouter.post('/', requireAuth, (req: AuthenticatedRequest, res) => {
  const {
    customer_id,
    product_id,
    plan_id,
    start_date,
    payment_method = 'cash',
    custom_price,
    specific_profile_id,
    notes,
    fulfillment_meta
  } = req.body;

  if (!customer_id || !product_id || !plan_id) {
    return res.status(400).json({ error: 'Customer, product, and plan are required.' });
  }

  // Verify customer exists and is active
  const customer = db.prepare('SELECT id, name, whatsapp, status FROM customers WHERE id = ?').get(customer_id) as any;
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }
  if (customer.status === 'blocked') {
    return res.status(403).json({ error: 'Cannot create orders for a blocked customer.' });
  }

  // Authoritative product and plan verification
  const product = db.prepare('SELECT id, name, capabilities, fulfillment_type, stock_limit FROM products WHERE id = ?').get(product_id) as any;
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }
  const capabilities: string[] = product.capabilities ? JSON.parse(product.capabilities) : [];

  const plan = db.prepare('SELECT id, name, duration, duration_unit, price, cost, currency, stock_limit FROM plans WHERE id = ? AND product_id = ?').get(plan_id, product_id) as any;
  if (!plan) {
    return res.status(404).json({ error: 'Invalid plan for this product.' });
  }

  // Stock check 1: Plan order capacity limit
  if (plan.stock_limit && plan.stock_limit > 0) {
    const activePlanOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE plan_id = ? AND status IN ('active', 'expiring')
    `).get(plan_id) as any;
    if ((activePlanOrders?.count || 0) >= plan.stock_limit) {
      return res.status(409).json({
        error: `Cannot create order: Stock for plan "${plan.name}" is full (${activePlanOrders?.count || 0}/${plan.stock_limit} active orders).`
      });
    }
  }

  // Stock check 2: Product order capacity limit
  if (product.stock_limit && product.stock_limit > 0) {
    const activeProductOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status IN ('active', 'expiring')
    `).get(product_id) as any;
    if ((activeProductOrders?.count || 0) >= product.stock_limit) {
      return res.status(409).json({
        error: `Cannot create order: Stock for product "${product.name}" is full (${activeProductOrders?.count || 0}/${product.stock_limit} active subscriptions).`
      });
    }
  }

  // Stock check 3: Service Profiles availability
  if (capabilities.includes('service_account') || capabilities.includes('profiles') || product.fulfillment_type === 'service_account') {
    const availableProfiles = db.prepare(`
      SELECT COUNT(sp.id) as count
      FROM service_profiles sp
      JOIN service_accounts sa ON sa.id = sp.service_account_id
      WHERE sa.product_id = ? AND sa.status = 'active' AND sp.status = 'available'
    `).get(product_id) as any;

    if (!availableProfiles || availableProfiles.count <= 0) {
      return res.status(409).json({
        error: `Cannot create order: Stock for "${product.name}" is full. All profile slots are currently assigned (0 available).`
      });
    }
  }

  // Stock check 4: License Keys availability
  if (capabilities.includes('license_key') || product.fulfillment_type === 'license_key') {
    const availableKeys = db.prepare(`
      SELECT COUNT(id) as count
      FROM license_keys
      WHERE product_id = ? AND status = 'available'
    `).get(product_id) as any;

    if (!availableKeys || availableKeys.count <= 0) {
      return res.status(409).json({
        error: `Cannot create order: Stock for "${product.name}" is full. No available license keys remain in stock.`
      });
    }
  }

  // Authoritative calculation of dates & price
  const startDateStr = start_date ? new Date(start_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  const endDateStr = calculateEndDate(startDateStr, plan.duration, plan.duration_unit);
  const finalPrice = custom_price !== undefined && req.user?.role !== 'agent' ? Number(custom_price) : plan.price;
  const finalCost = plan.cost;
  const currency = plan.currency || 'USD';

  const orderId = 'ord-' + crypto.randomUUID().slice(0, 8);
  const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const now = new Date().toISOString();

  let assignedAccountId: string | null = null;
  let assignedProfileId: string | null = null;
  let assignedLicenseId: string | null = null;
  let fulfillmentData: Record<string, any> = { notes: notes || '' };

  // BEGIN ATOMIC TRANSACTION
  db.exec('BEGIN IMMEDIATE TRANSACTION;');

  try {
    // 1. Allocate Service Account Profile if product capability has 'service_account' or 'profiles'
    if (capabilities.includes('service_account') || capabilities.includes('profiles')) {
      let profile: any = null;

      if (specific_profile_id) {
        // Specific profile requested
        profile = db.prepare(`
          SELECT sp.id, sp.profile_name, sp.pin, sp.service_account_id, sa.login, sa.encrypted_credential, sa.iv, sa.tag, sa.provider
          FROM service_profiles sp
          JOIN service_accounts sa ON sa.id = sp.service_account_id
          WHERE sp.id = ? AND sp.status = 'available'
        `).get(specific_profile_id);
      } else {
        // Automatically find first available profile
        profile = db.prepare(`
          SELECT sp.id, sp.profile_name, sp.pin, sp.service_account_id, sa.login, sa.encrypted_credential, sa.iv, sa.tag, sa.provider
          FROM service_profiles sp
          JOIN service_accounts sa ON sa.id = sp.service_account_id
          WHERE sa.product_id = ? AND sa.status = 'active' AND sp.status = 'available'
          ORDER BY sa.created_at ASC, sp.profile_name ASC
          LIMIT 1
        `).get(product_id);
      }

      if (!profile) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          error: 'No available profiles in inventory for this product. Please add more service accounts/profiles before completing order.'
        });
      }

      // Mark profile as assigned atomically
      db.prepare(`
        UPDATE service_profiles
        SET status = 'assigned', assigned_customer_id = ?, assigned_order_id = ?
        WHERE id = ? AND status = 'available'
      `).run(customer_id, orderId, profile.id);

      assignedAccountId = profile.service_account_id;
      assignedProfileId = profile.id;

      const decryptedPassword = decryptCredential(profile.encrypted_credential, profile.iv, profile.tag);
      fulfillmentData = {
        ...fulfillmentData,
        provider: profile.provider,
        login: profile.login,
        password: decryptedPassword,
        profile_name: profile.profile_name,
        pin: profile.pin
      };
    }

    // 2. Allocate License Key if product capability has 'license_key'
    else if (capabilities.includes('license_key')) {
      const license = db.prepare(`
        SELECT id, license_key
        FROM license_keys
        WHERE product_id = ? AND status = 'available'
        ORDER BY created_at ASC
        LIMIT 1
      `).get(product_id) as any;

      if (!license) {
        db.exec('ROLLBACK;');
        return res.status(409).json({
          error: 'No available license keys in stock for this product. Please add keys to inventory first.'
        });
      }

      // Mark license as assigned atomically
      db.prepare(`
        UPDATE license_keys
        SET status = 'assigned', assigned_customer_id = ?, assigned_order_id = ?
        WHERE id = ? AND status = 'available'
      `).run(customer_id, orderId, license.id);

      assignedLicenseId = license.id;
      fulfillmentData = {
        ...fulfillmentData,
        license_key: license.license_key
      };
    }

    // 3. Digital File or Custom On-Demand Merch Mockup
    else if (capabilities.includes('digital_file') || capabilities.includes('merch_mockup')) {
      fulfillmentData = {
        ...fulfillmentData,
        ...(fulfillment_meta || {}),
        type: 'digital_merch_delivery'
      };
    }

    // 4. Insert Order
    db.prepare(`
      INSERT INTO orders (
        id, order_number, customer_id, product_id, plan_id, status,
        start_date, end_date, price, cost, currency, payment_status,
        payment_method, fulfillment_type, assigned_service_account_id,
        assigned_profile_id, assigned_license_key_id, fulfillment_data,
        renewal_count, created_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      orderId,
      orderNumber,
      customer_id,
      product_id,
      plan_id,
      startDateStr,
      endDateStr,
      finalPrice,
      finalCost,
      currency,
      payment_method,
      product.fulfillment_type,
      assignedAccountId,
      assignedProfileId,
      assignedLicenseId,
      JSON.stringify(fulfillmentData),
      req.user?.id || null,
      now
    );

    db.exec('COMMIT;');

    logAudit(req.user || null, 'CREATE_ORDER', 'order', orderId, {
      orderNumber,
      customer_id,
      product_id,
      price: finalPrice,
      currency
    });

    res.status(201).json({
      success: true,
      order: {
        id: orderId,
        order_number: orderNumber,
        customer_id,
        customer_name: customer.name,
        customer_whatsapp: customer.whatsapp,
        product_name: product.name,
        plan_name: plan.name,
        start_date: startDateStr,
        end_date: endDateStr,
        price: finalPrice,
        currency,
        fulfillment_data: fulfillmentData
      }
    });
  } catch (txErr: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Order creation transaction failed: ' + txErr.message });
  }
});

// Cancel order (releases allocated assets back to available)
ordersRouter.post('/:id/cancel', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    // Release assigned profile if any
    if (order.assigned_profile_id) {
      db.prepare(`
        UPDATE service_profiles
        SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_profile_id);
    }

    // Release assigned license key if any
    if (order.assigned_license_key_id) {
      db.prepare(`
        UPDATE license_keys
        SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_license_key_id);
    }

    // Set order status cancelled
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(id);

    db.exec('COMMIT;');
    logAudit(req.user || null, 'CANCEL_ORDER', 'order', id, { reason });

    res.json({ success: true, message: 'Order cancelled and allocated inventory freed.' });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// Update order (customer, product, plan, dates, payment, notes, price, status)
ordersRouter.put('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const {
    customer_id,
    product_id,
    plan_id,
    start_date,
    end_date,
    price,
    payment_status,
    payment_method,
    status,
    notes
  } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  let fulfillmentData: any = {};
  try {
    fulfillmentData = order.fulfillment_data ? JSON.parse(order.fulfillment_data) : {};
  } catch {
    fulfillmentData = {};
  }
  if (notes !== undefined) {
    fulfillmentData.notes = notes;
  }

  const updatedCustomerId = customer_id || order.customer_id;
  const updatedProductId = product_id || order.product_id;
  const updatedPlanId = plan_id || order.plan_id;
  let updatedStartDate = start_date || order.start_date;
  let updatedEndDate = end_date || order.end_date;
  const updatedPrice = price !== undefined ? Number(price) : order.price;
  const updatedPaymentStatus = payment_status || order.payment_status;
  const updatedPaymentMethod = payment_method || order.payment_method;
  const updatedStatus = status || order.status;

  const today = new Date().toISOString().split('T')[0];
  const threeDaysAhead = new Date();
  threeDaysAhead.setDate(threeDaysAhead.getDate() + 3);
  const threeDaysStr = threeDaysAhead.toISOString().split('T')[0];

  // Adjust dates if status was explicitly changed without manually overriding end_date
  if (status && !end_date) {
    if (status === 'active' && order.end_date < today) {
      const plan = db.prepare('SELECT duration, duration_unit FROM plans WHERE id = ?').get(updatedPlanId) as any;
      const duration = plan?.duration || 1;
      const unit = plan?.duration_unit || 'months';
      updatedStartDate = today;
      updatedEndDate = calculateEndDate(today, duration, unit);
    } else if (status === 'expired' && order.end_date >= today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      updatedEndDate = yesterday.toISOString().split('T')[0];
    } else if (status === 'expiring' && (order.end_date > threeDaysStr || order.end_date < today)) {
      const twoDays = new Date();
      twoDays.setDate(twoDays.getDate() + 2);
      updatedEndDate = twoDays.toISOString().split('T')[0];
    }
  }

  // Verify stock availability if reassigning to a different plan
  if (updatedPlanId !== order.plan_id) {
    const targetPlan = db.prepare('SELECT name, stock_limit FROM plans WHERE id = ?').get(updatedPlanId) as any;
    if (targetPlan?.stock_limit && targetPlan.stock_limit > 0) {
      const activeCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE plan_id = ? AND status IN ('active', 'expiring') AND id != ?").get(updatedPlanId, id) as any;
      if ((activeCount?.count || 0) >= targetPlan.stock_limit) {
        return res.status(409).json({ error: `Cannot reassign order: Stock for plan "${targetPlan.name}" is full.` });
      }
    }
  }

  // Verify stock availability if reassigning to a different product
  if (updatedProductId !== order.product_id) {
    const targetProduct = db.prepare('SELECT name, capabilities, fulfillment_type, stock_limit FROM products WHERE id = ?').get(updatedProductId) as any;
    if (targetProduct) {
      if (targetProduct.stock_limit && targetProduct.stock_limit > 0) {
        const activeCount = db.prepare("SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status IN ('active', 'expiring') AND id != ?").get(updatedProductId, id) as any;
        if ((activeCount?.count || 0) >= targetProduct.stock_limit) {
          return res.status(409).json({ error: `Cannot reassign order: Stock for product "${targetProduct.name}" is full.` });
        }
      }
    }
  }

  // If status is transitioning to cancelled from an active/expiring order, free assigned assets
  if (updatedStatus === 'cancelled' && order.status !== 'cancelled') {
    if (order.assigned_profile_id) {
      db.prepare(`
        UPDATE service_profiles
        SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_profile_id);
    }
    if (order.assigned_license_key_id) {
      db.prepare(`
        UPDATE license_keys
        SET status = 'available', assigned_customer_id = NULL, assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_license_key_id);
    }
  }

  db.prepare(`
    UPDATE orders
    SET customer_id = ?, product_id = ?, plan_id = ?, start_date = ?, end_date = ?, price = ?, payment_status = ?, payment_method = ?, status = ?, fulfillment_data = ?
    WHERE id = ?
  `).run(
    updatedCustomerId,
    updatedProductId,
    updatedPlanId,
    updatedStartDate,
    updatedEndDate,
    updatedPrice,
    updatedPaymentStatus,
    updatedPaymentMethod,
    updatedStatus,
    JSON.stringify(fulfillmentData),
    id
  );

  logAudit(req.user || null, 'UPDATE_ORDER', 'order', id, {
    order_number: order.order_number,
    changes: { customer_id, product_id, plan_id, start_date, end_date, price, payment_status, payment_method, status, notes }
  });

  const updatedOrder = db.prepare(`
    SELECT o.*, c.name as customer_name, c.email as customer_email, c.whatsapp as customer_whatsapp,
           p.name as product_name, p.fulfillment_type, pl.name as plan_name, pl.duration, pl.duration_unit
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    JOIN products p ON p.id = o.product_id
    JOIN plans pl ON pl.id = o.plan_id
    WHERE o.id = ?
  `).get(id);

  res.json({ success: true, order: updatedOrder, message: 'Order updated successfully' });
});

// Delete order (restricted for active/expiring orders)
ordersRouter.delete('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Strictly restrict deleting active orders
  if (order.status === 'active' || order.status === 'expiring') {
    return res.status(400).json({
      error: 'Cannot delete an active order. Please cancel the order first to release allocated assets and preserve accounting records.'
    });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    if (order.assigned_profile_id) {
      db.prepare(`
        UPDATE service_profiles
        SET assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_profile_id);
    }
    if (order.assigned_license_key_id) {
      db.prepare(`
        UPDATE license_keys
        SET assigned_order_id = NULL
        WHERE id = ?
      `).run(order.assigned_license_key_id);
    }

    db.prepare('DELETE FROM order_renewals WHERE order_id = ?').run(id);
    db.prepare('DELETE FROM orders WHERE id = ?').run(id);

    db.exec('COMMIT;');
    logAudit(req.user || null, 'DELETE_ORDER', 'order', id, { order_number: order.order_number });

    res.json({ success: true, message: `Order #${order.order_number} has been deleted.` });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});
