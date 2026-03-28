import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getApiUrl, getFallbackUrls } from '../config/api';
import { debugLog } from '../utils/logger';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

let API_BASE_URL = getApiUrl(Platform.OS);
let currentIPIndex = 0;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setCustomApiUrl = async (url: string | null) => {
  if (!url) {
    await AsyncStorage.removeItem('customApiUrl');
    API_BASE_URL = getApiUrl(Platform.OS);
  } else {
    await AsyncStorage.setItem('customApiUrl', url);
    API_BASE_URL = url;
  }
  apiClient.defaults.baseURL = API_BASE_URL;
  currentIPIndex = 0;
  return API_BASE_URL;
};

type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

export const setTokenRefreshHandler = (handler: RefreshHandler) => {
  refreshHandler = handler;
};

export interface NormalizedApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

const extractValidationMessage = (payload: any): string | null => {
  if (!payload || typeof payload !== 'object') return null;

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    const first = payload.errors[0];
    if (typeof first === 'string') return first;
    if (first?.msg) return String(first.msg);
    if (first?.message) return String(first.message);
  }

  const ignoredKeys = new Set(['success', 'error', 'message', 'meta', 'statusCode']);
  for (const [field, value] of Object.entries(payload)) {
    if (ignoredKeys.has(field)) continue;
    if (Array.isArray(value) && value.length > 0) {
      const first = value[0];
      if (typeof first === 'string') return `${field}: ${first}`;
      if ((first as any)?.message) return `${field}: ${(first as any).message}`;
    }
  }

  return null;
};

export const normalizeApiError = (error: any): NormalizedApiError => {
  const status = error?.response?.status;
  const payload = error?.response?.data;
  const validationMessage = extractValidationMessage(payload);

  let message =
    validationMessage ||
    payload?.message ||
    payload?.error ||
    error?.message ||
    'Request failed';

  if (error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout')) {
    message = 'Request timed out. Please check your network and try again.';
  }

  const normalized = new Error(message) as NormalizedApiError;

  normalized.status = status;
  normalized.code = error?.code;
  normalized.details = payload;
  return normalized;
};

async function refreshAuthToken(): Promise<string | null> {
  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeTokenRefresh(resolve);
    });
  }

  if (!refreshHandler) {
    console.warn('[api] No token refresh handler configured');
    return null;
  }

  isRefreshing = true;

  try {
    const newToken = await refreshHandler();

    if (newToken) {
      await AsyncStorage.setItem('authToken', newToken);
      onRefreshed(newToken);
      return newToken;
    }
    return null;
  } catch (err: any) {
    console.error('[api] Error refreshing token:', err?.message || err);
    return null;
  } finally {
    isRefreshing = false;
  }
}

interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  __retryCount?: number;
  __ipFallbackTried?: boolean;
}

apiClient.interceptors.request.use(
  async (config: CustomInternalAxiosRequestConfig) => {
    debugLog('[api:req]', config.method?.toUpperCase(), `${config.baseURL || ''}${config.url || ''}`);

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('[api] Error getting token:', error);
    }

    config.__retryCount = config.__retryCount || 0;
    return config;
  },
  (error) => Promise.reject(normalizeApiError(error))
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: any) => {
    const status = error.response?.status;
    const originalRequest = error.config as CustomInternalAxiosRequestConfig;

    if (!error.response && !originalRequest.__ipFallbackTried) {
      originalRequest.__ipFallbackTried = true;

      const fallbackUrls = getFallbackUrls(Platform.OS);
      if (currentIPIndex < fallbackUrls.length) {
        const nextIP = fallbackUrls[currentIPIndex];
        currentIPIndex += 1;

        debugLog(`[api] Trying fallback URL: ${nextIP}`);
        originalRequest.baseURL = nextIP;
        originalRequest.__retryCount = (originalRequest.__retryCount || 0) + 1;

        return apiClient(originalRequest);
      }
    }

    if (status === 401) {
      if (originalRequest._retry) {
        return Promise.reject(normalizeApiError(error));
      }
      originalRequest._retry = true;

      try {
        const newToken = await refreshAuthToken();
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError: any) {
        debugLog('[api] Token refresh failed:', refreshError?.message || refreshError);
      }

      try {
        await AsyncStorage.multiRemove(['authToken', 'userData', 'refreshToken']);
      } catch (e) {
        console.error('[api] Error clearing auth:', e);
      }
    }

    if (status === 403) {
      debugLog('[api] Forbidden - access denied');
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default apiClient;

export const testServerConnectivity = async (): Promise<{ success: boolean; url: string | null }> => {
  const fallbackUrls = [API_BASE_URL, ...getFallbackUrls(Platform.OS)];

  for (const url of fallbackUrls) {
    try {
      const response = await axios.get(`${url.replace(/\/+$/, '')}/health`, { timeout: 5000 });
      if (response.status === 200) {
        debugLog(`[api] Server reachable at: ${url}`);
        return { success: true, url };
      }
    } catch {
      debugLog(`[api] Server not reachable at: ${url}`);
    }
  }

  return { success: false, url: null };
};

export const getCurrentApiUrl = () => API_BASE_URL;
