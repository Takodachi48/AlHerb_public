import api from './api';
import { API_ENDPOINTS } from '../../../shared/constants/api-endpoints';

const unwrapApiData = (response) => {
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data;
  }
  return response;
};

const LOCATION_QUERY_CACHE_TTL_MS = 45 * 1000;
const locationQueryCache = new Map();
const locationInFlight = new Map();

const normalizeCacheParams = (params = {}) => (
  Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
);

const buildCacheKey = (prefix, params = {}) => `${prefix}:${JSON.stringify(normalizeCacheParams(params))}`;

const getCachedValue = (key) => {
  const cached = locationQueryCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    locationQueryCache.delete(key);
    return null;
  }
  return cached.value;
};

const setCachedValue = (key, value) => {
  locationQueryCache.set(key, {
    value,
    expiresAt: Date.now() + LOCATION_QUERY_CACHE_TTL_MS
  });
};

const clearLocationQueryCache = () => {
  locationQueryCache.clear();
};

const isCanceledError = (error) => (
  error?.code === 'ERR_CANCELED'
  || error?.name === 'AbortError'
  || error?.message === 'canceled'
);

const cachedGet = async ({ key, fetcher, forceRefresh = false, signal }) => {
  if (signal?.aborted) {
    const abortError = new Error('canceled');
    abortError.name = 'AbortError';
    throw abortError;
  }

  if (!forceRefresh) {
    const cached = getCachedValue(key);
    if (cached) return cached;
  }

  // Do not share in-flight promises across callers when a cancellation signal is attached.
  if (signal) {
    const response = await fetcher();
    setCachedValue(key, response);
    return response;
  }

  const running = locationInFlight.get(key);
  if (running) return running;

  const pending = (async () => {
    const response = await fetcher();
    setCachedValue(key, response);
    return response;
  })();

  locationInFlight.set(key, pending);

  try {
    return await pending;
  } finally {
    locationInFlight.delete(key);
  }
};

const locationService = {
  /**
   * Fetch locations within viewport bounds with filters
   * @param {Object} bounds - Viewport bounds {minLng, minLat, maxLng, maxLat}
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} List of locations
   */
  async fetchLocations(bounds, filters = {}, options = {}) {
    try {
      const params = { ...filters };
      const { forceRefresh = false, signal } = options;

      if (bounds) {
        params.minLng = bounds.minLng;
        params.minLat = bounds.minLat;
        params.maxLng = bounds.maxLng;
        params.maxLat = bounds.maxLat;
        if (bounds.limit != null) params.limit = bounds.limit;
        if (bounds.page != null) params.page = bounds.page;
      }

      const key = buildCacheKey('locations:list', params);
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(API_ENDPOINTS.LOCATIONS.LIST, { params, signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error fetching locations:', error);
      throw error;
    }
  },

  /**
   * Search nearby locations
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {number} radius - Radius in km
   * @param {Object} filters - Additional filters
   */
  async searchNearby(lat, lng, radius, filters = {}, options = {}) {
    try {
      const { forceRefresh = false, signal } = options;
      const params = {
        lat,
        lng,
        radius: radius || 25,
        ...filters
      };

      const key = buildCacheKey('locations:nearby', params);
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(API_ENDPOINTS.LOCATIONS.NEARBY, { params, signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error searching nearby locations:', error);
      throw new Error(`Failed to search nearby: ${error.message}`);
    }
  },

  /**
   * Fetch location details by ID
   * @param {string} locationId 
   */
  async fetchLocationDetails(locationId, options = {}) {
    try {
      const { forceRefresh = false, signal } = options;
      const key = buildCacheKey('locations:detail', { locationId });
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(API_ENDPOINTS.LOCATIONS.DETAIL(locationId), { signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error fetching location details:', error);
      throw error;
    }
  },

  /**
   * Fetch reviews for a location
   */
  async fetchLocationReviews(locationId, params = {}, options = {}) {
    try {
      const { forceRefresh = false, signal } = options;
      const key = buildCacheKey('locations:reviews', { locationId, ...params });
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(`${API_ENDPOINTS.LOCATIONS.DETAIL(locationId)}/reviews`, { params, signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error fetching location reviews:', error);
      throw error;
    }
  },

  /**
   * Create a location review (supports single image upload)
   */
  async createLocationReview(locationId, reviewData = {}, options = {}) {
    try {
      const { signal } = options;
      const formData = new FormData();
      if (reviewData.comment) formData.append('comment', reviewData.comment);
      if (typeof reviewData.wouldReturn === 'boolean') {
        formData.append('wouldReturn', String(reviewData.wouldReturn));
      }
      if (reviewData.caption) formData.append('caption', reviewData.caption);
      if (reviewData.image instanceof File) {
        formData.append('image', reviewData.image);
      }

      const response = await api.post(
        `${API_ENDPOINTS.LOCATIONS.DETAIL(locationId)}/reviews`,
        formData,
        {
          signal,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );
      clearLocationQueryCache();
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error creating location review:', error);
      throw error;
    }
  },

  /**
   * Fetch all locations (shortcut for simple list)
   */
  async fetchAllLocations(filters = {}, options = {}) {
    try {
      const { forceRefresh = false, signal } = options;
      const key = buildCacheKey('locations:all', filters);
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(API_ENDPOINTS.LOCATIONS.LIST, { params: filters, signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error fetching all locations:', error);
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }
  },

  /**
   * Fetch available herbs for filtering
   */
  async fetchAvailableHerbs(options = {}) {
    try {
      const { forceRefresh = false } = options;
      const params = {
        limit: 100,
        select: 'name scientificName commonNames'
      };
      const key = buildCacheKey('locations:available-herbs', params);
      const response = await cachedGet({
        key,
        forceRefresh,
        fetcher: () => api.get(API_ENDPOINTS.HERBS.LIST, { params })
      });

      const data = response.data || response;
      return Array.isArray(data) ? data : (data.data || []);
    } catch (error) {
      console.error('Error fetching herbs for filter:', error);
      throw new Error(`Failed to fetch herbs: ${error.message}`);
    }
  },

  /**
   * Transform API data to GeoJSON for map
   */
  transformToGeoJSON(locations) {
    if (!Array.isArray(locations)) return { type: 'FeatureCollection', features: [] };

    return {
      type: 'FeatureCollection',
      features: locations.map(location => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            location.coordinates?.lng || location.location?.coordinates?.[0] || 0,
            location.coordinates?.lat || location.location?.coordinates?.[1] || 0
          ]
        },
        properties: {
          id: location._id || location.id,
          name: location.name,
          category: location.type,
          type: location.type,
          rating: location.rating,
          address: location.address || null,
          ...location.properties
        }
      }))
    };
  },

  /**
   * Fetch clustered locations for current map viewport.
   * @param {Object} bounds - { swLat, swLng, neLat, neLng }
   * @param {number} zoom
   * @param {Object} filters
   */
  async fetchClusters(bounds, zoom, filters = {}, options = {}) {
    try {
      const { forceRefresh = false, signal } = options;
      const normalizedZoom = Math.max(1, Math.min(20, Math.round(Number(zoom) || 10)));
      const params = {
        ...bounds,
        zoom: normalizedZoom,
        type: filters.type,
        herb: filters.herb,
        search: filters.search
      };

      const key = buildCacheKey('locations:clusters', params);
      const response = await cachedGet({
        key,
        forceRefresh,
        signal,
        fetcher: () => api.get(API_ENDPOINTS.LOCATIONS.CLUSTERS, { params, signal })
      });
      return response;
    } catch (error) {
      if (isCanceledError(error)) throw error;
      console.error('Error fetching location clusters:', error);
      throw new Error(`Failed to fetch clusters: ${error.message}`);
    }
  },

  /**
   * Convert a Leaflet click event to the backend GeoJSON payload.
   * @param {Object} leafletEvent - Leaflet click event with e.latlng
   */
  buildGeoPointFromLeafletClick(leafletEvent) {
    const lat = leafletEvent?.latlng?.lat;
    const lng = leafletEvent?.latlng?.lng;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new Error('Invalid Leaflet click event. Expected e.latlng.lat/lng.');
    }

    return {
      type: 'Point',
      coordinates: [lng, lat]
    };
  },

  /**
   * Fetch paginated locations for admin
   */
  async fetchLocationsWithPagination(params = {}, config = {}) {
    try {
      const normalizedParams = { ...params };
      if (normalizedParams.category && !normalizedParams.type) {
        normalizedParams.type = normalizedParams.category;
        delete normalizedParams.category;
      }

      const response = await api.get(API_ENDPOINTS.ADMIN.LOCATIONS, {
        ...config,
        params: normalizedParams
      });

      // The useAdminList hook handles formatting, but we ensure consistent response here
      return response;
    } catch (error) {
      if (error.code === 'ERR_CANCELED' || error.name === 'AbortError' || error.message === 'canceled') throw error;
      console.error('Error fetching paginated locations:', error);
      throw error;
    }
  },

  /**
   * Create location
   */
  async createLocation(locationData) {
    const response = await api.post(API_ENDPOINTS.LOCATIONS.LIST, locationData);
    clearLocationQueryCache();
    return response;
  },

  /**
   * Update location
   */
  async updateLocation(locationId, locationData) {
    const response = await api.put(API_ENDPOINTS.LOCATIONS.DETAIL(locationId), locationData);
    clearLocationQueryCache();
    return response;
  },

  /**
   * Delete location
   */
  async deleteLocation(locationId) {
    const response = await api.delete(API_ENDPOINTS.LOCATIONS.DETAIL(locationId));
    clearLocationQueryCache();
    return response;
  },

  /**
   * Fetch unique categories
   */
  async fetchUniqueCategories() {
    try {
      const response = await api.get(`${API_ENDPOINTS.ADMIN.LOCATIONS}/categories`);
      const categories = unwrapApiData(response);
      return {
        categories: Array.isArray(categories) ? categories : []
      };
    } catch (error) {
      console.warn('Fallback: Error fetching categories:', error);
      return { categories: ['market', 'shop', 'foraging', 'pharmacy', 'clinic'] };
    }
  },

  /**
   * Fetch unique statuses
   */
  async fetchUniqueStatuses() {
    try {
      const response = await api.get(`${API_ENDPOINTS.ADMIN.LOCATIONS}/statuses`);
      const statuses = unwrapApiData(response);
      return {
        statuses: Array.isArray(statuses) ? statuses : ['active', 'inactive']
      };
    } catch (error) {
      console.warn('Fallback: Error fetching statuses:', error);
      return { statuses: ['active', 'inactive'] };
    }
  },

  /**
   * Fetch location statistics
   */
  async fetchLocationStats() {
    try {
      const response = await api.get(`${API_ENDPOINTS.ADMIN.LOCATIONS}/stats`);
      const stats = unwrapApiData(response);
      return {
        total: stats?.total || 0,
        active: stats?.active || 0,
        inactive: stats?.inactive || 0,
        byType: stats?.byType || {}
      };
    } catch (error) {
      console.error('Error fetching location stats:', error);
      return {
        total: 0,
        byType: { market: 0, shop: 0, foraging: 0, pharmacy: 0, clinic: 0 }
      };
    }
  },

  /**
   * Get mock location data for development/fallback
   */
  getMockLocations(center, count = 20) {
    const mockLocations = [
      {
        _id: 'mock1',
        name: 'Manila Herbal Market',
        type: 'market',
        coordinates: [121.7740, 12.8797],
        address: 'Quiapo, Manila, Philippines',
        herbs: [
          { herbId: { _id: 'herb1', name: 'Lagundi', scientificName: 'Vitex negundo' }, availability: 'available' },
          { herbId: { _id: 'herb2', name: 'Ampalaya', scientificName: 'Carica papaya' }, availability: 'available' }
        ]
      },
      {
        _id: 'mock2',
        name: 'Quezon City Herbal Shop',
        type: 'shop',
        coordinates: [121.0437, 14.6761],
        address: 'Quezon City, Philippines',
        herbs: [
          { herbId: { _id: 'herb3', name: 'Sambong', scientificName: 'Blumea balsamifera' }, availability: 'limited' }
        ]
      }
    ];

    // Generate additional mock locations if needed
    const locations = [...mockLocations];
    for (let i = mockLocations.length; i < count; i++) {
      locations.push({
        _id: `mock${i + 1}`,
        name: `Herbal Location ${i + 1}`,
        type: ['market', 'shop', 'foraging'][i % 3],
        coordinates: [
          center.lng + (Math.random() - 0.5) * 0.1,
          center.lat + (Math.random() - 0.5) * 0.1
        ],
        address: `Mock Address ${i + 1}, Philippines`,
        herbs: []
      });
    }

    return locations;
  }
};

export default locationService;
