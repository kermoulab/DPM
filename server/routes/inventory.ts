import { Router } from 'express';
import crypto from 'crypto';
import { db, logAudit } from '../db.js';
import { requireAuth, requireRole, encryptCredential, decryptCredential, maskSecret, type AuthenticatedRequest } from '../security.js';

export const inventoryRouter = Router();

// -------------------------------------------------------------
// SERVICE ACCOUNTS & PROFILES
// -------------------------------------------------------------

// List service accounts with profiles count and status
inventoryRouter.get('/accounts', requireAuth, (req, res) => {
  const { product_id, status } = req.query;

  let query = `
    SELECT 
      sa.*,
      p.name as product_name,
      p.brand as product_brand,
      COUNT(sp.id) as total_profiles,
      COUNT(CASE WHEN sp.status = 'available' THEN 1 END) as available_profiles,
      COUNT(CASE WHEN sp.status = 'assigned' THEN 1 END) as assigned_profiles
    FROM service_accounts sa
    JOIN products p ON p.id = sa.product_id
    LEFT JOIN service_profiles sp ON sp.service_account_id = sa.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (product_id) {
    query += ` AND sa.product_id = ?`;
    params.push(product_id);
  }

  if (status) {
    query += ` AND sa.status = ?`;
    params.push(status);
  }

  query += ` GROUP BY sa.id ORDER BY sa.created_at DESC`;

  const rawAccounts = db.prepare(query).all(...params) as any[];

  // Redact raw encrypted credentials in list view for security (Rule 4)
  const accounts = rawAccounts.map(a => ({
    id: a.id,
    product_id: a.product_id,
    product_name: a.product_name,
    product_brand: a.product_brand,
    provider: a.provider,
    login: a.login,
    has_credential: Boolean(a.encrypted_credential),
    credential_masked: '••••••••••••',
    status: a.status,
    expiry_date: a.expiry_date,
    capacity: a.capacity,
    notes: a.notes,
    total_profiles: a.total_profiles,
    available_profiles: a.available_profiles,
    assigned_profiles: a.assigned_profiles,
    created_at: a.created_at
  }));

  res.json({ accounts });
});

// Reveal service account credentials (authorized only, audit logged)
inventoryRouter.post('/accounts/:id/reveal-credentials', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const account = db.prepare('SELECT id, provider, login, encrypted_credential, iv, tag FROM service_accounts WHERE id = ?').get(id) as any;
  if (!account) {
    return res.status(404).json({ error: 'Service account not found.' });
  }

  const decryptedPassword = decryptCredential(account.encrypted_credential, account.iv, account.tag);

  logAudit(req.user || null, 'REVEAL_CREDENTIALS', 'service_account', id, { login: account.login });

  res.json({
    login: account.login,
    password: decryptedPassword,
    provider: account.provider
  });
});

// Get profiles for a service account
inventoryRouter.get('/accounts/:id/profiles', requireAuth, (req, res) => {
  const { id } = req.params;

  const profiles = db.prepare(`
    SELECT 
      sp.*,
      c.name as customer_name,
      c.whatsapp as customer_whatsapp
    FROM service_profiles sp
    LEFT JOIN customers c ON c.id = sp.assigned_customer_id
    WHERE sp.service_account_id = ?
    ORDER BY sp.profile_name ASC
  `).all(id);

  res.json({ profiles });
});

// Create service account + auto-generate profiles
inventoryRouter.post('/accounts', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { product_id, provider, login, password, capacity, expiry_date, notes, profile_names } = req.body;

  if (!product_id || !login?.trim() || !password) {
    return res.status(400).json({ error: 'Product, login, and password are required.' });
  }

  const id = 'sa-' + crypto.randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  const cap = Number(capacity) || 5;

  const { encrypted, iv, tag } = encryptCredential(password);

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      INSERT INTO service_accounts (id, product_id, provider, login, encrypted_credential, iv, tag, status, expiry_date, capacity, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
    `).run(id, product_id, provider?.trim() || 'Provider', login.trim(), encrypted, iv, tag, expiry_date || null, cap, notes?.trim() || null, now);

    // Auto generate profile slots
    const names = Array.isArray(profile_names) && profile_names.length > 0 
      ? profile_names 
      : Array.from({ length: cap }, (_, i) => `Profile ${i + 1}`);

    for (let i = 0; i < cap; i++) {
      const pName = names[i] || `Profile ${i + 1}`;
      const profId = 'prof-' + crypto.randomUUID().slice(0, 8);
      const pin = String(Math.floor(1000 + Math.random() * 9000));
      db.prepare(`
        INSERT INTO service_profiles (id, service_account_id, profile_name, pin, status, created_at)
        VALUES (?, ?, ?, ?, 'available', ?)
      `).run(profId, id, pName, pin, now);
    }

    db.exec('COMMIT;');
    logAudit(req.user || null, 'CREATE_SERVICE_ACCOUNT', 'service_account', id, { login, capacity: cap, product_id });

    res.status(201).json({ success: true, id, login, capacity: cap });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Failed to create service account: ' + err.message });
  }
});

// Update profile status or details
inventoryRouter.put('/profiles/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { profile_name, pin, status, assigned_customer_id } = req.body;

  db.prepare(`
    UPDATE service_profiles
    SET profile_name = COALESCE(?, profile_name),
        pin = COALESCE(?, pin),
        status = COALESCE(?, status),
        assigned_customer_id = CASE WHEN ? IS NOT NULL THEN ? ELSE assigned_customer_id END
    WHERE id = ?
  `).run(profile_name, pin, status, assigned_customer_id !== undefined ? 1 : null, assigned_customer_id, id);

  logAudit(req.user || null, 'UPDATE_PROFILE', 'service_profile', id, { status });
  res.json({ success: true, message: 'Profile updated.' });
});

// Update service account
inventoryRouter.put('/accounts/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { product_id, provider, login, password, status, expiry_date, notes, capacity } = req.body;

  const existing = db.prepare('SELECT * FROM service_accounts WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Service account not found.' });
  }

  let encrypted = existing.encrypted_credential;
  let iv = existing.iv;
  let tag = existing.tag;

  if (password && password.trim()) {
    const cred = encryptCredential(password.trim());
    encrypted = cred.encrypted;
    iv = cred.iv;
    tag = cred.tag;
  }

  const updatedCapacity = capacity !== undefined && Number(capacity) > 0 ? Number(capacity) : existing.capacity;

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare(`
      UPDATE service_accounts
      SET product_id = COALESCE(?, product_id),
          provider = COALESCE(?, provider),
          login = COALESCE(?, login),
          encrypted_credential = ?,
          iv = ?,
          tag = ?,
          status = COALESCE(?, status),
          expiry_date = CASE WHEN ? = 1 THEN ? ELSE expiry_date END,
          notes = CASE WHEN ? = 1 THEN ? ELSE notes END,
          capacity = ?
      WHERE id = ?
    `).run(
      product_id || null,
      provider?.trim() || null,
      login?.trim() || null,
      encrypted,
      iv,
      tag,
      status || null,
      expiry_date !== undefined ? 1 : 0,
      expiry_date ? expiry_date : null,
      notes !== undefined ? 1 : 0,
      notes?.trim() || null,
      updatedCapacity,
      id
    );

    // If capacity was increased, generate additional profile slots
    if (updatedCapacity > existing.capacity) {
      const currentProfiles = db.prepare('SELECT COUNT(*) as count FROM service_profiles WHERE service_account_id = ?').get(id) as any;
      const count = currentProfiles?.count || 0;
      const now = new Date().toISOString();
      for (let i = count + 1; i <= updatedCapacity; i++) {
        const profId = 'prof-' + crypto.randomUUID().slice(0, 8);
        const pin = String(Math.floor(1000 + Math.random() * 9000));
        db.prepare(`
          INSERT INTO service_profiles (id, service_account_id, profile_name, pin, status, created_at)
          VALUES (?, ?, ?, ?, 'available', ?)
        `).run(profId, id, `Profile ${i}`, pin, now);
      }
    }

    db.exec('COMMIT;');
    logAudit(req.user || null, 'UPDATE_SERVICE_ACCOUNT', 'service_account', id, { login: login || existing.login, status });
    res.json({ success: true, message: 'Service account updated successfully.' });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Failed to update service account: ' + err.message });
  }
});

// Delete service account
inventoryRouter.delete('/accounts/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id, login FROM service_accounts WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Service account not found.' });
  }

  // Restrict deleting service accounts with assigned profiles
  const assigned = db.prepare(`
    SELECT COUNT(*) as count 
    FROM service_profiles 
    WHERE service_account_id = ? 
      AND (status = 'assigned' OR assigned_customer_id IS NOT NULL OR assigned_order_id IS NOT NULL)
  `).get(id) as any;

  if (assigned?.count > 0) {
    return res.status(400).json({ 
      error: `Cannot delete service account "${existing.login}". It has ${assigned.count} active assigned profile(s). Please unassign or cancel the associated subscriptions before deleting this account.` 
    });
  }

  db.exec('BEGIN TRANSACTION;');
  try {
    db.prepare('DELETE FROM service_profiles WHERE service_account_id = ?').run(id);
    db.prepare('DELETE FROM service_accounts WHERE id = ?').run(id);
    db.exec('COMMIT;');
    logAudit(req.user || null, 'DELETE_SERVICE_ACCOUNT', 'service_account', id, { login: existing.login });
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Failed to delete service account: ' + err.message });
  }
});

// -------------------------------------------------------------
// LICENSE KEYS & ACTIVATION CODES
// -------------------------------------------------------------

// List license keys with filters
inventoryRouter.get('/licenses', requireAuth, (req, res) => {
  const { product_id, status } = req.query;

  let query = `
    SELECT 
      lk.*,
      p.name as product_name,
      p.brand as product_brand,
      c.name as customer_name
    FROM license_keys lk
    JOIN products p ON p.id = lk.product_id
    LEFT JOIN customers c ON c.id = lk.assigned_customer_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (product_id) {
    query += ` AND lk.product_id = ?`;
    params.push(product_id);
  }

  if (status) {
    query += ` AND lk.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY lk.created_at DESC LIMIT 100`;

  const licenses = db.prepare(query).all(...params);
  res.json({ licenses });
});

// Add license keys (supports single key or bulk multi-line keys)
inventoryRouter.post('/licenses', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { product_id, keys, expiry_date, notes } = req.body;

  if (!product_id || !keys) {
    return res.status(400).json({ error: 'Product and license keys are required.' });
  }

  const keyList = (Array.isArray(keys) ? keys : String(keys).split('\n'))
    .map((k: string) => k.trim())
    .filter((k: string) => k.length > 0);

  if (keyList.length === 0) {
    return res.status(400).json({ error: 'At least one valid license key is required.' });
  }

  const now = new Date().toISOString();
  let insertedCount = 0;

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const key of keyList) {
      const id = 'lic-' + crypto.randomUUID().slice(0, 8);
      db.prepare(`
        INSERT INTO license_keys (id, product_id, license_key, status, expiry_date, notes, created_at)
        VALUES (?, ?, ?, 'available', ?, ?, ?)
      `).run(id, product_id, key, expiry_date || null, notes?.trim() || null, now);
      insertedCount++;
    }

    db.exec('COMMIT;');
    logAudit(req.user || null, 'ADD_LICENSES', 'license_keys', null, { count: insertedCount, product_id });

    res.status(201).json({ success: true, count: insertedCount, message: `Added ${insertedCount} license key(s).` });
  } catch (err: any) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: 'Failed to insert licenses: ' + err.message });
  }
});

// Delete license key
inventoryRouter.delete('/licenses/:id', requireAuth, requireRole('manager'), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const item = db.prepare('SELECT status FROM license_keys WHERE id = ?').get(id) as any;
  if (item?.status === 'assigned') {
    return res.status(400).json({ error: 'Cannot delete an assigned license key.' });
  }
  db.prepare('DELETE FROM license_keys WHERE id = ?').run(id);
  logAudit(req.user || null, 'DELETE_LICENSE', 'license_keys', id, {});
  res.json({ success: true, message: 'License key removed.' });
});
