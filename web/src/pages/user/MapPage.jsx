import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Loading from '../../components/common/Loading';
import InteractiveMap from '../../components/map/InteractiveMap';
import MapSidePanel from '../../components/map/MapSidePanel';
import { useMapFilters } from '../../hooks/useMapFilters';
import { useToast } from '../../hooks/useToast';
import { useAuthContext } from '../../context/AuthContext';
import locationService from '../../services/locationService';
import userLocationService from '../../services/userLocationService';

const MAX_SEARCH_RADIUS_KM = 50;
const MIN_SEARCH_RADIUS_KM = 1;
const MAX_SEARCH_RESULTS = 300;

const MapPage = () => {
  const navigate = useNavigate();
  const [canAnimateLayout, setCanAnimateLayout] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setCanAnimateLayout(true));
    return () => window.cancelAnimationFrame(id);
  }, []);
  const toast = useToast();
  const { user } = useAuthContext();
  const [userLocation, setUserLocation] = useState(null);
  const [userLocationSource, setUserLocationSource] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [locations, setLocations] = useState([]);
  const [mapItems, setMapItems] = useState([]);
  const [viewport, setViewport] = useState(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('filters');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [markersVisible, setMarkersVisible] = useState(true);
  const [centerRequestId, setCenterRequestId] = useState(0);
  const [centerZoom, setCenterZoom] = useState(11);
  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [availableHerbs, setAvailableHerbs] = useState([]);
  const [collapsedSections, setCollapsedSections] = useState({
    locationType: false,
    searchRadius: false
  });
  const mapRef = useRef(null);
  const viewportDebounceRef = useRef(null);
  const lastViewportKeyRef = useRef('');
  const lastClusterRequestKeyRef = useRef('');
  const lastNonRadiusFiltersRef = useRef('');
  const viewportActiveRef = useRef(false);
  const latestLocationsRequestRef = useRef(0);
  const latestDetailsRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const activeLocationsAbortRef = useRef(null);
  const activeDetailsAbortRef = useRef(null);
  const locationNoticeToastShownRef = useRef(false);
  const locationNoticeToastIdRef = useRef(null);
  const lastClusteredDataRef = useRef(null);
  const lastUnfilteredLocationsRef = useRef(null);

  // Use the custom filter hook
  const { filters, updateFilter, updateFilters, resetFilters } = useMapFilters();
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search || '');
  const hasCoordinates = Boolean(userLocation?.lat && userLocation?.lng);
  const effectiveRadiusKm = Math.min(
    MAX_SEARCH_RADIUS_KM,
    Math.max(MIN_SEARCH_RADIUS_KM, Number(filters.radius) || 10)
  );

  const normalizeLocationImages = (images) => {
    if (!Array.isArray(images)) return [];

    return images
      .map((image, index) => {
        if (!image) return null;

        if (typeof image === 'string') {
          return {
            url: image,
            caption: '',
            isPrimary: index === 0
          };
        }

        if (typeof image === 'object' && image.url) {
          return {
            url: image.url,
            caption: image.caption || '',
            isPrimary: Boolean(image.isPrimary)
          };
        }

        return null;
      })
      .filter(Boolean);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const extractAddressText = (location) => {
    const derived = location?.derivedLocation || {};
    const addressParts = [
      location?.address,
      derived.barangay,
      derived.city,
      derived.province,
      derived.region,
      derived.country
    ].filter(Boolean);

    return addressParts.join(' ');
  };

  const buildHerbNamesText = (location) => {
    const herbs = Array.isArray(location?.herbs) ? location.herbs : [];
    return herbs.map((item) => {
      const herbRef = item?.herbId || item?.herb || item;
      return herbRef?.name || item?.name || '';
    }).filter(Boolean).join(' ');
  };

  const extractLocationsPayload = (response) => {
    if (Array.isArray(response)) return { locations: response, pagination: null };
    const data = response?.data ?? response;
    if (Array.isArray(data?.locations)) {
      return { locations: data.locations, pagination: data.pagination || null };
    }
    if (Array.isArray(data)) return { locations: data, pagination: null };
    if (Array.isArray(response?.locations)) {
      return { locations: response.locations, pagination: response.pagination || null };
    }
    return { locations: [], pagination: null };
  };

  const fetchBoundedLocationsPaged = useCallback(async (bounds, signal) => {
    const collected = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && collected.length < MAX_SEARCH_RESULTS) {
      if (signal?.aborted) {
        const abortError = new Error('canceled');
        abortError.name = 'AbortError';
        throw abortError;
      }

      const response = await locationService.fetchLocations({
        minLat: bounds.swLat,
        minLng: bounds.swLng,
        maxLat: bounds.neLat,
        maxLng: bounds.neLng,
        limit: 100,
        page
      }, {
        compact: false
      }, { signal });

      const { locations: batch, pagination } = extractLocationsPayload(response);
      if (batch.length > 0) {
        collected.push(...batch);
      }

      hasMore = Boolean(pagination?.hasMore) && batch.length > 0;
      page += 1;
    }

    return collected.slice(0, MAX_SEARCH_RESULTS);
  }, []);

  const applyMobileFilters = useCallback((locationsInput = []) => {
    let combined = Array.isArray(locationsInput) ? [...locationsInput] : [];
    const herbFilter = String(filters.herb || '').trim();
    const typeFilter = String(filters.type || 'all').trim();
    const query = String(debouncedSearch || '').trim().toLowerCase();

    if (herbFilter) {
      combined = combined.filter((location) => {
        const inventory = Array.isArray(location?.herbs) ? location.herbs : [];
        return inventory.some((item) => {
          const herbRef = item?.herbId || item?.herb || item;
          const herbId = String(herbRef?._id || herbRef || '');
          return herbId === herbFilter;
        });
      });
    }

    if (typeFilter && typeFilter !== 'all') {
      combined = combined.filter((location) => {
        const value = String(location?.type || location?.category || '').toLowerCase();
        return value === typeFilter.toLowerCase();
      });
    }

    if (query && !herbFilter) {
      combined = combined.filter((location) => {
        const hay = [
          location?.name,
          location?.type,
          extractAddressText(location),
          buildHerbNamesText(location)
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(query);
      });
    }

    if (userLocation?.lat && userLocation?.lng) {
      const radiusKm = Math.min(
        MAX_SEARCH_RADIUS_KM,
        Math.max(MIN_SEARCH_RADIUS_KM, Number(filters.radius) || 10)
      );
      combined = combined.map((location) => {
        const coords = getLocationCoords(location);
        if (!coords) return { ...location, distance: Infinity };
        const dist = calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
        return { ...location, distance: Math.round(dist * 10) / 10 };
      }).filter((location) => location.distance <= radiusKm);
    }

    return combined;
  }, [debouncedSearch, filters.herb, filters.radius, filters.type, userLocation]);

  const getLocationCoords = (location) => {
    if (location?.location?.coordinates?.length === 2) {
      return {
        lng: location.location.coordinates[0],
        lat: location.location.coordinates[1]
      };
    }

    if (location?.coordinates?.length === 2) {
      return {
        lng: location.coordinates[0],
        lat: location.coordinates[1]
      };
    }

    if (typeof location?.lat === 'number' && typeof location?.lng === 'number') {
      return {
        lat: location.lat,
        lng: location.lng
      };
    }

    return null;
  };

  const normalizeLocationsResponse = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.locations)) return response.locations;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.locations)) return response.data.locations;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data?.results)) return response.data.results;
    if (Array.isArray(response?.data?.items)) return response.data.items;
    return [];
  };

  const normalizeClusterResponse = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (Array.isArray(response?.data?.results)) return response.data.results;
    if (Array.isArray(response?.results)) return response.results;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.clusters)) return response.clusters;
    if (Array.isArray(response?.data?.clusters)) return response.data.clusters;
    return [];
  };

  const buildClusterMapData = (clusters) => {
    const uniqueLocations = new Map();
    const items = [];

    clusters.forEach((cluster, index) => {
      const clusterLocations = Array.isArray(cluster.locations) ? cluster.locations : [];

      clusterLocations.forEach((location) => {
        const id = location._id || location.id;
        if (!id || uniqueLocations.has(id)) return;
        uniqueLocations.set(id, location);
      });

      if (cluster.count > 1) {
        items.push({
          id: cluster.geohash || `cluster-${index}`,
          isCluster: true,
          count: cluster.count,
          coordinates: cluster.center?.coordinates || [],
          locations: clusterLocations
        });
      } else if (clusterLocations[0]) {
        items.push(clusterLocations[0]);
      }
    });

    const locationList = Array.from(uniqueLocations.values());
    return { items, locationList };
  };

  const applyRadiusFilterToMapData = useCallback((items, locationList) => {
    const shouldApplyRadius = Boolean(userLocation?.lat && userLocation?.lng);
    if (!shouldApplyRadius || !userLocation?.lat || !userLocation?.lng || !filters.radius) {
      return { items, locationList };
    }

    const radiusKm = Math.min(
      MAX_SEARCH_RADIUS_KM,
      Math.max(MIN_SEARCH_RADIUS_KM, Number(filters.radius) || 10)
    );
    const filteredItems = [];
    const uniqueLocations = new Map();

    items.forEach((item) => {
      if (item.isCluster) {
        const inside = (item.locations || []).filter((location) => {
          const coords = getLocationCoords(location);
          if (!coords) return false;
          const distance = calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
          return distance <= radiusKm;
        }).map((location) => {
          const coords = getLocationCoords(location);
          const distance = coords
            ? Math.round(calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng) * 10) / 10
            : undefined;
          return { ...location, distance };
        });

        if (inside.length === 0) return;

        inside.forEach((location) => {
          const id = location._id || location.id;
          if (!id || uniqueLocations.has(id)) return;
          uniqueLocations.set(id, location);
        });

        if (inside.length === 1) {
          filteredItems.push(inside[0]);
          return;
        }

        const center = inside.reduce((acc, location) => {
          const coords = getLocationCoords(location);
          if (!coords) return acc;
          return {
            lng: acc.lng + coords.lng,
            lat: acc.lat + coords.lat
          };
        }, { lng: 0, lat: 0 });

        filteredItems.push({
          ...item,
          count: inside.length,
          locations: inside,
          coordinates: [center.lng / inside.length, center.lat / inside.length]
        });
        return;
      }

      const coords = getLocationCoords(item);
      if (!coords) return;
      const distance = calculateDistance(userLocation.lat, userLocation.lng, coords.lat, coords.lng);
      if (distance > radiusKm) return;

      const enriched = { ...item, distance: Math.round(distance * 10) / 10 };
      filteredItems.push(enriched);
      const id = enriched._id || enriched.id;
      if (id && !uniqueLocations.has(id)) {
        uniqueLocations.set(id, enriched);
      }
    });

    return {
      items: filteredItems,
      locationList: Array.from(uniqueLocations.values())
    };
  }, [filters.radius, userLocation, userLocationSource]);

  // Load available herbs from API once on mount
  useEffect(() => {
    loadAvailableHerbs();
  }, []);

  useEffect(() => {
    viewportActiveRef.current = Boolean(viewport?.bounds);
  }, [viewport]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search || '');
    }, 350);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    if (locationNoticeToastShownRef.current) return;
    if (hasCoordinates) return;

    const timer = setTimeout(() => {
      if (locationNoticeToastShownRef.current || hasCoordinates) return;
      const toastId = toast.info(
        'Log in and set your general location or enable location to see nearby points of interest',
        0
      );
      locationNoticeToastIdRef.current = toastId;
      locationNoticeToastShownRef.current = true;
    }, 350);

    return () => clearTimeout(timer);
  }, [hasCoordinates, toast]);

  useEffect(() => {
    if (Number(filters.radius) !== effectiveRadiusKm) {
      updateFilter('radius', effectiveRadiusKm);
    }
  }, [filters.radius, effectiveRadiusKm, updateFilter]);

  // Load available herbs from API
  const loadAvailableHerbs = async () => {
    try {
      const herbs = await locationService.fetchAvailableHerbs();
      setAvailableHerbs(Array.isArray(herbs) ? herbs : []);
    } catch (error) {
      console.error('Error loading available herbs:', error);
      setAvailableHerbs([
        { _id: 'lagundi', name: 'Lagundi', scientificName: 'Vitex negundo' },
        { _id: 'sambong', name: 'Sambong', scientificName: 'Blumea balsamifera' },
        { _id: 'ampalaya', name: 'Ampalaya', scientificName: 'Momordica charantia' },
        { _id: 'tsaang-gubat', name: 'Tsaang Gubat', scientificName: 'Carmona retusa' },
        { _id: 'niyog-niyogan', name: 'Niyog-niyogan', scientificName: 'Quisqualis indica' },
        { _id: 'yerba-buena', name: 'Yerba Buena', scientificName: 'Clinopodium douglasii' },
        { _id: 'akapulko', name: 'Akapulko', scientificName: 'Cassia alata' },
        { _id: 'pansit-pansitan', name: 'Pansit-pansitan', scientificName: 'Peperomia pellucida' },
        { _id: 'malunggay', name: 'Malunggay', scientificName: 'Moringa oleifera' },
        { _id: 'bayabas', name: 'Bayabas', scientificName: 'Psidium guajava' }
      ]);
    }
  };

  // Resolve initial user location with profile-first strategy
  useEffect(() => {
    try {
      // Initial map tie-in uses profile/general location only (city/province/region center).
      const profileCenter = userLocationService.findProfileCenter(user?.location || {});
      if (!profileCenter?.lat || !profileCenter?.lng) {
        if (!user && userLocationSource === 'profile') {
          setUserLocation(null);
          setUserLocationSource(null);
          setLocations([]);
          setMapItems([]);
        }
        return;
      }

      setUserLocation({ lat: profileCenter.lat, lng: profileCenter.lng });
      setUserLocationSource('profile');
      setCenterZoom(11);
      setCenterRequestId((prev) => prev + 1);
      updateFilters({
        lat: profileCenter.lat,
        lng: profileCenter.lng
      });
    } catch (error) {
      console.error('Error resolving profile location:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLocationSource]);

  // Re-fetch map data whenever filters/location change (viewport-triggered fetch runs in handleViewportChange)
  useEffect(() => {
    if (!hasCoordinates) {
      setLocations([]);
      setMapItems([]);
      return;
    }

    const viewportKey = viewport?.bounds
      ? [
          Number(viewport.zoom || 0).toFixed(2),
          Number(viewport.bounds.swLat || 0).toFixed(4),
          Number(viewport.bounds.swLng || 0).toFixed(4),
          Number(viewport.bounds.neLat || 0).toFixed(4),
          Number(viewport.bounds.neLng || 0).toFixed(4)
        ].join('|')
      : 'no-viewport';
    const nonRadiusKey = [
      viewportKey,
      String(filters.type || 'all'),
      String(filters.herb || ''),
      String((debouncedSearch || '').trim().toLowerCase()),
      String(userLocation?.lat || ''),
      String(userLocation?.lng || '')
    ].join('|');
    const hasSearchFilters = Boolean((debouncedSearch || '').trim() || (filters.herb || '').trim());
    const hasLocalCache = hasSearchFilters
      ? Array.isArray(lastUnfilteredLocationsRef.current)
      : Boolean(lastClusteredDataRef.current);
    const onlyRadiusChanged = lastNonRadiusFiltersRef.current === nonRadiusKey;

    if (viewport?.bounds) {
      if (onlyRadiusChanged && hasLocalCache) {
        return;
      }
      lastNonRadiusFiltersRef.current = nonRadiusKey;
      loadClusteredLocations(viewport);
    } else {
      lastNonRadiusFiltersRef.current = nonRadiusKey;
      searchNearbyLocations(userLocation);
    }
  }, [filters.type, filters.herb, filters.radius, debouncedSearch, userLocation, viewport, hasCoordinates]);

  useEffect(() => {
    if (!hasCoordinates || !viewport?.bounds) return;
    const hasSearchFilters = Boolean((debouncedSearch || '').trim() || (filters.herb || '').trim());

    if (hasSearchFilters) {
      const baseLocations = lastUnfilteredLocationsRef.current;
      if (!Array.isArray(baseLocations) || baseLocations.length === 0) return;
      const filtered = applyMobileFilters(baseLocations);
      setLocations(filtered);
      setMapItems(filtered);
      return;
    }

    const clustered = lastClusteredDataRef.current;
    if (!clustered || !Array.isArray(clustered.items)) return;
    const radiusFilteredData = applyRadiusFilterToMapData(clustered.items, clustered.locationList || []);
    const hasFilteredResults = radiusFilteredData.items.length > 0 || radiusFilteredData.locationList.length > 0;
    const nextData = hasFilteredResults ? radiusFilteredData : clustered;
    setMapItems(nextData.items);
    setLocations(nextData.locationList);
  }, [filters.radius, effectiveRadiusKm, hasCoordinates, viewport, debouncedSearch, filters.herb, applyMobileFilters, applyRadiusFilterToMapData]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      if (locationNoticeToastIdRef.current != null) {
        toast.removeToast(locationNoticeToastIdRef.current);
        locationNoticeToastIdRef.current = null;
      }
      mountedRef.current = false;
      if (activeLocationsAbortRef.current) {
        activeLocationsAbortRef.current.abort();
        activeLocationsAbortRef.current = null;
      }
      if (activeDetailsAbortRef.current) {
        activeDetailsAbortRef.current.abort();
        activeDetailsAbortRef.current = null;
      }
      if (viewportDebounceRef.current) {
        clearTimeout(viewportDebounceRef.current);
      }
    };
  }, []);

  const beginLocationsRequest = () => {
    latestLocationsRequestRef.current += 1;
    return latestLocationsRequestRef.current;
  };

  const startLocationsAbortController = () => {
    if (activeLocationsAbortRef.current) {
      activeLocationsAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeLocationsAbortRef.current = controller;
    return controller;
  };

  const isLocationsRequestCurrent = (requestId) => (
    mountedRef.current && requestId === latestLocationsRequestRef.current
  );

  const beginDetailsRequest = () => {
    latestDetailsRequestRef.current += 1;
    return latestDetailsRequestRef.current;
  };

  const startDetailsAbortController = () => {
    if (activeDetailsAbortRef.current) {
      activeDetailsAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeDetailsAbortRef.current = controller;
    return controller;
  };

  const isDetailsRequestCurrent = (requestId) => (
    mountedRef.current && requestId === latestDetailsRequestRef.current
  );

  const isCanceledError = (error) => (
    error?.code === 'ERR_CANCELED'
    || error?.name === 'AbortError'
    || error?.message === 'canceled'
  );

  // Handle specialized reset
  const handleResetFilters = () => {
    resetFilters();
    setUserLocation(null);
    setUserLocationSource(null);
    setSelectedLocation(null);
    setLocationDetails(null);
    setViewport(null);
    setLocations([]);
    setMapItems([]);
    lastViewportKeyRef.current = '';
    lastNonRadiusFiltersRef.current = '';
    lastClusteredDataRef.current = null;
    lastUnfilteredLocationsRef.current = null;
    viewportActiveRef.current = false;
    setMapResetSignal((prev) => prev + 1);
  };

  // Get user's current location using browser geolocation
  const getCurrentLocation = () => {
    const resolveRealtimeLocation = async () => {
      try {
        setIsSearching(true);
        // "Use My Location" uses browser/device geolocation.
        const resolved = await userLocationService.getBrowserGeolocation();

        if (!resolved?.lat || !resolved?.lng) {
          throw new Error('No coordinates received');
        }

        const location = {
          lat: resolved.lat,
          lng: resolved.lng
        };

        setUserLocation(location);
        setUserLocationSource('realtime');
        setCenterZoom(13);
        setCenterRequestId((prev) => prev + 1);
        updateFilters({
          lat: location.lat,
          lng: location.lng,
          zoom: 13
        });
      } catch (error) {
        console.error('Error getting realtime location:', error);
        toast.error('Unable to detect your realtime location. Please check browser location permissions.');
      } finally {
        setIsSearching(false);
      }
    };

    resolveRealtimeLocation();
  };

  // Search for nearby locations using the location service
  const searchNearbyLocations = async (center) => {
    const requestId = beginLocationsRequest();
    const controller = startLocationsAbortController();
    const hasSearchFilters = Boolean((debouncedSearch || '').trim() || (filters.herb || '').trim());
    const nearbyFilters = hasSearchFilters
      ? { compact: false }
      : {
          type: filters.type,
          search: debouncedSearch,
          herb: filters.herb,
          compact: true,
        };
    try {
      if (hasSearchFilters && viewport?.bounds) {
        const boundedLocations = await fetchBoundedLocationsPaged(viewport.bounds, controller.signal);
        if (!isLocationsRequestCurrent(requestId)) return;
        lastUnfilteredLocationsRef.current = boundedLocations;
        const filtered = applyMobileFilters(boundedLocations);
        setLocations(filtered);
        setMapItems(filtered);
        return;
      }

      const response = await locationService.searchNearby(
        center.lat,
        center.lng,
        effectiveRadiusKm,
        nearbyFilters,
        { signal: controller.signal }
      );
      if (!isLocationsRequestCurrent(requestId)) return;
      if (viewportActiveRef.current) return;
      const locationsArray = normalizeLocationsResponse(response);
      if (hasSearchFilters) {
        lastUnfilteredLocationsRef.current = locationsArray;
      }
      const nextLocations = hasSearchFilters ? applyMobileFilters(locationsArray) : locationsArray;
      setLocations(nextLocations);
      setMapItems(nextLocations);
    } catch (error) {
      if (!isLocationsRequestCurrent(requestId)) return;
      if (isCanceledError(error)) return;
      console.error('Error searching locations:', error);
      if (hasSearchFilters) {
        setLocations([]);
        setMapItems([]);
        return;
      }
      const mockData = locationService.getMockLocations(center, Math.min(effectiveRadiusKm, MAX_SEARCH_RADIUS_KM));
      setLocations(mockData);
      setMapItems(mockData);
    } finally {
      if (isLocationsRequestCurrent(requestId)) {
        if (activeLocationsAbortRef.current === controller) {
          activeLocationsAbortRef.current = null;
        }
      }
    }
  };

  const loadClusteredLocations = async (viewportData) => {
    if (!hasCoordinates) {
      setLocations([]);
      setMapItems([]);
      return;
    }
    const requestId = beginLocationsRequest();
    const controller = startLocationsAbortController();
    const hasSearchFilters = Boolean((debouncedSearch || '').trim() || (filters.herb || '').trim());

    const requestKey = [
      Number(viewportData?.zoom || 0).toFixed(2),
      Number(viewportData?.bounds?.swLat || 0).toFixed(4),
      Number(viewportData?.bounds?.swLng || 0).toFixed(4),
      Number(viewportData?.bounds?.neLat || 0).toFixed(4),
      Number(viewportData?.bounds?.neLng || 0).toFixed(4),
      Number(effectiveRadiusKm || 0).toFixed(2),
      String(filters.type || 'all'),
      String(filters.herb || ''),
      String((debouncedSearch || '').trim().toLowerCase())
    ].join('|');

    if (requestKey === lastClusterRequestKeyRef.current) {
      if (activeLocationsAbortRef.current === controller) {
        activeLocationsAbortRef.current = null;
      }
      return;
    }
    lastClusterRequestKeyRef.current = requestKey;

    try {
      if (hasSearchFilters) {
        const boundedLocations = await fetchBoundedLocationsPaged(viewportData.bounds, controller.signal);
        if (!mountedRef.current || !isLocationsRequestCurrent(requestId)) return;
        lastUnfilteredLocationsRef.current = boundedLocations;
        const filtered = applyMobileFilters(boundedLocations);
        setMapItems(filtered);
        setLocations(filtered);
        return;
      }

      const response = await Promise.race([
        locationService.fetchClusters(viewportData.bounds, viewportData.zoom, {
          type: filters.type,
          herb: filters.herb,
          search: debouncedSearch,
          compact: true,
        }, { signal: controller.signal }),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('CLUSTER_TIMEOUT')), 1800);
        })
      ]);
      if (!mountedRef.current || !isLocationsRequestCurrent(requestId)) return;

      const clusters = normalizeClusterResponse(response);
      if (clusters.length === 0) {
        await searchNearbyLocations(userLocation);
        return;
      }
      const clusteredData = buildClusterMapData(clusters);
      lastClusteredDataRef.current = clusteredData;
      const radiusFilteredData = applyRadiusFilterToMapData(clusteredData.items, clusteredData.locationList);
      const hasFilteredResults = radiusFilteredData.items.length > 0 || radiusFilteredData.locationList.length > 0;
      const nextData = hasFilteredResults ? radiusFilteredData : clusteredData;

      if (!isLocationsRequestCurrent(requestId)) return;
      setMapItems(nextData.items);
      setLocations(nextData.locationList);
    } catch (error) {
      if (!mountedRef.current || !isLocationsRequestCurrent(requestId)) return;
      if (isCanceledError(error)) return;
      console.error('Error loading clustered locations:', error);
      if (hasSearchFilters) {
        setMapItems([]);
        setLocations([]);
        return;
      }
      try {
        const boundedResponse = await locationService.fetchLocations({
          minLat: viewportData.bounds.swLat,
          minLng: viewportData.bounds.swLng,
          maxLat: viewportData.bounds.neLat,
          maxLng: viewportData.bounds.neLng
        }, {
          type: filters.type,
          herb: filters.herb,
          search: debouncedSearch,
          compact: true,
          limit: 100
        }, { signal: controller.signal });
        if (!mountedRef.current || !isLocationsRequestCurrent(requestId)) return;
        const boundedLocations = normalizeLocationsResponse(boundedResponse);
        lastClusteredDataRef.current = {
          items: boundedLocations,
          locationList: boundedLocations
        };
        const boundedRadiusFiltered = applyRadiusFilterToMapData(boundedLocations, boundedLocations);
        setMapItems(boundedRadiusFiltered.items);
        setLocations(boundedRadiusFiltered.locationList);
      } catch (fallbackError) {
        console.error('Error loading bounded locations fallback:', fallbackError);
        if (hasCoordinates) {
          searchNearbyLocations(userLocation);
        }
      }
    } finally {
      if (isLocationsRequestCurrent(requestId)) {
        if (activeLocationsAbortRef.current === controller) {
          activeLocationsAbortRef.current = null;
        }
      }
    }
  };

  const handleMarkerClick = async (locationId) => {
    const requestId = beginDetailsRequest();
    const controller = startDetailsAbortController();
    const location = locations.find(loc => (loc.id || loc._id) === locationId);
    if (!location) return;

    setSelectedLocation(location);
    setActiveTab('details');

    setIsLoadingDetails(true);
    try {
      const details = await locationService.fetchLocationDetails(locationId, { signal: controller.signal });
      if (!isDetailsRequestCurrent(requestId)) return;
      const resolvedImages = normalizeLocationImages(details?.images || location.images);
      const resolvedReviews = Array.isArray(details?.reviews)
        ? details.reviews
        : (location.reviews || []);

      const enhancedDetails = details || {
        ...location,
        description: location.description || 'A wonderful place for herbal medicine and natural healing remedies in the Philippines.',
        hours: location.properties?.hours || 'Mon-Fri: 9AM-6PM, Sat: 10AM-4PM',
        phone: location.phone || '(555) 123-4567',
        website: location.properties?.website || 'www.example.com',
        images: resolvedImages,
        reviews: location.reviews || [
          {
            id: 1,
            author: 'Juan Dela Cruz',
            rating: 5,
            text: 'Magandang lugar para sa mga herbal na gamot!',
            date: '2 days ago'
          }
        ]
      };
      enhancedDetails.images = resolvedImages;
      if (details) {
        enhancedDetails.reviews = resolvedReviews;
      }
      setLocationDetails(enhancedDetails);
    } catch (error) {
      if (!isDetailsRequestCurrent(requestId)) return;
      if (isCanceledError(error)) return;
      console.error('Error fetching location details:', error);
      setLocationDetails({
        ...location,
        description: location.description || 'A wonderful place for herbal medicine and natural healing remedies in the Philippines.',
        hours: 'Mon-Fri: 9AM-6PM, Sat: 10AM-4PM',
        images: normalizeLocationImages(location.images),
        reviews: []
      });
    } finally {
      if (isDetailsRequestCurrent(requestId)) {
        setIsLoadingDetails(false);
        if (activeDetailsAbortRef.current === controller) {
          activeDetailsAbortRef.current = null;
        }
      }
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const toggleMarkers = () => setMarkersVisible(prev => !prev);
  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSidePanel = () => {
    setIsSidePanelOpen(prev => !prev);
    if (isSidePanelOpen) {
      setIsSearching(false);
      setIsLoadingDetails(false);
    }
  };

  const handleViewportChange = useCallback((mapViewport) => {
    if (!hasCoordinates) return;
    if (!mapViewport?.bounds) return;

    const southWest = mapViewport.bounds.getSouthWest();
    const northEast = mapViewport.bounds.getNorthEast();

    const normalized = {
      zoom: mapViewport.zoom,
      bounds: {
        swLat: southWest.lat,
        swLng: southWest.lng,
        neLat: northEast.lat,
        neLng: northEast.lng
      }
    };

    const viewportKey = [
      Number(normalized.zoom || 0).toFixed(2),
      Number(normalized.bounds.swLat || 0).toFixed(4),
      Number(normalized.bounds.swLng || 0).toFixed(4),
      Number(normalized.bounds.neLat || 0).toFixed(4),
      Number(normalized.bounds.neLng || 0).toFixed(4)
    ].join('|');

    if (viewportDebounceRef.current) {
      clearTimeout(viewportDebounceRef.current);
    }

    viewportDebounceRef.current = setTimeout(() => {
      if (lastViewportKeyRef.current === viewportKey) {
        return;
      }
      lastViewportKeyRef.current = viewportKey;
      viewportActiveRef.current = true;
      setViewport(normalized);
    }, 250);
  }, [loadClusteredLocations, hasCoordinates]);

  const handleMapClick = (event) => {
    try {
      const point = locationService.buildGeoPointFromLeafletClick(event);
      updateFilters({
        lat: point.coordinates[1],
        lng: point.coordinates[0]
      });
    } catch (error) {
      console.error('Invalid map click event:', error);
    }
  };

  return (
    <div className="h-screen w-screen bg-transparent overflow-hidden">
      <div className="relative h-full">
        {/* Interactive Map */}
        <div className="w-full h-full">
          <InteractiveMap
            ref={mapRef}
            userLocation={userLocation}
            selectedFilter={filters.type}
            searchRadius={filters.radius}
            markersVisible={markersVisible}
            onMarkerClick={handleMarkerClick}
            selectedLocationId={selectedLocation?.id || selectedLocation?._id}
            selectedLocation={selectedLocation}
            resetSignal={mapResetSignal}
            locations={mapItems}
            onMapClick={handleMapClick}
            onViewportChange={handleViewportChange}
            centerRequestId={centerRequestId}
            centerZoom={centerZoom}
            focusZoom={15}
            className="w-full h-full"
          />
        </div>

        {/* Loading Indicator */}
        {(isSearching || isLoadingDetails) && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-surface-primary rounded-xl shadow-lg px-4 py-3 flex items-center space-x-3 border border-primary/10">
              <Loading size="small" />
              <span className="text-sm text-tertiary font-medium">
                {isSearching ? 'Searching locations...' : 'Unveiling details...'}
              </span>
            </div>
          </div>
        )}
        {/* Map Side Panel & Controls */}
        <MapSidePanel
          isSidePanelOpen={isSidePanelOpen}
          toggleSidePanel={toggleSidePanel}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          handleBack={() => navigate('/home')}
          getCurrentLocation={getCurrentLocation}
          user={user}
          userLocation={userLocation}
          filters={filters}
          updateFilter={updateFilter}
          availableHerbs={availableHerbs}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          selectedLocation={selectedLocation}
          locationDetails={locationDetails}
          isLoadingDetails={isLoadingDetails}
          markersVisible={markersVisible}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          toggleMarkers={toggleMarkers}
          handleResetFilters={handleResetFilters}
          onReviewSubmitted={handleMarkerClick}
        />

        {/* Floating Results Summary */}
        {locations.length > 0 && (
          <div className={`absolute bottom-4 right-4 bg-surface-primary rounded-2xl shadow-xl p-5 max-w-sm border border-primary/10 ${canAnimateLayout ? 'animate-in slide-in-from-bottom duration-500' : ''}`}>
            <h3 className="font-bold text-primary mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {locations.length} Locations Found
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {locations.slice(0, 3).map((location) => (
                <div
                  key={location.id || location._id}
                  className="rounded-xl p-3 hover:bg-surface-secondary cursor-pointer transition-colors border border-transparent hover:border-primary/5 group"
                  onClick={() => handleMarkerClick(location.id || location._id)}
                >
                  <div className="font-bold text-sm text-primary group-hover:text-brand transition-colors">{location.name}</div>
                  {userLocation && location.distance && (
                    <div className="text-xs font-medium text-tertiary mt-0.5">{location.distance} km from you</div>
                  )}
                </div>
              ))}
              {locations.length > 3 && (
                <div className="text-[10px] uppercase font-bold text-tertiary text-center pt-2 tracking-widest">
                  + {locations.length - 3} more nearby
                </div>
              )}
            </div>
          </div>
        )}

        {!hasCoordinates && (
          <div className="absolute bottom-4 right-4 bg-surface-primary rounded-2xl shadow-xl p-4 max-w-sm border border-primary/10">
            <p className="text-sm text-tertiary">
              Markers are locked until you use geolocation, or log in and set your location.
            </p>
            <p className="text-xs text-tertiary mt-1">
              Max searchable radius is {MAX_SEARCH_RADIUS_KM} km.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapPage;
