import { request } from './client';
import type { ServiceAccount, LicenseKey } from '../types';

export const inventoryApi = {
  getAccounts(params?: { product_id?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ accounts: ServiceAccount[] }>(`/api/inventory/accounts?${query}`);
  },

  getAccountProfiles(accountId: string) {
    return request<{ profiles: any[] }>(`/api/inventory/accounts/${accountId}/profiles`);
  },

  revealCredentials(accountId: string) {
    return request<{ login: string; password: string; provider: string }>(`/api/inventory/accounts/${accountId}/reveal-credentials`, {
      method: 'POST'
    });
  },

  createAccount(payload: any) {
    return request<{ success: boolean; id: string }>('/api/inventory/accounts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  updateProfile(id: string, payload: any) {
    return request<{ success: boolean }>(`/api/inventory/profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  updateAccount(id: string, payload: any) {
    return request<{ success: boolean; message?: string }>(`/api/inventory/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  deleteAccount(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/inventory/accounts/${id}`, { method: 'DELETE' });
  },

  getLicenses(params?: { product_id?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ licenses: LicenseKey[] }>(`/api/inventory/licenses?${query}`);
  },

  addLicenses(payload: { product_id: string; keys: string | string[]; expiry_date?: string; notes?: string }) {
    return request<{ success: boolean; count: number }>('/api/inventory/licenses', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  deleteLicense(id: string) {
    return request<{ success: boolean }>(`/api/inventory/licenses/${id}`, { method: 'DELETE' });
  }
};
