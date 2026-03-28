import Constants from 'expo-constants';

const DEFAULT_PORT = 5000;
const DEFAULT_REMOTE_API = 'https://tako48-herb-server.hf.space/api';

const getExtraEnv = (key) => {
  const value = Constants.expoConfig?.extra?.env?.[key];
  const trimmed = String(value ?? '').trim();
  return trimmed || '';
};

const normalizeApiBaseUrl = (rawUrl) => {
  const cleaned = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (/\/api$/i.test(cleaned)) return cleaned;
  return `${cleaned}/api`;
};

const parseFallbackUrls = (rawUrls) => {
  return String(rawUrls || '')
    .split(',')
    .map((url) => normalizeApiBaseUrl(url))
    .filter(Boolean);
};

// API configuration with deterministic environment priority.
// This avoids machine-specific hardcoded LAN URLs in source.
export const API_CONFIG = {
  PORT: DEFAULT_PORT,
  ENV_URL: getExtraEnv('EXPO_PUBLIC_API_BASE_URL') || process.env.EXPO_PUBLIC_API_BASE_URL || '',
  REMOTE_FALLBACK_URL: DEFAULT_REMOTE_API,
  FALLBACK_URLS: parseFallbackUrls(
    getExtraEnv('EXPO_PUBLIC_API_FALLBACK_URLS') || process.env.EXPO_PUBLIC_API_FALLBACK_URLS
  ),

  // API endpoints
  ENDPOINTS: {
    // Auth
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',

    // Diseases
    DISEASES: '/diseases',
    DISEASE_BY_ID: '/diseases/:id',
    DISEASE_RECOMMENDATIONS: '/diseases/:id/recommendations',
    SEARCH_DISEASES: '/diseases/search',

    // Herbs
    HERBS: '/herbs',
    HERB_BY_ID: '/herbs/:id',
    SEARCH_HERBS: '/herbs/search',
    FEATURED_HERBS: '/herbs/featured',

    // Locations
    LOCATIONS: '/locations',
    LOCATION_BY_ID: '/locations/:id',

    // Health check
    HEALTH: '/health',
  },

  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
};

// Get the best API URL based on platform
export const getApiUrl = (platform) => {
  const envUrl = normalizeApiBaseUrl(API_CONFIG.ENV_URL);
  if (envUrl) {
    return envUrl;
  }

  return API_CONFIG.REMOTE_FALLBACK_URL;
};

// Get fallback URLs for retry logic
export const getFallbackUrls = (platform) => {
  const envUrl = normalizeApiBaseUrl(API_CONFIG.ENV_URL);
  const configuredFallbacks = API_CONFIG.FALLBACK_URLS.filter((url) => url !== envUrl);
  if (configuredFallbacks.length > 0) {
    return configuredFallbacks;
  }

  if (envUrl && envUrl !== API_CONFIG.REMOTE_FALLBACK_URL) {
    return [API_CONFIG.REMOTE_FALLBACK_URL];
  }

  return [];
};
