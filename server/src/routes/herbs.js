const express = require('express');
const router = express.Router();
const { verifyToken, optionalAuth, adminMiddleware } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const upload = require('../middleware/upload');
const { validateRequest, validateMultiple } = require('../middleware/validateRequest');
const HerbController = require('../controllers/herbController');
const {
  herbIdParamSchema,
  paginationQuerySchema,
  listHerbsQuerySchema,
  searchHerbsQuerySchema,
  compareHerbsQuerySchema,
  recommendHerbsBodySchema,
  assessSafetyBodySchema,
  interactionsBodySchema,
  contraindicationsBodySchema,
  safetyCombinationBodySchema,
  herbStatusBodySchema,
  bulkHerbStatusBodySchema,
  createHerbBodySchema,
  updateHerbBodySchema,
  symptomParamSchema,
  categoryParamSchema,
} = require('../schemas/herbSchemas');


// Public routes (with optional auth for admin view/personalization)
router.get('/', optionalAuth, validateRequest(listHerbsQuerySchema, 'query'), cacheMiddleware(300), HerbController.getHerbs);
router.get('/search', optionalAuth, validateRequest(searchHerbsQuerySchema, 'query'), cacheMiddleware(300), HerbController.searchHerbs);
router.get('/compare', optionalAuth, validateRequest(compareHerbsQuerySchema, 'query'), cacheMiddleware(300), HerbController.compareHerbs);
router.post('/recommend', optionalAuth, validateRequest(recommendHerbsBodySchema), HerbController.recommendHerbs);
router.get('/cache-metrics', verifyToken, adminMiddleware, HerbController.getHerbCacheMetrics);
router.post('/:id/safety/assess', optionalAuth, validateMultiple({ params: herbIdParamSchema, body: assessSafetyBodySchema }), HerbController.assessHerbSafety);
router.post(
  '/:id/safety/interactions',
  optionalAuth,
  validateMultiple({ params: herbIdParamSchema, body: interactionsBodySchema }),
  HerbController.getHerbInteractions
);
router.post(
  '/:id/safety/contraindications',
  optionalAuth,
  validateMultiple({ params: herbIdParamSchema, body: contraindicationsBodySchema }),
  HerbController.getHerbContraindications,
);
router.post('/safety/combination', optionalAuth, validateRequest(safetyCombinationBodySchema), HerbController.checkHerbCombination);
router.get('/stats', cacheMiddleware(300), HerbController.getHerbStats);
// router.get('/favorites', optionalAuth, HerbController.getFavoriteHerbs); // don't cache favorites as they are user-specific
router.get('/recent', optionalAuth, validateRequest(paginationQuerySchema, 'query'), HerbController.getRecentHerbs); // don't cache recent
router.get('/by-symptom/:symptom', optionalAuth, validateMultiple({ params: symptomParamSchema, query: paginationQuerySchema }), cacheMiddleware(300), HerbController.getHerbsBySymptom);
router.get('/by-category/:category', optionalAuth, validateMultiple({ params: categoryParamSchema, query: paginationQuerySchema }), cacheMiddleware(300), HerbController.getHerbsByCategory);

// Protected routes (admin/expert only) - must come before /:id route
router.post('/', verifyToken, adminMiddleware, upload.array('images', 6), validateRequest(createHerbBodySchema), HerbController.createHerb);
router.patch('/bulk-status', verifyToken, adminMiddleware, validateRequest(bulkHerbStatusBodySchema), HerbController.bulkUpdateHerbStatus);
router.patch('/:id/status', verifyToken, adminMiddleware, validateMultiple({ params: herbIdParamSchema, body: herbStatusBodySchema }), HerbController.updateHerbStatus);
router.post('/:id/images', verifyToken, adminMiddleware, upload.array('images', 6), validateRequest(herbIdParamSchema, 'params'), HerbController.uploadHerbImages);
router.delete('/:id/images', verifyToken, adminMiddleware, validateRequest(herbIdParamSchema, 'params'), HerbController.deleteHerbImages);
router.put('/:id', verifyToken, adminMiddleware, upload.array('images', 6), validateMultiple({ params: herbIdParamSchema, body: updateHerbBodySchema }), HerbController.updateHerb);

// Public route for herb by ID (must be last to not conflict with /:id/status)
router.get('/:id', optionalAuth, validateRequest(herbIdParamSchema, 'params'), cacheMiddleware(600), HerbController.getHerbById);

module.exports = router;
