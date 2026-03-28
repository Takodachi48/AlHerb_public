/**
 * Summary:
 * - Replaced ad-hoc console logging with structured logger usage.
 * - Standardized error responses for consistency with API formatter helpers.
 */
const { isEmailVerified } = require('../config/firebase');
const { formatError } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

// Middleware to check if user's email is verified
const requireEmailVerification = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    const emailVerified = await isEmailVerified(req.user.uid);
    
    if (!emailVerified) {
      return res.status(403).json({ 
        ...formatError('Email verification required', 403),
        message: 'Please verify your email address to access this feature',
      });
    }

    next();
  } catch (error) {
    logger.warn(`Email verification check failed: ${error.message}`);
    return res.status(500).json(formatError('Failed to verify email status', 500));
  }
};

// Middleware that allows access but adds email verification status to request
const checkEmailVerification = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.emailVerified = await isEmailVerified(req.user.uid);
    }
    next();
  } catch (error) {
    logger.warn(`Non-blocking email verification check failed: ${error.message}`);
    // Continue without failing the request
    next();
  }
};

module.exports = {
  requireEmailVerification,
  checkEmailVerification,
};
