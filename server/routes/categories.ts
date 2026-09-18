import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const categoriesRouter = Router();

// List all categories
categoriesRouter.get('/', requireAuth, (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name ASC
  `).all();
  res.json({ categories });
});

// Create category
categoriesRouter.post('/', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { name, icon, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  const id = 'cat-' + crypto.randomUUID().slice(0, 8);
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO categories (id, name, slug, icon, description, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(id, name.trim(), slug, icon || 'Folder', description?.trim() || null, now);

    logAudit(req.user || null, 'CREATE_CATEGORY', 'category', id, { name });
    res.status(201).json({ success: true, id, name, slug });
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A category with this name or slug already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get plans attached to products in a category
categoriesRouter.get('/:id/plans', requireAuth, (req, res) => {
  const { id } = req.params;
  try {
    const plans = db.prepare(`
      SELECT pl.*, p.name as product_name, p.brand as product_brand, p.category_id
      FROM plans pl
      JOIN products p ON p.id = pl.product_id
      WHERE p.category_id = ?
      ORDER BY p.name ASC, pl.price ASC
    `).all(id);
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update category
categoriesRouter.put('/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { name, icon, description, status } = req.body;

  const existing = db.prepare('SELECT id FROM categories WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Category not found.' });
  }

  db.prepare(`
    UPDATE categories
    SET name = COALESCE(?, name),
        icon = COALESCE(?, icon),
        description = COALESCE(?, description),
        status = COALESCE(?, status)
    WHERE id = ?
  `).run(name?.trim(), icon, description?.trim(), status, id);

  logAudit(req.user || null, 'UPDATE_CATEGORY', 'category', id, { name, status });
  res.json({ success: true, message: 'Category updated successfully.' });
});

// Delete category with safe options (Option A: Move to General, Option B: Unassign plans)
categoriesRouter.delete('/:id', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const mode = (req.query.mode || req.body?.mode || '') as string;

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  if (!category) {
    return res.status(404).json({ error: 'Category not found.' });
  }

  // Count products in this category
  const productCountRes = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(id) as any;
  const productCount = productCountRes?.count || 0;

  if (productCount > 0 && !mode) {
    return res.status(400).json({
      error: `Category contains ${productCount} products. Please specify a deletion mode: 'move_to_general' or 'unassign_plans'.`,
      productCount
    });
  }

  const now = new Date().toISOString();

  if (mode === 'move_to_general') {
    // Option A: Move all products to an "Unassigned" or "General" category
    let generalCat = db.prepare("SELECT id FROM categories WHERE slug = 'general' OR slug = 'unassigned'").get() as any;
    if (!generalCat) {
      const genId = 'cat-general';
      db.prepare(`
        INSERT INTO categories (id, name, slug, icon, description, status, created_at)
        VALUES (?, 'General', 'general', 'Folder', 'Default unassigned product catalog', 'active', ?)
      `).run(genId, now);
      generalCat = { id: genId };
    }

    if (generalCat.id === id) {
      return res.status(400).json({ error: 'Cannot delete the primary General category.' });
    }

    db.prepare('UPDATE products SET category_id = ? WHERE category_id = ?').run(generalCat.id, id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);

    logAudit(req.user || null, 'DELETE_CATEGORY', 'category', id, { mode: 'move_to_general', target_category_id: generalCat.id });
    return res.json({ success: true, message: `Category "${category.name}" deleted. All ${productCount} products were moved to General category.` });
  }

  if (mode === 'unassign_plans') {
    // Option B: Delete the category and unassign its plans
    let unassignedCat = db.prepare("SELECT id FROM categories WHERE slug = 'unassigned' OR slug = 'general'").get() as any;
    if (!unassignedCat) {
      const unassignedId = 'cat-unassigned';
      db.prepare(`
        INSERT INTO categories (id, name, slug, icon, description, status, created_at)
        VALUES (?, 'Unassigned', 'unassigned', 'Folder', 'Unassigned plans and products catalog', 'active', ?)
      `).run(unassignedId, now);
      unassignedCat = { id: unassignedId };
    }

    const prods = db.prepare('SELECT id FROM products WHERE category_id = ?').all(id) as any[];
    for (const prod of prods) {
      const orderCount = db.prepare(`
        SELECT COUNT(*) as count FROM orders 
        WHERE product_id = ? OR plan_id IN (SELECT id FROM plans WHERE product_id = ?)
      `).get(prod.id, prod.id) as any;

      if (orderCount?.count > 0) {
        // Products and plans tied to orders must be preserved to maintain DB integrity; unassign category
        db.prepare('UPDATE products SET category_id = ?, status = ? WHERE id = ?').run(unassignedCat.id, 'inactive', prod.id);
      } else {
        // Safe to remove unused plans and product
        db.prepare('DELETE FROM plans WHERE product_id = ?').run(prod.id);
        db.prepare('DELETE FROM products WHERE id = ?').run(prod.id);
      }
    }

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    logAudit(req.user || null, 'DELETE_CATEGORY', 'category', id, { mode: 'unassign_plans' });
    return res.json({ success: true, message: `Category "${category.name}" deleted and subscription plans unassigned successfully.` });
  }

  // If no products, direct delete
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_CATEGORY', 'category', id, {});
  return res.json({ success: true, message: `Category "${category.name}" deleted successfully.` });
});
