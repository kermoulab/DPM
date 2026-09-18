import { request } from './client';
import type { Category, Product, Plan } from '../types';

export const productsApi = {
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
  }
};
