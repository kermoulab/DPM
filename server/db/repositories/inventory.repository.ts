import { query } from '../connection/pool.js';

export interface ServiceAccountRow {
  id: string;
  product_id: string;
  product_name?: string;
  provider: string;
  login: string;
  encrypted_credential: string;
  iv: string;
  tag: string;
  status: string;
  expiry_date?: string | null;
  capacity: number;
  notes?: string | null;
  created_at: string;
  profile_count?: number;
  available_profiles?: number;
}

export interface ServiceProfileRow {
  id: string;
  service_account_id: string;
  profile_name: string;
  pin?: string | null;
  status: string;
  assigned_customer_id?: string | null;
  customer_name?: string | null;
  assigned_order_id?: string | null;
  created_at: string;
}

export interface LicenseKeyRow {
  id: string;
  product_id: string;
  product_name?: string;
  license_key: string;
  status: string;
  assigned_order_id?: string | null;
  assigned_customer_id?: string | null;
  customer_name?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
  created_at: string;
}

export class InventoryRepository {
  // Service Accounts
  async findAccounts(filters?: { product_id?: string; status?: string }): Promise<ServiceAccountRow[]> {
    let sql = `
      SELECT sa.*, p.name as product_name,
             COUNT(sp.id)::int as profile_count,
             COUNT(CASE WHEN sp.status = 'available' THEN 1 END)::int as available_profiles
      FROM service_accounts sa
      JOIN products p ON p.id = sa.product_id
      LEFT JOIN service_profiles sp ON sp.service_account_id = sa.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.product_id) {
      sql += ` AND sa.product_id = $${idx++}`;
      params.push(filters.product_id);
    }
    if (filters?.status) {
      sql += ` AND sa.status = $${idx++}`;
      params.push(filters.status);
    }

    sql += ' GROUP BY sa.id, p.id ORDER BY sa.created_at DESC';
    const res = await query<ServiceAccountRow>(sql, params);
    return res.rows;
  }

  async findAccountById(id: string): Promise<ServiceAccountRow | null> {
    const res = await query<ServiceAccountRow>(
      `SELECT sa.*, p.name as product_name
       FROM service_accounts sa
       JOIN products p ON p.id = sa.product_id
       WHERE sa.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async createAccount(acc: Omit<ServiceAccountRow, 'created_at'>): Promise<ServiceAccountRow> {
    const res = await query<ServiceAccountRow>(
      `INSERT INTO service_accounts (
         id, product_id, provider, login, encrypted_credential, iv, tag, status, expiry_date, capacity, notes, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        acc.id, acc.product_id, acc.provider, acc.login, acc.encrypted_credential,
        acc.iv, acc.tag, acc.status || 'active', acc.expiry_date || null,
        acc.capacity || 5, acc.notes || null
      ]
    );
    return res.rows[0];
  }

  async updateAccount(id: string, updates: Partial<ServiceAccountRow>): Promise<ServiceAccountRow | null> {
    const res = await query<ServiceAccountRow>(
      `UPDATE service_accounts
       SET provider = COALESCE($1, provider),
           login = COALESCE($2, login),
           encrypted_credential = COALESCE($3, encrypted_credential),
           iv = COALESCE($4, iv),
           tag = COALESCE($5, tag),
           status = COALESCE($6, status),
           expiry_date = COALESCE($7, expiry_date),
           capacity = COALESCE($8, capacity),
           notes = COALESCE($9, notes)
       WHERE id = $10
       RETURNING *`,
      [
        updates.provider ?? null, updates.login ?? null, updates.encrypted_credential ?? null,
        updates.iv ?? null, updates.tag ?? null, updates.status ?? null,
        updates.expiry_date ?? null, updates.capacity ?? null, updates.notes ?? null, id
      ]
    );
    return res.rows[0] || null;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const res = await query('DELETE FROM service_accounts WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }

  // Service Profiles
  async findProfilesByAccountId(accountId: string): Promise<ServiceProfileRow[]> {
    const res = await query<ServiceProfileRow>(
      `SELECT sp.*, c.name as customer_name
       FROM service_profiles sp
       LEFT JOIN customers c ON c.id = sp.assigned_customer_id
       WHERE sp.service_account_id = $1
       ORDER BY sp.profile_name ASC`,
      [accountId]
    );
    return res.rows;
  }

  async createProfile(prof: { id: string; service_account_id: string; profile_name: string; pin?: string; status?: string }): Promise<ServiceProfileRow> {
    const res = await query<ServiceProfileRow>(
      `INSERT INTO service_profiles (id, service_account_id, profile_name, pin, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [prof.id, prof.service_account_id, prof.profile_name, prof.pin || null, prof.status || 'available']
    );
    return res.rows[0];
  }

  async updateProfile(id: string, updates: Partial<ServiceProfileRow>): Promise<ServiceProfileRow | null> {
    const res = await query<ServiceProfileRow>(
      `UPDATE service_profiles
       SET profile_name = COALESCE($1, profile_name),
           pin = COALESCE($2, pin),
           status = COALESCE($3, status),
           assigned_customer_id = $4,
           assigned_order_id = $5
       WHERE id = $6
       RETURNING *`,
      [
        updates.profile_name ?? null, updates.pin ?? null, updates.status ?? null,
        updates.assigned_customer_id !== undefined ? updates.assigned_customer_id : null,
        updates.assigned_order_id !== undefined ? updates.assigned_order_id : null,
        id
      ]
    );
    return res.rows[0] || null;
  }

  // License Keys
  async findLicenses(filters?: { product_id?: string; status?: string }): Promise<LicenseKeyRow[]> {
    let sql = `
      SELECT lk.*, p.name as product_name, c.name as customer_name
      FROM license_keys lk
      JOIN products p ON p.id = lk.product_id
      LEFT JOIN customers c ON c.id = lk.assigned_customer_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (filters?.product_id) {
      sql += ` AND lk.product_id = $${idx++}`;
      params.push(filters.product_id);
    }
    if (filters?.status) {
      sql += ` AND lk.status = $${idx++}`;
      params.push(filters.status);
    }

    sql += ' ORDER BY lk.created_at DESC';
    const res = await query<LicenseKeyRow>(sql, params);
    return res.rows;
  }

  async createLicense(lic: { id: string; product_id: string; license_key: string; expiry_date?: string; notes?: string }): Promise<LicenseKeyRow> {
    const res = await query<LicenseKeyRow>(
      `INSERT INTO license_keys (id, product_id, license_key, status, expiry_date, notes, created_at)
       VALUES ($1, $2, $3, 'available', $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [lic.id, lic.product_id, lic.license_key, lic.expiry_date || null, lic.notes || null]
    );
    return res.rows[0];
  }

  async deleteLicense(id: string): Promise<boolean> {
    const res = await query('DELETE FROM license_keys WHERE id = $1', [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const inventoryRepo = new InventoryRepository();
