import { createApiClient, createWebStorage } from '../../../shared/services/apiClient';

// Create web storage adapter
const webStorage = createWebStorage();

// Create API client with web-specific handlers
const api = createApiClient(webStorage, {
  onUnauthorized: () => {
    window.location.href = '/login';
  },
  onForbidden: () => {
    window.location.href = '/unauthorized';
  },
});

export default api;
