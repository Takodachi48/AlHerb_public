import api from './api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const STORAGE_CACHE_KEY = 'admin_storage_usage_cache_v1';
const STORAGE_CACHE_TTL_MS = 5 * 60 * 1000;
const ANALYTICS_DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;
const ANALYTICS_CACHE_TTL_BY_KEY_MS = {
  'slo-sla': 5 * 60 * 1000,
  operations: 2 * 60 * 1000,
  'safety-governance': 10 * 60 * 1000,
  'audit-trail': 30 * 60 * 1000,
  'recent-error-logs': 60 * 1000,
  'top-failing-endpoints': 2 * 60 * 1000,
  'monitoring-alert-rule': 10 * 60 * 1000,
  'recommendation-insights': 5 * 60 * 1000,
  'image-classifier-insights': 5 * 60 * 1000,
  'blog-insights': 5 * 60 * 1000,
  'chatbot-insights': 2 * 60 * 1000,
  'monitoring-overview': 2 * 60 * 1000,
  'dashboard-overview': 2 * 60 * 1000,
  'security-settings': 5 * 60 * 1000,
  'chatbot-settings': 2 * 60 * 1000,
};
const ANALYTICS_CACHE_PREFIX = 'admin_analytics_cache_v1:';
let inMemoryCache = null;
let inFlightRequest = null;
const analyticsMemoryCache = new Map();
const analyticsInFlight = new Map();
const DEFAULT_MONITORING_ERROR_FILTERS = {
  statusClass: 'all',
  endpoint: '',
  search: '',
};

const getErrorMessage = (error) => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  return error.message || error.error || 'Unknown error';
};

const normalizeResponseData = (response) => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data;
  }
  return response;
};

const saveCache = (data) => {
  const cacheValue = {
    data,
    timestamp: Date.now()
  };
  inMemoryCache = cacheValue;

  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cacheValue));
  }
};

const readCache = () => {
  const isValid = (cache) => cache && (Date.now() - cache.timestamp < STORAGE_CACHE_TTL_MS);

  if (isValid(inMemoryCache)) {
    return inMemoryCache.data;
  }

  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const rawCache = window.sessionStorage.getItem(STORAGE_CACHE_KEY);
    if (!rawCache) return null;

    const parsed = JSON.parse(rawCache);
    if (isValid(parsed)) {
      inMemoryCache = parsed;
      return parsed.data;
    }
  } catch {
    return null;
  }

  return null;
};

const getAnalyticsCacheKey = (key, params = {}) => `${ANALYTICS_CACHE_PREFIX}${key}:${JSON.stringify(params)}`;

const getAnalyticsTtlMs = (key) => ANALYTICS_CACHE_TTL_BY_KEY_MS[key] || ANALYTICS_DEFAULT_CACHE_TTL_MS;

const getCachedAnalyticsValue = (cacheKey, key) => {
  const ttlMs = getAnalyticsTtlMs(key);
  const mem = analyticsMemoryCache.get(cacheKey);
  if (mem && Date.now() - mem.timestamp < ttlMs) {
    return mem.data;
  }

  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Date.now() - parsed.timestamp < ttlMs) {
      analyticsMemoryCache.set(cacheKey, parsed);
      return parsed.data;
    }
  } catch {
    return null;
  }

  return null;
};

const setCachedAnalyticsValue = (cacheKey, data) => {
  const payload = { timestamp: Date.now(), data };
  analyticsMemoryCache.set(cacheKey, payload);
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
  }
};

const getAnalyticsCachePayload = (cacheKey) => {
  const mem = analyticsMemoryCache.get(cacheKey);
  if (mem) return mem;

  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    analyticsMemoryCache.set(cacheKey, parsed);
    return parsed;
  } catch {
    return null;
  }
};

const getMonitoringBundleRequestParts = (days = 30, filters = {}, options = {}) => {
  const normalizedDays = Number(days) > 0 ? Number(days) : 30;
  const hours = normalizedDays * 24;
  const scope = options?.scope ? String(options.scope).trim().toLowerCase() : '';
  const normalizedFilters = {
    ...DEFAULT_MONITORING_ERROR_FILTERS,
    ...(filters || {}),
  };

  return {
    safety: { key: 'safety-governance', params: {} },
    auditTrail: { key: 'audit-trail', params: { limit: 20, days: normalizedDays } },
    insights: { key: 'recommendation-insights', params: { days: normalizedDays } },
    imageInsights: { key: 'image-classifier-insights', params: { hours } },
    operations: { key: 'operations', params: { hours } },
    blogInsights: { key: 'blog-insights', params: { hours } },
    errorLogs: {
      key: 'recent-error-logs',
      params: {
        limit: 40,
        hours,
        statusClass: normalizedFilters.statusClass,
        endpoint: normalizedFilters.endpoint,
        search: normalizedFilters.search,
      },
    },
    topFailingEndpoints: { key: 'top-failing-endpoints', params: { hours, limit: 8 } },
    sloSlaSummary: { key: 'slo-sla', params: { days: normalizedDays, ...(scope ? { scope } : {}) } },
    alertRule: { key: 'monitoring-alert-rule', params: {} },
  };
};

const getMonitoringBundleFromCache = (days = 30, filters = {}, options = {}) => {
  const { requireAll = false } = options;
  const parts = getMonitoringBundleRequestParts(days, filters, options);
  const entries = {};
  let newestTimestamp = 0;

  for (const [field, cfg] of Object.entries(parts)) {
    const cacheKey = getAnalyticsCacheKey(cfg.key, cfg.params);
    const payload = getAnalyticsCachePayload(cacheKey);
    const ttlMs = getAnalyticsTtlMs(cfg.key);
    if (!payload || Date.now() - payload.timestamp >= ttlMs) {
      if (requireAll) return null;
      continue;
    }
    entries[field] = payload.data;
    newestTimestamp = Math.max(newestTimestamp, payload.timestamp);
  }

  if (Object.keys(entries).length === 0) return null;
  return {
    ...entries,
    _cacheTimestamp: newestTimestamp,
  };
};

const getDashboardBundleRequestParts = (days = 30) => {
  const normalizedDays = Number(days) > 0 ? Number(days) : 30;
  return {
    overview: { key: 'monitoring-overview', params: {} },
    dashboard: { key: 'dashboard-overview', params: { days: normalizedDays } },
  };
};

const getDashboardBundleFromCache = (days = 30) => {
  const parts = getDashboardBundleRequestParts(days);
  const entries = {};
  let newestTimestamp = 0;

  for (const [field, cfg] of Object.entries(parts)) {
    const cacheKey = getAnalyticsCacheKey(cfg.key, cfg.params);
    const payload = getAnalyticsCachePayload(cacheKey);
    const ttlMs = getAnalyticsTtlMs(cfg.key);
    if (!payload || Date.now() - payload.timestamp >= ttlMs) {
      return null;
    }
    entries[field] = payload.data;
    newestTimestamp = Math.max(newestTimestamp, payload.timestamp);
  }

  return {
    ...entries,
    _cacheTimestamp: newestTimestamp,
  };
};

const requestWithAnalyticsCache = async ({ key, params = {}, forceRefresh = false, fetcher }) => {
  const cacheKey = getAnalyticsCacheKey(key, params);

  if (!forceRefresh) {
    const cached = getCachedAnalyticsValue(cacheKey, key);
    if (cached) return cached;
  }

  if (analyticsInFlight.has(cacheKey)) {
    return analyticsInFlight.get(cacheKey);
  }

  const pending = fetcher()
    .then((data) => {
      setCachedAnalyticsValue(cacheKey, data);
      return data;
    })
    .finally(() => {
      analyticsInFlight.delete(cacheKey);
    });

  analyticsInFlight.set(cacheKey, pending);
  return pending;
};

const getStoredAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
};

const resolveApiBaseUrl = () => {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL;
  }
  if (typeof window === 'undefined') return API_BASE_URL;
  const normalized = API_BASE_URL.startsWith('/') ? API_BASE_URL : `/${API_BASE_URL}`;
  return `${window.location.origin}${normalized}`;
};

const parseSseEventBlock = (block = '') => {
  const lines = block.split('\n');
  let event = 'message';
  const dataLines = [];

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice(6).trim() || 'message';
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;

  const dataText = dataLines.join('\n');
  try {
    return { event, data: JSON.parse(dataText) };
  } catch {
    return { event, data: dataText };
  }
};

export const adminService = {
  /**
   * Fetch Cloudinary storage usage and statistics
   * @returns {Promise<Object>} Storage usage data
   */
  async getStorageUsage(options = {}) {
    const { forceRefresh = false } = options;

    try {
      if (!forceRefresh) {
        const cached = readCache();
        if (cached) return cached;
      }

      if (inFlightRequest) {
        return await inFlightRequest;
      }

      inFlightRequest = api.get('/admin/storage/stats')
        .then((response) => {
          const normalized = normalizeResponseData(response);
          saveCache(normalized);
          return normalized;
        })
        .finally(() => {
          inFlightRequest = null;
        });

      return await inFlightRequest;
    } catch (error) {
      console.error('Error fetching storage usage:', error);
      throw new Error(`Failed to fetch storage usage: ${getErrorMessage(error)}`);
    }
  },
  async getSecuritySettings(options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'security-settings',
        params: {},
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/settings/security')),
      });
    } catch (error) {
      console.error('Error fetching security settings:', error);
      throw new Error(`Failed to fetch security settings: ${getErrorMessage(error)}`);
    }
  },

  async updateSecuritySettings(payload) {
    try {
      const response = await api.put('/admin/settings/security', payload);
      return normalizeResponseData(response);
    } catch (error) {
      console.error('Error updating security settings:', error);
      throw new Error(`Failed to update security settings: ${getErrorMessage(error)}`);
    }
  },

  async getChatbotSettings(options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'chatbot-settings',
        params: {},
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/settings/chatbot')),
      });
    } catch (error) {
      console.error('Error fetching chatbot settings:', error);
      throw new Error(`Failed to fetch chatbot settings: ${getErrorMessage(error)}`);
    }
  },

  async updateChatbotSettings(payload) {
    try {
      const response = await api.put('/admin/settings/chatbot', payload);
      const normalized = normalizeResponseData(response);
      const cacheKey = getAnalyticsCacheKey('chatbot-settings', {});
      setCachedAnalyticsValue(cacheKey, normalized);
      return normalized;
    } catch (error) {
      console.error('Error updating chatbot settings:', error);
      throw new Error(`Failed to update chatbot settings: ${getErrorMessage(error)}`);
    }
  },

  async getMonitoringOverview(options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'monitoring-overview',
        params: {},
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/overview')),
      });
    } catch (error) {
      throw new Error(`Failed to fetch monitoring overview: ${getErrorMessage(error)}`);
    }
  },

  async getDashboardOverview(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'dashboard-overview',
        params: { days },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/dashboard-overview', { params: { days } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch dashboard overview: ${getErrorMessage(error)}`);
    }
  },

  async getOperationalMetrics(hours = 24, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'operations',
        params: { hours },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/operations', { params: { hours } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch operational metrics: ${getErrorMessage(error)}`);
    }
  },

  async getRecentErrorLogs(limit = 50, hours = 24, filters = {}, options = {}) {
    const { forceRefresh = false, offset = 0 } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'recent-error-logs',
        params: { limit, hours, offset, ...filters },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/error-logs', {
          params: { limit, hours, offset, ...filters },
        })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch error logs: ${getErrorMessage(error)}`);
    }
  },

  async getErrorLogsPaginated(page = 1, limit = 20, days = 30, filters = {}, options = {}) {
    const normalizedPage = Number(page) > 0 ? Number(page) : 1;
    const normalizedLimit = Number(limit) > 0 ? Number(limit) : 20;
    const normalizedDays = Number(days) > 0 ? Number(days) : 30;
    const hours = normalizedDays * 24;
    const offset = (normalizedPage - 1) * normalizedLimit;
    const normalizedFilters = {
      ...DEFAULT_MONITORING_ERROR_FILTERS,
      ...(filters || {}),
    };
    return this.getRecentErrorLogs(
      normalizedLimit,
      hours,
      normalizedFilters,
      { ...options, offset }
    );
  },

  async getSafetyGovernance(options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'safety-governance',
        params: {},
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/safety-governance')),
      });
    } catch (error) {
      throw new Error(`Failed to fetch safety governance metrics: ${getErrorMessage(error)}`);
    }
  },

  async getRecommendationInsights(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'recommendation-insights',
        params: { days },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/recommendation-insights', { params: { days } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch recommendation insights: ${getErrorMessage(error)}`);
    }
  },

  async getImageClassifierInsights(hours = 168, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'image-classifier-insights',
        params: { hours },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/image-classifier-insights', { params: { hours } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch image classifier insights: ${getErrorMessage(error)}`);
    }
  },

  async getBlogInsights(hours = 168, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'blog-insights',
        params: { hours },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/blog-insights', { params: { hours } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch blog insights: ${getErrorMessage(error)}`);
    }
  },

  async getChatbotInsights(hours = 24, limit = 20, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'chatbot-insights',
        params: { hours, limit },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/chatbot-insights', { params: { hours, limit } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch chatbot insights: ${getErrorMessage(error)}`);
    }
  },

  async getAuditTrail(limit = 25, days = 30, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'audit-trail',
        params: { limit, days },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/audit-trail', { params: { limit, days } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch audit trail: ${getErrorMessage(error)}`);
    }
  },

  async getTopFailingEndpoints(hours = 24, limit = 10, options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'top-failing-endpoints',
        params: { hours, limit },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/top-failing-endpoints', { params: { hours, limit } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch top failing endpoints: ${getErrorMessage(error)}`);
    }
  },

  async getSloSlaSummary(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    const scope = options.scope || 'all';
    try {
      return await requestWithAnalyticsCache({
        key: 'slo-sla',
        params: { days, scope },
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/slo-sla', { params: { days, scope } })),
      });
    } catch (error) {
      throw new Error(`Failed to fetch SLO/SLA summary: ${getErrorMessage(error)}`);
    }
  },

  async getMonitoringAlertRule(options = {}) {
    const { forceRefresh = false } = options;
    try {
      return await requestWithAnalyticsCache({
        key: 'monitoring-alert-rule',
        params: {},
        forceRefresh,
        fetcher: async () => normalizeResponseData(await api.get('/admin/monitoring/alert-rule')),
      });
    } catch (error) {
      throw new Error(`Failed to fetch monitoring alert rule: ${getErrorMessage(error)}`);
    }
  },

  getCachedMonitoringBundle(days = 30, filters = {}, options = {}) {
    return getMonitoringBundleFromCache(days, filters, { requireAll: false, ...options });
  },

  async getMonitoringCriticalBundle(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    const scope = options.scope || 'core';
    const normalizedDays = Number(days) > 0 ? Number(days) : 30;
    const hours = normalizedDays * 24;

    const [safety, operations, sloSlaSummary] = await Promise.all([
      this.getSafetyGovernance({ forceRefresh }),
      this.getOperationalMetrics(hours, { forceRefresh }),
      this.getSloSlaSummary(normalizedDays, { forceRefresh, scope }),
    ]);

    return {
      safety,
      operations,
      sloSlaSummary,
    };
  },

  async getMonitoringMinimalBundle(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    const scope = options.scope || 'core';
    const normalizedDays = Number(days) > 0 ? Number(days) : 30;
    const sloSlaSummary = await this.getSloSlaSummary(normalizedDays, { forceRefresh, scope });
    return { sloSlaSummary };
  },

  async getMonitoringSecondaryBundle(days = 30, filters = {}, options = {}) {
    const { forceRefresh = false, errorLogPage = 1, errorLogLimit = 20 } = options;
    const normalizedDays = Number(days) > 0 ? Number(days) : 30;
    const hours = normalizedDays * 24;
    const normalizedFilters = {
      ...DEFAULT_MONITORING_ERROR_FILTERS,
      ...(filters || {}),
    };

    const [
      auditTrail,
      insights,
      imageInsights,
      blogInsights,
      errorLogs,
      topFailingEndpoints,
      alertRule,
    ] = await Promise.all([
      this.getAuditTrail(20, normalizedDays, { forceRefresh }),
      this.getRecommendationInsights(normalizedDays, { forceRefresh }),
      this.getImageClassifierInsights(hours, { forceRefresh }),
      this.getBlogInsights(hours, { forceRefresh }),
      this.getErrorLogsPaginated(errorLogPage, errorLogLimit, normalizedDays, normalizedFilters, { forceRefresh }),
      this.getTopFailingEndpoints(hours, 8, { forceRefresh }),
      this.getMonitoringAlertRule({ forceRefresh }),
    ]);

    return {
      auditTrail,
      insights,
      imageInsights,
      blogInsights,
      errorLogs,
      topFailingEndpoints,
      alertRule,
    };
  },

  async getMonitoringBundle(days = 30, filters = {}, options = {}) {
    const critical = await this.getMonitoringCriticalBundle(days, options);
    const secondary = await this.getMonitoringSecondaryBundle(days, filters, {
      ...options,
      errorLogPage: 1,
      errorLogLimit: 40,
    });
    return { ...critical, ...secondary };
  },

  prefetchMonitoringBundle(days = 30, filters = {}, options = {}) {
    return this.getMonitoringCriticalBundle(days, { forceRefresh: false, ...options })
      .then(() => this.getMonitoringSecondaryBundle(days, filters, { forceRefresh: false, errorLogPage: 1, errorLogLimit: 20 }))
      .catch(() => null);
  },

  hydrateMonitoringCacheFromSnapshot(days = 30, snapshot = {}, filters = {}, options = {}) {
    if (!snapshot || typeof snapshot !== 'object') return;

    const parts = getMonitoringBundleRequestParts(days, filters, options);
    const write = (field, data) => {
      if (typeof data === 'undefined') return;
      const cfg = parts[field];
      if (!cfg) return;
      const cacheKey = getAnalyticsCacheKey(cfg.key, cfg.params);
      setCachedAnalyticsValue(cacheKey, data);
    };

    write('safety', snapshot.safety);
    write('insights', snapshot.recommendation);
    write('imageInsights', snapshot.image);
    write('operations', snapshot.operations);
    write('blogInsights', snapshot.blog);
    write('sloSlaSummary', snapshot.slo);
    if (Array.isArray(snapshot.topFailingEndpoints)) {
      write('topFailingEndpoints', snapshot.topFailingEndpoints);
    }
    if (Array.isArray(snapshot.auditTrail)) {
      write('auditTrail', snapshot.auditTrail);
    }
  },

  getCachedDashboardBundle(days = 30) {
    return getDashboardBundleFromCache(days);
  },

  async getDashboardBundle(days = 30, options = {}) {
    const { forceRefresh = false } = options;
    const normalizedDays = Number(days) > 0 ? Number(days) : 30;

    const [overview, dashboard] = await Promise.all([
      this.getMonitoringOverview({ forceRefresh }),
      this.getDashboardOverview(normalizedDays, { forceRefresh }),
    ]);

    return {
      overview,
      dashboard,
    };
  },

  prefetchDashboardBundle(days = 30) {
    return this.getDashboardBundle(days, { forceRefresh: false }).catch(() => null);
  },

  hydrateDashboardCacheFromSnapshot(days = 30, snapshot = {}) {
    if (!snapshot || typeof snapshot !== 'object') return;

    const parts = getDashboardBundleRequestParts(days);
    const write = (field, data) => {
      if (typeof data === 'undefined') return;
      const cfg = parts[field];
      if (!cfg) return;
      const cacheKey = getAnalyticsCacheKey(cfg.key, cfg.params);
      setCachedAnalyticsValue(cacheKey, data);
    };

    write('overview', snapshot.overview);
    write('dashboard', snapshot.dashboard);
  },

  async updateMonitoringAlertRule(payload) {
    try {
      const response = await api.put('/admin/monitoring/alert-rule', payload);
      return normalizeResponseData(response);
    } catch (error) {
      throw new Error(`Failed to update monitoring alert rule: ${getErrorMessage(error)}`);
    }
  },

  async downloadMonitoringPdf(report, params = {}) {
    try {
      const token = getStoredAuthToken();
      const response = await fetch(`${API_ENDPOINTS.ADMIN.MONITORING.EXPORT_PDF}?report=${report}&${new URLSearchParams(params).toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `PDF download failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  },

  async downloadMonitoringCsv(report, params = {}) {
    try {
      const blob = await api.get('/admin/monitoring/export-csv', {
        params: { report, ...params },
        responseType: 'blob',
      });

      const fileName = `monitoring-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error(`Failed to download CSV: ${getErrorMessage(error)}`);
    }
  },

  async triggerImageClassifierRetrain() {
    try {
      return normalizeResponseData(await api.post('/admin/ml/retrain/image-classifier'));
    } catch (error) {
      throw new Error(`Failed to trigger image classifier retrain: ${getErrorMessage(error)}`);
    }
  },

  async triggerRecommendationRetrain() {
    try {
      return normalizeResponseData(await api.post('/admin/ml/retrain/recommendation-engine'));
    } catch (error) {
      throw new Error(`Failed to trigger recommendation engine retrain: ${getErrorMessage(error)}`);
    }
  },

  async getImageClassifierRetrainStatus(taskId) {
    try {
      return normalizeResponseData(await api.get(`/admin/ml/retrain/image-classifier/${encodeURIComponent(taskId)}`));
    } catch (error) {
      throw new Error(`Failed to fetch image classifier retrain status: ${getErrorMessage(error)}`);
    }
  },

  async getImageClassifierQueueHealth() {
    try {
      return normalizeResponseData(await api.get('/admin/ml/queue-health/image-classifier'));
    } catch (error) {
      throw new Error(`Failed to fetch image classifier queue health: ${getErrorMessage(error)}`);
    }
  },

  async connectMonitoringStream(options = {}) {
    const {
      sections = ['overview', 'dashboard'],
      days = 30,
      hours = 24,
      intervalMs = 15000,
      scope,
      onMessage = () => {},
      onError = () => {},
    } = options;

    const token = getStoredAuthToken();
    if (!token) {
      throw new Error('Authentication token is required for monitoring stream');
    }

    const controller = new AbortController();
    const baseUrl = resolveApiBaseUrl();
    const streamUrl = new URL(`${baseUrl}/admin/monitoring/stream`);
    streamUrl.searchParams.set('sections', Array.isArray(sections) ? sections.join(',') : String(sections || ''));
    streamUrl.searchParams.set('days', String(days));
    streamUrl.searchParams.set('hours', String(hours));
    streamUrl.searchParams.set('intervalMs', String(intervalMs));
    if (scope) streamUrl.searchParams.set('scope', String(scope));

    const response = await fetch(streamUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Failed to connect monitoring stream (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const pump = async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            const parsed = parseSseEventBlock(block);
            if (!parsed) continue;
            onMessage(parsed);
          }
        }
      } catch (error) {
        if (error?.name !== 'AbortError') onError(error);
      }
    };

    pump();

    return {
      close: () => controller.abort(),
    };
  },
};

export default adminService;
