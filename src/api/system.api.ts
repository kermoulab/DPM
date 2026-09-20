import { request } from './client';
import type {
  DashboardStats,
  NotificationTemplate,
  Currency,
  User,
  PairedDevice,
  AuditLog
} from '../types';

export const systemApi = {
  // ── Installer ──────────────────────────────────────────────────────────────
  getInstallStatus() {
    return request<{
      installed: boolean;
      installState: 'not_installed' | 'installing' | 'installed' | 'upgrade_required';
      upgradeRequired: boolean;
      pendingMigrations: number;
      dbConfigured: boolean;
      requirements: {
        nodeVersion: string;
        nodeOk: boolean;
        postgresReady: boolean;
        cryptoAvailable: boolean;
      };
    }>('/api/install/status');
  },

  testConnection(databaseUrl: string) {
    return request<{ success: boolean; message?: string; maskedUrl?: string; alreadyInstalled?: boolean; hint?: string; error?: string }>(
      '/api/install/test-connection',
      { method: 'POST', body: JSON.stringify({ databaseUrl }) }
    );
  },

  configureDb(databaseUrl: string) {
    return request<{ success: boolean; message?: string; maskedUrl?: string; alreadyInstalled?: boolean; error?: string }>(
      '/api/install/configure-db',
      { method: 'POST', body: JSON.stringify({ databaseUrl }) }
    );
  },

  runMigrations() {
    return request<{ success: boolean; applied: string[]; alreadyUpToDate: boolean; alreadyInstalled?: boolean; message?: string; error?: string }>(
      '/api/install/run-migrations',
      { method: 'POST' }
    );
  },

  createAdmin(payload: {
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
    companyName?: string;
    baseCurrency?: string;
    currencySymbol?: string;
    supportPhone?: string;
  }) {
    return request<{ success: boolean; message?: string; alreadyInstalled?: boolean; error?: string }>(
      '/api/install/create-admin',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  finalizeInstall() {
    return request<{ success: boolean; token: string; user: User; message?: string }>(
      '/api/install/finalize',
      { method: 'POST' }
    );
  },

  testDb() {
    return request<{ success: boolean; message?: string }>('/api/install/test-db', { method: 'POST' });
  },

  runInstall(payload: any) {
    return request<{ success: boolean; token: string; user: User }>('/api/install/setup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Dashboard
  getDashboardStats() {
    return request<DashboardStats>('/api/dashboard/stats');
  },

  // Alerts
  getAlerts() {
    return request<{
      badgeCount: number;
      expiringOrders: any[];
      expiredOrders: any[];
      lowStockAccounts: any[];
      lowInventory: any[];
    }>('/api/alerts');
  },

  // WhatsApp
  getWhatsAppTemplates() {
    return request<{ templates: NotificationTemplate[] }>('/api/whatsapp/templates');
  },
  saveWhatsAppTemplate(payload: any) {
    return request<{ success: boolean; id: string; template?: NotificationTemplate }>('/api/whatsapp/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  deleteWhatsAppTemplate(id: string) {
    return request<{ success: boolean }>(`/api/whatsapp/templates/${id}`, {
      method: 'DELETE'
    });
  },
  composeWhatsApp(payload: {
    order_id: string;
    template_id?: string;
    language?: string;
    event_type?: string;
    phone?: string;
    save_phone?: boolean;
  }) {
    return request<{ phone: string; cleanPhone: string; message: string; waUrl: string | null }>('/api/whatsapp/compose', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Currencies
  getCurrencies() {
    return request<{ currencies: Currency[] }>('/api/currencies');
  },
  updateCurrency(code: string, payload: any) {
    return request<{ success: boolean }>(`/api/currencies/${code}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  createCurrency(payload: any) {
    return request<{ success: boolean; code: string }>('/api/currencies', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Users
  getUsers() {
    return request<{ users: User[] }>('/api/users');
  },
  createUser(payload: any) {
    return request<{ success: boolean; id: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateUser(id: string, payload: any) {
    return request<{ success: boolean }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteUser(id: string) {
    return request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' });
  },

  // Devices
  getDevices() {
    return request<{ devices: PairedDevice[] }>('/api/devices');
  },
  generatePairingCode() {
    return request<{ success: boolean; deviceId: string; pairingCode: string; expiresAt: string; qrDataUrl: string }>('/api/devices/generate-pairing-code', {
      method: 'POST'
    });
  },
  confirmPair(deviceId: string, deviceName?: string) {
    return request<{ success: boolean; device: any }>('/api/devices/confirm-pair', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, device_name: deviceName })
    });
  },
  revokeDevice(deviceId: string) {
    return request<{ success: boolean; message?: string; unpaired?: boolean }>(`/api/devices/${deviceId}`, { method: 'DELETE' });
  },

  // Audit
  getAuditLogs(params?: { entity?: string; action?: string; limit?: number }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ logs: AuditLog[] }>(`/api/audit?${query}`);
  },

  // Settings
  getSettings() {
    return request<{ settings: Record<string, string> }>('/api/settings');
  },
  updateSettings(settings: Record<string, string>) {
    return request<{ success: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // Search
  search(q: string) {
    return request<{ results: Array<{ id: string; title: string; subtitle: string; type: string; route: string }> }>(`/api/search?q=${encodeURIComponent(q)}`);
  }
};
