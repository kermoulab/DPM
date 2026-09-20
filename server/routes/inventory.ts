import { Router } from 'express';
import crypto from 'crypto';
import { inventoryRepo } from '../db/repositories/inventory.repository.js';
import { inventoryService } from '../services/inventory.service.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';
import { maskSecret, encryptCredential } from '../utils/crypto.js';

export const inventoryRouter = Router();

// GET /api/inventory/accounts
inventoryRouter.get('/accounts', requireAuth, async (req, res, next) => {
  try {
    const { product_id, status } = req.query;
    const accounts = await inventoryRepo.findAccounts({
      product_id: product_id as string,
      status: status as string
    });
    res.json({ accounts });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/accounts/:id/profiles
inventoryRouter.get('/accounts/:id/profiles', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const profiles = await inventoryRepo.findProfilesByAccountId(id);
    res.json({ profiles });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/accounts/:id/reveal-credentials
inventoryRouter.post('/accounts/:id/reveal-credentials', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const creds = await inventoryService.revealCredentials(id, req.user, req.ip || '127.0.0.1');
    res.json(creds);
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/accounts
inventoryRouter.post('/accounts', requireAuth, requireRole('manager'), validateBody({
  product_id: v.required('Product ID is required.'),
  provider: v.required('Provider name is required.'),
  login: v.required('Login username/email is required.'),
  password: v.required('Password/credential is required.')
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { product_id, provider, login, password, capacity, expiry_date, notes, create_profiles, profile_names } = req.body;

    const account = await inventoryService.createAccount(
      { product_id, provider, login, password, capacity, expiry_date, notes, create_profiles, profile_names },
      req.user
    );

    res.status(201).json({ success: true, id: account.id, account });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/profiles/:id
inventoryRouter.put('/profiles/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const updated = await inventoryRepo.updateProfile(id, req.body);
    await auditRepo.log(req.user || null, 'UPDATE_PROFILE', 'service_profile', id, req.body);
    res.json({ success: true, profile: updated });
  } catch (err) {
    next(err);
  }
});

// PUT /api/inventory/accounts/:id
inventoryRouter.put('/accounts/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    if (updates.password && typeof updates.password === 'string' && updates.password.trim()) {
      const enc = encryptCredential(updates.password.trim());
      updates.encrypted_credential = enc.encrypted;
      updates.iv = enc.iv;
      updates.tag = enc.tag;
      delete updates.password;
    }
    const updated = await inventoryRepo.updateAccount(id, updates);
    await auditRepo.log(req.user || null, 'UPDATE_SERVICE_ACCOUNT', 'service_account', id, { ...updates, encrypted_credential: '[HIDDEN]' });
    res.json({ success: true, account: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/accounts/:id
inventoryRouter.delete('/accounts/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    await inventoryRepo.deleteAccount(id);
    await auditRepo.log(req.user || null, 'DELETE_SERVICE_ACCOUNT', 'service_account', id, {});
    res.json({ success: true, message: 'Account deleted.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/inventory/licenses
inventoryRouter.get('/licenses', requireAuth, async (req, res, next) => {
  try {
    const { product_id, status } = req.query;
    const licenses = await inventoryRepo.findLicenses({
      product_id: product_id as string,
      status: status as string
    });
    res.json({ licenses });
  } catch (err) {
    next(err);
  }
});

// POST /api/inventory/licenses
inventoryRouter.post('/licenses', requireAuth, requireRole('manager'), validateBody({
  product_id: v.required('Product ID is required.'),
  keys: v.required('At least one license key is required.')
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { product_id, keys, expiry_date, notes } = req.body;

    const result = await inventoryService.addLicenses({ product_id, keys, expiry_date, notes }, req.user);
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/inventory/licenses/:id
inventoryRouter.delete('/licenses/:id', requireAuth, requireRole('manager'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { id } = req.params;
    await inventoryRepo.deleteLicense(id);
    await auditRepo.log(req.user || null, 'DELETE_LICENSE', 'license_key', id, {});
    res.json({ success: true, message: 'License key removed.' });
  } catch (err) {
    next(err);
  }
});
