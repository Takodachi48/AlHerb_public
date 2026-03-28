import api from './api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const unwrapPayload = (response) => response?.data?.data ?? response?.data ?? null;

const userProfileService = {
  getProfile: async () => {
    const response = await api.get(API_ENDPOINTS.USERS.PROFILE);
    const payload = unwrapPayload(response);
    return payload && typeof payload === 'object' ? payload : null;
  },
  updateProfile: async (payload) => {
    const response = await api.put(API_ENDPOINTS.USERS.UPDATE_PROFILE, payload);
    return unwrapPayload(response);
  },
};

export default userProfileService;
