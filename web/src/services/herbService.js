import api from './api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const QUERY_CACHE_TTL_MS = 60 * 1000;
const queryCache = new Map();
const unwrapPayload = (response) => response?.data?.data ?? response?.data ?? response;

const buildCacheKey = (prefix, params = {}) => {
  const normalized = Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return `${prefix}:${JSON.stringify(normalized)}`;
};

const getCached = (key) => {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return entry.value;
};

const setCached = (key, value) => {
  queryCache.set(key, { value, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
};

const clearQueryCache = () => {
  queryCache.clear();
};

const herbService = {
  /**
   * Get all herbs with pagination and filtering
   */
  getAllHerbs: async (params = {}, options = {}) => {
    const { forceRefresh = false } = options;
    const key = buildCacheKey('herbs:list', params);
    if (!forceRefresh) {
      const cached = getCached(key);
      if (cached) return cached;
    }
    const response = await api.get(API_ENDPOINTS.HERBS.LIST, { params });
    setCached(key, response);
    return response;
  },

  /**
   * Get herb by ID or slug
   */
  getHerbById: async (id) => {
    return api.get(API_ENDPOINTS.HERBS.DETAIL(id));
  },

  /**
   * Search herbs
   */
  searchHerbs: async (query, options = {}) => {
    const params = { q: query };
    const { forceRefresh = false } = options;
    const key = buildCacheKey('herbs:search', params);
    if (!forceRefresh) {
      const cached = getCached(key);
      if (cached) return cached;
    }
    const response = await api.get(API_ENDPOINTS.HERBS.SEARCH, { params });
    setCached(key, response);
    return response;
  },

  compareHerbs: async ({ herb1, herb2, symptom, ageGroup = 'adult', includeSafety = true }) => {
    return api.get(API_ENDPOINTS.HERBS.COMPARE, {
      params: {
        herb1,
        herb2,
        symptom: symptom || undefined,
        ageGroup,
        includeSafety,
      },
    });
  },

  recommendHerbs: async ({ symptoms, userProfile = {}, topN = 10 }) => {
    const response = await api.post(API_ENDPOINTS.HERBS.RECOMMEND, { symptoms, userProfile, topN });
    const payload = unwrapPayload(response);
    return payload && typeof payload === 'object' ? payload : null;
  },

  getRecommendationHistory: async ({
    page = 1,
    limit = 20,
    dateFrom,
    dateTo,
    rankingSource,
    blocked,
  } = {}) => {
    const response = await api.get(API_ENDPOINTS.USERS.RECOMMENDATION_HISTORY, {
      params: {
        page,
        limit,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        rankingSource: rankingSource || undefined,
        blocked: blocked || undefined,
      },
    });
    const payload = unwrapPayload(response);
    return payload && typeof payload === 'object' ? payload : { items: [], pagination: null };
  },

  assessHerbSafety: async (herbId, userProfile = {}) => {
    return api.post(API_ENDPOINTS.HERBS.SAFETY_ASSESS(herbId), { userProfile });
  },

  getHerbInteractions: async (herbId, { type, minSeverity, medications = [] } = {}) => {
    return api.post(API_ENDPOINTS.HERBS.SAFETY_INTERACTIONS(herbId), {
      type,
      minSeverity,
      medications,
    });
  },

  getHerbContraindications: async (herbId, conditions = []) => {
    return api.post(API_ENDPOINTS.HERBS.SAFETY_CONTRAINDICATIONS(herbId), { conditions });
  },

  checkCombinationSafety: async (herbIds = []) => {
    return api.post(API_ENDPOINTS.HERBS.SAFETY_COMBINATION, { herbIds });
  },

  /**
   * Get herbs for admin with pagination and filtering
   */
  getHerbsAdmin: async (params = {}, config = {}) => {
    return api.get(API_ENDPOINTS.ADMIN.HERBS, {
      ...config,
      params
    });
  },

  /**
   * Get herb statistics
   */
  getHerbsStats: async (config = {}) => {
    const response = await api.get(`${API_ENDPOINTS.ADMIN.HERBS}/stats`, config);
    return response.data || response;
  },

  /**
   * Create new herb
   */
  createHerb: async (herbData) => {
    const formData = new FormData();
    
    // Auto-generate name from first common name
    let commonNamesArray = [];
    if (herbData.commonNames) {
      if (typeof herbData.commonNames === 'string') {
        commonNamesArray = herbData.commonNames.split(',').map(name => name.trim()).filter(name => name);
      } else if (Array.isArray(herbData.commonNames)) {
        commonNamesArray = herbData.commonNames.filter(name => name && typeof name === 'string').map(name => name.trim());
      }
    }
    
    const primaryName = commonNamesArray.length > 0 ? commonNamesArray[0] : herbData.scientificName;
    
    // Add basic fields
    formData.append('name', primaryName);
    formData.append('scientificName', herbData.scientificName);
    formData.append('isActive', herbData.isActive);
    
    // Add common names as array
    if (commonNamesArray.length > 0) {
      commonNamesArray.forEach((name, index) => {
        formData.append(`commonNames[${index}]`, name);
      });
    }
    
    // Add images as array - use 'images' field name for array upload.
    // If image objects include isPrimary, send primary image first.
    if (herbData.images && Array.isArray(herbData.images)) {
      const imageEntries = herbData.images
        .map((image) => {
          if (!image) return null;
          if (image instanceof File) return { file: image, isPrimary: false };
          if (image.file instanceof File) return { file: image.file, isPrimary: Boolean(image.isPrimary) };
          return null;
        })
        .filter(Boolean);

      imageEntries.sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)));

      imageEntries.forEach((entry) => {
        formData.append('images', entry.file);
      });
    }
    
    const response = await api.post(API_ENDPOINTS.HERBS.CREATE, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    clearQueryCache();
    return response;
  },

  /**
   * Update herb
   */
  updateHerb: async (id, herbData) => {
    const response = await api.put(API_ENDPOINTS.HERBS.UPDATE(id), herbData);
    clearQueryCache();
    return response;
  },

  /**
   * Delete herb
   */
  deleteHerb: async (id) => {
    const response = await api.delete(API_ENDPOINTS.HERBS.DETAIL(id));
    clearQueryCache();
    return response;
  },

  /**
   * Delete specific herb images
   */
  deleteHerbImages: async (id, imageUrls = []) => {
    return api.delete(`${API_ENDPOINTS.HERBS.DETAIL(id)}/images`, {
      data: { imageUrls }
    });
  },

  /**
   * Toggle herb status
   */
  toggleHerbStatus: async (id, isActive) => {
    try {
      const response = await api.patch(`${API_ENDPOINTS.HERBS.DETAIL(id)}/status`, { isActive });
      clearQueryCache();
      return response.data || response;
    } catch (error) {
      // Fallback
      const response = await api.put(API_ENDPOINTS.HERBS.DETAIL(id), { isActive });
      clearQueryCache();
      return response;
    }
  },

  /**
   * Bulk toggle herb status
   */
  bulkToggleHerbStatus: async (herbIds, isActive) => {
    try {
      const response = await api.patch(`${API_ENDPOINTS.ADMIN.HERBS}/bulk-status`, { herbIds, isActive });
      clearQueryCache();
      return response.data || response;
    } catch (error) {
      console.warn('Bulk status update failed, falling back to individual updates');
      const promises = herbIds.map(id => herbService.toggleHerbStatus(id, isActive));
      return Promise.all(promises);
    }
  },

  /**
   * Fetch favorite herbs
   */
  getFavoriteHerbs: async () => {
    return api.get(API_ENDPOINTS.USERS.FAVORITES);
  },

  /**
   * Toggle favorites
   */
  addToFavorites: async (herbId) => {
    return api.post(API_ENDPOINTS.USERS.FAVORITES, { herbId });
  },

  removeFromFavorites: async (herbId) => {
    return api.delete(`${API_ENDPOINTS.USERS.FAVORITES}/${herbId}`);
  }
};

export { herbService };
export default herbService;
