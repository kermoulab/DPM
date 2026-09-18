import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const productsRouter = Router();

// List all products with category info, plan count, and stock status
productsRouter.get('/', requireAuth, (req, res) => {
  const { category_id, search, status } = req.query;

  let query = `
    SELECT 
      p.*,
      c.name as category_name,
      c.slug as category_slug,
      COUNT(DISTINCT pl.id) as plan_count,
      COUNT(DISTINCT sa.id) as account_count,
      COUNT(DISTINCT lk.id) as license_count
    FROM products p
    JOIN categories c ON c.id = p.category_id
    LEFT JOIN plans pl ON pl.product_id = p.id
    LEFT JOIN service_accounts sa ON sa.product_id = p.id AND sa.status = 'active'
    LEFT JOIN license_keys lk ON lk.product_id = p.id AND lk.status = 'available'
    WHERE 1=1
  `;
  const params: any[] = [];

  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(category_id);
  }

  if (status) {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (p.name LIKE ? OR p.brand LIKE ? OR p.description LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ` GROUP BY p.id ORDER BY p.name ASC`;

  const rawProducts = db.prepare(query).all(...params) as any[];

  // Parse JSON capabilities, custom_fields, and compute stock fullness
  const products = rawProducts.map((p) => {
    const caps: string[] = p.capabilities ? JSON.parse(p.capabilities) : [];
    let is_stock_full = false;
    let available_stock = 0;

    if (caps.includes('service_account') || caps.includes('profiles') || p.fulfillment_type === 'service_account') {
      const avail = db.prepare(`
        SELECT COUNT(sp.id) as count
        FROM service_profiles sp
        JOIN service_accounts sa ON sa.id = sp.service_account_id
        WHERE sa.product_id = ? AND sa.status = 'active' AND sp.status = 'available'
      `).get(p.id) as any;
      available_stock = avail?.count || 0;
      if (available_stock === 0) {
        is_stock_full = true;
      }
    } else if (caps.includes('license_key') || p.fulfillment_type === 'license_key') {
      const avail = db.prepare(`
        SELECT COUNT(id) as count
        FROM license_keys
        WHERE product_id = ? AND status = 'available'
      `).get(p.id) as any;
      available_stock = avail?.count || 0;
      if (available_stock === 0) {
        is_stock_full = true;
      }
    }

    if (p.stock_limit && p.stock_limit > 0) {
      const active = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status IN ('active', 'expiring')
      `).get(p.id) as any;
      if ((active?.count || 0) >= p.stock_limit) {
        is_stock_full = true;
      }
    }

    return {
      ...p,
      capabilities: caps,
      custom_fields: p.custom_fields ? JSON.parse(p.custom_fields) : [],
      available_stock,
      is_stock_full
    };
  });

  res.json({ products });
});

// Get single product with its plans and live inventory summary
productsRouter.get('/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;

    const product = db.prepare(`
      SELECT p.*, c.name as category_name
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE p.id = ?
    `).get(id) as any;

    if (!product) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const caps: string[] = product.capabilities ? JSON.parse(product.capabilities) : [];

    const rawPlans = db.prepare("SELECT * FROM plans WHERE product_id = ? AND status = 'active' ORDER BY price ASC").all(id) as any[];

    // Available and total profiles count
    const availableProfiles = db.prepare(`
      SELECT COUNT(sp.id) as count
      FROM service_profiles sp
      JOIN service_accounts sa ON sa.id = sp.service_account_id
      WHERE sa.product_id = ? AND sa.status = 'active' AND sp.status = 'available'
    `).get(id) as any;

    const totalProfiles = db.prepare(`
      SELECT COUNT(sp.id) as count
      FROM service_profiles sp
      JOIN service_accounts sa ON sa.id = sp.service_account_id
      WHERE sa.product_id = ? AND sa.status = 'active'
    `).get(id) as any;

    // Available and total licenses count
    const availableLicenses = db.prepare(`
      SELECT COUNT(id) as count
      FROM license_keys
      WHERE product_id = ? AND status = 'available'
    `).get(id) as any;

    const totalLicenses = db.prepare(`
      SELECT COUNT(id) as count
      FROM license_keys
      WHERE product_id = ?
    `).get(id) as any;

    // Active orders count for this product
    const activeOrders = db.prepare(`
      SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status IN ('active', 'expiring')
    `).get(id) as any;

    const availProfCount = availableProfiles?.count || 0;
    const totalProfCount = totalProfiles?.count || 0;
    const availLicCount = availableLicenses?.count || 0;
    const totalLicCount = totalLicenses?.count || 0;
    const activeOrdersCount = activeOrders?.count || 0;

    let isProductStockFull = false;
    let stockReason = '';

    if (caps.includes('service_account') || caps.includes('profiles') || product.fulfillment_type === 'service_account') {
      if (availProfCount === 0) {
        isProductStockFull = true;
        stockReason = totalProfCount > 0
          ? `All ${totalProfCount} service profile slots are currently assigned. Stock is full.`
          : 'No service accounts or profile slots exist in inventory.';
      }
    } else if (caps.includes('license_key') || product.fulfillment_type === 'license_key') {
      if (availLicCount === 0) {
        isProductStockFull = true;
        stockReason = totalLicCount > 0
          ? 'All license keys in stock have been assigned. Stock is full.'
          : 'No license keys currently exist in inventory.';
      }
    }

    if (product.stock_limit && product.stock_limit > 0 && activeOrdersCount >= product.stock_limit) {
      isProductStockFull = true;
      stockReason = `Maximum order capacity reached (${activeOrdersCount}/${product.stock_limit} active subscriptions).`;
    }

    // Process each plan to calculate active orders and stock fullness
    const plans = rawPlans.map((pl) => {
      const planActiveOrders = db.prepare(`
        SELECT COUNT(*) as count FROM orders WHERE plan_id = ? AND status IN ('active', 'expiring')
      `).get(pl.id) as any;
      const count = planActiveOrders?.count || 0;
      let isPlanStockFull = isProductStockFull;
      if (pl.stock_limit && pl.stock_limit > 0 && count >= pl.stock_limit) {
        isPlanStockFull = true;
      }
      return {
        ...pl,
        active_orders_count: count,
        is_stock_full: isPlanStockFull
      };
    });

    res.json({
      product: {
        ...product,
        capabilities: caps,
        custom_fields: product.custom_fields ? JSON.parse(product.custom_fields) : [],
        is_stock_full: isProductStockFull,
        stock_reason: stockReason
      },
      plans,
      inventorySummary: {
        availableProfiles: availProfCount,
        totalProfiles: totalProfCount,
        availableLicenses: availLicCount,
        totalLicenses: totalLicCount,
        activeOrdersCount,
        stockLimit: product.stock_limit || null,
        isStockFull: isProductStockFull,
        stockReason
      }
    });
  } catch (err: any) {
    console.error('Error fetching product details:', err);
    res.status(500).json({ error: err.message || 'Internal server error while fetching product.' });
  }
});

// Create product
productsRouter.post('/', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { category_id, name, brand, description, capabilities, fulfillment_type, custom_fields, icon, image_url } = req.body;

  if (!category_id || !name?.trim()) {
    return res.status(400).json({ error: 'Category and product name are required.' });
  }

  const id = 'prod-' + crypto.randomUUID().slice(0, 8);
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + id.slice(-4);
  const now = new Date().toISOString();

  const caps = Array.isArray(capabilities) ? capabilities : ['subscription', 'manual_fulfillment'];
  const fields = Array.isArray(custom_fields) ? custom_fields : [];

  try {
    db.prepare(`
      INSERT INTO products (id, category_id, name, slug, brand, description, status, capabilities, fulfillment_type, custom_fields, icon, image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      category_id,
      name.trim(),
      slug,
      brand?.trim() || null,
      description?.trim() || null,
      JSON.stringify(caps),
      fulfillment_type || 'automatic',
      JSON.stringify(fields),
      icon || 'Box',
      image_url || null,
      now
    );

    logAudit(req.user || null, 'CREATE_PRODUCT', 'product', id, { name, category_id });
    res.status(201).json({ success: true, id, name, slug });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// Update product
productsRouter.put('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { category_id, name, brand, description, status, capabilities, fulfillment_type, custom_fields, icon, image_url } = req.body;

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  db.prepare(`
    UPDATE products
    SET category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        capabilities = CASE WHEN ? IS NOT NULL THEN ? ELSE capabilities END,
        fulfillment_type = COALESCE(?, fulfillment_type),
        custom_fields = CASE WHEN ? IS NOT NULL THEN ? ELSE custom_fields END,
        icon = COALESCE(?, icon),
        image_url = COALESCE(?, image_url)
    WHERE id = ?
  `).run(
    category_id,
    name?.trim(),
    brand?.trim(),
    description?.trim(),
    status,
    capabilities ? 1 : null,
    capabilities ? JSON.stringify(capabilities) : null,
    fulfillment_type,
    custom_fields ? 1 : null,
    custom_fields ? JSON.stringify(custom_fields) : null,
    icon,
    image_url,
    id
  );

  logAudit(req.user || null, 'UPDATE_PRODUCT', 'product', id, { name, status });
  res.json({ success: true, message: 'Product updated successfully.' });
});

// Delete product
productsRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  // Check if product has active orders
  const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE product_id = ? AND status = 'active'").get(id) as any;
  if (activeOrders?.count > 0) {
    return res.status(400).json({
      error: `Cannot delete product with ${activeOrders.count} active order(s). Please deactivate the product instead, or complete/cancel the active orders.`
    });
  }

  // Check if any historic orders exist (non-active)
  const allOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE product_id = ?").get(id) as any;
  if (allOrders?.count > 0) {
    // Soft-delete/deactivate to preserve audit trail of historic orders
    db.prepare("UPDATE products SET status = 'inactive' WHERE id = ?").run(id);
    logAudit(req.user || null, 'DEACTIVATE_PRODUCT', 'product', id, { note: 'Deactivated due to historical orders' });
    return res.json({ success: true, message: 'Product archived and removed from catalog (historical order records preserved).' });
  }

  // If no orders exist, delete associated items and the product completely
  db.prepare('DELETE FROM plans WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM service_accounts WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM license_keys WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM digital_assets WHERE product_id = ?').run(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_PRODUCT', 'product', id, {});
  res.json({ success: true, message: 'Product deleted successfully.' });
});
