import { Router } from 'express';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../security.js';

export const currenciesRouter = Router();

// List currencies
currenciesRouter.get('/', requireAuth, (req, res) => {
  const currencies = db.prepare('SELECT * FROM currencies ORDER BY is_base DESC, code ASC').all();
  res.json({ currencies });
});

// Update exchange rate
currenciesRouter.put('/:code', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { code } = req.params;
  const { exchange_rate, symbol, name } = req.body;

  if (exchange_rate === undefined || Number(exchange_rate) <= 0) {
    return res.status(400).json({ error: 'Valid positive exchange rate is required.' });
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE currencies
    SET exchange_rate = ?,
        symbol = COALESCE(?, symbol),
        name = COALESCE(?, name),
        updated_at = ?
    WHERE code = ?
  `).run(Number(exchange_rate), symbol, name, now, code.toUpperCase());

  logAudit(req.user || null, 'UPDATE_EXCHANGE_RATE', 'currency', code, { exchange_rate });
  res.json({ success: true, message: 'Currency updated.' });
});

// Add new currency
currenciesRouter.post('/', requireAuth, requireRole('admin'), (req: AuthenticatedRequest, res) => {
  const { code, symbol, name, exchange_rate, decimal_precision = 2 } = req.body;

  if (!code || !symbol || !name || !exchange_rate) {
    return res.status(400).json({ error: 'Code, symbol, name, and exchange rate are required.' });
  }

  const now = new Date().toISOString();
  try {
    db.prepare(`
      INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).run(code.toUpperCase().trim(), symbol.trim(), name.trim(), Number(exchange_rate), decimal_precision, now);

    logAudit(req.user || null, 'CREATE_CURRENCY', 'currency', code, { rate: exchange_rate });
    res.status(201).json({ success: true, code });
  } catch (err: any) {
    res.status(400).json({ error: 'Currency code already exists or invalid.' });
  }
});
