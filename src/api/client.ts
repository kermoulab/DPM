const TOKEN_KEY = 'erp_session_token';

// Base URL defaults to relative path in development/bundled mode, or uses VITE_API_URL when set
const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export const tokenStorage = {
  get(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
  has(): boolean {
    return Boolean(localStorage.getItem(TOKEN_KEY));
  }
};

/**
 * Centralized fetch wrapper with timeout, token injection, and error normalization.
 */
export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStorage.get();
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Timeout handling via AbortController
  const timeoutMs = options.timeoutMs || 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw new Error(err.message || 'Network connection failed');
  } finally {
    clearTimeout(timeoutId);
  }

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
      tokenStorage.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}
