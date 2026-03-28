const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const upload = require('../middleware/upload');
const { authenticateToken, adminMiddleware } = require('../middleware/auth');
const { validateRequest, validateMultiple } = require('../middleware/validateRequest');
const {
  objectIdParamSchema,
  pagingQuerySchema,
  uploadLabelBodySchema,
  feedbackBodySchema,
} = require('../schemas/imageSchemas');

// Apply larger request size limits for image upload routes
router.use(express.json({ limit: '5mb' }));
router.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Upload avatar
router.post(
  '/avatar',
  authenticateToken,
  upload.single('avatar'),
  imageController.uploadAvatar
);

// Upload banner
router.post(
  '/banner',
  authenticateToken,
  upload.single('banner'),
  imageController.uploadBanner
);

// Delete avatar
router.delete(
  '/avatar',
  authenticateToken,
  imageController.deleteAvatar
);

// Delete banner
router.delete(
  '/banner',
  authenticateToken,
  imageController.deleteBanner
);

// Delete temporary image by URL (avatar/banner)
router.post(
  '/temp',
  authenticateToken,
  imageController.deleteTempImage
);

// Upload general image (for blog posts, etc.)
router.post(
  '/upload',
  authenticateToken,
  upload.single('image'),
  imageController.uploadImage
);

// Upload blog image (user/admin)
router.post(
  '/blog',
  authenticateToken,
  upload.single('image'),
  validateRequest(uploadLabelBodySchema),
  imageController.uploadBlogImage
);

// Upload landing background image (admin)
router.post(
  '/site-background',
  authenticateToken,
  adminMiddleware,
  upload.single('image'),
  validateRequest(uploadLabelBodySchema),
  imageController.uploadSiteBackground
);

// Upload landing carousel image (admin)
router.post(
  '/site-carousel',
  authenticateToken,
  adminMiddleware,
  upload.single('image'),
  validateRequest(uploadLabelBodySchema),
  imageController.uploadSiteCarousel
);

// Get user classification history
router.get(
  '/plant-identification',
  authenticateToken,
  validateRequest(pagingQuerySchema, 'query'),
  imageController.getUserIdentifications
);

// Get single identification by ID
router.get(
  '/plant-identification/:id',
  authenticateToken,
  validateRequest(objectIdParamSchema, 'params'),
  imageController.getIdentificationById
);

// Upload plant identification image
router.post(
  '/plant-identification',
  authenticateToken,
  upload.single('image'),
  imageController.uploadPlantIdentification
);

// Add feedback for identification
router.post(
  '/plant-identification/:id/feedback',
  authenticateToken,
  validateMultiple({ params: objectIdParamSchema, body: feedbackBodySchema }),
  imageController.addIdentificationFeedback
);

module.exports = router;
