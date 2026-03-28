const HerbService = require('../services/herbService');
const HerbComparisonService = require('../services/herbComparisonService');
const imageService = require('../services/imageService');
const Herb = require('../models/Herb');
const Symptom = require('../models/Symptom');
const HerbSafety = require('../models/HerbSafety');
const HerbInteraction = require('../models/HerbInteraction');
const Contraindication = require('../models/Contraindication');
const Recommendation = require('../models/Recommendation');
const User = require('../models/User');
const axios = require('axios');
const { formatSuccess, formatError, formatPaginatedResponse } = require('../utils/responseFormatter');
const { validateSearchQuery } = require('../utils/validators');
const { logger } = require('../utils/logger');
const { clearCache } = require('../middleware/cacheMiddleware');

const RECOMMENDATION_CACHE_TTL_MS = Number(process.env.RECOMMENDATION_CACHE_TTL_MS || 90000);
const MAX_RECOMMENDATION_CANDIDATES = Number(process.env.MAX_RECOMMENDATION_CANDIDATES || 50);
const recommendationCache = new Map();

const normalizeRecommendationArray = (items = []) => (
  Array.isArray(items)
    ? items.map((item) => String(item).trim().toLowerCase()).filter(Boolean).sort()
    : []
);

const normalizeRecommendationProfile = (profile = {}) => ({
  age: Number.isFinite(Number(profile.age)) ? Number(profile.age) : null,
  gender: profile.gender ? String(profile.gender).toLowerCase() : '',
  severity: profile.severity ? String(profile.severity).toLowerCase() : '',
  conditions: normalizeRecommendationArray(profile.conditions),
  medications: normalizeRecommendationArray(profile.medications),
  allergies: normalizeRecommendationArray(profile.allergies),
  isPregnant: Boolean(profile.isPregnant),
  isBreastfeeding: Boolean(profile.isBreastfeeding),
});

const makeRecommendationCacheKey = (symptoms, profile, topN, candidateCap) => (
  JSON.stringify({
    symptoms: normalizeRecommendationArray(symptoms),
    profile: normalizeRecommendationProfile(profile),
    topN: Number(topN) || 10,
    candidateCap: Number(candidateCap) || 0,
  })
);

const readRecommendationCache = (key) => {
  const entry = recommendationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > RECOMMENDATION_CACHE_TTL_MS) {
    recommendationCache.delete(key);
    return null;
  }
  return entry.data;
};

const writeRecommendationCache = (key, data) => {
  recommendationCache.set(key, { timestamp: Date.now(), data });
};

const clearRecommendationCache = () => {
  recommendationCache.clear();
};

/**
 * Herb Controller (New - Refactored)
 * Handles all herb-related operations using service layer
 */
class HerbController {
  static async resolveHerbIdentifier(identifier) {
    const value = String(identifier || '').trim();
    if (!value) return null;
    const byId = await Herb.findOne({ _id: value }).select('_id').lean();
    if (byId?._id) return String(byId._id);
    const bySlug = await Herb.findOne({ slug: value.toLowerCase() }).select('_id').lean();
    return bySlug?._id ? String(bySlug._id) : value;
  }

  static normalizeRecommendationConfidence(score) {
    const numeric = Number(score);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric < 0) return 0;
    if (numeric > 1) return 1;
    return numeric;
  }

  static scoreBySymptomOverlap(herb, symptoms = []) {
    if (!Array.isArray(symptoms) || symptoms.length === 0) return 0;
    const herbSymptoms = (herb?.symptoms || []).map((item) => String(item).toLowerCase());
    const herbProps = (herb?.properties || []).map((item) => String(item).toLowerCase());

    const overlap = symptoms.filter((input) => {
      const needle = String(input).toLowerCase();
      return herbSymptoms.some((value) => value.includes(needle) || needle.includes(value));
    });

    // Weighted Score: Symptoms (70%) + Property Match (30%)
    const symptomScore = overlap.length / symptoms.length;

    const propertyMatchCount = herbProps.filter(prop =>
      symptoms.some(sym => String(sym).toLowerCase().includes(prop) || prop.includes(String(sym).toLowerCase()))
    ).length;
    const propertyScore = herbProps.length > 0 ? Math.min(propertyMatchCount / herbProps.length, 1) : 0;

    return (symptomScore * 0.7) + (propertyScore * 0.3);
  }

  static generateDynamicReasoning(herb, inputSymptoms, userProfile) {
    const herbSymptoms = (herb?.symptoms || []).map((item) => String(item).toLowerCase());
    const matched = inputSymptoms.filter((input) => {
      const needle = String(input).toLowerCase();
      return herbSymptoms.some((value) => value.includes(needle) || needle.includes(value));
    });

    const herbProps = (herb?.properties || []).map((item) => String(item).toLowerCase());
    const propertyMatches = herbProps.filter(prop =>
      inputSymptoms.some(sym => String(sym).toLowerCase().includes(prop) || prop.includes(String(sym).toLowerCase()))
    );

    let reasoning = `${herb.name} is recommended because it matches your symptoms: ${matched.join(', ')}. `;

    if (propertyMatches.length > 0) {
      reasoning += `It contains ${propertyMatches.slice(0, 2).join(' and ')} properties which directly address these concerns. `;
    }

    if (userProfile?.age <= 12) {
      reasoning += `This herb's profile is considered gentle for pediatric use. `;
    } else if (userProfile?.age >= 65) {
      reasoning += `Its action is suitable for senior vitality and wellness. `;
    }

    return reasoning;
  }

  static async tryRecommendationEngine(candidates, userProfile) {
    const baseUrl = process.env.RECOMMENDATION_ENGINE_URL || 'http://127.0.0.1:8001';
    const timeout = Number(process.env.RECOMMENDATION_ENGINE_TIMEOUT_MS || 4000);

    const payload = {
      candidates: candidates.map((item) => ({
        herb_id: String(item._id),
        symptoms: item.symptoms || [],
        properties: item.properties || [],
      })),
      user_profile: {
        age: userProfile?.age,
        gender: userProfile?.gender,
        severity: userProfile?.severity,
        conditions: userProfile?.conditions || [],
        medications: userProfile?.medications || [],
      },
    };

    try {
      const response = await axios.post(`${baseUrl}/score`, payload, {
        timeout,
        headers: {
          'X-Internal-Key': process.env.INTERNAL_API_KEY,
        },
      });
      const ranked = Array.isArray(response?.data?.ranked) ? response.data.ranked : [];
      const scores = new Map(ranked.map((item) => [String(item.herb_id), item]));
      return { available: true, scores };
    } catch (error) {
      logger.warn(`Recommendation engine unavailable, using heuristic ranking: ${error.message}`);
      return { available: false, scores: new Map() };
    }
  }

  static pairKey(a, b) {
    const [first, second] = [String(a), String(b)].sort();
    return `${first}::${second}`;
  }

  static applyCombinationSafetyFilter(ranked = [], comboConflicts = [], topN = 10) {
    const conflictByPair = new Map();
    for (const conflict of comboConflicts || []) {
      const left = String(conflict?.herbId?._id || conflict?.herbId || '');
      const right = String(conflict?.interactsWith?.herbId?._id || conflict?.interactsWith?.herbId || '');
      if (!left || !right) continue;
      const key = HerbController.pairKey(left, right);
      if (!conflictByPair.has(key)) conflictByPair.set(key, []);
      conflictByPair.get(key).push(conflict);
    }

    const selected = [];
    const selectedIds = new Set();
    const excluded = [];
    const limit = Number(topN) || 10;

    for (const candidate of ranked) {
      if (selected.length >= limit) break;
      const candidateId = String(candidate.herb?._id || '');
      if (!candidateId) continue;

      let blockedConflict = null;
      for (const pickedId of selectedIds) {
        const key = HerbController.pairKey(candidateId, pickedId);
        const pairConflicts = conflictByPair.get(key) || [];
        const severe = pairConflicts.find((item) =>
          ['major', 'contraindicated'].includes(String(item?.severity || '').toLowerCase())
        );
        if (severe) {
          blockedConflict = { severe, pickedId };
          break;
        }
      }

      if (blockedConflict) {
        const severe = blockedConflict.severe;
        const severeLeftId = String(severe?.herbId?._id || severe?.herbId || '');
        const withHerbId = String(
          severeLeftId === candidateId
            ? severe?.interactsWith?.herbId?._id || severe?.interactsWith?.herbId || blockedConflict.pickedId
            : severe?.herbId?._id || severe?.herbId || blockedConflict.pickedId
        );
        excluded.push({
          interactionId: severe?._id || null,
          excludedHerbId: candidateId,
          conflictsWithHerbId: withHerbId,
          severity: severe?.severity || 'unknown',
          effect: severe?.effect || '',
          recommendation: severe?.recommendation || '',
        });
        continue;
      }

      selected.push(candidate);
      selectedIds.add(candidateId);
    }

    return { selected, excluded };
  }

  static async recordRecommendationIfEnabled({
    req,
    shouldRecord,
    normalizedSymptoms,
    userProfile,
    rankingSource,
    redFlags,
    excluded,
    results,
  }) {
    if (!shouldRecord || !req.user?._id) return;

    const normalizedGender = ['male', 'female'].includes(String(userProfile?.gender || '').toLowerCase())
      ? String(userProfile.gender).toLowerCase()
      : undefined;

    await Recommendation.create({
      user: req.user._id,
      symptoms: normalizedSymptoms,
      age: userProfile?.age,
      gender: normalizedGender,
      additionalInfo: {
        medications: userProfile?.medications || [],
        allergies: userProfile?.allergies || [],
        conditions: userProfile?.conditions || [],
      },
      recommendations: (results || []).map((entry) => ({
        herb: entry?.herb?._id,
        confidence: HerbController.normalizeRecommendationConfidence(entry?.score),
        reasoning: rankingSource === 'recommendation-engine'
          ? 'Ranked by recommendation engine after safety checks.'
          : 'Ranked by heuristic after safety checks.',
        warnings: entry?.warnings || [],
      })),
      mlModel: {
        version: rankingSource || 'unknown',
        confidence: null,
        processingTime: null,
      },
      status: redFlags?.length ? 'pending' : 'completed',
      isActive: true,
    });
  }

  /**
   * Get all herbs with pagination and filtering
   */
  static async getHerbs(req, res) {
    try {
      let favoriteHerbIds = [];
      if (req.user?._id) {
        const currentUser = await User.findById(req.user._id)
          .select('profile.favoriteHerbs')
          .lean();
        favoriteHerbIds = Array.isArray(currentUser?.profile?.favoriteHerbs)
          ? currentUser.profile.favoriteHerbs
          : [];
      }

      const result = await HerbService.getHerbs({
        ...req.query,
        favoriteHerbIds,
      });
      res.set('X-Herb-List-Cache', result?.cache?.hit ? 'HIT' : 'MISS');
      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Herbs retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching herbs:', error);
      res.status(500).json(formatError('Failed to fetch herbs', error.message));
    }
  }

  /**
   * Search herbs
   */
  static async searchHerbs(req, res) {
    try {
      const { q, page = 1, limit = 20, category } = req.query;

      if (!q || !validateSearchQuery(q)) {
        return res.status(400).json(formatError('Valid search query is required', 400));
      }

      const result = await HerbService.searchHerbs(q, { page, limit, category });
      res.set('X-Herb-Search-Cache', result?.cache?.hit ? 'HIT' : 'MISS');

      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Herbs search completed'
      ));
    } catch (error) {
      logger.error('Error searching herbs:', error);
      res.status(500).json(formatError('Failed to search herbs', error.message));
    }
  }

  /**
   * Get herb by ID
   */
  static async getHerbById(req, res) {
    try {
      const { id } = req.params;

      const herb = await HerbService.getHerbById(id);

      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }

      res.json(formatSuccess(herb, 'Herb retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching herb:', error);
      res.status(500).json(formatError('Failed to fetch herb', error.message));
    }
  }

  static async getHerbCacheMetrics(req, res) {
    try {
      const metrics = HerbService.getHerbQueryCacheMetrics();
      return res.json(formatSuccess(metrics, 'Herb query cache metrics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching herb cache metrics:', error);
      return res.status(500).json(formatError('Failed to fetch herb cache metrics', error.message));
    }
  }

  static async uploadHerbImages(req, res) {
    try {
      const { id } = req.params;
      const herb = await Herb.findOne({ _id: id });

      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }

      const files = Array.isArray(req.files) ? req.files : [];
      if (files.length === 0) {
        return res.status(400).json(formatError('No images uploaded', 400));
      }

      const scientificName = String(req.body?.scientificName || herb.scientificName || herb.name || '').trim();
      const uploaded = [];

      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const url = await imageService.uploadHerbImage(file, scientificName || herb._id);
        uploaded.push({
          url,
          caption: `${herb.name || herb.scientificName || 'Herb'} image`,
          isPrimary: false,
        });
      }

      const existingImages = Array.isArray(herb.images) ? herb.images : [];
      const hasPrimary = existingImages.some((image) => image?.isPrimary);
      if (!hasPrimary && uploaded.length > 0) {
        uploaded[0].isPrimary = true;
      }

      herb.images = [...existingImages, ...uploaded];
      await herb.save();

      clearCache('/api/herbs');
      clearCache(`/api/herbs/${id}`);
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      return res.json(formatSuccess(uploaded, 'Herb images uploaded successfully'));
    } catch (error) {
      logger.error('Error uploading herb images:', error);
      return res.status(500).json(formatError('Failed to upload herb images', 500, error.message));
    }
  }

  static async deleteHerbImages(req, res) {
    try {
      const { id } = req.params;
      const imageUrls = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls : [];

      if (imageUrls.length === 0) {
        return res.status(400).json(formatError('imageUrls array is required', 400));
      }

      const herb = await Herb.findOne({ _id: id });
      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }

      const before = Array.isArray(herb.images) ? herb.images : [];
      const toDelete = before.filter((image) => imageUrls.includes(image?.url));
      const remaining = before.filter((image) => !imageUrls.includes(image?.url));

      if (toDelete.length === 0) {
        return res.json(formatSuccess({ removed: 0 }, 'No matching images found'));
      }

      for (const image of toDelete) {
        // eslint-disable-next-line no-await-in-loop
        await imageService.deleteImage(image.url);
      }

      if (remaining.length > 0 && !remaining.some((image) => image?.isPrimary)) {
        remaining[0].isPrimary = true;
      }

      herb.images = remaining;
      await herb.save();

      clearCache('/api/herbs');
      clearCache(`/api/herbs/${id}`);
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      return res.json(formatSuccess({ removed: toDelete.length }, 'Herb images deleted successfully'));
    } catch (error) {
      logger.error('Error deleting herb images:', error);
      return res.status(500).json(formatError('Failed to delete herb images', 500, error.message));
    }
  }

  /**
   * Create new herb
   */
  static async createHerb(req, res) {
    try {
      const herbData = req.body;
      const images = req.files || [];
      const userId = req.user?.id || req.user?._id; // Get authenticated user ID

      const herb = await HerbService.createHerb(herbData, images, userId);

      // Clear relevant caches
      clearCache('/api/herbs');
      clearCache('/api/herbs/search');
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      res.status(201).json(formatSuccess(herb, 'Herb created successfully'));
    } catch (error) {
      logger.error('Error creating herb:', error);
      res.status(500).json(formatError('Failed to create herb', error.message));
    }
  }

  /**
   * Update herb
   */
  static async updateHerb(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const images = req.files || [];


      const herb = await HerbService.updateHerb(id, updateData, images);

      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }

      // Clear relevant caches
      clearCache('/api/herbs');
      clearCache('/api/herbs/search');
      clearCache(`/api/herbs/${id}`);
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      res.json(formatSuccess(herb, 'Herb updated successfully'));
    } catch (error) {
      logger.error('Error updating herb:', error);
      res.status(500).json(formatError('Failed to update herb', error.message));
    }
  }

  /**
   * Update herb status
   */
  static async updateHerbStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, isActive } = req.body;

      // Handle both status (string) and isActive (boolean) from frontend
      const statusValue = status !== undefined ? status : (isActive ? 'active' : 'inactive');

      const herb = await HerbService.updateHerbStatus(id, statusValue);

      if (!herb) {
        return res.status(404).json(formatError('Herb not found', 404));
      }

      // Clear relevant caches
      clearCache('/api/herbs');
      clearCache('/api/herbs/search');
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      res.json(formatSuccess(herb, `Herb status updated to ${statusValue}`));
    } catch (error) {
      logger.error('Error updating herb status:', error);
      res.status(500).json(formatError('Failed to update herb status', error.message));
    }
  }

  /**
   * Bulk update herb status
   */
  static async bulkUpdateHerbStatus(req, res) {
    try {
      const { ids, status, isActive } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json(formatError('Herb IDs array is required', 400));
      }

      // Handle both status (string) and isActive (boolean) from frontend
      const statusValue = status !== undefined ? status : (isActive ? 'active' : 'inactive');

      const result = await HerbService.bulkUpdateHerbStatus(ids, statusValue);

      // Clear relevant caches
      clearCache('/api/herbs');
      clearCache('/api/herbs/search');
      HerbService.clearHerbQueryCaches();
      clearRecommendationCache();

      res.json(formatSuccess(result, `${result.modifiedCount} herbs updated to ${statusValue}`));
    } catch (error) {
      logger.error('Error bulk updating herb status:', error);
      res.status(500).json(formatError('Failed to bulk update herb status', error.message));
    }
  }

  /**
   * Get herbs by symptom
   */
  static async getHerbsBySymptom(req, res) {
    try {
      const { symptom } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await HerbService.getHerbsBySymptom(symptom, { page, limit });

      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        `Herbs for ${symptom} retrieved successfully`
      ));
    } catch (error) {
      logger.error('Error fetching herbs by symptom:', error);
      res.status(500).json(formatError('Failed to fetch herbs by symptom', error.message));
    }
  }

  /**
   * Get herbs by category
   */
  static async getHerbsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await HerbService.getHerbsByCategory(category, { page, limit });

      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        `Herbs in ${category} retrieved successfully`
      ));
    } catch (error) {
      logger.error('Error fetching herbs by category:', error);
      res.status(500).json(formatError('Failed to fetch herbs by category', error.message));
    }
  }

  /**
   * Get favorite herbs for user - REMOVED
   */
  // static async getFavoriteHerbs(req, res) {
  //   try {
  //     const userId = req.user._id;
  //     const { page = 1, limit = 20 } = req.query;

  //     const result = await HerbService.getFavoriteHerbs(userId, { page, limit });

  //     res.json(formatPaginatedResponse(
  //       result.herbs,
  //       result.pagination.currentPage,
  //       result.pagination.itemsPerPage,
  //       result.pagination.totalItems,
  //       'Favorite herbs retrieved successfully'
  //     ));
  //   } catch (error) {
  //     logger.error('Error fetching favorite herbs:', error);
  //     res.status(500).json(formatError('Failed to fetch favorite herbs', error.message));
  //   }
  // }

  /**
   * Get recent herbs
   */
  static async getRecentHerbs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await HerbService.getRecentHerbs({ page, limit });

      res.json(formatPaginatedResponse(
        result.herbs,
        result.pagination.currentPage,
        result.pagination.itemsPerPage,
        result.pagination.totalItems,
        'Recent herbs retrieved successfully'
      ));
    } catch (error) {
      logger.error('Error fetching recent herbs:', error);
      res.status(500).json(formatError('Failed to fetch recent herbs', error.message));
    }
  }

  /**
   * Compare two herbs side-by-side
   */
  static async compareHerbs(req, res) {
    try {
      const {
        herb1,
        herb2,
        symptom = '',
        ageGroup = 'adult',
        includeSafety = 'false',
      } = req.query;

      if (!herb1 || !herb2) {
        return res.status(400).json(formatError('herb1 and herb2 query params are required', 400));
      }

      const comparison = await HerbComparisonService.compare({
        herb1,
        herb2,
        symptom,
        ageGroup,
        includeSafety: ['true', '1', 'yes'].includes(String(includeSafety).toLowerCase()),
      });

      res.json(formatSuccess(comparison, 'Herb comparison retrieved successfully'));
    } catch (error) {
      logger.error('Error comparing herbs:', error);
      const statusCode = error.message?.includes('required') || error.message?.includes('different') ? 400 : 500;
      res.status(statusCode).json(formatError('Failed to compare herbs', statusCode, error.message));
    }
  }

  static async recommendHerbs(req, res) {
    try {
      const {
        symptoms = [],
        userProfile = {},
        topN = 10,
        recordRecommendation = true,
        candidateCap,
      } = req.body || {};

      if (!Array.isArray(symptoms) || symptoms.length === 0) {
        return res.status(400).json(formatError('symptoms array is required', 400));
      }

      const normalizedSymptoms = symptoms.map((item) => String(item).trim()).filter(Boolean);
      if (normalizedSymptoms.length === 0) {
        return res.status(400).json(formatError('symptoms array is required', 400));
      }

      const capOverride = Number(candidateCap);
      const baseCandidateCap = Number.isFinite(capOverride) && capOverride > 0
        ? capOverride
        : (Number.isFinite(MAX_RECOMMENDATION_CANDIDATES) && MAX_RECOMMENDATION_CANDIDATES > 0
          ? MAX_RECOMMENDATION_CANDIDATES
          : 50);
      const cacheKey = makeRecommendationCacheKey(normalizedSymptoms, userProfile, topN, baseCandidateCap);

      const redFlags = await Symptom.checkRedFlags(normalizedSymptoms);
      if (redFlags.length > 0) {
        const blockedResponse = {
          status: 'blocked_red_flag',
          redFlags,
          rankingSource: 'none',
          excluded: {
            contraindications: [],
            drugInteractions: [],
            combinationConflicts: [],
          },
          results: [],
          message: 'Recommendations are blocked because at least one red-flag symptom requires medical attention.',
        };

        try {
          await HerbController.recordRecommendationIfEnabled({
            req,
            shouldRecord: Boolean(recordRecommendation),
            normalizedSymptoms,
            userProfile,
            rankingSource: 'none',
            redFlags,
            excluded: blockedResponse.excluded,
            results: [],
          });
        } catch (recordError) {
          logger.warn(`Failed to record blocked recommendation request: ${recordError.message}`);
        }

        return res.json(formatSuccess(blockedResponse, 'Recommendation blocked due to red-flag symptoms'));
      }

      const cached = readRecommendationCache(cacheKey);
      if (cached) {
        try {
          await HerbController.recordRecommendationIfEnabled({
            req,
            shouldRecord: Boolean(recordRecommendation),
            normalizedSymptoms,
            userProfile,
            rankingSource: cached.rankingSource || 'unknown',
            redFlags: cached.redFlags || [],
            excluded: cached.excluded || {
              contraindications: [],
              drugInteractions: [],
              combinationConflicts: [],
            },
            results: cached.results || [],
          });
        } catch (recordError) {
          logger.warn(`Failed to record recommendation request: ${recordError.message}`);
        }

        return res.json(formatSuccess(cached, 'Recommendations generated successfully'));
      }

      const initialCandidates = await Herb.findBySymptoms(normalizedSymptoms);

      if (initialCandidates.length === 0) {
        const emptyPayload = {
          redFlags,
          status: 'no_matches',
          rankingSource: 'none',
          results: [],
          excluded: { contraindications: [], drugInteractions: [], combinationConflicts: [] },
        };
        writeRecommendationCache(cacheKey, emptyPayload);
        return res.json(formatSuccess(emptyPayload, 'No matching herbs found'));
      }

      const candidatePool = initialCandidates
        .map((herb) => ({
          herb,
          overlapScore: HerbController.scoreBySymptomOverlap(herb, normalizedSymptoms),
        }))
        .sort((a, b) => b.overlapScore - a.overlapScore)
        .slice(0, Math.max(1, Math.min(baseCandidateCap, initialCandidates.length)))
        .map((entry) => entry.herb);

      const [contraHerbIds, drugHerbIds] = await Promise.all([
        Contraindication.getAbsolutelyContraindicated(userProfile.conditions || []),
        HerbInteraction.getDangerousHerbsForDrugs(userProfile.medications || []),
      ]);

      const excludedSet = new Set([...contraHerbIds, ...drugHerbIds].map(String));
      const filteredCandidates = candidatePool.filter((herb) => !excludedSet.has(String(herb._id)));

      const safeCandidateIds = await Herb.filterSafeForUser(
        filteredCandidates.map((item) => item._id),
        userProfile,
      );
      const safeIds = new Set(safeCandidateIds.map((item) => String(item._id)));
      const passFastFilter = filteredCandidates.filter((item) => safeIds.has(String(item._id)));

      const assessed = await Promise.all(passFastFilter.map(async (herb) => {
        const safety = await HerbSafety.assessForUser(herb._id, userProfile);
        return { herb, safety };
      }));

      const deepSafe = assessed.filter((item) => item.safety?.safe);
      const engine = await HerbController.tryRecommendationEngine(deepSafe.map((item) => item.herb), userProfile);

      const ranked = deepSafe.map((item) => {
        const key = String(item.herb._id);
        const ml = engine.scores.get(key);
        const heuristicScore = HerbController.scoreBySymptomOverlap(item.herb, normalizedSymptoms);
        return {
          herb: item.herb,
          warnings: item.safety?.warnings || [],
          blockers: item.safety?.blockers || [],
          predicted_rating: ml?.predicted_rating ?? null,
          predicted_effectiveness: ml?.predicted_effectiveness ?? null,
          score: ml?.score ?? heuristicScore,
        };
      }).sort((a, b) => b.score - a.score);

      const topCandidateIds = ranked.map((item) => item.herb?._id).filter(Boolean);
      const combinationConflicts = await HerbInteraction.checkCombination(topCandidateIds);
      const { selected: limited, excluded: combinationExcluded } = HerbController.applyCombinationSafetyFilter(
        ranked,
        combinationConflicts,
        topN,
      );

      const limitedHerbIds = limited.map((item) => item.herb?._id).filter(Boolean);
      const [contraindicationsBatch, drugInteractionsBatch] = await Promise.all([
        typeof Contraindication.checkForUserBulk === 'function'
          ? Contraindication.checkForUserBulk(limitedHerbIds, userProfile.conditions || [])
          : Promise.all(
            limitedHerbIds.map((herbId) => Contraindication.checkForUser(herbId, userProfile.conditions || []))
          ).then((rows) => rows.flat()),
        typeof HerbInteraction.checkDrugsBulk === 'function'
          ? HerbInteraction.checkDrugsBulk(limitedHerbIds, userProfile.medications || [])
          : Promise.all(
            limitedHerbIds.map((herbId) => HerbInteraction.checkDrugs(herbId, userProfile.medications || []))
          ).then((rows) => rows.flat()),
      ]);

      const contraindicationsByHerbId = contraindicationsBatch.reduce((acc, record) => {
        const key = String(record.herbId);
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
      }, {});

      const drugInteractionsByHerbId = drugInteractionsBatch.reduce((acc, record) => {
        const key = String(record.herbId);
        if (!acc[key]) acc[key] = [];
        acc[key].push(record);
        return acc;
      }, {});

      const enriched = limited.map((item) => {
        const herbIdKey = String(item.herb._id);
        const dynamicReasoning = HerbController.generateDynamicReasoning(item.herb, normalizedSymptoms, userProfile);

        return {
          herb: {
            _id: item.herb._id,
            slug: item.herb.slug,
            name: item.herb.name,
            scientificName: item.herb.scientificName,
            description: item.herb.description,
            symptoms: item.herb.symptoms || [],
            properties: item.herb.properties || [],
            phytochemicals: item.herb.phytochemicals || [],
            images: item.herb.images || [],
          },
          score: item.score,
          predictedRating: item.predicted_rating,
          predictedEffectiveness: item.predicted_effectiveness,
          warnings: item.warnings,
          reasoning: dynamicReasoning,
          contraindications: contraindicationsByHerbId[herbIdKey] || [],
          drugInteractions: drugInteractionsByHerbId[herbIdKey] || [],
        };
      });

      const payload = {
        redFlags,
        status: 'ok',
        rankingSource: engine.available ? 'recommendation-engine' : 'heuristic',
        safetyPolicy: {
          redFlagHardStop: true,
          comboAutoFilter: true,
        },
        excluded: {
          contraindications: [...new Set(contraHerbIds.map(String))],
          drugInteractions: [...new Set(drugHerbIds.map(String))],
          combinationConflicts: combinationExcluded,
        },
        results: enriched,
      };

      writeRecommendationCache(cacheKey, payload);

      try {
        await HerbController.recordRecommendationIfEnabled({
          req,
          shouldRecord: Boolean(recordRecommendation),
          normalizedSymptoms,
          userProfile,
          rankingSource: payload.rankingSource,
          redFlags,
          excluded: payload.excluded,
          results: payload.results,
        });
      } catch (recordError) {
        logger.warn(`Failed to record recommendation request: ${recordError.message}`);
      }

      return res.json(formatSuccess(payload, 'Recommendations generated successfully'));
    } catch (error) {
      logger.error('Error generating recommendations:', error);
      return res.status(500).json(formatError('Failed to generate recommendations', 500, error.message));
    }
  }

  static async assessHerbSafety(req, res) {
    try {
      const { id } = req.params;
      const { userProfile = {} } = req.body || {};
      const herbId = await HerbController.resolveHerbIdentifier(id);
      const assessment = await HerbSafety.assessForUser(herbId, userProfile);
      return res.json(formatSuccess(assessment, 'Herb safety assessment completed'));
    } catch (error) {
      logger.error('Error assessing herb safety:', error);
      return res.status(500).json(formatError('Failed to assess herb safety', 500, error.message));
    }
  }

  static async getHerbInteractions(req, res) {
    try {
      const { id } = req.params;
      const { type, minSeverity, medications } = req.body || {};
      const herbId = await HerbController.resolveHerbIdentifier(id);

      const [allInteractions, matchedDrugInteractions] = await Promise.all([
        HerbInteraction.findByHerb(herbId, { type, minSeverity }),
        HerbInteraction.checkDrugs(herbId, Array.isArray(medications) ? medications : []),
      ]);

      return res.json(formatSuccess({
        all: allInteractions,
        matchedDrugs: matchedDrugInteractions,
      }, 'Herb interactions retrieved successfully'));
    } catch (error) {
      logger.error('Error loading herb interactions:', error);
      return res.status(500).json(formatError('Failed to load herb interactions', 500, error.message));
    }
  }

  static async checkHerbCombination(req, res) {
    try {
      const { herbIds = [] } = req.body || {};
      if (!Array.isArray(herbIds) || herbIds.length < 2) {
        return res.status(400).json(formatError('herbIds with at least two herbs is required', 400));
      }

      const interactions = await HerbInteraction.checkCombination(herbIds);
      return res.json(formatSuccess(interactions, 'Herb combination check completed'));
    } catch (error) {
      logger.error('Error checking herb combination:', error);
      return res.status(500).json(formatError('Failed to check herb combination', 500, error.message));
    }
  }

  static async getHerbContraindications(req, res) {
    try {
      const { id } = req.params;
      const { conditions = [] } = req.body || {};
      const herbId = await HerbController.resolveHerbIdentifier(id);

      let records = [];
      if (Array.isArray(conditions) && conditions.length > 0) {
        records = await Contraindication.checkForUser(herbId, conditions);
      } else {
        records = await Contraindication.find({ herbId, isActive: true })
          .populate('alternatives', 'name scientificName slug')
          .populate('causativeCompound', 'name category');
      }

      return res.json(formatSuccess(records, 'Herb contraindications retrieved successfully'));
    } catch (error) {
      logger.error('Error loading contraindications:', error);
      return res.status(500).json(formatError('Failed to load contraindications', 500, error.message));
    }
  }

  /**
   * Get herb statistics (public)
   */
  static async getHerbStats(req, res) {
    try {
      const total = await require('../models/Herb').countDocuments({ isActive: true });
      res.json(formatSuccess({ herbs: total }, 'Herb statistics retrieved successfully'));
    } catch (error) {
      logger.error('Error fetching herb stats:', error);
      res.status(500).json(formatError('Failed to fetch herb statistics', error.message));
    }
  }
}

module.exports = HerbController;
