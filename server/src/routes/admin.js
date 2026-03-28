const express = require('express');
const router = express.Router();
const { authenticateToken, adminMiddleware } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/asyncHandler');
const { validateRequest, validateMultiple } = require('../middleware/validateRequest');
const AdminController = require('../controllers/adminController');
const PhytochemicalAdminController = require('../controllers/phytochemicalAdminController');
const SiteAssetController = require('../controllers/siteAssetController');
const {
  phytochemicalIdParamSchema,
  listPhytochemicalsQuerySchema,
  phytochemicalDetailQuerySchema,
  createPhytochemicalBodySchema,
  updatePhytochemicalBodySchema,
  listPhytochemicalHerbsQuerySchema,
  saveAssignmentBodySchema,
} = require('../schemas/phytochemicalAdminSchemas');

// Apply auth and admin middleware to all routes
router.use(authenticateToken);
router.use(adminMiddleware);

// User management routes
router.get('/users', asyncHandler(AdminController.getUsers));
router.get('/users/stats', asyncHandler(AdminController.getUserStats));
router.get('/users/status-email-templates', asyncHandler(AdminController.getUserStatusEmailTemplates));
router.get('/users/:id', asyncHandler(AdminController.getUserById));
router.patch('/users/:id/status', asyncHandler(AdminController.updateUserStatus));
router.patch('/users/batch-status', asyncHandler(AdminController.batchUpdateUserStatus));
router.patch('/users/:id/role', asyncHandler(AdminController.updateUserRole));
router.get('/users/search', asyncHandler(AdminController.searchUsers));
router.post('/search/reindex', asyncHandler(AdminController.reindexSearch));

// Herb management routes
router.get('/herbs', asyncHandler(AdminController.getHerbs));
router.get('/herbs/stats', asyncHandler(AdminController.getHerbStats));
router.get('/herbs/:id', asyncHandler(AdminController.getHerbById));
router.patch('/herbs/:id/status', asyncHandler(AdminController.updateHerbStatus));
router.patch('/herbs/batch-status', asyncHandler(AdminController.batchUpdateHerbStatus));
router.get('/phytochemicals', validateRequest(listPhytochemicalsQuerySchema, 'query'), asyncHandler(PhytochemicalAdminController.list));
router.get('/phytochemicals/herbs/search', validateRequest(listPhytochemicalHerbsQuerySchema, 'query'), asyncHandler(PhytochemicalAdminController.listHerbs));
router.get(
  '/phytochemicals/:id',
  validateMultiple({ params: phytochemicalIdParamSchema, query: phytochemicalDetailQuerySchema }),
  asyncHandler(PhytochemicalAdminController.detail)
);
router.post('/phytochemicals', validateRequest(createPhytochemicalBodySchema), asyncHandler(PhytochemicalAdminController.create));
router.put(
  '/phytochemicals/:id',
  validateMultiple({ params: phytochemicalIdParamSchema, body: updatePhytochemicalBodySchema }),
  asyncHandler(PhytochemicalAdminController.update)
);
router.patch('/phytochemicals/:id/archive', validateRequest(phytochemicalIdParamSchema, 'params'), asyncHandler(PhytochemicalAdminController.archive));
router.post('/phytochemical-assignments', validateRequest(saveAssignmentBodySchema), asyncHandler(PhytochemicalAdminController.saveAssignment));

// Location management routes
router.get('/locations', asyncHandler(AdminController.getLocations));
router.get('/locations/stats', asyncHandler(AdminController.getLocationStats));
router.get('/locations/categories', asyncHandler(AdminController.getLocationCategories));
router.get('/locations/statuses', asyncHandler(AdminController.getLocationStatuses));

// Storage management routes
router.get('/storage/stats', asyncHandler(AdminController.getStorageStats));
router.get('/storage/usage', asyncHandler(AdminController.getStorageStats));
router.get('/settings/security', asyncHandler(AdminController.getSecuritySettings));
router.put('/settings/security', asyncHandler(AdminController.updateSecuritySettings));
router.get('/settings/chatbot', asyncHandler(AdminController.getChatbotSettings));
router.put('/settings/chatbot', asyncHandler(AdminController.updateChatbotSettings));
router.get('/monitoring/overview', asyncHandler(AdminController.getMonitoringOverview));
router.get('/monitoring/dashboard-overview', asyncHandler(AdminController.getDashboardOverview));
router.get('/monitoring/stream', asyncHandler(AdminController.streamMonitoring));
router.get('/monitoring/operations', asyncHandler(AdminController.getOperationalMetrics));
router.get('/monitoring/error-logs', asyncHandler(AdminController.getRecentErrorLogs));
router.get('/monitoring/top-failing-endpoints', asyncHandler(AdminController.getTopFailingEndpoints));
router.get('/monitoring/latency-by-endpoint', asyncHandler(AdminController.getLatencyByEndpoint));
router.get('/monitoring/slo-sla', asyncHandler(AdminController.getSloSlaSummary));
router.get('/monitoring/alert-rule', asyncHandler(AdminController.getMonitoringAlertRule));
router.put('/monitoring/alert-rule', asyncHandler(AdminController.updateMonitoringAlertRule));
router.get('/monitoring/safety-governance', asyncHandler(AdminController.getSafetyGovernanceMetrics));
router.get('/monitoring/recommendation-insights', asyncHandler(AdminController.getRecommendationInsights));
router.get('/monitoring/image-classifier-insights', asyncHandler(AdminController.getImageClassifierInsights));
router.get('/monitoring/blog-insights', asyncHandler(AdminController.getBlogInsights));
router.get('/monitoring/chatbot-insights', asyncHandler(AdminController.getChatbotInsights));
router.get('/monitoring/audit-trail', asyncHandler(AdminController.getAdminAuditTrail));
router.get('/monitoring/export-pdf', asyncHandler(AdminController.exportMonitoringPdf));
router.get('/monitoring/export-csv', asyncHandler(AdminController.exportMonitoringCsv));
router.post('/ml/retrain/image-classifier', asyncHandler(AdminController.triggerImageClassifierRetrain));
router.post('/ml/retrain/recommendation-engine', asyncHandler(AdminController.triggerRecommendationRetrain));
router.get('/ml/retrain/image-classifier/:taskId', asyncHandler(AdminController.getImageClassifierRetrainStatus));
router.get('/ml/queue-health/image-classifier', asyncHandler(AdminController.getImageClassifierQueueHealth));

// Landing media (SiteAsset) management routes
router.get('/site-assets/landing', asyncHandler(SiteAssetController.getLandingAssetsAdmin));
router.put('/site-assets/landing', asyncHandler(SiteAssetController.saveLandingAssets));

module.exports = router;
