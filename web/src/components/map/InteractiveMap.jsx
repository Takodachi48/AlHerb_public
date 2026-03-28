import React, { useState, useEffect, useRef, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, Circle, useMap, useMapEvents } from 'react-leaflet';
import L, { Icon, DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../../styles/map/map.css';
import { Store, Leaf, ShoppingBag, Pill, Plus, MapPin } from 'lucide-react';

// Fix Leaflet default icon issue
delete Icon.Default.prototype._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

/* ═══════════════════════════════════════════════════════════════
   MARKER DESIGN SYSTEM
   All colours reference CSS custom properties from semantics.css.
   No hardcoded hex values — tokens resolve through the cascade.

   Location types  (matches LOCATION_TYPES in the app)
   ────────────────────────────────────────────────────
   market    — public market / palengke / wet market   (accent warm)
   foraging  — wild harvest / documented herb site     (brand green)
   shop      — herbal product retail shop              (success green)
   pharmacy  — herbal pharmacy / botika                (warning amber)
   clinic    — traditional medicine clinic             (info blue)

   Cluster tiers (progressively darker brand ramp)
   ────────────────────────────────────────────────
   sm  < 10  — surface-brand (lightest)
   md  < 50  — interactive-brand-secondary
   lg  < 200 — interactive-brand-primary
   xl  ≥ 200 — interactive-brand-primary-pressed (darkest)
═══════════════════════════════════════════════════════════════ */

// ── Lucide icon components (12×12, text-on-dark color) ──

const LUCIDE_ICONS = {
  // market — Store icon
  market: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 7v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7"/>
    <path d="M5 7V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/>
    <path d="M2 7h20"/>
    <path d="M9 12v4"/>
    <path d="M15 12v4"/>
  </svg>`,
  // foraging — Leaf icon
  foraging: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 20A7 7 0 0 0 9.5 6.5C6.5 3.5 2 5 2 5s2.5 4.5 5.5 7.5A7 7 0 0 0 11 20z"/>
    <path d="M13 20A7 7 0 0 1 14.5 6.5C17.5 3.5 22 5 22 5s-2.5 4.5-5.5 7.5A7 7 0 0 1 13 20z"/>
  </svg>`,
  // shop — ShoppingBag icon
  shop: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 0-8 0"/>
  </svg>`,
  // pharmacy — Pill icon
  pharmacy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.5 19.5L19 11"/>
    <path d="M19 11l-7-7"/>
    <path d="M11 4L4 11"/>
    <path d="M4 11l7 7"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>`,
  // clinic — Plus (medical cross) icon
  clinic: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>`,
  // default pin — MapPin icon
  default: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-on-dark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>`,
};

// ── Marker icon factory ───────────────────────────────────────

function createLocationMarker(type, isSelected = false) {
  const t = LUCIDE_ICONS[type] ? type : 'default';
  const selectedClass = isSelected ? ' map-marker--selected' : '';

  return new DivIcon({
    html: `<div class="map-marker map-marker--${t}${selectedClass}">
      <div class="map-marker__body">
        <span class="map-marker__icon">${LUCIDE_ICONS[t]}</span>
      </div>
      <div class="map-marker__tail"></div>
    </div>`,
    className: '',
    iconSize:    [32, 40],
    iconAnchor:  [16, 40],
    popupAnchor: [0, -44],
  });
}

// ── Cluster icon factory ──────────────────────────────────────

function createClusterMarker(count) {
  const tier = count < 10 ? 'sm' : count < 50 ? 'md' : count < 200 ? 'lg' : 'xl';
  const size = { sm: 34, md: 38, lg: 42, xl: 46 }[tier];

  return new DivIcon({
    html: `<div class="map-cluster map-cluster--${tier}" style="width:${size}px;height:${size}px">
      <span class="map-cluster__count">${count > 999 ? '999+' : count}</span>
    </div>`,
    className:   '',
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  });
}

// ── User location marker factory ──────────────────────────────

function createUserLocationMarker() {
  return new DivIcon({
    html: `<div class="map-user-dot">
      <div class="map-user-dot__pulse"></div>
      <div class="map-user-dot__core"></div>
    </div>`,
    className:   '',
    iconSize:    [20, 20],
    iconAnchor:  [10, 10],
    popupAnchor: [0, -14],
  });
}

// ── Search radius circle Leaflet path options ─────────────────
// Leaflet Circle doesn't accept CSS vars for color/fillColor, so
// we use a className and override the SVG path via map.css.
const RADIUS_CIRCLE_OPTIONS = {
  className:    'map-radius-circle',
  color:        '#6e9448',   // overridden in map.css via .map-radius-circle path
  fillColor:    '#6e9448',
  fillOpacity:  0.07,
  weight:       1.5,
  dashArray:    '6 4',
  opacity:      0.6,
};

const getLocationLatLng = (location) => {
  let lat;
  let lng;

  if (location?.location?.coordinates && Array.isArray(location.location.coordinates)) {
    [lng, lat] = location.location.coordinates;
  } else if (location?.coordinates && Array.isArray(location.coordinates)) {
    [lng, lat] = location.coordinates;
  } else if (location?.coordinates?.lat != null && location?.coordinates?.lng != null) {
    lat = location.coordinates.lat;
    lng = location.coordinates.lng;
  } else if (location?.lat != null && location?.lng != null) {
    lat = location.lat;
    lng = location.lng;
  }

  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
};

// Component to enforce strict boundary limits
const BoundaryEnforcer = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    const enforceBounds = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();

      // Check if center is outside bounds
      if (center.lat < bounds[0][0] || center.lat > bounds[1][0] ||
        center.lng < bounds[0][1] || center.lng > bounds[1][1]) {
        // Calculate safe center within bounds
        const safeLat = Math.max(bounds[0][0], Math.min(bounds[1][0], center.lat));
        const safeLng = Math.max(bounds[0][1], Math.min(bounds[1][1], center.lng));
        map.setView([safeLat, safeLng], zoom, { animate: false });
      }
    };

    // Check bounds on various events
    map.on('moveend', enforceBounds);
    map.on('zoomend', enforceBounds);
    map.on('dragend', enforceBounds);

    return () => {
      map.off('moveend', enforceBounds);
      map.off('zoomend', enforceBounds);
      map.off('dragend', enforceBounds);
    };
  }, [map, bounds]);

  return null;
};

// Component to handle map events and viewport
const MapEvents = ({ onViewportChange, onMapClick }) => {
  const map = useMap();

  const emitViewport = useCallback(() => {
    if (!onViewportChange) {
      return;
    }

    const center = map.getCenter();
    onViewportChange({
      center,
      zoom: map.getZoom(),
      bounds: map.getBounds(),
    });
  }, [map, onViewportChange]);

  useMapEvents({
    moveend: (event) => {
      const map = event.target;
      const center = map.getCenter();
      const zoom = map.getZoom();

      // Check if map center is within Philippines bounds
      if (center.lat < 4.0 || center.lat > 21.0 || center.lng < 117.0 || center.lng > 127.0) {
        // Force map back within bounds
        map.setView([12.8797, 121.7740], zoom);
        return;
      }

      emitViewport();
    },
    click: (event) => {
      if (onMapClick) {
        onMapClick(event);
      }
    }
  });

  // Enforce zoom limits
  useEffect(() => {
    const handleZoom = () => {
      const zoom = map.getZoom();
      if (zoom < 5) {
        map.setZoom(5);
      } else if (zoom > 18) {
        map.setZoom(18);
      }
    };

    map.on('zoomend', handleZoom);

    return () => {
      map.off('zoomend', handleZoom);
    };
  }, [map]);

  useEffect(() => {
    emitViewport();
  }, [emitViewport]);

  return null;
};

// Component to update map when user location changes
const MapController = ({ userLocation, centerRequestId = 0, centerZoom = 13 }) => {
  const map = useMap();
  const lastHandledRequestRef = useRef(0);

  useEffect(() => {
    if (!userLocation || !centerRequestId) {
      return;
    }

    if (lastHandledRequestRef.current === centerRequestId) {
      return;
    }

    // Only center if coordinates are within Philippines bounds.
    const lat = userLocation.lat;
    const lng = userLocation.lng;
    if (lat < 4.0 || lat > 21.0 || lng < 117.0 || lng > 127.0) {
      return;
    }

    map.setView([lat, lng], centerZoom);
    lastHandledRequestRef.current = centerRequestId;
  }, [userLocation, centerRequestId, centerZoom, map]);

  return null;
};

const MapResetController = ({ resetSignal, defaultCenter, defaultZoom }) => {
  const map = useMap();
  const lastResetRef = useRef(0);

  useEffect(() => {
    if (!resetSignal || lastResetRef.current === resetSignal) {
      return;
    }
    map.setView(defaultCenter, defaultZoom, { animate: true, duration: 0.6 });
    lastResetRef.current = resetSignal;
  }, [resetSignal, defaultCenter, defaultZoom, map]);

  return null;
};

const SelectedLocationController = ({ selectedLocationId, locations, fallbackLocation, focusZoom }) => {
  const map = useMap();
  const lastFocusedLocationIdRef = useRef(null);

  useEffect(() => {
    if (!selectedLocationId) {
      lastFocusedLocationIdRef.current = null;
    }
  }, [selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId || !Array.isArray(locations) || locations.length === 0) {
      return;
    }

    if (lastFocusedLocationIdRef.current === selectedLocationId) {
      return;
    }

    let target = locations.find((location) => (location.id || location._id) === selectedLocationId && !location.isCluster);
    if (!target && fallbackLocation && (fallbackLocation.id || fallbackLocation._id) === selectedLocationId) {
      target = fallbackLocation;
    }
    if (!target) {
      return;
    }

    const point = getLocationLatLng(target);
    if (!point) {
      return;
    }

    const nextZoom = Math.max(map.getZoom(), focusZoom);
    map.flyTo([point.lat, point.lng], nextZoom, { animate: true, duration: 0.8 });
    lastFocusedLocationIdRef.current = selectedLocationId;
  }, [map, selectedLocationId, locations, focusZoom]);

  return null;
};

const InteractiveMap = forwardRef(({
  userLocation,
  selectedFilter,
  searchRadius,
  markersVisible,
  onMarkerClick,
  onMapClick,
  onViewportChange,
  selectedLocationId,
  selectedLocation,
  resetSignal = 0,
  locations,
  focusZoom = 15,
  centerRequestId = 0,
  centerZoom = 13,
  className = ''
}, ref) => {
  const [mapError, setMapError] = useState(null);
  const mapRef = useRef(null);

  // Zoom control functions
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  // Expose zoom methods to parent
  useImperativeHandle(ref, () => ({
    zoomIn,
    zoomOut
  }), []);

  const defaultCenter = [12.8797, 121.7740];
  const defaultZoom = 6;

  // Philippines bounds for limiting map movement
  const philippinesBounds = [
    [4.0, 117.0], // Southwest corner (minimum latitude, longitude)
    [21.0, 127.0]  // Northeast corner (maximum latitude, longitude)
  ];

  // Filter locations based on selected filter
  const filteredLocations = useMemo(() => {
    if (!selectedFilter || selectedFilter === '' || selectedFilter === 'all') return locations || [];
    return (locations || []).filter((location) => {
      if (location.isCluster) return true;
      return location.type === selectedFilter || location.category === selectedFilter;
    });
  }, [selectedFilter, locations]);

  // Radius filtering is handled upstream in MapPage/service queries.
  const locationsInRadius = filteredLocations;

  // Handle marker clicks
  const handleMarkerClick = useCallback((locationId) => {
    onMarkerClick(locationId);
  }, [onMarkerClick]);

  if (mapError) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-bg ${className}`}>
        <div className="text-center p-4">
          <div className="w-16 h-16 bg-intent-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-intent-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-text-neutral mb-2">Map Error</h3>
          <p className="text-text-neutral/60 mb-4">Unable to load the map. Please check your connection.</p>
          <button
            onClick={() => setMapError(null)}
            className="bg-intent-info text-white px-4 py-2 rounded-lg hover:bg-intent-info-hover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <MapContainer
        ref={mapRef}
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ width: '100%', height: '100%' }}
        className="z-0"
        bounds={philippinesBounds}
        maxBounds={philippinesBounds}
        maxBoundsViscosity={1.0}
        minZoom={5}
        maxZoom={18}
        worldCopyJump={false}
        bounceAtZoomLimits={true}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          userLocation={userLocation}
          centerRequestId={centerRequestId}
          centerZoom={centerZoom}
        />
        <MapResetController
          resetSignal={resetSignal}
          defaultCenter={defaultCenter}
          defaultZoom={defaultZoom}
        />
        <SelectedLocationController
          selectedLocationId={selectedLocationId}
          locations={locationsInRadius}
          fallbackLocation={selectedLocation}
          focusZoom={focusZoom}
        />
        <BoundaryEnforcer bounds={philippinesBounds} />
        <MapEvents
          onViewportChange={onViewportChange}
          onMapClick={onMapClick}
        />

        {/* ── Search radius circle ── */}
        {userLocation?.lat && userLocation?.lng && searchRadius > 0 && (
          <Circle
            center={[userLocation.lat, userLocation.lng]}
            radius={searchRadius * 1000}
            pathOptions={RADIUS_CIRCLE_OPTIONS}
          />
        )}

        {/* ── Location + cluster markers ── */}
        {locationsInRadius.map(location => {
          const point = getLocationLatLng(location);
          if (!point) {
            console.warn('Invalid coordinates for location:', location);
            return null;
          }

          const isCluster  = Boolean(location.isCluster);
          const count      = Number(location.count) || 1;
          const locType    = location.type || location.category || 'default';
          const isSelected = (location.id || location._id) === selectedLocationId;

          const icon = isCluster
            ? createClusterMarker(count)
            : createLocationMarker(locType, isSelected);

          return (
            <Marker
              key={location.id || location._id}
              position={[point.lat, point.lng]}
              icon={icon}
              opacity={markersVisible ? 1 : 0}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  if (isCluster && mapRef.current) {
                    const nextZoom = Math.min(mapRef.current.getZoom() + 2, 18);
                    mapRef.current.flyTo([point.lat, point.lng], nextZoom, { animate: true, duration: 0.6 });
                    return;
                  }
                  handleMarkerClick(location.id || location._id);
                }
              }}
            />
          );
        }).filter(Boolean)}

        {/* ── User location dot ── */}
        {userLocation?.lat && userLocation?.lng && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={createUserLocationMarker()}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>
    </div>
  );
});

InteractiveMap.displayName = 'InteractiveMap';

// Named export — lets parent components build a filter bar / legend
// without duplicating the type list. Mirrors LOCATION_TYPES in the app.
export const LOCATION_TYPE_CONFIG = {
  market:   { label: 'Market',   colorToken: 'interactive-accent-primary'  },
  foraging: { label: 'Foraging', colorToken: 'interactive-brand-primary'   },
  shop:     { label: 'Shop',     colorToken: 'interactive-success'         },
  pharmacy: { label: 'Pharmacy', colorToken: 'interactive-warning'         },
  clinic:   { label: 'Clinic',   colorToken: 'interactive-info'            },
};

export default InteractiveMap;