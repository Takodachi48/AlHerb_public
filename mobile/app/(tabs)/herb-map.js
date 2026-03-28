import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Animated,
  Keyboard,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import OpenStreetMap from '../../components/OpenStreetMap';
import LocationBottomSheet from '../../components/LocationBottomSheet';
import { styles } from '../../styles/HerbMapScreen.styles';
import { useLocations, useHerbs } from '../../hooks/useApi';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { locationService } from '../../services/apiServices';
import { formatLocationAddress } from '../../utils/locationFormat';
import { reverseGeocodeLocation } from '../../utils/reverseGeocode';

const locationTypes = ['All', 'Market', 'Foraging', 'Shop', 'Pharmacy', 'Clinic', 'Garden', 'Farm', 'Park'];

const typeIcon = (type) => {
  const t = type.toLowerCase();
  switch (t) {
    case 'market': return 'storefront-outline';
    case 'shop':
    case 'store': return 'bag-handle-outline';
    case 'clinic':
    case 'pharmacy': return 'medkit-outline';
    case 'wild':
    case 'foraging': return 'leaf-outline';
    case 'garden': return 'flower-outline';
    case 'farm': return 'nutrition-outline';
    case 'park': return 'map-outline';
    case 'suggested': return 'pin-outline';
    default: return 'location-outline';
  }
};

// Helper function to calculate distance between two points (defined outside component)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const asSingleParam = (value) => {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
};

const MAX_VISIBLE_LOCATIONS = 300;
const MAX_ADDRESS_LOOKUPS = 12;
const CLUSTER_FETCH_DEBOUNCE_MS = 250;
const CLUSTER_SUPPORTED_TYPES = new Set(['market', 'foraging', 'shop', 'pharmacy', 'clinic']);

const getLocationId = (location) => String(location?._id || location?.id || '');

const mapClustersToLocations = (clusters = []) =>
  clusters.flatMap((cluster) => {
    const count = Number(cluster?.count || 0);
    const centerCoordinates = cluster?.center?.coordinates;
    const locationsInCluster = Array.isArray(cluster?.locations) ? cluster.locations : [];

    if (count <= 1 && locationsInCluster[0]) {
      const first = locationsInCluster[0];
      return [{
        ...first,
        _id: first._id || first.id || `${cluster?.geohash || Math.random()}`,
      }];
    }

    if (!Array.isArray(centerCoordinates) || centerCoordinates.length < 2) {
      return [];
    }

    return [{
      _id: `cluster-${cluster?.geohash || `${centerCoordinates[0]}-${centerCoordinates[1]}`}`,
      name: `${count} locations`,
      type: 'cluster',
      isCluster: true,
      clusterCount: count,
      location: {
        type: 'Point',
        coordinates: [Number(centerCoordinates[0]), Number(centerCoordinates[1])],
      },
      derivedLocation: locationsInCluster[0]?.derivedLocation || null,
      herbs: [],
    }];
  });

export default function HerbMapScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const queryParam = String(asSingleParam(params.query) || '');
  const herbIdParam = String(asSingleParam(params.herbId) || '');
  const locationIdParam = String(asSingleParam(params.locationId) || '');
  const useNearbyParam = asSingleParam(params.useNearby) === 'true';

  // Data Hooks
  const { locations } = useLocations();
  const { herbs } = useHerbs();

  // State
  const [query, setQuery] = useState(queryParam);
  const [selectedHerbId, setSelectedHerbId] = useState(herbIdParam || null);

  const [selectedType, setSelectedType] = useState('All');
  const [userLocation, setUserLocation] = useState(null);
  const [detectedAddress, setDetectedAddress] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [clusterFocus, setClusterFocus] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [clusteredMapPoints, setClusteredMapPoints] = useState([]);
  const [resolvedAddressMap, setResolvedAddressMap] = useState({});
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [mapResetSignal, setMapResetSignal] = useState(0);
  const [zoomInSignal, setZoomInSignal] = useState(0);
  const [zoomOutSignal, setZoomOutSignal] = useState(0);
  const [isSheetExpanded, setIsSheetExpanded] = useState(false);
  const geocodePendingRef = useRef(new Set());
  const lastClusterRequestKeyRef = useRef('');

  // Update query when params change
  useEffect(() => {
    if (queryParam) {
      setQuery(queryParam);
      setSelectedHerbId(null);
      // Reset location filters when searching specific herb
      setUserLocation(null);
      setDetectedAddress(null);
    } else if (herbIdParam) {
      setSelectedHerbId(herbIdParam);
      // Keep a readable search label when the herb record is available.
      const herb = herbs.find(h => String(h._id) === herbIdParam);
      if (herb) {
        setQuery(herb.name);
      } else {
        setQuery('');
      }
      // When coming from "Find Nearby", trigger user location instead of clearing it
      if (!useNearbyParam) {
        setUserLocation(null);
        setDetectedAddress(null);
      }
    } else {
      setSelectedHerbId(null);
    }
  }, [queryParam, herbIdParam, herbs]);

  // Auto-request user location when useNearby param is present
  useEffect(() => {
    if (useNearbyParam && herbIdParam) {
      handleUseMyLocation(true); // preserveQuery=true to keep herb name label
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useNearbyParam, herbIdParam]);

  useEffect(() => {
    if (!locationIdParam || !Array.isArray(locations) || locations.length === 0) return;

    const matched = locations.find((location) => String(location?._id || location?.id || '') === locationIdParam);
    if (matched) {
      setSelectedLocation(matched);
    }
  }, [locationIdParam, locations]);

  // RADIUS FILTER (New)
  const [searchRadius, setSearchRadius] = useState(20); // Default 20km
  const radiusOptions = [5, 10, 20, 50];

  // Suggested locations from geocoding
  const [suggestedLocations] = useState([]);
  const [isGeocoding] = useState(false);

  // Filter Logic (Combines Verified + Suggested + Range)
  const filteredLocations = useMemo(() => {
    let combined = [...(locations || [])];

    if (selectedHerbId) {
      combined = combined.filter((location) => {
        const inventory = Array.isArray(location?.herbs) ? location.herbs : [];
        return inventory.some((item) => {
          const herbRef = item?.herbId || item?.herb || item;
          const herbId = String(herbRef?._id || herbRef || '');
          return herbId === String(selectedHerbId);
        });
      });
    }

    // 1. Location Type Filter
    if (selectedType !== 'All') {
      combined = combined.filter(l => l.type.toLowerCase() === selectedType.toLowerCase());
    }

    const q = query.trim().toLowerCase();

    // 2. Search Query Filter — skip when herbId filter is active (query is just a display label)
    if (q && !selectedHerbId) {
      combined = combined.filter((l) => {
        const herbNames = l.herbs ? l.herbs.map(h => {
          const herbData = h.herbId || h.herb || {};
          return herbData.name || h.name || 'Unknown';
        }).join(' ') : '';

        const addressText = formatLocationAddress(l, '');

        const hay = `${l.name} ${addressText} ${l.type} ${herbNames}`.toLowerCase();
        return hay.includes(q);
      });

      if (suggestedLocations.length > 0) {
        combined = [...combined, ...suggestedLocations];
      }
    }
    // 3. "My Location" Active (Range Filter) — always apply when userLocation is set,
    //    even when herbId or query filters are also active.
    if (userLocation) {
      // Use dynamic searchRadius
      combined = combined.map(l => {
        // Ensure coords exist
        const lat = l.location?.coordinates?.[1] || l.latitude;
        const lng = l.location?.coordinates?.[0] || l.longitude;
        if (!lat || !lng) return { ...l, distance: Infinity };

        const dist = calculateDistance(userLocation.latitude, userLocation.longitude, lat, lng);
        return { ...l, distance: dist };
      })
        .filter(l => l.distance <= searchRadius)
        .sort((a, b) => a.distance - b.distance);
    }

    return combined;
  }, [locations, selectedType, query, selectedHerbId, suggestedLocations, userLocation, searchRadius]);

  const visibleLocations = useMemo(() => {
    const hasSearch = query.trim().length > 0;
    const shouldCap = !hasSearch && !selectedHerbId && !userLocation && !locationIdParam;
    if (!shouldCap) return filteredLocations;
    return filteredLocations.slice(0, MAX_VISIBLE_LOCATIONS);
  }, [filteredLocations, query, selectedHerbId, userLocation, locationIdParam]);

  const hasSearchQuery = query.trim().length > 0;
  const sheetHeaderMode = useMemo(() => {
    if (hasSearchQuery) return 'search';
    if (selectedHerbId) return 'herb';
    if (userLocation) return 'nearby';
    return 'all';
  }, [hasSearchQuery, selectedHerbId, userLocation]);

  const isPerformanceCapped = useMemo(() => {
    const globalView = !hasSearchQuery && !selectedHerbId && !userLocation && !locationIdParam;
    return globalView && filteredLocations.length > visibleLocations.length;
  }, [hasSearchQuery, selectedHerbId, userLocation, locationIdParam, filteredLocations.length, visibleLocations.length]);

  const shouldHideTabBar = isSheetExpanded || Boolean(selectedLocation);
  useEffect(() => {
    navigation.setParams?.({ hideTabBar: shouldHideTabBar });
    router.setParams?.({ hideTabBar: shouldHideTabBar });
    navigation.getParent?.()?.setOptions?.({
      tabBarStyle: shouldHideTabBar ? { display: 'none' } : undefined,
    });

    return () => {
      navigation.setParams?.({ hideTabBar: false });
      router.setParams?.({ hideTabBar: false });
      navigation.getParent?.()?.setOptions?.({
        tabBarStyle: undefined,
      });
    };
  }, [navigation, router, shouldHideTabBar]);

  const selectedTypeLower = String(selectedType || '').toLowerCase();
  const canClusterForType = selectedType === 'All' || CLUSTER_SUPPORTED_TYPES.has(selectedTypeLower);
  // Disabled server-side clustering in favor of client-side Leaflet.markercluster
  const shouldUseClusterMode = false; // !query.trim() && !selectedHerbId && !userLocation && !locationIdParam && canClusterForType;

  const handleBoundsChange = (nextBounds) => {
    if (!nextBounds) return;
    const normalize = (value, precision = 3) => Number(Number(value || 0).toFixed(precision));

    const normalizedNext = {
      swLat: normalize(nextBounds.swLat),
      swLng: normalize(nextBounds.swLng),
      neLat: normalize(nextBounds.neLat),
      neLng: normalize(nextBounds.neLng),
      zoom: normalize(nextBounds.zoom, 1),
    };

    setMapBounds((previous) => {
      if (!previous) return normalizedNext;
      const same =
        normalize(previous.swLat) === normalizedNext.swLat &&
        normalize(previous.swLng) === normalizedNext.swLng &&
        normalize(previous.neLat) === normalizedNext.neLat &&
        normalize(previous.neLng) === normalizedNext.neLng &&
        normalize(previous.zoom, 1) === normalizedNext.zoom;
      return same ? previous : normalizedNext;
    });
  };

  useEffect(() => {
    if (!shouldUseClusterMode) {
      setClusteredMapPoints([]);
      lastClusterRequestKeyRef.current = '';
      return;
    }

    if (!mapBounds) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsLoadingClusters(true);
        const selectedTypeParam = selectedType === 'All' || !CLUSTER_SUPPORTED_TYPES.has(selectedTypeLower)
          ? undefined
          : selectedTypeLower;
        const requestKey = JSON.stringify({
          ...mapBounds,
          type: selectedTypeParam || 'all',
        });

        if (requestKey === lastClusterRequestKeyRef.current) {
          setIsLoadingClusters(false);
          return;
        }
        lastClusterRequestKeyRef.current = requestKey;

        const clusters = await locationService.getLocationClusters(
          {
            swLat: mapBounds.swLat,
            swLng: mapBounds.swLng,
            neLat: mapBounds.neLat,
            neLng: mapBounds.neLng,
            zoom: mapBounds.zoom,
          },
          {
            type: selectedTypeParam,
          }
        );

        if (!cancelled) {
          setClusteredMapPoints(mapClustersToLocations(clusters));
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Cluster fetch failed, using local points:', error?.message || error);
          setClusteredMapPoints([]);
          lastClusterRequestKeyRef.current = '';
        }
      } finally {
        if (!cancelled) {
          setIsLoadingClusters(false);
        }
      }
    }, CLUSTER_FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mapBounds, shouldUseClusterMode, selectedType]);

  useEffect(() => {
    let cancelled = false;
    const candidates = [...visibleLocations.slice(0, MAX_ADDRESS_LOOKUPS)];
    if (selectedLocation) {
      candidates.push(selectedLocation);
    }

    const enrichMissingAddresses = async () => {
      for (const location of candidates) {
        if (cancelled) return;

        const id = getLocationId(location);
        if (!id) continue;
        if (resolvedAddressMap[id]) continue;
        if (geocodePendingRef.current.has(id)) continue;

        const existingAddress = formatLocationAddress(location, '');
        if (existingAddress) continue;

        geocodePendingRef.current.add(id);

        try {
          const resolved = await reverseGeocodeLocation(location);
          if (resolved && !cancelled) {
            setResolvedAddressMap((prev) => {
              if (prev[id]) return prev;
              return { ...prev, [id]: resolved };
            });
          }
        } finally {
          geocodePendingRef.current.delete(id);
        }
      }
    };

    enrichMissingAddresses();

    return () => {
      cancelled = true;
    };
  }, [visibleLocations, selectedLocation, resolvedAddressMap]);

  const withResolvedAddress = (location) => {
    const id = getLocationId(location);
    const resolved = id ? resolvedAddressMap[id] : '';
    if (!resolved) return location;
    if (formatLocationAddress(location, '')) return location;
    return { ...location, address: resolved };
  };

  const locationsWithResolvedAddress = useMemo(
    () => visibleLocations.map((location) => withResolvedAddress(location)),
    [visibleLocations, resolvedAddressMap]
  );

  const clusteredPointsWithResolvedAddress = useMemo(
    () => clusteredMapPoints.map((location) => withResolvedAddress(location)),
    [clusteredMapPoints, resolvedAddressMap]
  );

  const mapPoints = useMemo(() => {
    const basePoints = shouldUseClusterMode && clusteredPointsWithResolvedAddress.length > 0
      ? clusteredPointsWithResolvedAddress
      : locationsWithResolvedAddress;

    if (!selectedLocation) return basePoints;

    const selectedId = getLocationId(selectedLocation);
    if (!selectedId) return basePoints;

    const exists = basePoints.some((item) => getLocationId(item) === selectedId);
    if (exists) return basePoints;

    return [...basePoints, withResolvedAddress(selectedLocation)];
  }, [
    shouldUseClusterMode,
    clusteredPointsWithResolvedAddress,
    locationsWithResolvedAddress,
    selectedLocation,
    resolvedAddressMap,
  ]);

  const focusedClusterLocations = useMemo(() => {
    if (!clusterFocus?.location?.coordinates) return locationsWithResolvedAddress;

    const centerLng = Number(clusterFocus.location.coordinates[0]);
    const centerLat = Number(clusterFocus.location.coordinates[1]);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) {
      return locationsWithResolvedAddress;
    }

    const nearby = locationsWithResolvedAddress.map((location) => {
      const lat = Number(location?.location?.coordinates?.[1] ?? location?.latitude);
      const lng = Number(location?.location?.coordinates?.[0] ?? location?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { ...location, __clusterDistance: Number.POSITIVE_INFINITY };
      }

      const dist = calculateDistance(centerLat, centerLng, lat, lng);
      return { ...location, __clusterDistance: dist };
    })
      .filter((location) => Number.isFinite(location.__clusterDistance) && location.__clusterDistance <= 12)
      .sort((a, b) => a.__clusterDistance - b.__clusterDistance)
      .slice(0, 120)
      .map(({ __clusterDistance, ...location }) => location);

    if (nearby.length > 0) return nearby;
    return locationsWithResolvedAddress.slice(0, 120);
  }, [clusterFocus, locationsWithResolvedAddress]);

  // Animation for compass button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [isLocatingUser, setIsLocatingUser] = useState(false);

  // Handle location selection
  const onLocationSelect = (location) => {
    if (location?.isCluster) {
      setClusterFocus(location);
      setSelectedLocation(null);
      return;
    }

    setClusterFocus(null);
    setSelectedLocation(location);
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedType('All');
    setQuery('');
    setSelectedHerbId(null);
    setUserLocation(null);
    setDetectedAddress(null);
    setSelectedLocation(null);
    setClusterFocus(null);
    setClusteredMapPoints([]);
    setIsSheetExpanded(false);
    setMapResetSignal((prev) => prev + 1);
  };

  const handleSheetStateChange = useCallback((state) => {
    setIsSheetExpanded(state === 'expanded');
  }, []);

  // Handle getting user's current location
  // preserveQuery: when true, keeps the current search label (e.g. herb name from Find Nearby)
  const handleUseMyLocation = async (preserveQuery = false) => {
    try {
      setIsLocatingUser(true);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this feature');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setUserLocation({ latitude, longitude });

      // Only clear query when NOT coming from a herb-specific "Find Nearby" flow
      if (!preserveQuery) {
        setQuery('');
      }
      setDetectedAddress('Your Location');

      // Pulse animation
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Unable to get your location');
    } finally {
      setIsLocatingUser(false);
    }
  };

  // ... (existing effects)

  return (
    <View style={styles.container}>
      {/* ... (Map Container) ... */}
      {/* 1. Full Screen Map */}
      <View style={styles.mapContainer}>
        <OpenStreetMap
          locations={mapPoints}
          userLocation={userLocation}
          searchRadius={searchRadius} // Pass radius for circle visualization
          resetViewSignal={mapResetSignal}
          zoomInSignal={zoomInSignal}
          zoomOutSignal={zoomOutSignal}
          selectedLocationId={getLocationId(selectedLocation)}
          onLocationPress={setSelectedLocation}
          onBoundsChange={handleBoundsChange}
          onMapInteract={() => Keyboard.dismiss()}
          style={styles.map}
        />
      </View>

      {/* 2. Floating Header Overlay */}
      <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerContent}>
          {/* Search Bar (Clean White) */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search herbs, locations..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (selectedHerbId) {
                  setSelectedHerbId(null);
                }
                if (clusterFocus) {
                  setClusterFocus(null);
                }
                if (text.length > 0) {
                  setUserLocation(null);
                  setDetectedAddress(null);
                }
              }}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter Chips & Radius */}
        <View style={styles.filtersContainer}>
          {userLocation && (selectedHerbId || !query.trim()) && (
            <View style={styles.radiusRow}>
              {radiusOptions.map((rad) => (
                <TouchableOpacity
                  key={`rad-${rad}`}
                  style={[styles.radiusChip, searchRadius === rad && styles.radiusChipSelected]}
                  onPress={() => setSearchRadius(rad)}
                >
                  <Text style={[styles.radiusChipText, searchRadius === rad && styles.radiusChipTextSelected]}>
                    {rad} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersContent}
          >
            {locationTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, selectedType === type && styles.filterChipSelected]}
                onPress={() => {
                  setSelectedType(type);
                  if (clusterFocus) setClusterFocus(null);
                }}
              >
                <Ionicons
                  name={typeIcon(type)}
                  size={16}
                  color={selectedType === type ? '#10B981' : '#374151'}
                />
                <Text style={[styles.filterText, selectedType === type && styles.filterTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isGeocoding && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loadingText}>Finding suggested locations...</Text>
          </View>
        )}

        {isLoadingClusters && shouldUseClusterMode && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loadingText}>Optimizing map points...</Text>
          </View>
        )}

        {clusterFocus && (
          <View style={styles.loadingContainer}>
            <Ionicons name="layers-outline" size={16} color="#10B981" />
            <Text style={styles.loadingText}>
              Cluster focus active. Showing nearby locations in the list.
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.mapControlsStack, { bottom: insets.bottom + (shouldHideTabBar ? 178 : 150) }]}>
        <TouchableOpacity
          style={[styles.mapControlCircle, styles.mapControlPrimary]}
          onPress={handleUseMyLocation}
          activeOpacity={0.9}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons
              name={userLocation || isLocatingUser ? "locate" : "locate-outline"}
              size={18}
              color="#FFFFFF"
            />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.mapControlDivider} />
        <TouchableOpacity
          style={styles.mapControlCircle}
          onPress={resetFilters}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={16} color="#B91C1C" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlCircle}
          onPress={() => setZoomInSignal((prev) => prev + 1)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={17} color="#064E3B" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.mapControlCircle}
          onPress={() => setZoomOutSignal((prev) => prev + 1)}
          activeOpacity={0.85}
        >
          <Ionicons name="remove" size={17} color="#064E3B" />
        </TouchableOpacity>
      </View>

      {/* 5. LOCATIONS BOTTOM SHEET (Replaced Slider) */}
      <LocationBottomSheet
        locations={focusedClusterLocations}
        totalLocationsCount={filteredLocations.length}
        selectedLocation={selectedLocation ? withResolvedAddress(selectedLocation) : null}
        onLocationSelect={onLocationSelect}
        isGeocoding={isGeocoding}
        headerMode={sheetHeaderMode}
        isPerformanceCapped={isPerformanceCapped}
        onSheetStateChange={handleSheetStateChange}
      />
    </View>
  );
}
