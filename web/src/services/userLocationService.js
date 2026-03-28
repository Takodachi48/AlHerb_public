import { PH_ADMIN_CENTERS } from '../data/phAdminCenters';

const SESSION_KEY = 'userLocationCoords';

const normalize = (value) => String(value || '').trim().toLowerCase();

const getSessionCache = () => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return parsed;
    }
    return null;
  } catch (error) {
    return null;
  }
};

const setSessionCache = (coords) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(coords));
  } catch (error) {
    // Ignore cache failures in privacy-restricted browsers.
  }
};

const findProfileCenter = (profileLocation = {}) => {
  const city = normalize(profileLocation.city);
  const province = normalize(profileLocation.province);
  const region = normalize(profileLocation.region);

  if (!city && !province && !region) {
    return null;
  }

  const exactCity = PH_ADMIN_CENTERS.find((entry) => normalize(entry.city) === city);
  if (exactCity) {
    return {
      lat: exactCity.coordinates[1],
      lng: exactCity.coordinates[0],
      source: 'profile_city',
      city: exactCity.city,
      province: exactCity.province,
      region: exactCity.region,
    };
  }

  const provinceMatch = PH_ADMIN_CENTERS.find((entry) => normalize(entry.province) === province);
  if (provinceMatch) {
    return {
      lat: provinceMatch.coordinates[1],
      lng: provinceMatch.coordinates[0],
      source: 'profile_province',
      city: provinceMatch.city,
      province: provinceMatch.province,
      region: provinceMatch.region,
    };
  }

  const regionMatch = PH_ADMIN_CENTERS.find((entry) => normalize(entry.region) === region);
  if (regionMatch) {
    return {
      lat: regionMatch.coordinates[1],
      lng: regionMatch.coordinates[0],
      source: 'profile_region',
      city: regionMatch.city,
      province: regionMatch.province,
      region: regionMatch.region,
    };
  }

  return null;
};

const getGoogleGeolocation = async (apiKey) => {
  if (!apiKey) {
    return null;
  }

  const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      considerIp: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google geolocation failed with status ${response.status}`);
  }

  const data = await response.json();
  const lat = data?.location?.lat;
  const lng = data?.location?.lng;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  return { lat, lng, source: 'google_geolocation', accuracy: data?.accuracy || null };
};

const getBrowserGeolocation = () => new Promise((resolve) => {
  if (!navigator.geolocation) {
    resolve(null);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      source: 'browser_geolocation',
      accuracy: position.coords.accuracy,
    }),
    () => resolve(null),
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    },
  );
});

const resolveUserCoordinates = async ({
  user,
  preferProfile = true,
  forceRealtime = false,
  googleApiKey = import.meta.env.VITE_GOOGLE_GEOLOCATION_API_KEY,
} = {}) => {
  if (!forceRealtime) {
    const cached = getSessionCache();
    if (cached) {
      return { ...cached, source: cached.source || 'session_cache' };
    }
  }

  if (preferProfile && !forceRealtime) {
    const profileMatch = findProfileCenter(user?.location || {});
    if (profileMatch) {
      setSessionCache(profileMatch);
      return profileMatch;
    }
  }

  try {
    const googleCoords = await getGoogleGeolocation(googleApiKey);
    if (googleCoords) {
      setSessionCache(googleCoords);
      return googleCoords;
    }
  } catch (error) {
    // Fall back to browser geolocation and then default center.
  }

  const browserCoords = await getBrowserGeolocation();
  if (browserCoords) {
    setSessionCache(browserCoords);
    return browserCoords;
  }

  const fallback = { lat: 12.8797, lng: 121.774, source: 'default_ph_center' };
  setSessionCache(fallback);
  return fallback;
};

export default {
  resolveUserCoordinates,
  getGoogleGeolocation,
  getBrowserGeolocation,
  findProfileCenter,
};
