import { request, tokenStorage } from './client';
import type { User } from '../types';

export const authApi = {
  getToken(): string | null {
    return tokenStorage.get();
  },
  setToken(token: string): void {
    tokenStorage.set(token);
  },
  clearToken(): void {
    tokenStorage.clear();
  },
  hasSession(): boolean {
    return tokenStorage.has();
  },

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
      // Ignore network failures during logout
    } finally {
      tokenStorage.clear();
    }
    return { success: true };
  },

  changePassword(passwords: { currentPassword: string; newPassword: string }) {
    return request<{ success: boolean; message?: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords)
    });
  }
};
