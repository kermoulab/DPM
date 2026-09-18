import { Router } from 'express';
import { systemSettingsRepo } from '../db/repositories/system-settings.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const settings = await systemSettingsRepo.getAll();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

settingsRouter.put('/', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const updates = req.body;
    if (typeof updates !== 'object' || updates === null) {
      res.status(400).json({ error: 'Settings object is required.' });
      return;
    }

    await systemSettingsRepo.setMany(updates);
    await auditRepo.log(req.user || null, 'UPDATE_SETTINGS', 'settings', null, { keys: Object.keys(updates) });
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    next(err);
  }
});
