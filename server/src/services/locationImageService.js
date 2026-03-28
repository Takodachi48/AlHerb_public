const axios = require('axios');
const LocationImageCache = require('../models/LocationImageCache');
const { logger } = require('../utils/logger');

const RATE_LIMIT_MS = 1000;
const HASH_DECIMALS = 6;
const DEFAULT_RADIUS_METERS = 50;
const REQUEST_TIMEOUT_MS = 12000;
const RETRY_ATTEMPTS = 2;

let queue = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toRadians = (value) => (value * Math.PI) / 180;

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
    * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const normalizeCoordinate = (value) => Number(Number(value).toFixed(HASH_DECIMALS));

const buildCoordinateHash = (lat, lng) => `${normalizeCoordinate(lat)},${normalizeCoordinate(lng)}`;

const enqueue = (task) => {
  const run = async () => {
    const elapsed = Date.now() - lastRequestAt;
    const waitMs = Math.max(0, RATE_LIMIT_MS - elapsed);
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

const fetchFromWikimedia = async (lat, lng, radius = DEFAULT_RADIUS_METERS) => {
  const response = await axios.get('https://commons.wikimedia.org/w/api.php', {
    params: {
      action: 'query',
      format: 'json',
      generator: 'geosearch',
      ggscoord: `${lat}|${lng}`,
      ggsradius: Math.max(10, Math.min(10000, Math.round(radius))),
      ggslimit: 20,
      prop: 'pageimages|coordinates|info',
      piprop: 'thumbnail|original',
      pithumbsize: 400,
      inprop: 'url',
      origin: '*',
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const pages = Object.values(response.data?.query?.pages || {});
  if (pages.length === 0) {
    return null;
  }

  const candidates = pages
    .map((page) => {
      const pageLat = page.coordinates?.[0]?.lat;
      const pageLng = page.coordinates?.[0]?.lon;
      if (!Number.isFinite(pageLat) || !Number.isFinite(pageLng)) {
        return null;
      }

      const thumb = page.thumbnail?.source || '';
      const original = page.original?.source || '';
      const imageUrl = original || thumb;
      if (!imageUrl) {
        return null;
      }

      return {
        provider: 'wikimedia',
        imageUrl,
        thumbnailUrl: thumb || imageUrl,
        attribution: page.fullurl || 'Wikimedia Commons',
        distanceMeters: distanceMeters(lat, lng, pageLat, pageLng),
        raw: {
          pageid: page.pageid,
          title: page.title,
          fullurl: page.fullurl,
        },
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
};

const fetchFromMapillary = async (lat, lng, radius = DEFAULT_RADIUS_METERS) => {
  if (!process.env.MAPILLARY_ACCESS_TOKEN) {
    return null;
  }

  const response = await axios.get('https://graph.mapillary.com/images', {
    params: {
      access_token: process.env.MAPILLARY_ACCESS_TOKEN,
      fields: 'id,thumb_256_url,thumb_1024_url,geometry,captured_at',
      closeto: `${lng},${lat}`,
      radius,
      limit: 10,
    },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const images = Array.isArray(response.data?.data) ? response.data.data : [];
  if (images.length === 0) {
    return null;
  }

  const candidates = images
    .map((item) => {
      const coords = item.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length !== 2) {
        return null;
      }
      const [itemLng, itemLat] = coords;
      const imageUrl = item.thumb_1024_url || item.thumb_256_url;
      if (!imageUrl) {
        return null;
      }

      return {
        provider: 'mapillary',
        imageUrl,
        thumbnailUrl: item.thumb_256_url || imageUrl,
        attribution: `https://www.mapillary.com/app/?pKey=${item.id}`,
        capturedAt: item.captured_at ? new Date(item.captured_at) : null,
        distanceMeters: distanceMeters(lat, lng, itemLat, itemLng),
        raw: item,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
};

const fetchFromKartaView = async (lat, lng, radius = DEFAULT_RADIUS_METERS) => {
  if (!process.env.KARTAVIEW_REVERSE_IMAGE_URL) {
    return null;
  }

  const response = await axios.get(process.env.KARTAVIEW_REVERSE_IMAGE_URL, {
    params: { lat, lng, radius },
    timeout: REQUEST_TIMEOUT_MS,
  });

  const items = Array.isArray(response.data?.items) ? response.data.items : [];
  if (items.length === 0) {
    return null;
  }

  const candidates = items
    .map((item) => {
      if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng) || !item.imageUrl) {
        return null;
      }
      return {
        provider: 'kartaView',
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl || item.imageUrl,
        attribution: item.attribution || '',
        distanceMeters: distanceMeters(lat, lng, item.lat, item.lng),
        raw: item,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return candidates[0] || null;
};

const fetchImageFromProviders = async (lat, lng, radius) => {
  const providers = [
    () => fetchFromMapillary(lat, lng, radius),
    () => fetchFromWikimedia(lat, lng, radius),
    () => fetchFromKartaView(lat, lng, radius),
  ];

  for (const provider of providers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await provider();
      if (result?.imageUrl) {
        return result;
      }
    } catch (error) {
      logger.warn(`Location image provider failed: ${error.message}`);
    }
  }

  return null;
};

const getLocationFromDB = async (coordinates) => {
  const [lng, lat] = coordinates;
  const coordHash = buildCoordinateHash(lat, lng);
  const cached = await LocationImageCache.findOne({
    coordHash,
    status: 'success',
  }).lean();

  if (!cached || !cached.imageUrl) {
    return null;
  }

  return {
    provider: cached.provider,
    imageUrl: cached.imageUrl,
    thumbnailUrl: cached.thumbnailUrl || cached.imageUrl,
    distanceMeters: cached.distanceMeters ?? 0,
    attribution: cached.attribution || '',
    capturedAt: cached.capturedAt || null,
    fromCache: true,
  };
};

const findNearbyImages = async (lat, lng, radius = DEFAULT_RADIUS_METERS) => {
  const nearby = await LocationImageCache.find({
    status: 'success',
    point: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: radius,
      },
    },
  }).limit(10).lean();

  return nearby.map((item) => ({
    provider: item.provider,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl || item.imageUrl,
    distanceMeters: item.distanceMeters ?? distanceMeters(lat, lng, item.lat, item.lng),
    attribution: item.attribution || '',
    capturedAt: item.capturedAt || null,
    fromCache: true,
  }));
};

const cacheImage = async (coordinates, imageData = {}, options = {}) => {
  const [lng, lat] = coordinates;
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  const coordHash = buildCoordinateHash(normalizedLat, normalizedLng);
  const {
    status = 'success',
    failureCount = 0,
    retryAfterMs = null,
  } = options;

  const payload = {
    coordHash,
    lat: normalizedLat,
    lng: normalizedLng,
    point: {
      type: 'Point',
      coordinates: [normalizedLng, normalizedLat],
    },
    provider: imageData.provider || 'wikimedia',
    imageUrl: imageData.imageUrl || '',
    thumbnailUrl: imageData.thumbnailUrl || '',
    distanceMeters: Number.isFinite(imageData.distanceMeters) ? imageData.distanceMeters : null,
    attribution: imageData.attribution || '',
    capturedAt: imageData.capturedAt || null,
    status,
    failureCount,
    lastFetchedAt: new Date(),
    nextRetryAt: retryAfterMs ? new Date(Date.now() + retryAfterMs) : null,
    raw: imageData.raw || null,
  };

  await LocationImageCache.findOneAndUpdate(
    { coordHash },
    { $set: payload },
    { upsert: true, new: true },
  );

  return payload;
};

const getLocationImage = async (lat, lng, options = {}) => {
  const {
    radius = DEFAULT_RADIUS_METERS,
    forceRefresh = false,
  } = options;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Invalid coordinates');
  }

  const coordinates = [normalizeCoordinate(lng), normalizeCoordinate(lat)];

  if (!forceRefresh) {
    const exactCache = await getLocationFromDB(coordinates);
    if (exactCache) {
      return exactCache;
    }

    const nearbyCache = await findNearbyImages(lat, lng, radius);
    if (nearbyCache.length > 0) {
      return nearbyCache.sort((a, b) => a.distanceMeters - b.distanceMeters)[0];
    }

    const coordHash = buildCoordinateHash(lat, lng);
    const failed = await LocationImageCache.findOne({ coordHash, status: 'failed' }).lean();
    if (failed && failed.nextRetryAt && new Date(failed.nextRetryAt).getTime() > Date.now()) {
      return null;
    }
  }

  return enqueue(async () => {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const imageData = await fetchImageFromProviders(lat, lng, radius);
        if (imageData) {
          await cacheImage(coordinates, imageData, { status: 'success', failureCount: 0 });
          return { ...imageData, fromCache: false };
        }
      } catch (error) {
        logger.warn(`getLocationImage attempt ${attempt} failed: ${error.message}`);
      }

      if (attempt < RETRY_ATTEMPTS) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(1200 * attempt);
      }
    }

    await cacheImage(coordinates, { provider: 'wikimedia' }, {
      status: 'failed',
      failureCount: RETRY_ATTEMPTS,
      retryAfterMs: 60 * 60 * 1000,
    });

    return null;
  });
};

const attachLocationImageIfMissing = async (locationDocument, options = {}) => {
  try {
    if (!locationDocument || !Array.isArray(locationDocument.location?.coordinates)) {
      return locationDocument;
    }

    const hasImage = Array.isArray(locationDocument.images)
      && locationDocument.images.some((img) => img?.url);
    if (hasImage && !options.forceRefresh) {
      return locationDocument;
    }

    const [lng, lat] = locationDocument.location.coordinates;
    const imageData = await getLocationImage(lat, lng, options);
    if (!imageData?.imageUrl) {
      return locationDocument;
    }

    const images = Array.isArray(locationDocument.images) ? [...locationDocument.images] : [];
    if (!images.some((img) => img?.isPrimary)) {
      images.push({
        url: imageData.thumbnailUrl || imageData.imageUrl,
        caption: `Location image (${imageData.provider})`,
        isPrimary: true,
      });
    } else {
      images.push({
        url: imageData.thumbnailUrl || imageData.imageUrl,
        caption: `Location image (${imageData.provider})`,
        isPrimary: false,
      });
    }

    locationDocument.images = images;
    return locationDocument;
  } catch (error) {
    logger.warn(`attachLocationImageIfMissing failed: ${error.message}`);
    return locationDocument;
  }
};

module.exports = {
  getLocationImage,
  cacheImage,
  getLocationFromDB,
  findNearbyImages,
  attachLocationImageIfMissing,
  buildCoordinateHash,
};
