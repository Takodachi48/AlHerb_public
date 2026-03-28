import api from './api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const userService = {
  /**
   * Get all users with pagination and filtering
   */
  getAllUsers: async (params = {}, config = {}) => {
    return api.get(API_ENDPOINTS.ADMIN.USERS, {
      ...config,
      params
    });
  },

  /**
   * Get user by ID
   */
  getUserById: async (id) => {
    return api.get(`${API_ENDPOINTS.ADMIN.USERS}/${id}`);
  },

  /**
   * Update user status
   */
  updateUserStatus: async (userId, isActive, reasonTemplateKey = null) => {
    const payload = { isActive };
    if (!isActive && reasonTemplateKey) {
      payload.reasonTemplateKey = reasonTemplateKey;
    }

    const response = await api.patch(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/status`, {
      ...payload
    });
    return response;
  },

  /**
   * Batch update user status
   */
  batchUpdateUserStatus: async (userIds, isActive, reasonTemplateKey = null) => {
    const payload = { userIds, isActive };
    if (!isActive && reasonTemplateKey) {
      payload.reasonTemplateKey = reasonTemplateKey;
    }

    const response = await api.patch(`${API_ENDPOINTS.ADMIN.USERS}/batch-status`, {
      ...payload
    });
    return response;
  },

  /**
   * Update user role
   */
  updateUserRole: async (userId, role) => {
    const response = await api.patch(`${API_ENDPOINTS.ADMIN.USERS}/${userId}/role`, {
      role
    });
    return response;
  },

  /**
   * Get user statistics
   */
  getUserStats: async (config = {}) => {
    const response = await api.get(`${API_ENDPOINTS.ADMIN.USERS}/stats`, config);
    return response;
  },

  getUserStatusEmailTemplates: async () => {
    return api.get(API_ENDPOINTS.ADMIN.USER_STATUS_EMAIL_TEMPLATES);
  },

  /**
   * Search users (Note: often handled via getAllUsers with query params)
   */
  searchUsers: async (query, params = {}) => {
    const response = await api.get(`${API_ENDPOINTS.ADMIN.USERS}/search`, {
      params: { q: query, ...params }
    });
    return response;
  }
};

export default userService;
