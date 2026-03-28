/**
 * Summary:
 * - Prevented cache poisoning/data leaks by bypassing cache for authenticated requests.
 * - Added deterministic cache keys and cached status/body payload pairs.
 * - Added `X-Cache` response header for operational visibility.
 */
const cache = require('../config/cache');
const { logger } = require('../utils/logger');

const CACHE_NAMESPACE = 'herbal_medicine';

const generateCacheKey = (key) => `${CACHE_NAMESPACE}:${key}`;

const shouldBypassCache = (req) => {
  if (req.method !== 'GET') {
    return true;
  }

  // Avoid serving personalized content from shared cache.
  if (req.headers.authorization) {
    return true;
  }

  return false;
};

const cacheMiddleware = (durationSeconds) => (req, res, next) => {
  if (shouldBypassCache(req)) {
    return next();
  }

  const key = generateCacheKey(req.originalUrl || req.url);
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    res.set('X-Cache', 'HIT');
    return res.status(cachedResponse.statusCode).json(cachedResponse.body);
  }

  res.set('X-Cache', 'MISS');

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      cache.set(
        key,
        {
          statusCode: res.statusCode,
          body,
        },
        durationSeconds
      );
    }
    return originalJson(body);
  };

  return next();
};

const clearCache = (pattern) => {
  const namespacedPrefix = `${CACHE_NAMESPACE}:`;
  const keysToClear = cache.keys().filter((key) => (
    key.startsWith(namespacedPrefix) && key.includes(pattern)
  ));

  if (keysToClear.length > 0) {
    cache.del(keysToClear);
    logger.info(`Cleared ${keysToClear.length} cache keys for pattern: ${pattern}`);
  }
};

const clearAllCache = () => {
  const namespacedPrefix = `${CACHE_NAMESPACE}:`;
  const keysToClear = cache.keys().filter((key) => key.startsWith(namespacedPrefix));

  if (keysToClear.length > 0) {
    cache.del(keysToClear);
    logger.info(`Cleared all ${keysToClear.length} cache keys`);
  }
};

const getCacheStats = () => {
  const namespacedPrefix = `${CACHE_NAMESPACE}:`;
  const totalKeys = cache.keys().filter((key) => key.startsWith(namespacedPrefix)).length;

  return {
    totalKeys,
    namespace: CACHE_NAMESPACE,
  };
};

module.exports = {
  cacheMiddleware,
  clearCache,
  clearAllCache,
  getCacheStats,
  generateCacheKey,
  CACHE_NAMESPACE,
};
