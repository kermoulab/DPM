import { Router } from 'express';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const settingsRouter = Router();

// Get all settings
settingsRouter.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// Update settings
settingsRouter.put('/', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const allowedKeys = [
    'company_name',
    'base_currency',
    'currency_symbol',
    'support_phone',
    'low_inventory_threshold',
    'order_expiry_warning_days'
  ];

  const now = new Date().toISOString();
  for (const key of allowedKeys) {
    if (req.body[key] !== undefined) {
      db.prepare(`
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(key, String(req.body[key]).trim(), now);
    }
  }

  logAudit(req.user || null, 'UPDATE_SETTINGS', 'settings', 'general', req.body);
  res.json({ success: true, message: 'Settings successfully updated.' });
});
