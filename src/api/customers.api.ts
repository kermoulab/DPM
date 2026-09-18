import { request } from './client';
import type { Customer, Order } from '../types';

export const customersApi = {
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
  }
};
