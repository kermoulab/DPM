import { request, tokenStorage } from './client';
import { authApi } from './auth.api';
import { productsApi } from './products.api';
import { ordersApi } from './orders.api';
import { customersApi } from './customers.api';
import { inventoryApi } from './inventory.api';
import { systemApi } from './system.api';

export * from './client';
export * from './auth.api';
export * from './products.api';
export * from './orders.api';
export * from './customers.api';
export * from './inventory.api';
export * from './system.api';

/**
 * Unified, backward-compatible API client object.
 * All frontend components calling `api.*` continue to function seamlessly.
 */
export const api = {
  request,
  ...tokenStorage,
  ...authApi,
  ...productsApi,
  ...ordersApi,
  ...customersApi,
  ...inventoryApi,
  ...systemApi
};

export default api;
