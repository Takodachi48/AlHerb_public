const express = require('express');
const locationController = require('../controllers/locationController');
const { verifyToken, optionalAuth, adminMiddleware } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { validateRequest, validateMultiple } = require('../middleware/validateRequest');
const {
  locationIdParamSchema,
  listLocationsQuerySchema,
  nearbyLocationsQuerySchema,
  clustersQuerySchema,
  locationReviewsQuerySchema,
  createLocationReviewBodySchema,
  createLocationBodySchema,
  updateLocationBodySchema,
} = require('../schemas/locationSchemas');
const router = express.Router();

// Public routes (with optional auth for personalization)
router.get('/', optionalAuth, validateRequest(listLocationsQuerySchema, 'query'), cacheMiddleware(300), locationController.getLocations);
router.get('/nearby', optionalAuth, validateRequest(nearbyLocationsQuerySchema, 'query'), cacheMiddleware(300), locationController.getNearbyLocations);
router.get('/clusters', optionalAuth, validateRequest(clustersQuerySchema, 'query'), cacheMiddleware(120), locationController.getLocationClusters);

// Location reviews (public read, auth write)
router.get('/:id/reviews', optionalAuth, validateMultiple({ params: locationIdParamSchema, query: locationReviewsQuerySchema }), locationController.getLocationReviews);
router.post('/:id/reviews', verifyToken, upload.single('image'), validateMultiple({ params: locationIdParamSchema, body: createLocationReviewBodySchema }), locationController.createLocationReview);

// Public routes for dropdown options
router.get('/categories', optionalAuth, cacheMiddleware(300), locationController.getUniqueCategories);
router.get('/statuses', optionalAuth, cacheMiddleware(300), locationController.getUniqueStatuses);
router.get('/stats', cacheMiddleware(300), locationController.getLocationStats);

// Protected routes (admin only)
router.post('/', verifyToken, adminMiddleware, validateRequest(createLocationBodySchema), locationController.createLocation);
router.put('/:id', verifyToken, adminMiddleware, validateMultiple({ params: locationIdParamSchema, body: updateLocationBodySchema }), locationController.updateLocation);
router.delete('/:id', verifyToken, adminMiddleware, validateRequest(locationIdParamSchema, 'params'), locationController.deleteLocation);

// Public route for location by ID (must be last to not conflict with other routes)
router.get('/:id', optionalAuth, validateRequest(locationIdParamSchema, 'params'), cacheMiddleware(600), locationController.getLocationById);

module.exports = router;
