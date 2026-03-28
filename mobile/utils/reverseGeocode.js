import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const cache = new Map();
const inFlight = new Map();
const CACHE_KEY = 'reverseGeocodeCacheV1';
let cacheLoaded = false;
let persistTimer = null;

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
};

const getCoordinates = (location) => {
  const coordinates = Array.isArray(location?.location?.coordinates)
    ? location.location.coordinates
    : null;

  const lng = toNumber(coordinates?.[0] ?? location?.longitude);
  const lat = toNumber(coordinates?.[1] ?? location?.latitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
};

const makeKey = (lat, lng) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

const pushUnique = (target, value) => {
  const cleaned = String(value || '').trim();
  if (!cleaned) return;
  const exists = target.some((entry) => entry.toLowerCase() === cleaned.toLowerCase());
  if (!exists) {
    target.push(cleaned);
  }
};

const buildAddressText = (address = {}) => {
  const parts = [];

  pushUnique(parts, address.name);
  pushUnique(parts, address.street);
  pushUnique(parts, address.district || address.subregion);
  pushUnique(parts, address.city || address.town || address.village || address.municipality);
  pushUnique(parts, address.region);
  pushUnique(parts, address.country);

  return parts.join(', ');
};

const schedulePersistCache = () => {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      const payload = Object.fromEntries(cache.entries());
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {
      // ignore cache persistence failures
    }
  }, 200);
};

const ensureCacheLoaded = async () => {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    Object.entries(parsed || {}).forEach(([key, value]) => {
      const text = String(value || '').trim();
      if (text) cache.set(key, text);
    });
  } catch {
    // ignore cache read failures
  }
};

const buildAddressFromGeoResult = (result = {}) => {
  const parts = [
    result.name,
    result.street,
    result.district || result.subregion,
    result.city || result.region,
    result.country,
  ];

  return buildAddressText({
    name: parts[0],
    street: parts[1],
    district: parts[2],
    city: parts[3],
    country: parts[4],
  });
};

export const reverseGeocodeLocation = async (location) => {
  const coords = getCoordinates(location);
  if (!coords) return '';

  await ensureCacheLoaded();

  const key = makeKey(coords.lat, coords.lng);
  if (cache.has(key)) {
    return cache.get(key) || '';
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const task = (async () => {
    try {
      const response = await Location.reverseGeocodeAsync({
        latitude: coords.lat,
        longitude: coords.lng,
      });

      const first = Array.isArray(response) ? response[0] : null;
      const addressText = first ? buildAddressFromGeoResult(first) : '';
      if (!addressText) {
        return '';
      }

      cache.set(key, addressText);
      schedulePersistCache();
      return addressText;
    } catch {
      return '';
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);

  try {
    return await task;
  } catch {
    return '';
  }
};
