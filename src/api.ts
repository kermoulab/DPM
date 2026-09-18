import type { 
  User, 
  DashboardStats, 
  Category, 
  Product, 
  Plan, 
  Customer, 
  ServiceAccount, 
  LicenseKey, 
  Order, 
  OrderRenewal, 
  Currency, 
  NotificationTemplate, 
  PairedDevice, 
  AuditLog 
} from './types';

const TOKEN_KEY = 'erp_session_token';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  const contentType = res.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`Server returned error ${res.status}: ${rawText.slice(0, 150)}`);
    }
    throw new Error(`Invalid response format from server (${res.status})`);
  }

  if (!res.ok) {
    if (res.status === 401 && !endpoint.includes('/api/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  hasSession(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  },

  request,

  // Installer
  getInstallStatus() {
    return request<{ installed: boolean; requirements: any }>('/api/install/status');
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

  // Auth
  login(credentials: { username: string; password: string }) {
    return request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  },
  getMe() {
    return request<{ user: User }>('/api/auth/me');
  },
  updateMyProfile(payload: {
    name: string;
    username: string;
    email: string;
    preferred_currency?: string;
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }) {
    return request<{ success: boolean; message: string; user: User; token: string }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  updatePreferredCurrency(currency: string) {
    return request<{ success: boolean; preferred_currency: string; message: string }>('/api/auth/currency', {
      method: 'PUT',
      body: JSON.stringify({ currency })
    });
  },
  async logout() {
    try {
      await request<{ success: boolean }>('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearToken();
    }
    return { success: true };
  },
  changePassword(passwords: { currentPassword: string; newPassword: string }) {
    return request<{ success: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords)
    });
  },

  // Dashboard
  getDashboardStats() {
    return request<DashboardStats>('/api/dashboard/stats');
  },

  // Categories
  getCategories() {
    return request<{ categories: Category[] }>('/api/categories');
  },
  createCategory(payload: { name: string; icon?: string; description?: string }) {
    return request<{ success: boolean; id: string }>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateCategory(id: string, payload: any) {
    return request<{ success: boolean }>('/api/categories/' + id, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteCategory(id: string, mode?: 'move_to_general' | 'unassign_plans') {
    const query = mode ? `?mode=${encodeURIComponent(mode)}` : '';
    return request<{ success: boolean; message?: string }>('/api/categories/' + id + query, { method: 'DELETE' });
  },
  getCategoryPlans(id: string) {
    return request<{ plans: Plan[] }>(`/api/categories/${id}/plans`);
  },

  // Products
  getProducts(params?: { category_id?: string; search?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ products: Product[] }>(`/api/products?${query}`);
  },
  getProduct(id: string) {
    return request<{ product: Product; plans: Plan[]; inventorySummary: any }>(`/api/products/${id}`);
  },
  createProduct(payload: any) {
    return request<{ success: boolean; id: string }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateProduct(id: string, payload: any) {
    return request<{ success: boolean }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteProduct(id: string) {
    return request<{ success: boolean; message?: string }>(`/api/products/${id}`, { method: 'DELETE' });
  },

  // Plans
  getPlans(product_id?: string) {
    const query = product_id ? `?product_id=${product_id}` : '';
    return request<{ plans: Plan[] }>(`/api/plans${query}`);
  },
  calculateDates(plan_id: string, start_date?: string) {
    return request<{
      start_date: string;
      end_date: string;
      duration: number;
      duration_unit: string;
      price: number;
      cost: number;
      currency: string;
    }>('/api/plans/calculate-dates', {
      method: 'POST',
      body: JSON.stringify({ plan_id, start_date })
    });
  },
  createPlan(payload: any) {
    return request<{ success: boolean; id: string }>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updatePlan(id: string, payload: any) {
    return request<{ success: boolean }>(`/api/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deletePlan(id: string) {
    return request<{ success: boolean }>(`/api/plans/${id}`, { method: 'DELETE' });
  },

  // Customers
  getCustomers(params?: { search?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{ customers: Customer[] }>(`/api/customers?${query}`);
  },
  getCustomer(id: string) {
    return request<{ customer: Customer; orders: Order[]; auditLogs: any[] }>(`/api/customers/${id}`);
  },
  createCustomer(payload: { name: string; email?: string; whatsapp?: string; notes?: string }) {
    return request<{ success: boolean; id: string }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  updateCustomer(id: string, payload: any) {
    return request<{ success: boolean }>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteCustomer(id: string) {
    return request<{ success: boolean }>(`/api/customers/${id}`, { method: 'DELETE' });
  },

  // Inventory
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
  },

  // Orders
  getOrders(params?: { status?: string; customer_id?: string; product_id?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return request<{
      orders: Order[];
      counts?: {
        all: number;
        pending: number;
        active: number;
        expiring: number;
        completed: number;
        expired: number;
        cancelled: number;
      };
    }>(`/api/orders?${query}`);
  },
  getOrder(id: string) {
    return request<{ order: Order; renewals: OrderRenewal[] }>(`/api/orders/${id}`);
  },
  createOrder(payload: any) {
    return request<{ success: boolean; order: any }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  cancelOrder(id: string, reason?: string) {
    return request<{ success: boolean }>(`/api/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },
  updateOrder(id: string, payload: any) {
    return request<{ success: boolean; order: Order; message: string }>(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },
  deleteOrder(id: string) {
    return request<{ success: boolean; message: string }>(`/api/orders/${id}`, {
      method: 'DELETE'
    });
  },

  // Renewals
  renewOrder(orderId: string, payload?: { custom_price?: number; notes?: string }) {
    return request<{
      success: boolean;
      start_date: string;
      new_end_date: string;
      previous_end_date: string;
      duration: number;
      duration_unit: string;
      renewal: any;
    }>(`/api/renewals/${orderId}`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
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
  composeWhatsApp(payload: { order_id: string; template_id?: string; language?: string; event_type?: string; phone?: string; save_phone?: boolean }) {
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

  // Devices & Android Pairing
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
