const AnalyticsEvent = require('../models/AnalyticsEvent');
const { logger } = require('../utils/logger');

const IGNORED_PATH_PREFIXES = [
  '/health',
  '/ready',
  '/api/admin/monitoring',
];

const shouldCapture = (path = '') => {
  if (!path.startsWith('/api/')) return false;
  return !IGNORED_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
};

const analyticsEventRecorder = (req, res, next) => {
  const startMs = Date.now();
  const requestPath = req.originalUrl || req.path || '';

  if (!shouldCapture(requestPath)) {
    return next();
  }

  res.on('finish', () => {
    const responseTimeMs = Math.max(Date.now() - startMs, 0);
    const statusCode = Number(res.statusCode) || 0;

    const payload = {
      eventType: 'api_request',
      timestamp: new Date(),
      path: requestPath.split('?')[0],
      method: req.method,
      statusCode,
      responseTimeMs,
      userId: req.user?._id || null,
      meta: {
        requestId: req.requestId || null,
      },
    };

    AnalyticsEvent.create(payload).catch((error) => {
      logger.warn(`Failed to persist analytics event: ${error.message}`);
    });
  });

  next();
};

module.exports = analyticsEventRecorder;
