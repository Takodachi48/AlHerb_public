const axios = require('axios');
const CoordinateLookupCache = require('../models/CoordinateLookupCache');
const { logger } = require('../utils/logger');

const RATE_LIMIT_MS = 1000;
const REQUEST_TIMEOUT_MS = 12000;
const RETRY_DELAY_MS = 2000;
const RETRY_ATTEMPTS = 2;
const HASH_DECIMALS = 6;

let queue = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const normalizeCoordinate = (value) => Number(Number(value).toFixed(HASH_DECIMALS));

const buildCoordinateHash = (lat, lng) => {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  return `${normalizedLat},${normalizedLng}`;
};

const extractStructuredLocation = (address = {}) => ({
  city: address.city || address.town || address.village || address.municipality || address.county || '',
  province: address.state || address.province || address.region || '',
  country: address.country || '',
  postcode: address.postcode || '',
});

const enqueueReverseGeocode = (task) => {
  const run = async () => {
    const now = Date.now();
    const waitMs = Math.max(0, RATE_LIMIT_MS - (now - lastRequestAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const result = await task();
    lastRequestAt = Date.now();
    return result;
  };

  queue = queue.then(run, run);
  return queue;
};

const callNominatim = async (lat, lng) => {
  const url = 'https://nominatim.openstreetmap.org/reverse';
  const response = await axios.get(url, {
    params: {
      format: 'jsonv2',
      lat,
      lon: lng,
      addressdetails: 1,
      zoom: 14,
    },
    headers: {
      'User-Agent': process.env.NOMINATIM_USER_AGENT || 'herb-system/1.0 (contact: admin@local.dev)',
      Accept: 'application/json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const structured = extractStructuredLocation(response.data?.address);
  return {
    ...structured,
    provider: 'nominatim',
    raw: response.data || null,
  };
};

const callGeoapify = async (lat, lng) => {
  if (!process.env.GEOAPIFY_API_KEY) {
    return null;
  }

  const response = await axios.get('https://api.geoapify.com/v1/geocode/reverse', {
    params: {
      lat,
      lon: lng,
      apiKey: process.env.GEOAPIFY_API_KEY,
      format: 'json',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const first = response.data?.results?.[0];
  if (!first) {
    return null;
  }

  return {
    city: first.city || first.county || '',
    province: first.state || '',
    country: first.country || '',
    postcode: first.postcode || '',
    provider: 'geoapify',
    raw: first,
  };
};

const callOpenCage = async (lat, lng) => {
  if (!process.env.OPENCAGE_API_KEY) {
    return null;
  }

  const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', {
    params: {
      q: `${lat},${lng}`,
      key: process.env.OPENCAGE_API_KEY,
      no_annotations: 1,
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const first = response.data?.results?.[0];
  const components = first?.components || {};
  if (!first) {
    return null;
  }

  return {
    city: components.city || components.town || components.village || components.county || '',
    province: components.state || '',
    country: components.country || '',
    postcode: components.postcode || '',
    provider: 'opencage',
    raw: first,
  };
};

const fetchFromProviders = async (lat, lng) => {
  try {
    return await callNominatim(lat, lng);
  } catch (nominatimError) {
    logger.warn(`Nominatim reverse geocode failed: ${nominatimError.message}`);
  }

  try {
    const geoapifyData = await callGeoapify(lat, lng);
    if (geoapifyData) return geoapifyData;
  } catch (geoapifyError) {
    logger.warn(`Geoapify fallback failed: ${geoapifyError.message}`);
  }

  try {
    const opencageData = await callOpenCage(lat, lng);
    if (opencageData) return opencageData;
  } catch (openCageError) {
    logger.warn(`OpenCage fallback failed: ${openCageError.message}`);
  }

  return null;
};

const getLocationFromDB = async (coordinates) => {
  const [lng, lat] = coordinates;
  const coordHash = buildCoordinateHash(lat, lng);

  const cached = await CoordinateLookupCache.findOne({
    coordHash,
    lookupStatus: 'success',
  }).lean();

  if (!cached) {
    return null;
  }

  return {
    city: cached.city,
    province: cached.province,
    country: cached.country,
    postcode: cached.postcode,
    provider: cached.provider,
    fromCache: true,
    coordHash,
  };
};

const getLookupRecord = async (coordinates) => {
  const [lng, lat] = coordinates;
  const coordHash = buildCoordinateHash(lat, lng);
  return CoordinateLookupCache.findOne({ coordHash }).lean();
};

const saveLocationToDB = async (coordinates, locationData, options = {}) => {
  const [lng, lat] = coordinates;
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  const coordHash = buildCoordinateHash(normalizedLat, normalizedLng);
  const {
    lookupStatus = 'success',
    failureCount = 0,
    retryAfterMs = null,
  } = options;

  const payload = {
    coordHash,
    lat: normalizedLat,
    lng: normalizedLng,
    city: locationData?.city || '',
    province: locationData?.province || '',
    country: locationData?.country || '',
    postcode: locationData?.postcode || '',
    provider: locationData?.provider || 'nominatim',
    lookupStatus,
    failureCount,
    lastLookupAt: new Date(),
    nextRetryAt: retryAfterMs ? new Date(Date.now() + retryAfterMs) : null,
    raw: locationData?.raw || null,
  };

  await CoordinateLookupCache.findOneAndUpdate(
    { coordHash },
    { $set: payload },
    { upsert: true, new: true },
  );

  return payload;
};

const getLocationFromCoordinates = async (lat, lng, options = {}) => {
  const {
    forceRefresh = false,
  } = options;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates for reverse geocoding');
  }

  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  const coordinates = [normalizedLng, normalizedLat];

  if (!forceRefresh) {
    const cached = await getLocationFromDB(coordinates);
    if (cached) {
      return cached;
    }

    const previousLookup = await getLookupRecord(coordinates);
    if (
      previousLookup
      && previousLookup.lookupStatus === 'failed'
      && previousLookup.nextRetryAt
      && new Date(previousLookup.nextRetryAt).getTime() > Date.now()
    ) {
      return null;
    }
  }

  return enqueueReverseGeocode(async () => {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        const locationData = await fetchFromProviders(normalizedLat, normalizedLng);
        if (!locationData) {
          throw new Error('All reverse geocoding providers failed');
        }

        await saveLocationToDB(coordinates, locationData, { lookupStatus: 'success', failureCount: 0 });
        return {
          city: locationData.city || '',
          province: locationData.province || '',
          country: locationData.country || '',
          postcode: locationData.postcode || '',
          provider: locationData.provider || 'nominatim',
          fromCache: false,
        };
      } catch (error) {
        logger.warn(`Reverse geocode attempt ${attempt} failed for ${normalizedLat},${normalizedLng}: ${error.message}`);
        if (attempt < RETRY_ATTEMPTS) {
          // eslint-disable-next-line no-await-in-loop
          await sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    await saveLocationToDB(coordinates, {}, {
      lookupStatus: 'failed',
      failureCount: RETRY_ATTEMPTS,
      retryAfterMs: 60 * 60 * 1000,
    });
    return null;
  });
};

const enrichLocationDocument = async (locationDocument, options = {}) => {
  const coordinates = locationDocument?.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return locationDocument;
  }

  const [lng, lat] = coordinates;
  try {
    const locationData = await getLocationFromCoordinates(lat, lng, options);
    if (locationData) {
      locationDocument.derivedLocation = {
        city: locationData.city || '',
        province: locationData.province || '',
        country: locationData.country || '',
        postcode: locationData.postcode || '',
        provider: locationData.provider || 'nominatim',
        updatedAt: new Date(),
      };
    }
  } catch (error) {
    logger.warn(`Failed to enrich location document with reverse geocode: ${error.message}`);
  }

  return locationDocument;
};

module.exports = {
  getLocationFromCoordinates,
  saveLocationToDB,
  getLocationFromDB,
  enrichLocationDocument,
  buildCoordinateHash,
  normalizeCoordinate,
};
