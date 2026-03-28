const { formatError } = require('../utils/responseFormatter');

/**
 * Authorization Middleware Composition Helpers
 * Provides reusable authorization middleware and policy declarations
 */

/**
 * Require authentication
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(formatError('Authentication required', 401));
  }
  next();
};

/**
 * Require specific role
 */
const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    if (req.user.role !== role) {
      return res.status(403).json(formatError(`${role} access required`, 403));
    }

    next();
  };
};

/**
 * Require admin role
 */
const requireAdmin = requireRole('admin');

/**
 * Require moderator or admin role
 */
const requireModerator = requireRole('moderator');

/**
 * Require resource ownership
 */
const requireOwnership = (resourceField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json(formatError('Authentication required', 401));
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resource = req[resourceField];
    if (resource && resource.user && resource.user.toString() !== req.user._id.toString()) {
      return res.status(403).json(formatError('Access denied: You do not own this resource', 403));
    }

    next();
  };
};

/**
 * Require ownership or admin role
 */
const requireOwnershipOrAdmin = requireOwnership('user');

/**
 * Check if user can perform action on resource
 */
const canPerformAction = (user, resource, action) => {
  // Admin can do anything
  if (user.role === 'admin') {
    return true;
  }

  // Check ownership
  if (resource.user && resource.user.toString() !== user._id.toString()) {
    return false;
  }

  // Define action permissions by role
  const rolePermissions = {
    user: ['read', 'comment'],
    moderator: ['read', 'comment', 'moderate'],
    admin: ['read', 'comment', 'moderate', 'write', 'delete', 'manage']
  };

  const userRole = user.role || 'user';
  const allowedActions = rolePermissions[userRole] || [];

  return allowedActions.includes(action);
};

/**
 * Policy declaration helper
 */
const createPolicy = (name, rules) => {
  return {
    name,
    rules,
    check: (req, res, next) => {
      for (const rule of rules) {
        const result = rule(req);
        if (!result.allowed) {
          return res.status(result.statusCode || 403).json(
            formatError(result.message || 'Access denied', result.statusCode || 403)
          );
        }
      }
      next();
    }
  };
};

/**
 * Common policy declarations
 */
const policies = {
  // Only authenticated users can access
  authenticatedOnly: createPolicy('authenticatedOnly', [
    (req) => ({
      allowed: !!req.user,
      statusCode: 401,
      message: 'Authentication required'
    })
  ]),

  // Only admins can access
  adminOnly: createPolicy('adminOnly', [
    (req) => ({
      allowed: req.user && req.user.role === 'admin',
      statusCode: 403,
      message: 'Admin access required'
    })
  ]),

  // Users can only access their own resources
  ownResourcesOnly: createPolicy('ownResourcesOnly', [
    (req) => {
      if (!req.user) {
        return { allowed: false, statusCode: 401, message: 'Authentication required' };
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        return { allowed: true };
      }

      // Check resource ownership
      const resource = req.resource;
      if (resource && resource.user && resource.user.toString() !== req.user._id.toString()) {
        return { allowed: false, statusCode: 403, message: 'Access denied: You do not own this resource' };
      }

      return { allowed: true };
    }
  ]),

  // Resource-specific policies
  blog: {
    update: createPolicy('blogUpdate', [
      (req) => {
        const user = req.user;
        const blog = req.blog;
        
        if (!user) {
          return { allowed: false, statusCode: 401, message: 'Authentication required' };
        }

        // Admin can update any blog
        if (user.role === 'admin') {
          return { allowed: true };
        }

        // User can update their own blog
        if (blog && blog.author && blog.author.toString() === user._id.toString()) {
          return { allowed: true };
        }

        // Moderator can update any blog
        if (user.role === 'moderator') {
          return { allowed: true };
        }

        return { allowed: false, statusCode: 403, message: 'Access denied' };
      }
    ]),

    delete: createPolicy('blogDelete', [
      (req) => {
        const user = req.user;
        const blog = req.blog;
        
        if (!user) {
          return { allowed: false, statusCode: 401, message: 'Authentication required' };
        }

        // Admin can delete any blog
        if (user.role === 'admin') {
          return { allowed: true };
        }

        // User can delete their own blog
        if (blog && blog.author && blog.author.toString() === user._id.toString()) {
          return { allowed: true };
        }

        return { allowed: false, statusCode: 403, message: 'Access denied' };
      }
    ])
  },

  location: {
    create: createPolicy('locationCreate', [
      (req) => {
        const user = req.user;
        
        if (!user) {
          return { allowed: false, statusCode: 401, message: 'Authentication required' };
        }

        // Only admin and moderator can create locations
        return { 
          allowed: user.role === 'admin' || user.role === 'moderator',
          statusCode: 403,
          message: 'Admin or moderator access required'
        };
      }
    ]),

    update: createPolicy('locationUpdate', [
      (req) => {
        const user = req.user;
        const location = req.location;
        
        if (!user) {
          return { allowed: false, statusCode: 401, message: 'Authentication required' };
        }

        // Admin can update any location
        if (user.role === 'admin') {
          return { allowed: true };
        }

        // Moderator can update any location
        if (user.role === 'moderator') {
          return { allowed: true };
        }

        return { allowed: false, statusCode: 403, message: 'Access denied' };
      }
    ]),

    delete: createPolicy('locationDelete', [
      (req) => {
        const user = req.user;
        
        if (!user) {
          return { allowed: false, statusCode: 401, message: 'Authentication required' };
        }

        // Only admin can delete locations
        return { 
          allowed: user.role === 'admin',
          statusCode: 403,
          message: 'Admin access required'
        };
      }
    ])
  }
};

/**
 * Apply policy to route
 */
const applyPolicy = (policy) => {
  return (req, res, next) => {
    policy.check(req, res, next);
  };
};

module.exports = {
  // Middleware functions
  requireAuth,
  requireRole,
  requireAdmin,
  requireModerator,
  requireOwnership,
  requireOwnershipOrAdmin,
  
  // Policy helpers
  createPolicy,
  policies,
  applyPolicy
};
