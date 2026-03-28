/**
 * Summary:
 * - Centralized limiter creation to remove duplication and keep behavior consistent.
 * - Added structured 429 responses and request logging for abuse visibility.
 * - Skips `/health` so monitoring probes are not rate-limited.
 */
const rateLimit = require('express-rate-limit');
const { formatError } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

const SKIP_PATHS = new Set(['/health', '/ready']);

const createLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => SKIP_PATHS.has(req.path),
    handler: (req, res) => {
      logger.warn(
        `Rate limit triggered for ip=${req.ip} path=${req.originalUrl} method=${req.method}`
      );
      return res.status(429).json(formatError(message, 429));
    },
  });

const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes',
});

const apiLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after a minute',
});

const searchLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many search requests, please slow down',
});

const inquiryLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many inquiries from this IP, please try again after 15 minutes',
});

const commentLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many comment actions, please slow down',
});

const chatLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many chat requests, please slow down',
});

const mlLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many ML scoring requests, please slow down',
});

module.exports = {
  authLimiter,
  apiLimiter,
  searchLimiter,
  inquiryLimiter,
  commentLimiter,
  chatLimiter,
  mlLimiter,
};
