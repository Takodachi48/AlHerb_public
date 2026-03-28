const express = require('express');
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
  profileUpdateBodySchema,
  preferencesBodySchema,
  medicalInfoBodySchema,
  recommendationHistoryQuerySchema,
  changePasswordBodySchema,
  herbIdBodySchema,
  herbIdParamSchema,
  savedRecommendationBodySchema,
  recommendationIdParamSchema,
} = require('../schemas/userSchemas');
const router = express.Router();

// All routes require authentication and email verification
router.use(authenticateToken);

// Profile routes
router.get('/profile', userController.getProfile);
router.put('/profile', validateRequest(profileUpdateBodySchema), userController.updateProfile);
router.patch('/profile', validateRequest(profileUpdateBodySchema), userController.updateProfile);

// Preferences routes
router.get('/preferences', userController.getPreferences);
router.put('/preferences', validateRequest(preferencesBodySchema), userController.updatePreferences);

// Medical information routes
router.get('/medical-info', userController.getMedicalInfo);
router.put('/medical-info', validateRequest(medicalInfoBodySchema), userController.updateMedicalInfo);

// Statistics
router.get('/stats', userController.getStats);
router.get('/recommendations/history', validateRequest(recommendationHistoryQuerySchema, 'query'), userController.getRecommendationHistory);
router.get('/recommendations/:recommendationId', validateRequest(recommendationIdParamSchema, 'params'), userController.getRecommendationById);

// Favorites
router.get('/favorites', userController.getFavorites);
router.post('/favorites', validateRequest(herbIdBodySchema), userController.addToFavorites);
router.delete('/favorites/:herbId', validateRequest(herbIdParamSchema, 'params'), userController.removeFromFavorites);

// Saved recommendations
router.get('/saved', userController.getSavedRecommendations);
router.post('/saved', validateRequest(savedRecommendationBodySchema), userController.addToSaved);
router.delete('/saved/:recommendationId', validateRequest(recommendationIdParamSchema, 'params'), userController.removeFromSaved);

// Account management
router.patch('/change-password', validateRequest(changePasswordBodySchema), userController.changePassword);
router.delete('/account', userController.deleteAccount);

// Expo push notification token
router.post('/push-token', userController.registerPushToken);
router.delete('/push-token', userController.removePushToken);

module.exports = router;
