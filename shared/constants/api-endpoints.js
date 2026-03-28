// API endpoint constants for the Herbal Medicine System

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
export const ML_SERVICE_BASE_URL = import.meta.env.VITE_ML_SERVICE_BASE_URL || 'http://localhost:8000/api';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    GOOGLE_SIGNIN: '/auth/google-signin',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    VERIFY_EMAIL: '/auth/verify-email',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
  },

  // Users
  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences',
    MEDICAL_INFO: '/users/medical-info',
    STATS: '/users/stats',
    RECOMMENDATION_HISTORY: '/users/recommendations/history',
    FAVORITES: '/users/favorites',
    SAVED: '/users/saved',
  },

  // Herbs
  HERBS: {
    LIST: '/herbs',
    DETAIL: (id) => `/herbs/${id}`,
    CREATE: '/herbs',
    UPDATE: (id) => `/herbs/${id}`,
    SEARCH: '/herbs/search',
    COMPARE: '/herbs/compare',
    RECOMMEND: '/herbs/recommend',
    SAFETY_ASSESS: (id) => `/herbs/${id}/safety/assess`,
    SAFETY_INTERACTIONS: (id) => `/herbs/${id}/safety/interactions`,
    SAFETY_CONTRAINDICATIONS: (id) => `/herbs/${id}/safety/contraindications`,
    SAFETY_COMBINATION: '/herbs/safety/combination',
    BY_SYMPTOM: '/herbs/by-symptom',
    BY_CATEGORY: '/herbs/by-category',
    FAVORITES: '/herbs/favorites',
    RECENT: '/herbs/recent',
    POPULAR: '/herbs/popular',
  },

  // Recommendations
  RECOMMENDATIONS: {
    CREATE: '/recommendations',
    LIST: '/recommendations',
    DETAIL: (id) => `/recommendations/${id}`,
    FEEDBACK: (id) => `/recommendations/${id}/feedback`,
    HISTORY: '/recommendations/history',
    SAVED: '/recommendations/saved',
  },

  // Locations
  LOCATIONS: {
    LIST: '/locations',
    DETAIL: (id) => `/locations/${id}`,
    NEARBY: '/locations/nearby',
    CLUSTERS: '/locations/clusters',
    BY_TYPE: '/locations/by-type',
    WITH_HERBS: '/locations/with-herbs',
    SEARCH: '/locations/search',
  },

  // Image Processing
  IMAGE_PROCESSING: {
    UPLOAD: '/image-processing/upload',
    IDENTIFY: '/image-processing/identify',
    ANALYZE: '/image-processing/analyze',
    HISTORY: '/image-processing/history',
  },

  // Blogs
  BLOGS: {
    LIST: '/blogs',
    DETAIL: (slug) => `/blogs/${slug}`,
    LIKE: (id) => `/blogs/${id}/like`,
    BOOKMARK: (id) => `/blogs/${id}/bookmark`,
    SAVED: '/blogs/saved',
    CREATE: '/blogs',
    UPDATE: (id) => `/blogs/${id}`,
    DELETE: (id) => `/blogs/${id}`,
    SEARCH: '/blogs/search',
    BY_CATEGORY: '/blogs/by-category',
    BY_AUTHOR: '/blogs/by-author',
    FEATURED: '/blogs/featured',
    RECENT: '/blogs/recent',
  },

  // Comments
  COMMENTS: {
    LIST: (blogId) => `/comments/blog/${blogId}`,
    CREATE: '/comments',
    UPDATE: (id) => `/comments/${id}`,
    DELETE: (id) => `/comments/${id}`,
    LIKE: (id) => `/comments/${id}/like`,
    REPLY: (id) => `/comments/${id}/reply`,
  },

  // Chatbot
  CHATBOT: {
    CONVERSATIONS: '/chatbot/conversations',
    CONVERSATION: (id) => `/chatbot/conversations/${id}`,
    SEND_MESSAGE: (id) => `/chatbot/conversations/${id}/messages`,
    HISTORY: '/chatbot/history',
    FEEDBACK: (id) => `/chatbot/conversations/${id}/feedback`,
  },

  // Admin
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    ANALYTICS: '/admin/analytics',
    USERS: '/admin/users',
    USER_STATUS_EMAIL_TEMPLATES: '/admin/users/status-email-templates',
    HERBS: '/admin/herbs',
    BLOGS: '/admin/blogs',
    COMMENTS: '/admin/comments',
    FEEDBACK: '/admin/feedback',
    LOCATIONS: '/admin/locations',
    CHATBOT_ANALYTICS: '/admin/chatbot-analytics',
    SYSTEM_SETTINGS: '/admin/settings',
    MONITORING: {
      OVERVIEW: '/admin/monitoring/overview',
      DASHBOARD_OVERVIEW: '/admin/monitoring/dashboard-overview',
      OPERATIONS: '/admin/monitoring/operations',
      ERROR_LOGS: '/admin/monitoring/error-logs',
      TOP_FAILING_ENDPOINTS: '/admin/monitoring/top-failing-endpoints',
      LATENCY_BY_ENDPOINT: '/admin/monitoring/latency-by-endpoint',
      SLO_SLA: '/admin/monitoring/slo-sla',
      ALERT_RULE: '/admin/monitoring/alert-rule',
      SAFETY_GOVERNANCE: '/admin/monitoring/safety-governance',
      RECOMMENDATION_INSIGHTS: '/admin/monitoring/recommendation-insights',
      IMAGE_CLASSIFIER_INSIGHTS: '/admin/monitoring/image-classifier-insights',
      BLOG_INSIGHTS: '/admin/monitoring/blog-insights',
      CHATBOT_INSIGHTS: '/admin/monitoring/chatbot-insights',
      AUDIT_TRAIL: '/admin/monitoring/audit-trail',
      EXPORT_CSV: '/admin/monitoring/export-csv',
      EXPORT_PDF: '/admin/monitoring/export-pdf',
    },
  },

  // ML Service
  ML_SERVICE: {
    PREDICT: '/predict',
    CLASSIFY_IMAGE: '/classify-image',
    UPDATE_MODEL: '/update-model',
    METRICS: '/metrics',
    TRAINING_STATUS: '/training-status',
  },
};

export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
};

export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export const REQUEST_TIMEOUT = 30000; // 30 seconds
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function buildUrl(endpoint, params = {}) {
  const url = new URL(endpoint, API_BASE_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
}

export function buildMLServiceUrl(endpoint, params = {}) {
  const url = new URL(endpoint, ML_SERVICE_BASE_URL);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  return url.toString();
}

export function getFullUrl(endpoint) {
  return `${API_BASE_URL}${endpoint}`;
}

export function getMLServiceFullUrl(endpoint) {
  return `${ML_SERVICE_BASE_URL}${endpoint}`;
}
