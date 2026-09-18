import crypto from 'crypto';
import { transaction } from '../db/connection/pool.js';
import { inventoryRepo, type ServiceAccountRow } from '../db/repositories/inventory.repository.js';
import { encryptCredential, decryptCredential } from '../utils/crypto.js';
import { auditRepo } from '../db/repositories/audit.repository.js';

export class InventoryService {
  async revealCredentials(accountId: string, user?: any, ip: string = '127.0.0.1'): Promise<{ login: string; password: string; provider: string }> {
    const account = await inventoryRepo.findAccountById(accountId);
    if (!account) {
      const err = new Error('Service account not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    const password = decryptCredential(account.encrypted_credential, account.iv, account.tag);
    await auditRepo.log(user || null, 'REVEAL_CREDENTIALS', 'service_account', accountId, { provider: account.provider }, ip);

    return {
      login: account.login,
      password,
      provider: account.provider
    };
  }

  async createAccount(payload: {
    product_id: string;
    provider: string;
    login: string;
    password: string;
    capacity?: number;
    expiry_date?: string;
    notes?: string;
    create_profiles?: boolean;
    profile_names?: string[];
  }, user?: any): Promise<ServiceAccountRow> {
    const enc = encryptCredential(payload.password);
    const accountId = 'acc-' + crypto.randomUUID().slice(0, 8);
    const capacity = payload.capacity || 5;

    const account = await transaction(async (client) => {
      const accRes = await client.query<ServiceAccountRow>(
        `INSERT INTO service_accounts (
           id, product_id, provider, login, encrypted_credential, iv, tag, status, expiry_date, capacity, notes, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          accountId, payload.product_id, payload.provider, payload.login, enc.encrypted,
          enc.iv, enc.tag, 'active', payload.expiry_date || null,
          capacity, payload.notes || null
        ]
      );

      // Auto-create initial profiles atomically
      if (payload.create_profiles) {
        const profileNames = payload.profile_names || [];
        for (let i = 1; i <= capacity; i++) {
          const pName = profileNames[i - 1] || `Profile ${i}`;
          await client.query(
            `INSERT INTO service_profiles (id, service_account_id, profile_name, status, created_at)
             VALUES ($1, $2, $3, 'available', CURRENT_TIMESTAMP)`,
            ['prof-' + crypto.randomUUID().slice(0, 8), accountId, pName]
          );
        }
      }

      return accRes.rows[0];
    });

    await auditRepo.log(user || null, 'CREATE_SERVICE_ACCOUNT', 'service_account', accountId, { provider: payload.provider });
    return account;
  }

  async addLicenses(payload: {
    product_id: string;
    keys: string | string[];
    expiry_date?: string;
    notes?: string;
  }, user?: any): Promise<{ count: number }> {
    const rawKeys = Array.isArray(payload.keys)
      ? payload.keys
      : String(payload.keys || '').split(/[\r\n,]+/).map((k) => k.trim()).filter(Boolean);

    const result = await transaction(async (client) => {
      let count = 0;
      for (const key of rawKeys) {
        await client.query(
          `INSERT INTO license_keys (id, product_id, license_key, status, expiry_date, notes, created_at)
           VALUES ($1, $2, $3, 'available', $4, $5, CURRENT_TIMESTAMP)`,
          ['lic-' + crypto.randomUUID().slice(0, 8), payload.product_id, key, payload.expiry_date || null, payload.notes || null]
        );
        count++;
      }
      return { count };
    });

    await auditRepo.log(user || null, 'ADD_LICENSES', 'license_keys', null, { product_id: payload.product_id, count: result.count });
    return result;
  }
}

export const inventoryService = new InventoryService();
