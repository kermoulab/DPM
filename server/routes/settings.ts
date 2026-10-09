import { Router } from 'express';
import { systemSettingsRepo } from '../db/repositories/system-settings.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const settingsRouter = Router();

const PROTECTED_SETTINGS = new Set(['install_state', 'installed', 'jwt_secret', 'encryption_key']);
const SENSITIVE_SETTINGS = new Set(['firebase_service_account_json', 'jwt_secret', 'encryption_key']);

settingsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const settings = await systemSettingsRepo.getAll();
    for (const key of SENSITIVE_SETTINGS) {
      delete settings[key];
    }
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

    const forbidden = Object.keys(updates).filter(k => PROTECTED_SETTINGS.has(k));
    if (forbidden.length > 0) {
      res.status(400).json({ error: `Cannot modify protected system setting: ${forbidden.join(', ')}` });
      return;
    }

    await systemSettingsRepo.setMany(updates);
    await auditRepo.log(req.user || null, 'UPDATE_SETTINGS', 'settings', null, { keys: Object.keys(updates) });
    res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err) {
    next(err);
  }
});
