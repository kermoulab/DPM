import { Router } from 'express';
import crypto from 'crypto';
import { categoriesRepo } from '../db/repositories/categories.repository.js';
import { plansRepo } from '../db/repositories/plans.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const categoriesRouter = Router();

// GET /api/categories
categoriesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const categories = await categoriesRepo.findAll();
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// POST /api/categories
categoriesRouter.post('/', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, icon, description } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }

    const id = 'cat-' + crypto.randomUUID().slice(0, 8);
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const category = await categoriesRepo.create({
      id,
      name: name.trim(),
      slug,
      icon: icon || 'Folder',
      description: description?.trim() || null
    });

    await auditRepo.log(req.user || null, 'CREATE_CATEGORY', 'category', id, { name });
    res.status(201).json({ success: true, id: category.id, name: category.name, slug: category.slug });
  } catch (err: any) {
    if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
      res.status(400).json({ error: 'A category with this name or slug already exists.' });
      return;
    }
    next(err);
  }
});

// GET /api/categories/:id/plans
categoriesRouter.get('/:id/plans', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const plans = await plansRepo.findAll();
    const categoryPlans = plans.filter((p) => p.category_id === id);
    res.json({ plans: categoryPlans });
  } catch (err) {
    next(err);
  }
});

// PUT /api/categories/:id
categoriesRouter.put('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, description, status } = req.body;

    const existing = await categoriesRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    await categoriesRepo.update(id, { name: name?.trim(), icon, description: description?.trim(), status });
    await auditRepo.log(req.user || null, 'UPDATE_CATEGORY', 'category', id, { name, status });

    res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categories/:id
categoriesRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const category = await categoriesRepo.findById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    await categoriesRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_CATEGORY', 'category', id, { name: category.name });
    res.json({ success: true, message: `Category "${category.name}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
});
