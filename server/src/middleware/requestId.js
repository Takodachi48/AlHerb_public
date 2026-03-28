const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

const DEFAULT_SKIP_PATHS = new Set(['/health', '/ready']);
const configuredSkipPaths = (() => {
  const raw = process.env.REQUEST_LOG_SKIP_PATHS;
  if (!raw) return DEFAULT_SKIP_PATHS;
  return new Set(
    String(raw)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
})();

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing and debugging
 */
const requestIdMiddleware = (req, res, next) => {
  // Generate unique request ID
  const requestId = uuidv4();
  
  // Add request ID to request object
  req.requestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  const shouldLogRequest = !configuredSkipPaths.has(req.path);

  // Log request start with request ID
  const startTime = Date.now();
  if (shouldLogRequest) {
    logger.info(`Request started`, {
      requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    });
  }
  
  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    if (shouldLogRequest) {
      logger.info(`Request completed`, {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = requestIdMiddleware;
