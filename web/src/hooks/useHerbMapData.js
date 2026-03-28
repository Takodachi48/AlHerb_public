import { useState, useEffect, useMemo, useCallback } from 'react';
import locationService from '../services/locationService';

/**
 * Custom hook for herb map data management
 * Handles location data, filtering, and map state
 */
export const useHerbMapData = () => {
  const [locations, setLocations] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetails, setLocationDetails] = useState(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [availableHerbs, setAvailableHerbs] = useState([]);
  const [markersVisible, setMarkersVisible] = useState(true);

  // Load available herbs from API once on mount
  useEffect(() => {
    loadAvailableHerbs();
  }, []);

  // Load available herbs
  const loadAvailableHerbs = useCallback(async () => {
    try {
      const response = await locationService.fetchAvailableHerbs();
      if (response.success) {
        setAvailableHerbs(response.data);
      }
    } catch (err) {
      console.error('Failed to load available herbs:', err);
    }
  }, []);

  // Search locations with filters
  const searchLocations = useCallback(async (filters) => {
    try {
      setIsSearching(true);
      const response = await locationService.searchLocations(filters);
      
      if (response.success) {
        setLocations(response.data.locations || []);
      }
    } catch (err) {
      console.error('Failed to search locations:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Get location details
  const getLocationDetails = useCallback(async (locationId) => {
    try {
      setIsLoadingDetails(true);
      const response = await locationService.getLocationDetails(locationId);
      
      if (response.success) {
        setLocationDetails(response.data);
      }
    } catch (err) {
      console.error('Failed to get location details:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  // Clear location details
  const clearLocationDetails = useCallback(() => {
    setLocationDetails(null);
    setSelectedLocation(null);
  }, []);

  // Filter herbs based on search
  const filteredHerbs = useMemo(() => {
    if (!Array.isArray(availableHerbs)) return [];
    return availableHerbs.filter(herb =>
      herb.name.toLowerCase().includes('') ||
      herb.scientificName?.toLowerCase().includes('') ||
      herb.commonNames?.some(name => name.toLowerCase().includes(''))
    );
  }, [availableHerbs]);

  // Get herbs for a specific location
  const getLocationHerbs = useCallback((locationId) => {
    const location = locations.find(loc => loc._id === locationId);
    if (!location || !location.herbs) return [];
    
    return location.herbs.map(herbRef => ({
      id: herbRef.herbId._id,
      name: herbRef.herbId.name,
      scientificName: herbRef.herbId.scientificName,
      commonNames: herbRef.herbId.commonNames,
      availability: herbRef.availability || 'available'
    }));
  }, [locations]);

  // Update location
  const updateLocation = useCallback(async (locationId, updateData) => {
    try {
      const response = await locationService.updateLocation(locationId, updateData);
      
      if (response.success) {
        setLocations(prev => 
          prev.map(loc => 
            loc._id === locationId ? { ...loc, ...response.data } : loc
          )
        );
      }
    } catch (err) {
      console.error('Failed to update location:', err);
    }
  }, []);

  // Add new location
  const addLocation = useCallback(async (locationData) => {
    try {
      const response = await locationService.createLocation(locationData);
      
      if (response.success) {
        setLocations(prev => [...prev, response.data]);
      }
    } catch (err) {
      console.error('Failed to add location:', err);
    }
  }, []);

  // Delete location
  const deleteLocation = useCallback(async (locationId) => {
    try {
      await locationService.deleteLocation(locationId);
      setLocations(prev => prev.filter(loc => loc._id !== locationId));
      
      if (selectedLocation?._id === locationId) {
        clearLocationDetails();
      }
    } catch (err) {
      console.error('Failed to delete location:', err);
    }
  }, [selectedLocation, clearLocationDetails]);

  // Toggle markers visibility
  const toggleMarkers = useCallback(() => {
    setMarkersVisible(prev => !prev);
  }, []);

  // Get map bounds for fitting all markers
  const getMapBounds = useCallback(() => {
    if (locations.length === 0) return null;
    
    const lats = locations.map(loc => loc.coordinates?.[1]).filter(Boolean);
    const lngs = locations.map(loc => loc.coordinates?.[0]).filter(Boolean);
    
    if (lats.length === 0 || lngs.length === 0) return null;
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    return {
      north: maxLat,
      south: minLat,
      east: maxLng,
      west: minLng
    };
  }, [locations]);

  // Get center point for map
  const getMapCenter = useCallback(() => {
    const bounds = getMapBounds();
    if (!bounds) return { lat: 0, lng: 0 };
    
    return {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };
  }, [getMapBounds]);

  return {
    // State
    locations,
    isSearching,
    selectedLocation,
    locationDetails,
    isLoadingDetails,
    availableHerbs,
    markersVisible,
    filteredHerbs,
    
    // Computed
    locationHerbs: selectedLocation ? getLocationHerbs(selectedLocation._id) : [],
    
    // Actions
    searchLocations,
    getLocationDetails,
    clearLocationDetails,
    updateLocation,
    addLocation,
    deleteLocation,
    toggleMarkers,
    
    // Utilities
    getMapBounds,
    getMapCenter
  };
};
