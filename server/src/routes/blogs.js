const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const {
  getPublishedBlogs,
  getFeaturedBlogs,
  getTrendingBlogs,
  getBlogMetrics,
  getBlogBySlug,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  getUserBlogs,
  searchBlogs,
  getCategories,
  requestBlogApproval,
  approveAndPublishBlog,
  getAdminBlogs,
  moderateBlog,
  toggleBlogLike,
  getBlogLikes,
  toggleBlogBookmark,
  getSavedBlogs,
  setBlogFeatured,
  updateBlogStatus,
} = require('../controllers/blogController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const requireRoles = (roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (!Array.isArray(roles) || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Insufficient permissions' });
  }

  return next();
};

// Public routes
router.get('/', optionalAuth, getPublishedBlogs);
router.get('/featured', optionalAuth, getFeaturedBlogs);
router.get('/trending', optionalAuth, getTrendingBlogs);
router.get('/search', optionalAuth, searchBlogs);
router.get('/categories', getCategories);
router.get('/slug/:slug', optionalAuth, getBlogBySlug);
router.get('/:id/metrics', optionalAuth, getBlogMetrics);
router.get('/:id/likes', optionalAuth, getBlogLikes);

// Protected routes
router.get('/user/blogs', authenticateToken, getUserBlogs);
router.get('/saved', authenticateToken, getSavedBlogs);
router.patch('/:id/status', authenticateToken, updateBlogStatus);
router.patch('/:id/featured', authenticateToken, requireRoles(['admin']), [
  body('featured').isBoolean().withMessage('featured must be a boolean'),
], setBlogFeatured);
router.post('/:id/like', authenticateToken, toggleBlogLike);
router.post('/:id/bookmark', authenticateToken, toggleBlogBookmark);
router.get('/admin/list', authenticateToken, requireRoles(['admin', 'moderator']), getAdminBlogs);
router.get('/:id', authenticateToken, getBlogById);
router.post('/', authenticateToken, [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('excerpt')
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('Excerpt must be between 10 and 300 characters'),
  body('content')
    .trim()
    .isLength({ min: 10 }) // Reduced from 50 to 10 for testing
    .withMessage('Content must be at least 10 characters'),
  body('category')
    .isIn(['herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('featuredImage.url')
    .optional()
    .isURL()
    .withMessage('Featured image URL must be a valid URL'),
  body('featuredImage.caption')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Featured image caption must not exceed 200 characters'),
  body('featuredImage.alt')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Featured image alt text must not exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'review', 'published'])
    .withMessage('Status must be draft, review, or published'),
  body('seo.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('SEO meta title must not exceed 60 characters'),
  body('seo.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('SEO meta description must not exceed 160 characters'),
  body('seo.keywords')
    .optional()
    .isArray()
    .withMessage('SEO keywords must be an array'),
  body('relatedHerbs')
    .optional()
    .isArray()
    .withMessage('Related herbs must be an array'),
  body('relatedSymptoms')
    .optional()
    .isArray()
    .withMessage('Related symptoms must be an array')
], createBlog);

router.put('/:id', authenticateToken, [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('excerpt')
    .optional()
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('Excerpt must be between 10 and 300 characters'),
  body('content')
    .optional()
    .trim()
    .isLength({ min: 50 })
    .withMessage('Content must be at least 50 characters'),
  body('category')
    .optional()
    .isIn(['herb_profiles', 'remedies', 'research', 'safety', 'gardening', 'foraging', 'recipes', 'news', 'interviews', 'general'])
    .withMessage('Invalid category'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
  body('featuredImage.url')
    .optional()
    .isURL()
    .withMessage('Featured image URL must be a valid URL'),
  body('featuredImage.caption')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Featured image caption must not exceed 200 characters'),
  body('featuredImage.alt')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Featured image alt text must not exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'review', 'published'])
    .withMessage('Status must be draft, review, or published'),
  body('seo.metaTitle')
    .optional()
    .trim()
    .isLength({ max: 60 })
    .withMessage('SEO meta title must not exceed 60 characters'),
  body('seo.metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 })
    .withMessage('SEO meta description must not exceed 160 characters'),
  body('seo.keywords')
    .optional()
    .isArray()
    .withMessage('SEO keywords must be an array'),
  body('relatedHerbs')
    .optional()
    .isArray()
    .withMessage('Related herbs must be an array'),
  body('relatedSymptoms')
    .optional()
    .isArray()
    .withMessage('Related symptoms must be an array')
], updateBlog);

router.patch('/:id/request-approval', authenticateToken, requestBlogApproval);
router.patch('/:id/approve-publish', authenticateToken, requireRoles(['admin', 'moderator']), [
  body('moderationReason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage('Moderation reason must be between 1 and 300 characters'),
  body('moderationReasonType')
    .optional()
    .isIn(['preset', 'custom'])
    .withMessage('Moderation reason type must be preset or custom'),
  body('moderationReasonPreset')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Moderation preset key must be between 1 and 100 characters'),
], approveAndPublishBlog);
router.patch('/:id/moderate', authenticateToken, requireRoles(['admin', 'moderator']), [
  body('status')
    .isIn(['draft', 'review', 'published', 'archived'])
    .withMessage('Status must be draft, review, published, or archived'),
  body('moderationReason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 300 })
    .withMessage('Moderation reason must be between 1 and 300 characters'),
  body('moderationReasonType')
    .optional()
    .isIn(['preset', 'custom'])
    .withMessage('Moderation reason type must be preset or custom'),
  body('moderationReasonPreset')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Moderation preset key must be between 1 and 100 characters'),
], moderateBlog);

router.delete('/:id', authenticateToken, deleteBlog);

module.exports = router;
