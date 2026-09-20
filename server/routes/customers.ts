import { Router } from 'express';
import crypto from 'crypto';
import { customersRepo } from '../db/repositories/customers.repository.js';
import { ordersRepo } from '../db/repositories/orders.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const customersRouter = Router();

// GET /api/customers
customersRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const customers = await customersRepo.findAll({
      search: search as string,
      status: status as string
    });
    res.json({ customers });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
customersRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await customersRepo.findById(id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const orders = await ordersRepo.findAll({ customer_id: id });
    const auditLogs = await auditRepo.findLogs({ entity: 'customer', limit: 50 });

    res.json({ customer, orders, auditLogs });
  } catch (err) {
    next(err);
  }
});

// POST /api/customers
customersRouter.post('/', requireAuth, validateBody({
  name: [v.required('Customer name is required.'), v.string({ min: 1, max: 200 })],
  email: v.email('Invalid email address format.')
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { name, email, whatsapp, notes } = req.body;

    const id = 'cust-' + crypto.randomUUID().slice(0, 8);
    const customer = await customersRepo.create({ id, name, email, whatsapp, notes });
    await auditRepo.log(req.user || null, 'CREATE_CUSTOMER', 'customer', id, { name });
    res.status(201).json({ success: true, id: customer.id, customer });
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id
customersRouter.put('/:id', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const existing = await customersRepo.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const updated = await customersRepo.update(id, req.body);
    await auditRepo.log(req.user || null, 'UPDATE_CUSTOMER', 'customer', id, { name: updated?.name });
    res.json({ success: true, message: 'Customer updated successfully.', customer: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id
customersRouter.delete('/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const customer = await customersRepo.findById(id);
    if (!customer) {
      res.status(404).json({ error: 'Customer not found.' });
      return;
    }

    const customerOrders = await ordersRepo.findAll({ customer_id: id });
    if (customerOrders.length > 0) {
      res.status(400).json({ error: 'Cannot delete customer with existing orders. Please cancel or remove customer orders first.' });
      return;
    }

    await customersRepo.delete(id);
    await auditRepo.log(req.user || null, 'DELETE_CUSTOMER', 'customer', id, { name: customer.name });
    res.json({ success: true, message: 'Customer deleted successfully.' });
  } catch (err) {
    next(err);
  }
});
