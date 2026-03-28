const imageService = require('../services/imageService');
const { CLOUDINARY_FOLDERS } = require('../config/cloudinary');
const { validateImageFile } = require('../utils/imageValidation');
const User = require('../models/User');
const PlantIdentification = require('../models/PlantIdentification');
const Herb = require('../models/Herb');
const { formatError, formatSuccess } = require('../utils/responseFormatter');
const { logger } = require('../utils/logger');

class ImageController {
  // Upload user avatar
  async uploadAvatar(req, res) {
    try {
      const { uid } = req.user;

      // Validate image
      validateImageFile(req.file);

      // Get old avatar URL for cleanup after successful upload (but don't save yet)
      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      // Upload new avatar to Cloudinary
      const avatarUrl = await imageService.uploadAvatar(req.file, uid);

      logger.info(`Avatar uploaded to Cloudinary for user: ${uid}`);

      res.json(
        formatSuccess({
          photoURL: avatarUrl
        }, 'Avatar uploaded successfully')
      );
    } catch (error) {
      logger.error('Avatar upload error:', error);
      res.status(500).json(
        formatError('Failed to upload avatar', 500)
      );
    }
  }

  // Upload user banner
  async uploadBanner(req, res) {
    try {
      const { uid } = req.user;

      // Validate image
      validateImageFile(req.file);

      // Get user
      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      // Upload new banner to Cloudinary
      const bannerUrl = await imageService.uploadBanner(req.file, uid);

      logger.info(`Banner uploaded to Cloudinary for user: ${uid}`);

      res.json(
        formatSuccess({
          bannerURL: bannerUrl
        }, 'Banner uploaded successfully')
      );
    } catch (error) {
      logger.error('Banner upload error:', error);
      res.status(500).json(
        formatError('Failed to upload banner', 500)
      );
    }
  }

  // Delete user avatar
  async deleteAvatar(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      // Delete from Cloudinary
      if (user.photoURL) {
        await imageService.deleteImage(user.photoURL);
        user.photoURL = null;
        await user.save();
      }

      logger.info(`Avatar deleted for user: ${uid}`);

      res.json(
        formatSuccess(null, 'Avatar deleted successfully')
      );
    } catch (error) {
      logger.error('Avatar deletion error:', error);
      res.status(500).json(
        formatError('Failed to delete avatar', 500)
      );
    }
  }

  // Delete user banner
  async deleteBanner(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      if (user.bannerURL) {
        await imageService.deleteImage(user.bannerURL);
        user.bannerURL = null;
        await user.save();
      }

      logger.info(`Banner deleted for user: ${uid}`);

      return res.json(
        formatSuccess(null, 'Banner deleted successfully')
      );
    } catch (error) {
      logger.error('Banner deletion error:', error);
      return res.status(500).json(
        formatError('Failed to delete banner', 500)
      );
    }
  }

  // Delete a temporary user image by URL (avatar/banner)
  async deleteTempImage(req, res) {
    try {
      const { uid } = req.user;
      const { url } = req.body || {};

      if (!url || typeof url !== 'string') {
        return res.status(400).json(
          formatError('Image URL is required', 400)
        );
      }

      const publicId = imageService.extractPublicIdFromUrl(url);
      if (!publicId) {
        return res.status(400).json(
          formatError('Invalid image URL', 400)
        );
      }

      const avatarPrefix = `${CLOUDINARY_FOLDERS.USER_AVATARS}/user-${uid}-`;
      const bannerPrefix = `${CLOUDINARY_FOLDERS.USER_BANNERS}/user-${uid}-`;

      if (!publicId.startsWith(avatarPrefix) && !publicId.startsWith(bannerPrefix)) {
        return res.status(403).json(
          formatError('Not authorized to delete this image', 403)
        );
      }

      await imageService.deleteImage(url);

      return res.json(
        formatSuccess(null, 'Temporary image deleted successfully')
      );
    } catch (error) {
      logger.error('Temp image deletion error:', error);
      return res.status(500).json(
        formatError('Failed to delete temporary image', 500)
      );
    }
  }

  // Upload plant identification image
  async uploadPlantIdentification(req, res) {
    try {
      const { uid } = req.user;
      const user = await User.findOne({ uid }); // PlantIdentification needs ObjectId

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      // Validate image
      validateImageFile(req.file);

      // 1. Upload to Cloudinary (Initial unclassified folder)
      // We'll use a temp publicId for unclassified
      const publicId = `user-${user._id}-${Date.now()}`;
      const imageUrl = await imageService.uploadUnclassifiedPlantImage(req.file, user._id);

      // Extract original cloud publicId format
      const cloudPublicID = imageService.extractPublicIdFromUrl(imageUrl);

      // 2. Create database record (Status: pending)
      const plantIdRecord = new PlantIdentification({
        user: user._id,
        image: {
          publicId: cloudPublicID,
          url: imageUrl,
          originalName: req.file.originalname,
          size: req.file.size,
          format: req.file.mimetype.split('/')[1]
        },
        classification: {
          scientificName: 'Pending', // Initial placeholder
          confidence: 0
        },
        status: 'pending',
        metadata: {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      await plantIdRecord.save();

      // 3. Trigger asynchronous classification
      // Don't wait for this to respond to the user
      ImageController.handleClassification(plantIdRecord, imageUrl, cloudPublicID).catch(err => {
        logger.error(`Classification background task failed: ${err.message}`);
      });

      logger.info(`Plant identification record created for user: ${uid} (ID: ${plantIdRecord._id})`);

      res.status(201).json(
        formatSuccess({
          identification: plantIdRecord
        }, 'Image uploaded and classification started', 201)
      );
    } catch (error) {
      logger.error('Plant identification upload error:', error);
      res.status(500).json(
        formatError('Failed to start plant identification', 500)
      );
    }
  }

  // Get user's classification history
  async getUserIdentifications(req, res) {
    try {
      const { uid } = req.user;
      const user = await User.findOne({ uid });

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      const { page = 1, limit = 10 } = req.query;
      const skip = (page - 1) * limit;

      const identifications = await PlantIdentification.find({ user: user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await PlantIdentification.countDocuments({ user: user._id });

      res.json(formatSuccess({
        identifications,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / limit)
        }
      }, 'Classification history retrieved'));
    } catch (error) {
      logger.error('Get user identifications error:', error);
      res.status(500).json(formatError('Failed to retrieve history', 500));
    }
  }

  // Get single identification by ID
  async getIdentificationById(req, res) {
    try {
      const { uid } = req.user;
      const { id } = req.params;

      const user = await User.findOne({ uid });

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      const identification = await PlantIdentification.findOne({
        _id: id,
        user: user._id
      });

      if (!identification) {
        return res.status(404).json(formatError('Identification not found', 404));
      }

      res.json(formatSuccess({
        identification: identification.toObject()
      }, 'Identification retrieved'));
    } catch (error) {
      logger.error('Get identification by ID error:', error);
      res.status(500).json(formatError('Failed to retrieve identification', 500));
    }
  }

  // Add user feedback for classification
  async addIdentificationFeedback(req, res) {
    try {
      const { id } = req.params;
      const { userCorrection, isCorrect, rating } = req.body;
      const { uid } = req.user;

      // Check if user is admin or owner
      const isAdmin = req.user.role === 'admin';
      let query = { _id: id };
      if (!isAdmin) {
        const user = await User.findOne({ uid });
        if (!user) {
          return res.status(404).json(formatError('User not found', 404));
        }
        query = { _id: id, user: user._id };
      }

      const identification = await PlantIdentification.findOne(query);

      if (!identification) {
        return res.status(404).json(formatError('Record not found or access denied', 404));
      }

      const hasExistingFeedback =
        identification.feedback &&
        (
          typeof identification.feedback.isCorrect === 'boolean' ||
          (typeof identification.feedback.userCorrection === 'string' && identification.feedback.userCorrection.trim().length > 0) ||
          typeof identification.feedback.rating === 'number'
        );

      if (hasExistingFeedback && !isAdmin) {
        return res.status(409).json(formatError('Feedback already submitted for this record', 409));
      }

      const feedbackUpdate = {};
      if (typeof userCorrection === 'string') {
        feedbackUpdate.userCorrection = userCorrection.trim();
      }
      if (typeof isCorrect === 'boolean') {
        feedbackUpdate.isCorrect = isCorrect;
      }
      if (typeof rating === 'number' && Number.isFinite(rating)) {
        feedbackUpdate.rating = rating;
      }

      if (!Object.keys(feedbackUpdate).length) {
        return res.status(400).json(formatError('Invalid feedback payload', 400));
      }

      const setOps = {};
      if (Object.prototype.hasOwnProperty.call(feedbackUpdate, 'userCorrection')) {
        setOps['feedback.userCorrection'] = feedbackUpdate.userCorrection;
      }
      if (Object.prototype.hasOwnProperty.call(feedbackUpdate, 'isCorrect')) {
        setOps['feedback.isCorrect'] = feedbackUpdate.isCorrect;
      }
      if (Object.prototype.hasOwnProperty.call(feedbackUpdate, 'rating')) {
        setOps['feedback.rating'] = feedbackUpdate.rating;
      }

      const updatedIdentification = await PlantIdentification.findOneAndUpdate(
        query,
        { $set: setOps },
        { new: true }
      );

      if (!updatedIdentification) {
        return res.status(404).json(formatError('Record not found or access denied', 404));
      }

      // Forward feedback to ML Microservice for continuous learning
      ImageController.sendFeedbackToML(updatedIdentification).catch(err => {
        logger.error(`Failed to send feedback to ML service: ${err.message}`);
      });

      res.json(formatSuccess(updatedIdentification, 'Feedback updated successfully'));
    } catch (error) {
      logger.error('Add identification feedback error:', error);
      res.status(500).json(formatError('Failed to update feedback', 500));
    }
  }

  /**
   * Background task: Forward feedback to ML microservice
   */
  static async sendFeedbackToML(record) {
    const mlService = require('../services/mlService');

    if (!record.feedback || !String(record.feedback.userCorrection || '').trim()) return;

    try {
      // Forward to Python service /api/v1/feedback
      await mlService.client.post('/api/v1/feedback', {
        prediction_id: record.image.publicId.split('/').pop(),
        correct_herb_id: 0, // Placeholder
        correct_herb_name: record.feedback.userCorrection, // User correction as common name
        correct_scientific_name: record.feedback.userCorrection, // Also as scientific for now
        user_id: record.user.toString(),
        feedback_type: record.feedback.isCorrect ? 'verification' : 'correction'
      });
      logger.info(`Feedback forwarded to ML service for record ${record._id}`);
    } catch (error) {
      logger.error(`Error forwarding feedback to ML: ${error.message}`);
    }
  }

  /**
   * Background task: Call ML service, update DB, and move image in Cloudinary
   */
  static async handleClassification(record, imageUrl, currentPublicId) {
    const mlService = require('../services/mlService');
    const { imageHelpers } = require('../config/cloudinary');

    try {
      logger.info(`Starting classification for record ${record._id} using image URL ${imageUrl}`);
      // 1. Call ML Service
      const result = await mlService.classifyImage(imageUrl);
      logger.info(`ML classification response received for record ${record._id}`);

      if (!result || !result.scientific_name) {
        throw new Error('ML service returned invalid classification');
      }

      // 2. Map to internal Herb record if exists
      const herbRecord = await Herb.findOne({
        scientificName: { $regex: new RegExp(`^${result.scientific_name}$`, 'i') }
      });

      // 3. Update Database (Ensure confidence is 0-100)
      const classificationData = {
        scientificName: result.scientific_name,
        commonName: result.herb_name,
        herbId: herbRecord ? herbRecord._id : null,
        confidence: Math.round((result.confidence || 0) * 100),
        alternatives: (result.top_k || []).slice(1).map(alt => ({
          scientificName: alt.scientific_name,
          commonName: alt.herb_name,
          confidence: Math.round((alt.confidence || 0) * 100)
        })),
        modelVersion: result.model_version || 'v1',
        processingTime: result.inference_time_ms,
        illustrationUrl: herbRecord ? (herbRecord.images.find(img => img.isPrimary)?.url || herbRecord.images[0]?.url) : null,
        description: herbRecord ? herbRecord.description : '',
        symptoms: herbRecord ? (herbRecord.symptoms || herbRecord.properties || []) : [],
        uncertainty: {
          isUncertain: Boolean(result?.uncertainty?.is_uncertain),
          maxProbability: Number(result?.uncertainty?.max_probability || 0),
          secondProbability: Number(result?.uncertainty?.second_probability || 0),
          margin: Number(result?.uncertainty?.margin || 0),
          reasons: Array.isArray(result?.uncertainty?.reasons) ? result.uncertainty.reasons : [],
        },
      };

      const isUncertain = Boolean(result?.uncertainty?.is_uncertain);
      const moveResult = isUncertain
        ? await imageHelpers.moveToUncertain(currentPublicId)
        : await imageHelpers.moveToClassified(currentPublicId, result.scientific_name);

      // Update record with new URL and status
      record.classification = classificationData;
      record.status = isUncertain ? 'uncertain' : 'classified';
      record.image.url = moveResult.url;
      record.image.publicId = moveResult.newPublicId;
      record.metadata.classifiedAt = new Date();
      record.notes = isUncertain
        ? `Uncertain prediction: ${(classificationData.uncertainty.reasons || []).join(', ') || 'low_confidence'}`
        : record.notes;

      await record.save();
      if (isUncertain) {
        logger.warn(`Record ${record._id} marked uncertain (top=${classificationData.confidence}%)`);
      } else {
        logger.info(`Successfully classified record ${record._id} as ${result.scientific_name}`);
      }

    } catch (error) {
      logger.warn(`Classification error for record ${record._id}, using mock fallback: ${error.message}`);

      // --- MOCK FALLBACK (for testing UI when ML service is unavailable) ---
      try {
        // Retrieve an herb that actually has images for UI testing
        const mockHerb = await Herb.findOne({ images: { $ne: [] } }).sort({ name: 1 }).lean();
        if (mockHerb) {
          record.classification = {
            scientificName: mockHerb.scientificName || 'Lagerstroemia speciosa',
            commonName: mockHerb.commonName || mockHerb.name || 'Banaba',
            herbId: mockHerb._id,
            confidence: 75, // Fixed moderate confidence so mock is obviously distinguishable
            alternatives: [],
            modelVersion: 'mock-v1',
            processingTime: 0,
            illustrationUrl: mockHerb.images?.find(img => img.isPrimary)?.url || mockHerb.images?.[0]?.url || null,
            description: mockHerb.description || '',
            symptoms: mockHerb.symptoms || mockHerb.properties || [],
            uncertainty: { isUncertain: false, maxProbability: 0.75, secondProbability: 0, margin: 0.75, reasons: [] },
          };
          record.status = 'classified';
          record.notes = '[MOCK] ML service unavailable — using fallback for UI testing';
          record.metadata.classifiedAt = new Date();
          await record.save();
          logger.info(`Mock classification applied for record ${record._id} → ${record.classification.scientificName}`);
          return;
        }
      } catch (mockErr) {
        logger.error(`Mock fallback also failed for record ${record._id}: ${mockErr.message}`);
      }
      // --- END MOCK FALLBACK ---

      // Explicitly reject so the frontend poll exits cleanly instead of timing out
      record.status = 'rejected';
      record.notes = `Classification failed: ${error.message}`;
      await record.save();
    }

  }

  // Upload general image (for blog posts, etc.)
  async uploadImage(req, res) {
    try {
      // Validate image
      validateImageFile(req.file);

      // Upload to Cloudinary with general folder
      const imageUrl = await imageService.uploadGeneralImage(req.file);

      res.json(
        formatSuccess({
          url: imageUrl
        }, 'Image uploaded successfully')
      );
    } catch (error) {
      logger.error('General image upload error:', error);
      res.status(500).json(
        formatError('Failed to upload image', 500, error.message)
      );
    }
  }

  // Upload blog featured image
  async uploadBlogImage(req, res) {
    try {
      validateImageFile(req.file);

      const label = req.body?.label || 'blog-featured-image';
      const imageUrl = await imageService.uploadBlogImage(req.file, label);

      res.json(
        formatSuccess({
          url: imageUrl
        }, 'Blog image uploaded successfully')
      );
    } catch (error) {
      logger.error('Blog image upload error:', error);
      res.status(500).json(
        formatError('Failed to upload blog image', 500, error.message)
      );
    }
  }

  // Upload landing/site background image
  async uploadSiteBackground(req, res) {
    try {
      validateImageFile(req.file);

      const label = req.body?.label || 'landing-background';
      const imageUrl = await imageService.uploadSiteBackgroundImage(req.file, label);

      res.json(
        formatSuccess({
          url: imageUrl
        }, 'Background image uploaded successfully')
      );
    } catch (error) {
      logger.error('Background image upload error:', error);
      res.status(500).json(
        formatError('Failed to upload background image', 500, error.message)
      );
    }
  }

  // Upload landing/site carousel image
  async uploadSiteCarousel(req, res) {
    try {
      validateImageFile(req.file);

      const label = req.body?.label || 'landing-carousel';
      const imageUrl = await imageService.uploadSiteCarouselImage(req.file, label);

      res.json(
        formatSuccess({
          url: imageUrl
        }, 'Carousel image uploaded successfully')
      );
    } catch (error) {
      logger.error('Carousel image upload error:', error);
      res.status(500).json(
        formatError('Failed to upload carousel image', 500, error.message)
      );
    }
  }
}

module.exports = new ImageController();
