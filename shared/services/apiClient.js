/**
 * Shared API client factory
 * Creates a configured axios instance with common interceptors
 * Works across web (localStorage) and mobile (AsyncStorage) platforms
 */
import axios from 'axios';
import { API_BASE_URL } from '../constants/api-endpoints';

/**
 * Storage adapter interface:
 * - getItem(key: string): Promise<string|null> | string | null
 * - removeItem(key: string): Promise<void> | void
 * - multiRemove?(keys: string[]): Promise<void> | void (optional, for mobile)
 */

/**
 * Creates a configured axios instance with auth interceptors
 * @param {Object} storage - Storage adapter (localStorage-like interface)
 * @param {Object} options - Configuration options
 * @param {Function} options.onUnauthorized - Callback when 401 received
 * @param {Function} options.onForbidden - Callback when 403 received
 * @param {number} options.timeout - Request timeout in ms (default: 30000)
 * @param {number} options.retries - Number of retries for failed requests (default: 3)
 * @returns {AxiosInstance} Configured axios instance
 */
export const createApiClient = (storage, options = {}) => {
    const {
        timeout = 30000,
        retries = 3,
        onUnauthorized = null,
        onForbidden = null,
        onTimeout = null,
    } = options;

    // Create axios instance
    const api = axios.create({
        baseURL: API_BASE_URL,
        timeout,
        headers: {
            'Content-Type': 'application/json',
        },
    });

    // Request interceptor to add auth token
    api.interceptors.request.use(
        async (config) => {
            try {
                // Handle both sync (localStorage) and async (AsyncStorage) storage
                // Check localStorage first, then sessionStorage for session tokens
                let token = await Promise.resolve(storage.getItem('authToken'));

                // If no token in localStorage and we're on web, check sessionStorage
                if (!token && typeof window !== 'undefined' && window.sessionStorage) {
                    token = window.sessionStorage.getItem('authToken');
                }

                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error('Error getting auth token:', error);
            }
            // Track retry count
            config.__retryCount = config.__retryCount || 0;
            return config;
        },
        (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    api.interceptors.response.use(
        (response) => {
            // Return response.data for successful responses
            // For error responses, the error handler will deal with them
            return response.data;
        },
        async (error) => {
            const config = error.config;
            const status = error.response?.status;

            // Handle cancellations first - don't wrap them, just reject standard error
            if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
                return Promise.reject(error);
            }

            // Handle timeout errors with retry
            if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                if (config && config.__retryCount < retries) {
                    config.__retryCount += 1;

                    // Exponential backoff: 1s, 2s, 4s...
                    const delay = Math.pow(2, config.__retryCount - 1) * 1000;
                    console.warn(`Request timeout, retrying (${config.__retryCount}/${retries}) after ${delay}ms...`);

                    await new Promise(resolve => setTimeout(resolve, delay));
                    return api.request(config);
                }

                // All retries exhausted
                if (onTimeout) {
                    onTimeout(error);
                }

                return Promise.reject(new Error('Request timeout. Please check your connection and try again.'));
            }

            // Handle network errors with retry
            // DO NOT retry if the request was canceled (AbortController)
            if (!error.response && !axios.isCancel(error) && config && config.__retryCount < retries) {
                config.__retryCount += 1;
                const delay = Math.pow(2, config.__retryCount - 1) * 1000;
                console.warn(`Network error, retrying (${config.__retryCount}/${retries}) after ${delay}ms...`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return api.request(config);
            }

            // Handle 401 unauthorized
            if (status === 401) {
                try {
                    // Clear auth data from both localStorage and sessionStorage
                    const clearStorage = (storage) => {
                        if (storage.multiRemove) {
                            return storage.multiRemove(['authToken', 'userData', 'tokenExpiry']);
                        } else {
                            return Promise.all([
                                Promise.resolve(storage.removeItem('authToken')),
                                Promise.resolve(storage.removeItem('userData')),
                                Promise.resolve(storage.removeItem('tokenExpiry'))
                            ]);
                        }
                    };

                    // Clear from localStorage
                    await clearStorage(localStorage);
                    // Clear from sessionStorage
                    await clearStorage(sessionStorage);
                } catch (e) {
                    console.error('Error clearing auth data:', e);
                }

                if (onUnauthorized) {
                    onUnauthorized(error);
                }
            }

            // Handle 403 forbidden
            if (status === 403) {
                // Check if it's a deactivation error
                const errorMessage = error.response?.data?.error || '';
                if (errorMessage.includes('deactivated') || errorMessage.includes('Account has been deactivated')) {
                    // For deactivation, reject with the actual error message from backend
                    return Promise.reject(new Error(errorMessage));
                }

                // For non-deactivation 403 errors (but not for login requests)
                if (!config?.url?.includes('/auth/login') && onForbidden) {
                    onForbidden(error);
                }
            }

            // For error responses, create a proper error structure
            if (error.response?.data) {
                // Backend returned an error response
                console.log('Backend error response:', error.response.data); // Debug log
                return Promise.reject(error.response.data);
            } else {
                // Network error or other error
                console.log('Network error:', error); // Debug log
                return Promise.reject({
                    success: false,
                    message: error.message || 'Network error occurred',
                    error: error.code || 'NETWORK_ERROR'
                });
            }
        }
    );

    return api;
};

/**
 * Create a storage adapter for web (localStorage)
 */
export const createWebStorage = () => ({
    getItem: (key) => localStorage.getItem(key),
    removeItem: (key) => localStorage.removeItem(key),
});

export default createApiClient;
