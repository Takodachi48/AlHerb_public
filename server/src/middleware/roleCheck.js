const { auth } = require('../config/firebase');

// Check if user has admin role
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRecord = await auth.getUser(req.user.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user.isAdmin = true;
    next();
  } catch (error) {
    console.error('Role check error:', error);
    return res.status(500).json({ error: 'Failed to verify user role' });
  }
};

// Check if user is either admin or the resource owner
const requireAdminOrOwner = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceUserId = req.params[resourceUserIdField] || 
                            req.body[resourceUserIdField] || 
                            req.query[resourceUserIdField];

      // Allow if user is admin or resource owner
      if (req.user.isAdmin || req.user.uid === resourceUserId) {
        return next();
      }

      return res.status(403).json({ error: 'Access denied' });
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Failed to verify access' });
    }
  };
};

module.exports = {
  requireAdmin,
  requireAdminOrOwner,
};
