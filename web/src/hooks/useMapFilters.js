import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const DEFAULT_FILTERS = {
  type: 'all',
  herb: '',
  radius: 10,
  search: '',
  lat: null,
  lng: null,
  zoom: 13
};

export const useMapFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL or defaults
  const [filters, setFilters] = useState(() => {
    const urlFilters = {};
    for (const key of Object.keys(DEFAULT_FILTERS)) {
      const value = searchParams.get(key);
      if (value !== null) {
        urlFilters[key] = key === 'radius' || key === 'zoom' ?
          parseInt(value, 10) :
          value === 'null' ? null : value;
      }
    }
    return { ...DEFAULT_FILTERS, ...urlFilters };
  });

  // Update URL when filters change
  useEffect(() => {
    const newParams = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      // Skip lat, lng, and zoom - don't show coordinates in URL
      if (value !== null && value !== DEFAULT_FILTERS[key] &&
        !['lat', 'lng', 'zoom'].includes(key)) {
        newParams.set(key, value.toString());
      }
    });

    setSearchParams(newParams);
  }, [filters, setSearchParams]);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const updateFilters = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Get API query parameters
  const getQueryParams = () => {
    const params = {};
    if (filters.radius !== DEFAULT_FILTERS.radius) {
      params.radius = filters.radius;
    }
    if (filters.type !== DEFAULT_FILTERS.type) {
      params.type = filters.type;
    }
    if (filters.search) {
      params.search = filters.search;
    }
    if (filters.herb) {
      params.herb = filters.herb;
    }
    return params;
  };

  return {
    filters,
    updateFilter,
    updateFilters,
    resetFilters,
    getQueryParams,
    searchParams
  };
};
