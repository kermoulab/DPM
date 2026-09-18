import { Router } from 'express';
import crypto from 'crypto';
import { productsRepo } from '../db/repositories/products.repository.js';
import { plansRepo } from '../db/repositories/plans.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const productsRouter = Router();

// GET /api/products
productsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { category_id, search, status } = req.query;
    const rawProducts = await productsRepo.findAll({
      category_id: category_id as string,
      search: search as string,
      status: status as string
    });

    const products = await Promise.all(
      rawProducts.map(async (p) => {
        const inv = await productsRepo.getInventoryCounts(p.id, p.fulfillment_type);
        return {
          ...p,
          available_inventory: inv.available,
          in_stock: inv.available > 0
        };
      })
    );

    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
productsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productsRepo.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const plans = await plansRepo.findByProductId(id);
    const inventorySummary = await productsRepo.getInventoryCounts(id, product.fulfillment_type);

    res.json({ product, plans, inventorySummary });
  } catch (err) {
    next(err);
  }
});

// POST /api/products
productsRouter.post('/', requireAuth, requireRole('manager'), validateBody({
  category_id: v.required('Category is required.'),
  name: [v.required('Product name is required.'), v.string({ min: 1, max: 200 })]
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { category_id, name, brand, description, capabilities, fulfillment_type, custom_fields, icon, image_url, stock_limit } = req.body;

    const id = 'prod-' + crypto.randomUUID().slice(0, 8);
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const product = await productsRepo.create({
      id,
      category_id,
      name: name.trim(),
      slug,
      brand: brand || null,
      description: description || null,
      status: 'active',
      capabilities: Array.isArray(capabilities) ? capabilities : ['subscription'],
      fulfillment_type: fulfillment_type || 'automatic',
      custom_fields: Array.isArray(custom_fields) ? custom_fields : [],
      icon: icon || 'Box',
      image_url: image_url || null,
      stock_limit: stock_limit !== undefined ? Number(stock_limit) : null
    });

    await auditRepo.log(req.user || null, 'CREATE_PRODUCT', 'product', id, { name });
    res.status(201).json({ success: true, id: product.id, product });
  } catch (err: any) {
    if (err.message?.includes('duplicate key') || err.message?.includes('unique constraint')) {
      res.status(400).json({ error: 'A product with this name or slug already exists.' });
      return;
    }
    next(err);
  }
});

// PUT /api/products/:id
productsRouter.put('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await productsRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const updated = await productsRepo.update(id, req.body);
    await auditRepo.log(req.user || null, 'UPDATE_PRODUCT', 'product', id, { name: updated?.name });
    res.json({ success: true, product: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id
productsRouter.delete('/:id', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const product = await productsRepo.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    await productsRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_PRODUCT', 'product', id, { name: product.name });
    res.json({ success: true, message: `Product "${product.name}" deleted.` });
  } catch (err) {
    next(err);
  }
});
