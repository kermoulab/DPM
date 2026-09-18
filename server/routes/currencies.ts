import { Router } from 'express';
import { currenciesRepo } from '../db/repositories/currencies.repository.js';
import { auditRepo } from '../db/repositories/audit.repository.js';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { validateBody, v } from '../middleware/validation.middleware.js';

export const currenciesRouter = Router();

// GET /api/currencies
currenciesRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const currencies = await currenciesRepo.findAll();
    res.json({ currencies });
  } catch (err) {
    next(err);
  }
});

// PUT /api/currencies/:code
currenciesRouter.put('/:code', requireAuth, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { code } = req.params;
    const { exchange_rate, symbol, name, decimal_precision, is_base } = req.body;

    const existing = await currenciesRepo.findByCode(code);
    if (!existing) {
      res.status(404).json({ error: 'Currency not found.' });
      return;
    }

    const updated = await currenciesRepo.upsert({
      code: code.toUpperCase(),
      symbol: symbol || existing.symbol,
      name: name || existing.name,
      exchange_rate: exchange_rate !== undefined ? parseFloat(exchange_rate) : existing.exchange_rate,
      decimal_precision: decimal_precision !== undefined ? parseInt(decimal_precision, 10) : existing.decimal_precision,
      is_base: is_base !== undefined ? Boolean(is_base) : existing.is_base
    });

    await auditRepo.log(req.user || null, 'UPDATE_CURRENCY_RATE', 'currency', code.toUpperCase(), { exchange_rate });
    res.json({ success: true, currency: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/currencies
currenciesRouter.post('/', requireAuth, requireRole('admin'), validateBody({
  code: [v.required('Currency code is required.'), v.currencyCode()],
  symbol: v.required('Currency symbol is required.'),
  name: [v.required('Currency name is required.'), v.string({ min: 1, max: 100 })],
  exchange_rate: [v.required('Exchange rate is required.'), v.number({ min: 0.000001, message: 'Exchange rate must be positive.' })]
}), async (req: AuthenticatedRequest, res, next) => {
  try {
    const { code, symbol, name, exchange_rate, decimal_precision, is_base } = req.body;

    const created = await currenciesRepo.upsert({
      code: code.toUpperCase().trim(),
      symbol: symbol.trim(),
      name: name.trim(),
      exchange_rate: parseFloat(exchange_rate),
      decimal_precision: decimal_precision ? parseInt(decimal_precision, 10) : 2,
      is_base: Boolean(is_base)
    });

    await auditRepo.log(req.user || null, 'CREATE_CURRENCY', 'currency', created.code, { name });
    res.status(201).json({ success: true, code: created.code, currency: created });
  } catch (err) {
    next(err);
  }
});
