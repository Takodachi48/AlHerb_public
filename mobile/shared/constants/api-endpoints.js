// API endpoint constants for the Herbal Medicine System
// Mobile contract aligned with current server routes

import { Platform } from 'react-native';
import { getApiUrl } from '../../config/api';

export const API_BASE_URL = getApiUrl(Platform.OS);

export const API_ENDPOINTS = {
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

  USERS: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    PREFERENCES: '/users/preferences',
    MEDICAL_INFO: '/users/medical-info',
    STATS: '/users/stats',
    RECOMMENDATION_HISTORY: '/users/recommendations/history',
    FAVORITES: '/users/favorites',
    SAVED: '/users/saved',
    DELETE_ACCOUNT: '/users/account',
  },

  HERBS: {
    LIST: '/herbs',
    DETAIL: (id) => `/herbs/${id}`,
    SEARCH: '/herbs/search',
    COMPARE: '/herbs/compare',
    RECOMMEND: '/herbs/recommend',
    SAFETY_ASSESS: (id) => `/herbs/${id}/safety/assess`,
    SAFETY_INTERACTIONS: (id) => `/herbs/${id}/safety/interactions`,
    SAFETY_CONTRAINDICATIONS: (id) => `/herbs/${id}/safety/contraindications`,
    SAFETY_COMBINATION: '/herbs/safety/combination',
    BY_SYMPTOM: (symptom) => `/herbs/by-symptom/${encodeURIComponent(symptom)}`,
    BY_CATEGORY: (category) => `/herbs/by-category/${encodeURIComponent(category)}`,
    RECENT: '/herbs/recent',
    STATS: '/herbs/stats',
  },

  LOCATIONS: {
    LIST: '/locations',
    DETAIL: (id) => `/locations/${id}`,
    NEARBY: '/locations/nearby',
    CLUSTERS: '/locations/clusters',
  },

  BLOGS: {
    LIST: '/blogs',
    DETAIL_BY_SLUG: (slug) => `/blogs/slug/${encodeURIComponent(slug)}`,
    DETAIL_BY_ID: (id) => `/blogs/${id}`,
    CREATE: '/blogs',
    UPDATE: (id) => `/blogs/${id}`,
    DELETE: (id) => `/blogs/${id}`,
    SEARCH: '/blogs/search',
    FEATURED: '/blogs/featured',
    TRENDING: '/blogs/trending',
    CATEGORIES: '/blogs/categories',
    LIKE: (id) => `/blogs/${id}/like`,
    BOOKMARK: (id) => `/blogs/${id}/bookmark`,
    SAVED: '/blogs/saved',
    USER_BLOGS: '/blogs/user/blogs',
    REQUEST_APPROVAL: (id) => `/blogs/${id}/request-approval`,
    STATUS: (id) => `/blogs/${id}/status`,
  },

  COMMENTS: {
    LIST: (blogId) => `/comments/blog/${blogId}`,
    CREATE: '/comments',
    UPDATE: (id) => `/comments/${id}`,
    DELETE: (id) => `/comments/${id}`,
    LIKE: (id) => `/comments/${id}/like`,
  },

  CHAT: {
    SEND: '/chat/send',
  },

  IMAGES: {
    AVATAR: '/images/avatar',
    GENERAL_UPLOAD: '/images/upload',
    BLOG_UPLOAD: '/images/blog',
    IDENTIFICATION: '/images/plant-identification',
    IDENTIFICATION_BY_ID: (id) => `/images/plant-identification/${id}`,
    IDENTIFICATION_FEEDBACK: (id) => `/images/plant-identification/${id}/feedback`,
  },

  ADMIN: {
    USERS: '/admin/users',
    USER_STATUS_EMAIL_TEMPLATES: '/admin/users/status-email-templates',
    HERBS: '/admin/herbs',
    BLOGS: '/admin/blogs',
    LOCATIONS: '/admin/locations',
    MONITORING_DASHBOARD_OVERVIEW: '/admin/monitoring/dashboard-overview',
  },
  NOTIFICATIONS: {
    LIST: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_READ: (id) => `/notifications/${id}/read`,
    MARK_ALL_READ: '/notifications/mark-all-read',
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

export function getFullUrl(endpoint) {
  return `${API_BASE_URL}${endpoint}`;
}
