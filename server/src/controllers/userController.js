const User = require('../models/User');
const Recommendation = require('../models/Recommendation');
const Feedback = require('../models/Feedback');
const bcrypt = require('bcryptjs');
const { formatSuccess, formatError } = require('../utils/response');
const { logger } = require('../utils/logger');
const { validateEmail, validateAge, validateGender } = require('../utils/validators');

const normalizeUserPreferences = (preferences = {}) => ({
  notifications: {
    system: preferences?.notifications?.system ?? true,
    blog: preferences?.notifications?.blog ?? true,
    email: preferences?.notifications?.email ?? true,
    push: preferences?.notifications?.push ?? true,
  },
  language: typeof preferences?.language === 'string' && preferences.language.trim()
    ? preferences.language
    : 'en',
  theme: typeof preferences?.theme === 'string' && preferences.theme.trim()
    ? preferences.theme
    : 'theme1',
  darkMode: typeof preferences?.darkMode === 'string' && preferences.darkMode.trim()
    ? preferences.darkMode
    : 'light',
  chatbot: {
    enabled: preferences?.chatbot?.enabled ?? true,
  },
});

const normalizeMedicalInfo = (medicalInfo = {}) => ({
  allergies: Array.isArray(medicalInfo?.allergies) ? medicalInfo.allergies : [],
  medications: Array.isArray(medicalInfo?.medications) ? medicalInfo.medications : [],
  conditions: Array.isArray(medicalInfo?.conditions) ? medicalInfo.conditions : [],
});

const normalizeUserProfile = (profile = {}) => ({
  bio: typeof profile?.bio === 'string' ? profile.bio : '',
  favoriteHerbs: Array.isArray(profile?.favoriteHerbs) ? profile.favoriteHerbs : [],
  savedRecommendations: Array.isArray(profile?.savedRecommendations) ? profile.savedRecommendations : [],
  savedRemedies: Array.isArray(profile?.savedRemedies) ? profile.savedRemedies : [],
});

const normalizeUserPayload = (userDoc) => {
  const user = typeof userDoc?.toObject === 'function' ? userDoc.toObject() : (userDoc || {});

  return {
    ...user,
    displayName: typeof user.displayName === 'string' ? user.displayName : '',
    photoURL: user.photoURL ?? null,
    location: {
      city: user?.location?.city ?? '',
      province: user?.location?.province ?? '',
      region: user?.location?.region ?? '',
    },
    preferences: normalizeUserPreferences(user.preferences),
    medicalInfo: normalizeMedicalInfo(user.medicalInfo),
    profile: normalizeUserProfile(user.profile),
  };
};

const normalizeSavedRemedyPayload = (body = {}) => ({
  herbId: String(body.herbId || '').trim(),
  herbName: String(body.herbName || '').trim(),
  scientificName: String(body.scientificName || '').trim(),
  dosageInfo: body.dosageInfo ?? null,
  preparation: body.preparation ?? null,
  effectiveness: Number.isFinite(Number(body.effectiveness)) ? Number(body.effectiveness) : 0,
  matchedSymptoms: Array.isArray(body.matchedSymptoms)
    ? body.matchedSymptoms.map((item) => String(item).trim()).filter(Boolean)
    : [],
  evidence: String(body.evidence || '').trim(),
  notes: String(body.notes || '').trim(),
  selectedAge: String(body.selectedAge || '').trim(),
  selectedGender: String(body.selectedGender || '').trim(),
  searchMode: String(body.searchMode || 'symptom').trim() || 'symptom',
  diseaseName: String(body.diseaseName || '').trim(),
  savedAt: new Date(),
});

const validateNewPassword = (password = '') => {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be between 8 and 128 characters';
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasUpper || !hasLower || !hasDigit) {
    return 'Password must include uppercase, lowercase, and numeric characters';
  }

  return '';
};

class UserController {
  // Get user profile
  async getProfile(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid }).select('-__v');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      res.json(
        formatSuccess(normalizeUserPayload(user), 'Profile retrieved successfully')
      );
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json(
        formatError('Failed to retrieve profile', 500)
      );
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { uid } = req.user;
      const updates = req.body;

      if (updates.location && typeof updates.location === 'object') {
        // Normalize legacy keys from older clients.
        if (!updates.location.region && updates.location.country) {
          updates.location.region = updates.location.country;
        }
        if (!updates.location.province && updates.location.address) {
          updates.location.province = updates.location.address;
        }
        delete updates.location.country;
        delete updates.location.address;
      }

      // Validate updates
      if (updates.email && !validateEmail(updates.email)) {
        return res.status(400).json(
          formatError('Invalid email format', 400)
        );
      }

      if (updates.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(updates.dateOfBirth).getFullYear();
        if (!validateAge(age)) {
          return res.status(400).json(
            formatError('Invalid date of birth', 400)
          );
        }
      }

      if (updates.gender && !validateGender(updates.gender)) {
        return res.status(400).json(
          formatError('Invalid gender value', 400)
        );
      }

      // Validate preferences.darkMode
      if (updates.preferences && updates.preferences.darkMode !== undefined) {
        const darkMode = updates.preferences.darkMode;
        if (typeof darkMode === 'boolean') {
          // Convert boolean to string: true -> 'dark', false -> 'light'
          updates.preferences.darkMode = darkMode ? 'dark' : 'light';
        } else if (typeof darkMode === 'string') {
          // Validate string enum
          const allowedValues = ['light', 'dark', 'auto'];
          if (!allowedValues.includes(darkMode)) {
            return res.status(400).json(
              formatError('Invalid darkMode value. Must be one of: light, dark, auto', 400)
            );
          }
        } else {
          return res.status(400).json(
            formatError('darkMode must be a string or boolean', 400)
          );
        }
      }

      // Handle photoURL updates and cleanup
      let oldPhotoURL = null;
      if (updates.photoURL) {
        // Get current photoURL for cleanup
        const currentUser = await User.findOne({ uid }).select('photoURL');
        oldPhotoURL = currentUser?.photoURL;
      }

      // Update user
      const user = await User.findOneAndUpdate(
        { uid },
        {
          ...updates,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).select('-__v');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      // Clean up old avatar if photoURL was updated
      if (updates.photoURL && oldPhotoURL && oldPhotoURL !== updates.photoURL) {
        try {
          const imageService = require('../services/imageService');
          await imageService.deleteImage(oldPhotoURL);
          logger.info(`Old avatar deleted for user: ${uid}`);
        } catch (deleteError) {
          logger.warn(`Failed to delete old avatar for user: ${uid}`, deleteError.message);
          // Don't fail the request if cleanup fails
        }
      }

      logger.info(`Profile updated for user: ${uid}`);

      res.json(
        formatSuccess(normalizeUserPayload(user), 'Profile updated successfully')
      );
    } catch (error) {
      logger.error('Update profile error:', error);
      res.status(500).json(
        formatError('Failed to update profile', 500)
      );
    }
  }

  // Get user preferences
  async getPreferences(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid }).select('preferences');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      res.json(
        formatSuccess(normalizeUserPreferences(user.preferences), 'Preferences retrieved successfully')
      );
    } catch (error) {
      logger.error('Get preferences error:', error);
      res.status(500).json(
        formatError('Failed to retrieve preferences', 500)
      );
    }
  }

  // Update user preferences
  async updatePreferences(req, res) {
    try {
      const { uid } = req.user;
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json(
          formatError('Invalid preferences data', 400)
        );
      }

      const updateSet = { updatedAt: new Date() };

      if (preferences.notifications !== undefined) {
        if (typeof preferences.notifications !== 'object' || Array.isArray(preferences.notifications)) {
          return res.status(400).json(formatError('preferences.notifications must be an object', 400));
        }

        const notificationKeys = ['email', 'push', 'system', 'blog'];
        notificationKeys.forEach((key) => {
          if (preferences.notifications[key] !== undefined) {
            if (typeof preferences.notifications[key] !== 'boolean') return;
            updateSet[`preferences.notifications.${key}`] = preferences.notifications[key];
          }
        });

        const invalidNotificationKey = notificationKeys.find(
          (key) =>
            preferences.notifications[key] !== undefined &&
            typeof preferences.notifications[key] !== 'boolean'
        );
        if (invalidNotificationKey) {
          return res.status(400).json(
            formatError(`preferences.notifications.${invalidNotificationKey} must be a boolean`, 400)
          );
        }
      }

      if (preferences.language !== undefined) {
        if (typeof preferences.language !== 'string' || !preferences.language.trim()) {
          return res.status(400).json(formatError('preferences.language must be a non-empty string', 400));
        }
        updateSet['preferences.language'] = preferences.language;
      }

      if (preferences.theme !== undefined) {
        const allowedThemes = ['theme1', 'theme2', 'theme8'];
        if (!allowedThemes.includes(preferences.theme)) {
          return res.status(400).json(formatError('Invalid preferences.theme value', 400));
        }
        updateSet['preferences.theme'] = preferences.theme;
      }

      if (preferences.darkMode !== undefined) {
        const allowedDarkMode = ['light', 'dark', 'auto'];
        if (!allowedDarkMode.includes(preferences.darkMode)) {
          return res.status(400).json(formatError('Invalid preferences.darkMode value', 400));
        }
        updateSet['preferences.darkMode'] = preferences.darkMode;
      }

      if (preferences.chatbot?.enabled !== undefined) {
        if (typeof preferences.chatbot.enabled !== 'boolean') {
          return res.status(400).json(formatError('preferences.chatbot.enabled must be a boolean', 400));
        }
        updateSet['preferences.chatbot.enabled'] = preferences.chatbot.enabled;
      }

      let user;
      try {
        user = await User.findOneAndUpdate(
          { uid },
          { $set: updateSet },
          { new: true, runValidators: true }
        ).select('preferences');
      } catch (validationError) {
        return res.status(400).json(formatError(validationError.message, 400));
      }

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      logger.info(`Preferences updated for user: ${uid}`);

      res.json(
        formatSuccess(normalizeUserPreferences(user.preferences), 'Preferences updated successfully')
      );
    } catch (error) {
      logger.error('Update preferences error:', error);
      res.status(500).json(
        formatError('Failed to update preferences', 500)
      );
    }
  }

  // Get medical information
  async getMedicalInfo(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid }).select('medicalInfo');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      res.json(
        formatSuccess(normalizeMedicalInfo(user.medicalInfo), 'Medical information retrieved successfully')
      );
    } catch (error) {
      logger.error('Get medical info error:', error);
      res.status(500).json(
        formatError('Failed to retrieve medical information', 500)
      );
    }
  }

  // Update medical information
  async updateMedicalInfo(req, res) {
    try {
      const { uid } = req.user;
      const { medicalInfo } = req.body;

      if (!medicalInfo || typeof medicalInfo !== 'object') {
        return res.status(400).json(
          formatError('Invalid medical information data', 400)
        );
      }

      // Update medical information
      const user = await User.findOneAndUpdate(
        { uid },
        {
          $set: {
            'medicalInfo.allergies': medicalInfo.allergies || [],
            'medicalInfo.medications': medicalInfo.medications || [],
            'medicalInfo.conditions': medicalInfo.conditions || []
          },
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      ).select('medicalInfo');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      logger.info(`Medical information updated for user: ${uid}`);

      res.json(
        formatSuccess(normalizeMedicalInfo(user.medicalInfo), 'Medical information updated successfully')
      );
    } catch (error) {
      logger.error('Update medical info error:', error);
      res.status(500).json(
        formatError('Failed to update medical information', 500)
      );
    }
  }

  // Get user statistics
  async getStats(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid });

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      const stats = {
        totalRecommendations: await Recommendation.countDocuments({ user: user._id }),
        totalFeedback: await Feedback.countDocuments({ user: user._id }),
        favoriteHerbCount: user.profile?.favoriteHerbs?.length || 0,
        savedRecommendationCount:
          (user.profile?.savedRecommendations?.length || 0) +
          (user.profile?.savedRemedies?.length || 0),
        lastActiveDate: user.lastLoginAt || null,
        joinDate: user.createdAt,
      };

      res.json(
        formatSuccess(stats, 'User statistics retrieved successfully')
      );
    } catch (error) {
      logger.error('Get stats error:', error);
      res.status(500).json(
        formatError('Failed to retrieve user statistics', 500)
      );
    }
  }

  // Get recommendation history (tabular support)
  async getRecommendationHistory(req, res) {
    try {
      const { uid } = req.user;
      const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
      const skip = (page - 1) * limit;
      const rankingSource = String(req.query.rankingSource || '').trim();
      const blockedFilter = String(req.query.blocked || '').trim().toLowerCase();
      const dateFromRaw = String(req.query.dateFrom || '').trim();
      const dateToRaw = String(req.query.dateTo || '').trim();

      const user = await User.findOne({ uid }).select('_id');
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      const query = { user: user._id, isActive: true };
      if (rankingSource && rankingSource !== 'all') {
        query['mlModel.version'] = rankingSource;
      }
      if (blockedFilter === 'blocked' || blockedFilter === 'true') {
        query.status = 'pending';
      } else if (blockedFilter === 'non_blocked' || blockedFilter === 'false') {
        query.status = { $ne: 'pending' };
      }
      if (dateFromRaw || dateToRaw) {
        query.createdAt = {};
        if (dateFromRaw) {
          const fromDate = new Date(dateFromRaw);
          if (Number.isNaN(fromDate.getTime())) {
            return res.status(400).json(formatError('Invalid dateFrom value', 400));
          }
          query.createdAt.$gte = fromDate;
        }
        if (dateToRaw) {
          const toDate = new Date(dateToRaw);
          if (Number.isNaN(toDate.getTime())) {
            return res.status(400).json(formatError('Invalid dateTo value', 400));
          }
          if (dateToRaw.length <= 10) {
            toDate.setHours(23, 59, 59, 999);
          }
          query.createdAt.$lte = toDate;
        }
      }

      const [rows, total] = await Promise.all([
        Recommendation.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('symptoms recommendations mlModel status createdAt userFeedback')
          .populate('recommendations.herb', 'name scientificName slug')
          .lean(),
        Recommendation.countDocuments(query),
      ]);

      const items = rows.map((entry) => {
        const topHerbs = (entry.recommendations || [])
          .slice(0, 3)
          .map((item) => ({
            id: item?.herb?._id || item?.herb || null,
            name: item?.herb?.name || null,
            scientificName: item?.herb?.scientificName || null,
            slug: item?.herb?.slug || null,
            confidence: item?.confidence ?? null,
          }));

        return {
          id: entry._id,
          createdAt: entry.createdAt,
          status: entry.status || 'completed',
          isBlocked: (entry.status || 'completed') === 'pending',
          rankingSource: entry.mlModel?.version || 'unknown',
          symptomCount: Array.isArray(entry.symptoms) ? entry.symptoms.length : 0,
          symptoms: entry.symptoms || [],
          recommendationCount: Array.isArray(entry.recommendations) ? entry.recommendations.length : 0,
          topHerbs,
          feedbackRating: entry.userFeedback?.rating ?? null,
        };
      });

      return res.json(
        formatSuccess({
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
            hasNextPage: skip + items.length < total,
            hasPrevPage: page > 1,
          },
        }, 'Recommendation history retrieved successfully')
      );
    } catch (error) {
      logger.error('Get recommendation history error:', error);
      return res.status(500).json(
        formatError('Failed to retrieve recommendation history', 500)
      );
    }
  }

  // Get favorite herbs
  async getFavorites(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid })
        .populate('profile.favoriteHerbs', 'name scientificName images imageUrl safety category slug')
        .select('profile.favoriteHerbs');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      res.json(
        formatSuccess(user.profile?.favoriteHerbs || [], 'Favorite herbs retrieved successfully')
      );
    } catch (error) {
      logger.error('Get favorites error:', error);
      res.status(500).json(
        formatError('Failed to retrieve favorite herbs', 500)
      );
    }
  }

  // Add herb to favorites
  async addToFavorites(req, res) {
    try {
      const { uid } = req.user;
      const herbId = String(req.body?.herbId || '').trim();

      if (!herbId) {
        return res.status(400).json(
          formatError('Herb ID is required', 400)
        );
      }

      const user = await User.findOneAndUpdate(
        { uid },
        {
          $addToSet: { 'profile.favoriteHerbs': herbId },
          $set: { updatedAt: new Date() },
        },
        { new: true, runValidators: true }
      )
        .populate('profile.favoriteHerbs', 'name scientificName images imageUrl safety category slug')
        .select('profile.favoriteHerbs');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      logger.info(`Herb ${herbId} added to favorites for user: ${uid}`);

      res.json(
        formatSuccess(user.profile?.favoriteHerbs || [], 'Herb added to favorites')
      );
    } catch (error) {
      logger.error('Add to favorites error:', error);
      res.status(500).json(
        formatError('Failed to add herb to favorites', 500)
      );
    }
  }

  // Remove herb from favorites
  async removeFromFavorites(req, res) {
    try {
      const { uid } = req.user;
      const herbId = String(req.params?.herbId || '').trim();

      if (!herbId) {
        return res.status(400).json(
          formatError('Herb ID is required', 400)
        );
      }

      const user = await User.findOneAndUpdate(
        { uid },
        {
          $pull: { 'profile.favoriteHerbs': herbId },
          $set: { updatedAt: new Date() },
        },
        { new: true, runValidators: true }
      )
        .populate('profile.favoriteHerbs', 'name scientificName images imageUrl safety category slug')
        .select('profile.favoriteHerbs');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      logger.info(`Herb ${herbId} removed from favorites for user: ${uid}`);

      res.json(
        formatSuccess(user.profile?.favoriteHerbs || [], 'Herb removed from favorites')
      );
    } catch (error) {
      logger.error('Remove from favorites error:', error);
      res.status(500).json(
        formatError('Failed to remove herb from favorites', 500)
      );
    }
  }

  // Get saved remedies/recommendations
  async getSavedRecommendations(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOne({ uid })
        .populate({
          path: 'profile.savedRecommendations',
          populate: { path: 'recommendations.herb', select: 'name scientificName images imageUrl slug' },
        })
        .select('profile.savedRecommendations profile.savedRemedies');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      const savedRemedies = Array.isArray(user.profile?.savedRemedies) ? user.profile.savedRemedies : [];
      const normalizedSavedRemedies = [...savedRemedies].sort(
        (a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime()
      );

      return res.json(
        formatSuccess(normalizedSavedRemedies, 'Saved remedies retrieved successfully')
      );
    } catch (error) {
      logger.error('Get saved recommendations error:', error);
      return res.status(500).json(
        formatError('Failed to retrieve saved remedies', 500)
      );
    }
  }

  // Save a remedy or recommendation
  async addToSaved(req, res) {
    try {
      const { uid } = req.user;
      const recommendationId = String(req.body?.recommendationId || '').trim();

      if (recommendationId) {
        const user = await User.findOneAndUpdate(
          { uid },
          {
            $addToSet: { 'profile.savedRecommendations': recommendationId },
            $set: { updatedAt: new Date() },
          },
          { new: true, runValidators: true }
        ).select('profile.savedRecommendations');

        if (!user) {
          return res.status(404).json(
            formatError('User not found', 404)
          );
        }

        return res.json(
          formatSuccess(
            Array.isArray(user.profile?.savedRecommendations) ? user.profile.savedRecommendations : [],
            'Recommendation saved successfully'
          )
        );
      }

      const user = await User.findOne({ uid });
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      if (!user.profile) {
        user.profile = {};
      }
      if (!Array.isArray(user.profile.savedRecommendations)) {
        user.profile.savedRecommendations = [];
      }
      if (!Array.isArray(user.profile.savedRemedies)) {
        user.profile.savedRemedies = [];
      }

      const normalized = normalizeSavedRemedyPayload(req.body);
      if (!normalized.herbId) {
        return res.status(400).json(
          formatError('herbId is required', 400)
        );
      }

      const existingIndex = user.profile.savedRemedies.findIndex(
        (item) => String(item.herbId) === normalized.herbId
      );

      if (existingIndex > -1) {
        const existingValue = user.profile.savedRemedies[existingIndex];
        const existingPlain = existingValue && typeof existingValue.toObject === 'function'
          ? existingValue.toObject()
          : existingValue;
        user.profile.savedRemedies[existingIndex] = {
          ...existingPlain,
          ...normalized,
          savedAt: new Date(),
        };
      } else {
        user.profile.savedRemedies.push(normalized);
      }

      user.updatedAt = new Date();
      await user.save();

      const savedRemedies = [...user.profile.savedRemedies].sort(
        (a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime()
      );

      logger.info(`Herb ${normalized.herbId} saved for user: ${uid}`);

      return res.json(
        formatSuccess(savedRemedies, 'Remedy saved successfully')
      );
    } catch (error) {
      logger.error('Add to saved error:', error);
      return res.status(500).json(
        formatError('Failed to save remedy', 500)
      );
    }
  }

  // Remove saved remedy/recommendation
  async removeFromSaved(req, res) {
    try {
      const { uid } = req.user;
      const targetId = String(req.params?.recommendationId || '').trim();

      if (!targetId) {
        return res.status(400).json(
          formatError('Saved item id is required', 400)
        );
      }

      let user = await User.findOneAndUpdate(
        { uid },
        {
          $pull: {
            'profile.savedRecommendations': targetId,
            'profile.savedRemedies': { herbId: targetId },
          },
          $set: { updatedAt: new Date() },
        },
        { new: true, runValidators: true }
      ).select('profile.savedRemedies');

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      if (/^[0-9a-fA-F]{24}$/.test(targetId)) {
        user = await User.findOneAndUpdate(
          { uid },
          {
            $pull: { 'profile.savedRemedies': { _id: targetId } },
            $set: { updatedAt: new Date() },
          },
          { new: true, runValidators: true }
        ).select('profile.savedRemedies');
      }

      logger.info(`Saved item ${targetId} removed for user: ${uid}`);

      return res.json(
        formatSuccess(
          Array.isArray(user.profile?.savedRemedies) ? user.profile.savedRemedies : [],
          'Saved item removed successfully'
        )
      );
    } catch (error) {
      logger.error('Remove from saved error:', error);
      return res.status(500).json(
        formatError('Failed to remove saved item', 500)
      );
    }
  }
  // Delete account (soft delete)
  async deleteAccount(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOneAndUpdate(
        { uid },
        {
          $set: { isActive: false, updatedAt: new Date() },
          $unset: { pushTokens: 1 }
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      logger.info(`User account deactivated: ${uid}`);
      return res.json(formatSuccess(null, 'Account deleted successfully'));
    } catch (error) {
      logger.error('Delete account error:', error);
      return res.status(500).json(formatError('Failed to delete account', 500));
    }
  }

  // Change password for local-auth users
  async changePassword(req, res) {
    try {
      const { uid } = req.user;
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');

      const validationError = validateNewPassword(newPassword);
      if (validationError) {
        return res.status(400).json(formatError(validationError, 400));
      }

      const user = await User.findOne({ uid }).select('+passwordHash authProvider');
      if (!user) {
        return res.status(404).json(formatError('User not found', 404));
      }

      if (user.authProvider !== 'local') {
        return res.status(400).json(formatError('Password change is only available for local accounts', 400));
      }

      if (!user.passwordHash) {
        return res.status(400).json(formatError('Password is not set for this account', 400));
      }

      const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isMatch) {
        return res.status(400).json(formatError('Current password is incorrect', 400));
      }

      const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
      if (samePassword) {
        return res.status(400).json(formatError('New password must be different from current password', 400));
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
      user.updatedAt = new Date();
      await user.save();

      logger.info(`Password changed for user: ${uid}`);
      return res.json(formatSuccess(null, 'Password changed successfully'));
    } catch (error) {
      logger.error('Change password error:', error);
      return res.status(500).json(formatError('Failed to change password', 500));
    }
  }

  // Register Expo push token for this device
  async registerPushToken(req, res) {
    try {
      const { uid } = req.user;
      const token = String(req.body?.token || '').trim();

      if (!token) {
        return res.status(400).json(formatError('Push token is required', 400));
      }

      await User.findOneAndUpdate(
        { uid },
        { $addToSet: { pushTokens: token } },
        { new: true }
      );

      logger.info(`[Push] Token registered for user: ${uid}`);
      res.json(formatSuccess(null, 'Push token registered'));
    } catch (error) {
      logger.error('Register push token error:', error);
      res.status(500).json(formatError('Failed to register push token', 500));
    }
  }

  // Remove Expo push token (called on logout or token refresh)
  async removePushToken(req, res) {
    try {
      const { uid } = req.user;
      const token = String(req.body?.token || '').trim();

      if (!token) {
        return res.status(400).json(formatError('Push token is required', 400));
      }

      await User.findOneAndUpdate(
        { uid },
        { $pull: { pushTokens: token } }
      );

      logger.info(`[Push] Token removed for user: ${uid}`);
      res.json(formatSuccess(null, 'Push token removed'));
    } catch (error) {
      logger.error('Remove push token error:', error);
      res.status(500).json(formatError('Failed to remove push token', 500));
    }
  }
  // Delete user account (soft delete by deactivating)
  async deleteAccount(req, res) {
    try {
      const { uid } = req.user;

      const user = await User.findOneAndUpdate(
        { uid },
        {
          isActive: false,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      logger.info(`Account deactivated for user: ${uid}`);

      res.json(
        formatSuccess(null, 'Account deleted successfully')
      );
    } catch (error) {
      logger.error('Delete account error:', error);
      res.status(500).json(
        formatError('Failed to delete account', 500)
      );
    }
  }

  // Get single recommendation by ID
  async getRecommendationById(req, res) {
    try {
      const { uid } = req.user;
      const { recommendationId } = req.params;

      const user = await User.findOne({ uid }).select('_id');
      if (!user) {
        return res.status(404).json(
          formatError('User not found', 404)
        );
      }

      const recommendation = await Recommendation.findOne({
        _id: recommendationId,
        user: user._id,
        isActive: true,
      })
        .populate('recommendations.herb', 'name scientificName slug images imageUrl description safety category preparation symptoms info dosage phytochemicals')
        .populate('recommendations.herb.phytochemicals.compound', 'name category effects')
        .populate('recommendations.alternatives.herb', 'name scientificName slug');

      if (!recommendation) {
        return res.status(404).json(
          formatError('Recommendation not found', 404)
        );
      }

      res.json(
        formatSuccess(recommendation, 'Recommendation retrieved successfully')
      );
    } catch (error) {
      logger.error('Get recommendation by ID error:', error);
      res.status(500).json(
        formatError('Failed to retrieve recommendation details', 500)
      );
    }
  }
}

module.exports = new UserController();
