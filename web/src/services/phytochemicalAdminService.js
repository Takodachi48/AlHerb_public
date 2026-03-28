import api from './api';

const unwrap = (response) => (response?.data?.data ?? response?.data ?? response);

const phytochemicalAdminService = {
  async list(params = {}) {
    const response = await api.get('/admin/phytochemicals', { params });
    return {
      items: unwrap(response) || [],
      pagination: response?.data?.pagination || response?.pagination || {},
    };
  },

  async detail(id, params = {}) {
    const response = await api.get(`/admin/phytochemicals/${id}`, { params });
    return unwrap(response);
  },

  async create(payload) {
    const response = await api.post('/admin/phytochemicals', payload);
    return unwrap(response);
  },

  async update(id, payload) {
    const response = await api.put(`/admin/phytochemicals/${id}`, payload);
    return unwrap(response);
  },

  async archive(id) {
    const response = await api.patch(`/admin/phytochemicals/${id}/archive`);
    return unwrap(response);
  },

  async searchHerbs(query, limit = 20) {
    const response = await api.get('/admin/phytochemicals/herbs/search', {
      params: { q: query, limit },
    });
    return unwrap(response) || [];
  },

  async saveAssignment(payload) {
    const response = await api.post('/admin/phytochemical-assignments', payload);
    return unwrap(response);
  },
};

export default phytochemicalAdminService;
