import React, { useRef, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { formatLocationAddress } from '../utils/locationFormat';

const OpenStreetMap = ({
  locations = [],
  userLocation = null,
  searchRadius = 20, // Default 20km
  resetViewSignal = 0,
  zoomInSignal = 0,
  zoomOutSignal = 0,
  selectedLocationId = null,
  onLocationPress = () => { },
  onBoundsChange = () => { },
  onMapInteract = () => { },
  style = {},
  initialRegion = { latitude: 12.8797, longitude: 121.7740, zoom: 6 }
}) => {
  const webViewRef = useRef(null);
  const lastFlyToIdRef = useRef(null);
  const lastUserFocusKeyRef = useRef('');
  const [isMapReady, setIsMapReady] = useState(false);

  // --- DATA PREPARATION HELPERS ---

  const prepareMarkerData = (loc) => {
    let lat, lng;
    if (loc.location && Array.isArray(loc.location.coordinates)) {
      lng = loc.location.coordinates[0];
      lat = loc.location.coordinates[1];
    } else {
      lat = loc.latitude;
      lng = loc.longitude;
    }

    if (!lat || !lng) return null;

    const herbNames = loc.herbs && loc.herbs.length > 0
      ? loc.herbs.map(h => {
        if (typeof h === 'string') return h;
        if (h.herbId && h.herbId.name) return h.herbId.name;
        if (h.herb && h.herb.name) return h.herb.name;
        if (h.name) return h.name;
        return null;
      }).filter(Boolean).join(', ')
      : '';

    return {
      id: loc._id || loc.id,
      name: loc.name,
      type: loc.type,
      isCluster: Boolean(loc.isCluster),
      clusterCount: Number(loc.clusterCount || 0),
      isVerified: Boolean(loc.isVerified),
      addressText: formatLocationAddress(loc, 'Resolving address...'),
      rating: loc.rating || 'New',
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      color: getLocationColor(loc.type),
      herbNames: herbNames
    };
  };

  const prepareUserLocationData = () => {
    if (userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number') {
      return {
        lat: userLocation.latitude,
        lng: userLocation.longitude,
        radiusMeters: searchRadius * 1000
      };
    }
    return null;
  };

  // --- DYNAMIC UPDATES via postMessage ---

  // 1. Update Markers when locations change
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    const timer = setTimeout(() => {
      const markersData = locations.map(prepareMarkerData).filter(Boolean);

      webViewRef.current.postMessage(JSON.stringify({
        action: 'updateMarkers',
        markers: markersData
      }));
    }, 150); // Debounce updates to prevent bridge overload

    return () => clearTimeout(timer);
  }, [locations, isMapReady]);

  // 2. Update User Location when it changes
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    const userLocData = prepareUserLocationData();

    webViewRef.current.postMessage(JSON.stringify({
      action: 'updateUserLocation',
      userLocation: userLocData
    }));
  }, [userLocation, searchRadius, isMapReady]);

  // 2b. Animate map viewport to user location + selected radius
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;

    if (!userLocation || typeof userLocation.latitude !== 'number' || typeof userLocation.longitude !== 'number') {
      lastUserFocusKeyRef.current = '';
      return;
    }

    const radiusMeters = Math.max(0, Number(searchRadius || 0) * 1000);
    // Be less sensitive to minor GPS drift (4 decimal places is ~11 meters)
    const locationsKey = radiusMeters > 0 ? locations.slice(0, 10).map(l => l._id || l.id).join(',') : 'all';
    const focusKey = `${userLocation.latitude.toFixed(4)}:${userLocation.longitude.toFixed(4)}:${Math.round(radiusMeters)}:${locationsKey}`;
    if (focusKey === lastUserFocusKeyRef.current) return;

    webViewRef.current.postMessage(JSON.stringify({
      action: 'focusUserLocation',
      userLocation: {
        lat: Number(userLocation.latitude),
        lng: Number(userLocation.longitude),
        radiusMeters
      }
    }));

    lastUserFocusKeyRef.current = focusKey;
  }, [userLocation, searchRadius, isMapReady, locations.length]);

  // 2c. Reset map to show all visible location markers
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;
    if (!resetViewSignal) return;

    const timer = setTimeout(() => {
      webViewRef.current?.postMessage(JSON.stringify({
        action: 'fitAllLocations',
      }));
    }, 220);

    return () => clearTimeout(timer);
  }, [resetViewSignal, isMapReady, locations.length]);

  // 2d. Zoom controls from native overlay
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;
    if (!zoomInSignal) return;

    webViewRef.current.postMessage(JSON.stringify({
      action: 'zoomIn',
    }));
  }, [zoomInSignal, isMapReady]);

  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;
    if (!zoomOutSignal) return;

    webViewRef.current.postMessage(JSON.stringify({
      action: 'zoomOut',
    }));
  }, [zoomOutSignal, isMapReady]);

  // 3. Handle FlyTo Selection
  useEffect(() => {
    if (!selectedLocationId) {
      lastFlyToIdRef.current = null;
      return;
    }

    if (isMapReady && webViewRef.current) {
      const selectedId = String(selectedLocationId);
      if (lastFlyToIdRef.current === selectedId) return;

      const loc = locations.find(l => String(l._id || l.id || '') === selectedId);
      if (loc) {
        let lat, lng;
        if (loc.location && Array.isArray(loc.location.coordinates)) {
          lng = loc.location.coordinates[0];
          lat = loc.location.coordinates[1];
        } else {
          lat = loc.latitude;
          lng = loc.longitude;
        }

        if (lat && lng) {
          webViewRef.current.postMessage(JSON.stringify({
            action: 'flyTo',
            lat: parseFloat(lat),
            lng: parseFloat(lng),
            id: selectedId
          }));
          lastFlyToIdRef.current = selectedId;
        }
      }
    }
  }, [selectedLocationId, locations, isMapReady]);


  // --- STATIC HTML GENERATION ---

  // We use useMemo to ensure the HTML string doesn't change on every render,
  // preventing the WebView from reloading.
  const mapHTML = useMemo(() => {
    const initialConfig = {
      lat: userLocation ? userLocation.latitude : initialRegion.latitude,
      lng: userLocation ? userLocation.longitude : initialRegion.longitude,
      zoom: userLocation ? 13 : initialRegion.zoom
    };

    return `   
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Herb Locations Map</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
        <script>
          // GLOBAL ERROR HANDLER
          window.onerror = function(message, source, lineno, colno, error) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'log',
                type: 'ERROR-GLOBAL',
                message: message + ' at ' + source + ':' + lineno
              }));
            } catch (e) {}
          };
        </script>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          #map { height: 100vh; width: 100vw; background-color: #f3f4f6; }
          .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); }
          .leaflet-popup-content { margin: 0; width: 280px !important; }
          .leaflet-container a.leaflet-popup-close-button { top: 8px; right: 8px; color: #6B7280; font-size: 18px; padding: 4px; }
          .leaflet-bottom.leaflet-left { bottom: 10px; left: 8px; }
          .leaflet-control-attribution {
            background: rgba(255, 255, 255, 0.8) !important;
            border-radius: 6px !important;
            padding: 2px 6px !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
          }
          .leaflet-control-attribution a {
            color: #065F46 !important;
          }
          
          /* Pulse Animation for User Location */
          .user-location-pulse {
            width: 14px;
            height: 14px;
            background: #3b82f6;
            border: 2px solid white;
            border-radius: 50%;
            position: relative;
            box-shadow: 0 0 4px rgba(0,0,0,0.2);
          }
          .user-location-pulse::after {
            content: '';
            position: absolute;
            top: -2px;
            left: -2px;
            width: 100%;
            height: 100%;
            border: 2px solid #3b82f6;
            border-radius: 50%;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(3); opacity: 0; }
          }

          /* Custom Marker Style */
          .custom-marker-wrapper {
             transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .custom-marker {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            background: white;
            border-radius: 50%;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            border: 2px solid #10b981;
            transition: all 0.2s ease;
          }
          .custom-marker i {
            font-size: 18px;
            color: #10b981;
          }
          
          /* Selected State */
          .marker-selected {
            transform: scale(1.15);
            z-index: 1000 !important;
          }
          .marker-selected .custom-marker {
            border-width: 3px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
          }
          
          /* Verified State */
          .marker-verified .custom-marker {
            border-color: #F59E0B !important;
          }
          .marker-verified ion-icon {
            color: #F59E0B !important;
          }
          .verified-badge {
            display: inline-flex;
            align-items: center;
            background: #FEF3C7;
            color: #D97706;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            margin-left: 6px;
            vertical-align: middle;
          }

          /* Cluster Style */
          .marker-cluster-small {
            background: rgba(167, 243, 208, 0.55);
          }
          .marker-cluster-small div {
            background: #34D399;
            color: #064E3B;
          }
          .marker-cluster-medium {
            background: rgba(52, 211, 153, 0.38);
          }
          .marker-cluster-medium div {
            background: #10B981;
            color: #ECFDF5;
          }
          .marker-cluster-large {
            background: rgba(6, 95, 70, 0.36);
          }
          .marker-cluster-large div {
            background: #047857;
            color: #ECFDF5;
          }
          .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
            font-weight: 800;
            box-shadow: 0 8px 14px rgba(0, 0, 0, 0.2);
            border: 2px solid rgba(255, 255, 255, 0.92);
          }

          /* Location Type Styles */
          .marker-market .custom-marker { border-color: #10B981; color: #10B981; }
          .marker-shop .custom-marker { border-color: #059669; color: #059669; }
          .marker-clinic .custom-marker { border-color: #047857; color: #047857; }
          .marker-wild .custom-marker { border-color: #34D399; color: #34D399; }
          .marker-garden .custom-marker { border-color: #16A34A; color: #16A34A; }
          
          /* Promoted Listing Style */
          .marker-promoted .custom-marker {
            border-width: 3px;
            border-color: #F59E0B !important;
            box-shadow: 0 0 15px rgba(245, 158, 11, 0.4);
          }
          .marker-promoted .custom-marker i {
            color: #F59E0B !important;
          }

          /* Popup Styling */
          .popup-header {
            padding: 16px 16px 12px;
            background: #fff;
            border-bottom: 1px solid #f3f4f6;
          }
          .popup-title {
            margin: 0 0 4px 0;
            font-size: 16px;
            font-weight: 700;
            color: #111827;
            line-height: 1.2;
          }
          .popup-type {
            display: inline-block;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .popup-body {
            padding: 12px 16px;
            background: #f9fafb;
          }
          .popup-address {
            margin: 0 0 8px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.4;
          }
          .popup-herbs {
            margin: 0 0 12px;
            font-size: 12px;
            color: #374151;
            line-height: 1.4;
          }
          .popup-btn {
            width: 100%;
            border: none;
            padding: 10px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 13px;
            cursor: pointer;
            transition: opacity 0.2s;
            color: white;
          }
          .popup-btn:active { opacity: 0.8; }
        </style>
        <!-- Adding IonIcons for markers -->
        <script src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js" type="module"></script>
        <script src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js" nomodule></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          // --- LOGGING ---
          function sendLog(type, args) {
             try {
               window.ReactNativeWebView.postMessage(JSON.stringify({
                 action: 'log',
                 type: type,
                 message: Array.prototype.slice.call(args).join(' ')
               }));
             } catch (e) {}
          }
          console.log = function() { sendLog('LOG', arguments); };
          console.warn = function() { sendLog('WARN', arguments); };
          console.error = function() { sendLog('ERROR', arguments); };

          // --- STATE ---
          var map = null;
          var markersLayerGroup = null;
          var userLayerGroup = null;
          var markerMap = {}; // id -> marker instance
          var currentConfig = ${JSON.stringify(initialConfig)};
          var lastFocusLoc = null;
          var isManualInteracted = false;
          var focusTimer = null;
          var isAnimatingFocus = false;

          // --- ICONS ---
          function getIconForType(type) {
            var t = String(type || '').toLowerCase();
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
          }

          // --- MAP INITIALIZATION ---
          function initMap() {
            try {
              if (typeof L === 'undefined') {
                setTimeout(initMap, 100);
                return;
              }

              map = L.map('map', {
                  zoomControl: false,
                  attributionControl: false,
                  dragging: true,
                  tap: true
              }).setView([currentConfig.lat, currentConfig.lng], currentConfig.zoom);
              
              L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
              }).addTo(map);
              L.control.attribution({ position: 'bottomleft', prefix: false })
                .addTo(map)
                .addAttribution('&copy; OpenStreetMap contributors');
              
              // Initialize Layer Groups
              markersLayerGroup = L.markerClusterGroup({
                maxClusterRadius: 50,
                spiderfyOnMaxZoom: true,
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true
              }).addTo(map);
              userLayerGroup = L.layerGroup().addTo(map);

              // Event Listeners
              map.on('moveend zoomend', sendBoundsChange);
              map.on('mousedown touchstart dragstart', function() {
                isManualInteracted = true;
                window.ReactNativeWebView.postMessage(JSON.stringify({action: 'mapInteraction', active: true}));
              });
              map.on('mouseup touchend dragend', function() {
                window.ReactNativeWebView.postMessage(JSON.stringify({action: 'mapInteraction', active: false}));
              });

              // Notify Ready
              window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'mapReady' }));
              console.log('Map Initialized');
              
              // Initial Bounds
              setTimeout(sendBoundsChange, 500);

            } catch (err) {
              console.error('Map Init Failed:', err.message);
            }
          }

          function sendBoundsChange() {
            if (!map) return;
            try {
              var bounds = map.getBounds();
              window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'boundsChange',
                bounds: {
                  swLat: bounds.getSouth(),
                  swLng: bounds.getWest(),
                  neLat: bounds.getNorth(),
                  neLng: bounds.getEast(),
                  zoom: map.getZoom()
                }
              }));
            } catch (e) {}
          }

          window.handleLocationClick = function(id) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              action: 'selectLocation',
              locationId: id
            }));
          };

          // --- UPDATE FUNCTIONS ---

          window.updateMarkers = function(markersData) {
            if (!map || !markersLayerGroup) return;
            
            console.log('Updating markers: ' + markersData.length);
            
            // Clear existing
            markersLayerGroup.clearLayers();
            markerMap = {};

            markersData.forEach(function(loc) {
              var lat = loc.lat;
              var lng = loc.lng;
              var id = loc.id;
              
              // Icon Style
              var iconHtml = '';
              var iconSize = 34;
              var iconAnchor = 17;
              
              // Normal Marker
              var typeClass = ' marker-' + (String(loc.type || '').toLowerCase());
              var verifiedClass = loc.isVerified ? ' marker-verified' : '';
              var promotedClass = loc.isPromoted ? ' marker-promoted' : '';
              
              iconHtml = '<div class="custom-marker' + typeClass + verifiedClass + promotedClass + '" style="border-color: ' + (loc.color || '#10B981') + ';">' +
                         '<ion-icon name="' + getIconForType(loc.type) + '" style="color: ' + (loc.color || '#10B981') + ';"></ion-icon>' +
                         '</div>';
              
              var customIcon = L.divIcon({
                className: 'custom-marker-wrapper' + (loc.isVerified ? ' marker-verified' : '') + (loc.isPromoted ? ' marker-promoted' : ''),
                html: iconHtml,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconAnchor, iconAnchor],
                popupAnchor: [0, -iconAnchor]
              });

              // Popup Content
              var verifiedBadge = loc.isVerified ? '<span class="verified-badge"><ion-icon name="checkmark-circle" style="font-size: 12px; margin-right: 2px;"></ion-icon> Verified</span>' : '';
              var promotedBadge = loc.isPromoted ? '<span class="promoted-badge" style="background:#FEF3C7; color:#D97706; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:6px;">Ad</span>' : '';
              
              var content = '<div class="popup-header">' +
                            '<h3 class="popup-title">' + 
                              (loc.name || 'Unknown') + 
                              verifiedBadge + promotedBadge +
                            '</h3>' +
                            '<span class="popup-type" style="background-color: ' + (loc.color || '#10B981') + '20; color: ' + (loc.color || '#10B981') + ';">' + 
                              (loc.type || 'Location') + 
                            '</span>' +
                            '</div>' +
                            '<div class="popup-body">' +
                            '<p class="popup-address">' + (loc.addressText || 'Address unavailable') + '</p>';
              
              if (loc.herbNames) {
                content += '<p class="popup-herbs"><strong>Herbs:</strong> ' + loc.herbNames + '</p>';
              }

              var btnText = 'Select Location';
              var btnColor = (loc.color || '#10B981');
              
              content += '<button class="popup-btn" style="background-color: ' + btnColor + ';" onclick="handleLocationClick(\\'' + id + '\\')">' + btnText + '</button>' +
                         '</div>';

              var marker = L.marker([lat, lng], { icon: customIcon })
                .bindPopup(content);
              
              marker.on('click', function() {
                // Highlight logic can be added here
                handleLocationClick(id);
              });

              markersLayerGroup.addLayer(marker);
              markerMap[id] = marker;
            });

            // If we have a pending focus and haven't manually moved yet, try to focus/re-focus
            if (lastFocusLoc && !isManualInteracted) {
               console.log('Markers arrived, ensuring focus is correct');
               window.focusUserLocation(lastFocusLoc, true);
            }
          };

          window.updateUserLocation = function(userLoc) {
            if (!map || !userLayerGroup) return;
            
            userLayerGroup.clearLayers();
            
            if (userLoc && userLoc.lat && userLoc.lng) {
               var userMarker = L.marker([userLoc.lat, userLoc.lng], {
                icon: L.divIcon({
                  className: 'user-marker-container',
                  html: '<div class="user-location-pulse"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                })
              }).bindPopup("You are here");
              
              userLayerGroup.addLayer(userMarker);
              
              if (userLoc.radiusMeters) {
                L.circle([userLoc.lat, userLoc.lng], {
                    color: '#3B82F6',
                    fillColor: '#3B82F6',
                    weight: 1,
                    fillOpacity: 0.1,
                    radius: userLoc.radiusMeters
                }).addTo(userLayerGroup);
              }
            }
          };

          window.focusUserLocation = function(userLoc, ignoreManualCheck) {
            if (!map || !userLoc) return;
            
            lastFocusLoc = userLoc;
            if (isManualInteracted && !ignoreManualCheck) return;
            
            if (focusTimer) {
              clearTimeout(focusTimer);
              focusTimer = null;
            }

            var lat = Number(userLoc.lat);
            var lng = Number(userLoc.lng);
            var radiusMeters = Math.max(0, Number(userLoc.radiusMeters || 0));
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

            var userLatLng = L.latLng(lat, lng);
            var markersBounds = markersLayerGroup.getBounds();
            var radiusCircle = L.circle(userLatLng, { radius: radiusMeters });
            var radiusBounds = radiusCircle.getBounds();
            
            var targetBounds = radiusBounds; // Default
            if (markersBounds && markersBounds.isValid && markersBounds.isValid()) {
                targetBounds = markersBounds.extend(userLatLng);
            }

            // Calculate optimal zoom with padding
            var zoom = Math.min(map.getBoundsZoom(targetBounds, false, [64, 64]), 16);
            
            // The "Zoom Out Zoom In" effect is handled by map.flyTo automatically
            // when the target is far or the zoom level difference is significant.
            console.log('Flying to target (Zoom: ' + zoom + ')');
            map.flyTo(targetBounds.getCenter(), zoom, {
                animate: true,
                duration: 1.5,
                easeLinearity: 0.25
            });

            // Set a small "interaction protection" timer but don't block updateMarkers
            isAnimatingFocus = true;
            focusTimer = setTimeout(function() {
                isAnimatingFocus = false;
                focusTimer = null;
            }, 1600);
          };

          window.fitAllLocations = function() {
            if (!map || !markersLayerGroup) return;

            var bounds = markersLayerGroup.getBounds();
            if (bounds && bounds.isValid && bounds.isValid()) {
              map.fitBounds(bounds, {
                padding: [48, 48],
                animate: true,
                duration: 0.9,
                maxZoom: 15
              });
              return;
            }

            map.flyTo([currentConfig.lat, currentConfig.lng], currentConfig.zoom, {
              animate: true,
              duration: 0.9
            });
          };

          window.zoomInMap = function() {
            if (!map) return;
            map.zoomIn(1, { animate: true, duration: 0.4 });
          };

          window.zoomOutMap = function() {
            if (!map) return;
            map.zoomOut(1, { animate: true, duration: 0.4 });
          };

          window.flyToLocation = function(lat, lng, id) {
             if (map) {
               map.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
               
               if (id && markerMap[id]) {
                 setTimeout(function() {
                   markerMap[id].openPopup();
                 }, 1200);
               }
             }
          };

          // --- MESSAGE LISTENER ---
          document.addEventListener('message', function(event) {
            try {
              var data = JSON.parse(event.data);
              if (data.action === 'updateMarkers') {
                window.updateMarkers(data.markers);
              } else if (data.action === 'updateUserLocation') {
                window.updateUserLocation(data.userLocation);
              } else if (data.action === 'focusUserLocation') {
                isManualInteracted = false; // Reset interaction state when explicit focus is requested
                window.focusUserLocation(data.userLocation);
              } else if (data.action === 'fitAllLocations') {
                window.fitAllLocations();
              } else if (data.action === 'zoomIn') {
                window.zoomInMap();
              } else if (data.action === 'zoomOut') {
                window.zoomOutMap();
              } else if (data.action === 'flyTo') {
                window.flyToLocation(data.lat, data.lng, data.id);
              }
            } catch(e) { console.error('Error handling message', e); }
          });

          // Start
          initMap();

        </script>
      </body>
      </html>
    `;
  }, []); // Empty dependency array = static HTML

  const getLocationColor = (type) => {
    switch (String(type || '').toLowerCase()) {
      case 'cluster': return '#059669';
      case 'market': return '#10B981';
      case 'store':
      case 'shop': return '#059669';
      case 'clinic':
      case 'pharmacy': return '#047857';
      case 'wild':
      case 'foraging': return '#34D399';
      case 'garden': return '#16A34A';
      case 'farm': return '#047857';
      case 'park': return '#0F766E';
      case 'suggested': return '#22C55E';
      default: return '#6B7280';
    }
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.action === 'log') {
        // console.log(`[WebView ${data.type}]:`, data.message);
      } else if (data.action === 'mapReady') {
        setIsMapReady(true);
      } else if (data.action === 'selectLocation') {
        const location = locations.find(loc => (loc._id || loc.id) === data.locationId);
        if (location) {
          onLocationPress(location);
        }
      } else if (data.action === 'mapInteraction') {
        onMapInteract(data.active);
      } else if (data.action === 'boundsChange' && data.bounds) {
        onBoundsChange(data.bounds);
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: mapHTML, baseUrl: '' }}
        originWhitelist={['*']}
        style={styles.webView}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn('WebView error: ', nativeEvent);
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6'
  }
});

export default OpenStreetMap;
