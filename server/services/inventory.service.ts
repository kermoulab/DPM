import crypto from 'crypto';
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

    const account = await inventoryRepo.createAccount({
      id: accountId,
      product_id: payload.product_id,
      provider: payload.provider,
      login: payload.login,
      encrypted_credential: enc.encrypted,
      iv: enc.iv,
      tag: enc.tag,
      status: 'active',
      capacity,
      expiry_date: payload.expiry_date || null,
      notes: payload.notes || null
    });

    // Auto-create initial profiles if requested
    if (payload.create_profiles) {
      const profileNames = payload.profile_names || [];
      for (let i = 1; i <= capacity; i++) {
        const pName = profileNames[i - 1] || `Profile ${i}`;
        await inventoryRepo.createProfile({
          id: 'prof-' + crypto.randomUUID().slice(0, 8),
          service_account_id: accountId,
          profile_name: pName,
          status: 'available'
        });
      }
    }

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

    let count = 0;
    for (const key of rawKeys) {
      await inventoryRepo.createLicense({
        id: 'lic-' + crypto.randomUUID().slice(0, 8),
        product_id: payload.product_id,
        license_key: key,
        expiry_date: payload.expiry_date || null,
        notes: payload.notes || null
      });
      count++;
    }

    await auditRepo.log(user || null, 'ADD_LICENSES', 'license_keys', null, { product_id: payload.product_id, count });
    return { count };
  }
}

export const inventoryService = new InventoryService();
