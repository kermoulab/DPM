import { Router } from 'express';
import crypto from 'crypto';
import { testConnection, transaction } from '../db/connection/pool.js';
import { systemSettingsRepo } from '../db/repositories/system-settings.repository.js';
import { usersRepo } from '../db/repositories/users.repository.js';
import { hashPassword } from '../utils/crypto.js';
import { createSessionToken } from '../middleware/auth.middleware.js';
import { auditRepo } from '../db/repositories/audit.repository.js';

export const installRouter = Router();

// GET /api/install/status
installRouter.get('/status', async (req, res, next) => {
  try {
    const isInstalled = await systemSettingsRepo.isInstalled();
    const dbTest = await testConnection();

    res.json({
      installed: isInstalled,
      requirements: {
        nodeVersion: process.version,
        nodeOk: parseInt(process.version.slice(1).split('.')[0], 10) >= 18,
        postgresReady: dbTest.ok,
        cryptoAvailable: Boolean(crypto.randomUUID)
      }
    });
  } catch (err) {
    // If table doesn't exist yet, it's not installed
    res.json({
      installed: false,
      requirements: {
        nodeVersion: process.version,
        nodeOk: true,
        postgresReady: false,
        cryptoAvailable: true
      }
    });
  }
});

// POST /api/install/test-db
installRouter.post('/test-db', async (req, res, next) => {
  try {
    const test = await testConnection();
    if (test.ok) {
      res.json({ success: true, message: `PostgreSQL connection verified (latency: ${test.latencyMs}ms).` });
    } else {
      res.status(500).json({ error: test.error || 'PostgreSQL connection failed.' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Database test failed.' });
  }
});

// POST /api/install/setup
installRouter.post('/setup', async (req, res, next) => {
  try {
    const alreadyInstalled = await systemSettingsRepo.isInstalled();
    if (alreadyInstalled) {
      res.status(403).json({ error: 'System is already installed. Setup wizard is locked.' });
      return;
    }

    const {
      adminUsername,
      adminEmail,
      adminName,
      adminPassword,
      companyName,
      baseCurrency,
      currencySymbol,
      supportPhone
    } = req.body;

    if (!adminUsername || !adminEmail || !adminPassword) {
      res.status(400).json({ error: 'Administrator username, email, and password are required.' });
      return;
    }

    if (adminPassword.length < 8) {
      res.status(400).json({ error: 'Administrator password must be at least 8 characters.' });
      return;
    }

    const adminId = crypto.randomUUID();
    const { hash, salt } = hashPassword(adminPassword);

    await transaction(async (client) => {
      // 1. Create Owner User
      await client.query(
        `INSERT INTO users (id, username, email, name, password_hash, password_salt, role, status, preferred_currency, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'owner', 'active', $7, CURRENT_TIMESTAMP)`,
        [
          adminId,
          adminUsername.trim(),
          adminEmail.trim().toLowerCase(),
          (adminName && adminName.trim()) || 'Administrator',
          hash,
          salt,
          (baseCurrency && baseCurrency.trim().toUpperCase()) || 'USD'
        ]
      );

      // 2. Save System Settings
      const settings = [
        ['installed', 'true'],
        ['company_name', (companyName && companyName.trim()) || 'DPM Reseller Hub'],
        ['base_currency', (baseCurrency && baseCurrency.trim().toUpperCase()) || 'USD'],
        ['currency_symbol', (currencySymbol && currencySymbol.trim()) || '$'],
        ['support_phone', (supportPhone && supportPhone.trim()) || '']
      ];

      for (const [k, v] of settings) {
        await client.query(
          `INSERT INTO system_settings (key, value, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
          [k, v]
        );
      }

      // 3. Seed base currencies
      const defaultCurrencies = [
        ['USD', '$', 'US Dollar', 1.0, 2, true],
        ['EUR', '€', 'Euro', 0.92, 2, false],
        ['GBP', '£', 'British Pound', 0.78, 2, false],
        ['AED', 'AED', 'UAE Dirham', 3.67, 2, false],
        ['SAR', 'SAR', 'Saudi Riyal', 3.75, 2, false],
        ['CAD', 'CA$', 'Canadian Dollar', 1.35, 2, false]
      ];

      for (const [code, symbol, name, rate, prec, isBase] of defaultCurrencies) {
        await client.query(
          `INSERT INTO currencies (code, symbol, name, exchange_rate, decimal_precision, is_base, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (code) DO NOTHING`,
          [code, symbol, name, rate, prec, isBase]
        );
      }
    });

    const authUser = {
      id: adminId,
      username: adminUsername.trim(),
      email: adminEmail.trim().toLowerCase(),
      name: (adminName && adminName.trim()) || 'Administrator',
      role: 'owner' as const,
      preferred_currency: (baseCurrency && baseCurrency.trim().toUpperCase()) || 'USD'
    };

    const token = createSessionToken(authUser);
    await auditRepo.log(authUser, 'SYSTEM_INSTALLED', 'system', null, { companyName });

    res.json({
      success: true,
      token,
      user: authUser
    });
  } catch (err: any) {
    next(err);
  }
});
