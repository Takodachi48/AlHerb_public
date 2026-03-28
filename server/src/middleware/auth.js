/**
 * Summary:
 * - Reduced auth overhead by replacing duplicate Mongo queries with one lean lookup.
 * - Added short-lived cache for Firebase email verification checks.
 * - Standardized token parsing and logging while preserving existing middleware exports.
 */
const cache = require('../config/cache');
const { isEmailVerified, verifyJWTToken, verifyToken: verifyFirebaseToken } = require('../config/firebase');
const User = require('../models/User');
const { formatError } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

const EMAIL_VERIFIED_CACHE_TTL_SECONDS = 300;

const extractToken = (req) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token.trim();
};

const buildUserObject = (decodedToken, user) => ({
  _id: user._id,
  uid: decodedToken.uid,
  email: decodedToken.email || user.email,
  emailVerified: Boolean(decodedToken.email_verified),
  role: user.role || 'user',
});

const getCachedEmailVerified = async (uid, tokenClaimValue) => {
  if (typeof tokenClaimValue === 'boolean') {
    return tokenClaimValue;
  }

  const cacheKey = `auth:email-verified:${uid}`;
  const cachedValue = cache.get(cacheKey);
  if (typeof cachedValue === 'boolean') {
    return cachedValue;
  }

  const verified = await isEmailVerified(uid);
  cache.set(cacheKey, verified, EMAIL_VERIFIED_CACHE_TTL_SECONDS);
  return verified;
};

const createAuthMiddleware = (options = {}) => {
  const {
    optional = false,
    tryJwtFirst = false,
    requireEmailVerification = true,
  } = options;

  return async (req, res, next) => {
    const token = extractToken(req);
    if (!token) {
      if (optional) {
        return next();
      }
      return res.status(401).json(formatError('Access token required', 401));
    }

    try {
      let decodedToken;
      let tokenType = 'firebase';

      if (tryJwtFirst) {
        try {
          decodedToken = verifyJWTToken(token);
          tokenType = 'jwt';
        } catch (jwtError) {
          decodedToken = null;
        }
      }

      if (!decodedToken) {
        decodedToken = await verifyFirebaseToken(token);
      }

      if (requireEmailVerification && tokenType !== 'jwt') {
        const verified = await getCachedEmailVerified(decodedToken.uid, decodedToken.email_verified);
        if (!verified) {
          return res.status(403).json(formatError('Email not verified', 403));
        }
      }

      const user = await User.findOne({ uid: decodedToken.uid })
        .select('_id uid email role isActive')
        .lean();

      if (!user) {
        logger.warn(`Authenticated UID not found in DB: ${decodedToken.uid}`);
        if (optional) {
          return next();
        }
        return res.status(401).json(formatError('User not found', 401));
      }

      if (!user.isActive) {
        logger.warn(`Inactive user attempted access: ${decodedToken.uid}`);
        if (optional) {
          return next();
        }
        return res.status(403).json(formatError('Account has been deactivated', 403));
      }

      req.user = buildUserObject(decodedToken, user);
      return next();
    } catch (error) {
      logger.warn(`Authentication failed: ${error.message}`);
      if (optional) {
        return next();
      }
      return res.status(401).json(formatError('Invalid or expired token', 401));
    }
  };
};

const verifyTokenMiddleware = createAuthMiddleware({ requireEmailVerification: true });
const authenticateToken = createAuthMiddleware({ requireEmailVerification: true });
const authenticateJWT = createAuthMiddleware({
  tryJwtFirst: true,
  requireEmailVerification: true,
});
const optionalAuth = createAuthMiddleware({
  optional: true,
  requireEmailVerification: false,
});

const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(formatError('Authentication required', 401));
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json(formatError('Admin access required', 403));
  }

  return next();
};

module.exports = {
  verifyToken: verifyTokenMiddleware,
  authenticateToken,
  authenticateJWT,
  optionalAuth,
  adminMiddleware,
  createAuthMiddleware,
  isEmailVerified,
  extractToken,
  buildUserObject,
};
