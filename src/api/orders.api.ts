import { request } from './client';
import type { Order, OrderRenewal } from '../types';

export const ordersApi = {
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
  }
};
