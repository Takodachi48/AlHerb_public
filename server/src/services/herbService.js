const Herb = require('../models/Herb');
const Phytochemical = require('../models/Phytochemical');
const SearchService = require('./searchService');
const cache = require('../config/cache');
const crypto = require('crypto');
const { cloudinary, CLOUDINARY_FOLDERS, TRANSFORMATIONS } = require('../config/cloudinary');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

/**
 * Herb Service Layer
 * Handles all herb business logic separated from routes
 */

class HerbService {
  static HERB_LIST_CACHE_TTL_SECONDS = 45;
  static HERB_LIST_CACHE_PREFIX = 'herb_list:v2:';
  static HERB_SEARCH_CACHE_TTL_SECONDS = 45;
  static HERB_SEARCH_CACHE_PREFIX = 'herb_search:v1:';
  static HERB_CACHE_METRICS = {
    list: { hit: 0, miss: 0 },
    search: { hit: 0, miss: 0 },
    invalidations: 0,
  };
  static LIST_FIELDS = 'name slug scientificName commonNames description symptoms properties images safetyProfile isFeatured';
  static LIST_PROJECTION = {
    name: 1,
    slug: 1,
    scientificName: 1,
    commonNames: 1,
    description: 1,
    symptoms: 1,
    properties: 1,
    images: 1,
    safetyProfile: 1,
    isFeatured: 1,
  };
  static MALE_CONDITION_REGEX = /(male|men|man|prostate|testosterone|erectile|seminal)/i;

  static escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static buildTokenizedSearchClauses(search = '', fields = []) {
    const tokens = String(search || '')
      .trim()
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0);

    return tokens.map((token) => {
      const tokenRegex = new RegExp(HerbService.escapeRegex(token), 'i');
      return {
        $or: fields.map((field) => ({ [field]: tokenRegex })),
      };
    });
  }

  static buildFavoriteSignature(ids = []) {
    if (!Array.isArray(ids) || ids.length === 0) return 'none';
    const normalized = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean))).sort();
    return crypto.createHash('sha1').update(normalized.join(',')).digest('hex');
  }

  static buildHerbListCacheKey(options = {}) {
    const payload = [
      Number.parseInt(options.page, 10) || 1,
      Number.parseInt(options.limit, 10) || 20,
      String(options.search || '').trim().toLowerCase(),
      String(options.category || 'all').trim().toLowerCase(),
      String(options.gender || 'all').trim().toLowerCase(),
      String(options.safety || 'all').trim().toLowerCase(),
      String(options.status || 'active').trim().toLowerCase(),
      this.buildFavoriteSignature(options.favoriteHerbIds || []),
    ];
    return `${HerbService.HERB_LIST_CACHE_PREFIX}${payload.join('|')}`;
  }

  static clearHerbListCache() {
    const keys = cache.keys().filter((key) => key.startsWith(HerbService.HERB_LIST_CACHE_PREFIX));
    if (keys.length > 0) {
      cache.del(keys);
    }
  }

  static buildHerbSearchCacheKey(query, options = {}) {
    const payload = [
      String(query || '').trim().toLowerCase(),
      Number.parseInt(options.page, 10) || 1,
      Number.parseInt(options.limit, 10) || 20,
      String(options.category || 'all').trim().toLowerCase(),
    ];
    return `${HerbService.HERB_SEARCH_CACHE_PREFIX}${payload.join('|')}`;
  }

  static clearHerbSearchCache() {
    const keys = cache.keys().filter((key) => key.startsWith(HerbService.HERB_SEARCH_CACHE_PREFIX));
    if (keys.length > 0) {
      cache.del(keys);
    }
  }

  static clearHerbQueryCaches() {
    HerbService.clearHerbListCache();
    HerbService.clearHerbSearchCache();
    HerbService.HERB_CACHE_METRICS.invalidations += 1;
  }

  static getHerbQueryCacheMetrics() {
    const listKeyCount = cache.keys().filter((key) => key.startsWith(HerbService.HERB_LIST_CACHE_PREFIX)).length;
    const searchKeyCount = cache.keys().filter((key) => key.startsWith(HerbService.HERB_SEARCH_CACHE_PREFIX)).length;
    return {
      list: { ...HerbService.HERB_CACHE_METRICS.list, keys: listKeyCount, ttlSeconds: HerbService.HERB_LIST_CACHE_TTL_SECONDS },
      search: { ...HerbService.HERB_CACHE_METRICS.search, keys: searchKeyCount, ttlSeconds: HerbService.HERB_SEARCH_CACHE_TTL_SECONDS },
      invalidations: HerbService.HERB_CACHE_METRICS.invalidations,
    };
  }

  static async resolvePhytochemicals(phytochemicals = []) {
    if (!Array.isArray(phytochemicals)) return [];

    const pendingByName = new Map();
    const pending = [];
    const resolved = [];

    for (const entry of phytochemicals) {
      if (!entry) continue;

      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!pendingByName.has(key)) {
          pendingByName.set(key, {
            name,
            category: 'other',
            description: undefined,
            effects: [],
          });
        }
        pending.push({ key, concentration: '', partSource: '' });
        continue;
      }

      const concentration = entry.concentration || '';
      const partSource = entry.partSource || '';

      if (entry.compound && typeof entry.compound === 'object' && entry.compound._id) {
        resolved.push({ compound: entry.compound._id, concentration, partSource });
        continue;
      }

      if (entry.compound) {
        resolved.push({ compound: entry.compound, concentration, partSource });
        continue;
      }

      if (entry.name && String(entry.name).trim()) {
        const name = String(entry.name).trim();
        const key = name.toLowerCase();
        if (!pendingByName.has(key)) {
          pendingByName.set(key, {
            name,
            category: entry.category || 'other',
            description: entry.description || undefined,
            effects: Array.isArray(entry.benefits) ? entry.benefits : [],
          });
        }
        pending.push({ key, concentration, partSource });
      }
    }

    if (pendingByName.size === 0) {
      return resolved;
    }

    const lookupNames = Array.from(pendingByName.values()).map((item) => item.name);
    const fetchActiveByName = async () => (
      Phytochemical.find({ isActive: true, name: { $in: lookupNames } })
        .select('_id name')
        .collation({ locale: 'en', strength: 2 })
        .lean()
    );

    let found = await fetchActiveByName();
    let foundByName = new Map(found.map((item) => [String(item.name).toLowerCase(), item]));

    const missing = Array.from(pendingByName.values()).filter((item) => !foundByName.has(item.name.toLowerCase()));
    if (missing.length > 0) {
      try {
        await Phytochemical.insertMany(
          missing.map((item) => ({
            name: item.name,
            category: item.category,
            description: item.description,
            effects: item.effects,
            isActive: true,
          })),
          { ordered: false },
        );
      } catch (error) {
        // Duplicate-key races are expected under concurrent creates; re-query below.
      }

      found = await fetchActiveByName();
      foundByName = new Map(found.map((item) => [String(item.name).toLowerCase(), item]));
    }

    for (const item of pending) {
      const compound = foundByName.get(item.key);
      if (!compound?._id) continue;
      resolved.push({
        compound: compound._id,
        concentration: item.concentration,
        partSource: item.partSource,
      });
    }

    return resolved;
  }

  static normalizeHerbImages(images = []) {
    const normalized = (Array.isArray(images) ? images : [])
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') {
          const url = image.trim();
          return url ? { url, caption: '', isPrimary: false } : null;
        }

        const url = String(image.url || '').trim();
        if (!url) return null;
        return {
          url,
          caption: String(image.caption || image.name || '').trim(),
          isPrimary: Boolean(image.isPrimary),
        };
      })
      .filter(Boolean);

    if (normalized.length === 0) return [];

    const primaryIndex = normalized.findIndex((image) => image.isPrimary);
    const selectedIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return normalized.map((image, index) => ({
      ...image,
      isPrimary: index === selectedIndex,
    }));
  }

  /**
   * Get all herbs with pagination and filtering
   */
  static async getHerbs(options = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      gender = 'all',
      safety = 'all',
      favoriteHerbIds = [],
      status = 'active'
    } = options;

    const query = {};
    const cacheKey = HerbService.buildHerbListCacheKey(options);
    const cached = cache.get(cacheKey);
    if (cached) {
      HerbService.HERB_CACHE_METRICS.list.hit += 1;
      return {
        ...cached,
        cache: { scope: 'list', hit: true },
      };
    }
    HerbService.HERB_CACHE_METRICS.list.miss += 1;

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Search filter: tokenized partial matching (works for partial words, not just full-text terms)
    if (search) {
      const clauses = HerbService.buildTokenizedSearchClauses(search, [
        'name',
        'scientificName',
        'commonNames',
        'description',
        'symptoms',
        'properties',
      ]);
      if (clauses.length > 0) {
        query.$and = [...(query.$and || []), ...clauses];
      }
    }

    const activeGender = String(gender || 'all').toLowerCase();
    const activeSafety = String(safety || 'all').toLowerCase();

    if (activeSafety !== 'all') {
      if (activeGender === 'male') {
        query.$or = [
          { 'safetyProfile.male': activeSafety },
          {
            'safetyProfile.medicalConditions': {
              $elemMatch: {
                condition: { $regex: HerbService.MALE_CONDITION_REGEX },
                recommendation: activeSafety,
              },
            },
          },
        ];
      } else if (activeGender === 'female') {
        query.$or = [
          { 'safetyProfile.female': activeSafety },
          { 'safetyProfile.pregnancy': activeSafety },
          { 'safetyProfile.breastfeeding': activeSafety },
        ];
      } else {
        query.$or = [
          { 'safetyProfile.male': activeSafety },
          { 'safetyProfile.female': activeSafety },
          { 'safetyProfile.pregnancy': activeSafety },
          { 'safetyProfile.breastfeeding': activeSafety },
          {
            'safetyProfile.medicalConditions': {
              $elemMatch: {
                condition: { $regex: HerbService.MALE_CONDITION_REGEX },
                recommendation: activeSafety,
              },
            },
          },
        ];
      }
    } else if (activeGender === 'male') {
      // Gender-only filtering should still exclude entries explicitly marked as unsuitable.
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { 'safetyProfile.male': { $exists: false } },
            { 'safetyProfile.male': null },
            { 'safetyProfile.male': { $ne: 'avoid' } },
          ],
        },
        {
          'safetyProfile.medicalConditions': {
            $not: {
              $elemMatch: {
                condition: { $regex: HerbService.MALE_CONDITION_REGEX },
                recommendation: 'avoid',
              },
            },
          },
        },
      ];
    } else if (activeGender === 'female') {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { 'safetyProfile.female': { $exists: false } },
            { 'safetyProfile.female': null },
            { 'safetyProfile.female': { $ne: 'avoid' } },
          ],
        },
        {
          $or: [
            { 'safetyProfile.pregnancy': { $exists: false } },
            { 'safetyProfile.pregnancy': null },
            { 'safetyProfile.pregnancy': { $ne: 'avoid' } },
          ],
        },
        {
          $or: [
            { 'safetyProfile.breastfeeding': { $exists: false } },
            { 'safetyProfile.breastfeeding': null },
            { 'safetyProfile.breastfeeding': { $ne: 'avoid' } },
          ],
        },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const normalizedFavoriteIds = Array.isArray(favoriteHerbIds)
      ? Array.from(new Set(favoriteHerbIds.map((id) => String(id).trim()).filter(Boolean)))
      : [];

    let herbs = [];
    let total = 0;

    if (normalizedFavoriteIds.length > 0) {
      const [result] = await Herb.aggregate([
        { $match: query },
        { $addFields: { isFavorite: { $in: ['$_id', normalizedFavoriteIds] } } },
        { $sort: { isFavorite: -1, isFeatured: -1, name: 1 } },
        {
          $facet: {
            items: [
              { $skip: skip },
              { $limit: limitNum },
              { $project: HerbService.LIST_PROJECTION },
            ],
            meta: [{ $count: 'total' }],
          },
        },
      ]);

      herbs = result?.items || [];
      total = result?.meta?.[0]?.total || 0;
    } else {
      [herbs, total] = await Promise.all([
        Herb.find(query)
          .select(HerbService.LIST_FIELDS)
          .sort({ isFeatured: -1, name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Herb.countDocuments(query),
      ]);
    }

    const response = {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
    cache.set(cacheKey, response, HerbService.HERB_LIST_CACHE_TTL_SECONDS);
    return {
      ...response,
      cache: { scope: 'list', hit: false },
    };
  }

  /**
   * Search herbs
   */
  static async searchHerbs(query, options = {}) {
    const {
      page = 1,
      limit = 20,
      category
    } = options;

    if (!query || !query.trim()) {
      throw new Error('Valid search query is required');
    }

    const cacheKey = HerbService.buildHerbSearchCacheKey(query, options);
    const cached = cache.get(cacheKey);
    if (cached) {
      HerbService.HERB_CACHE_METRICS.search.hit += 1;
      return {
        ...cached,
        cache: { scope: 'search', hit: true },
      };
    }
    HerbService.HERB_CACHE_METRICS.search.miss += 1;

    const meiliResult = await SearchService.searchHerbIds(query, {
      page,
      limit,
      category,
      status: 'active',
    }).catch(() => null);

    if (meiliResult && Array.isArray(meiliResult.ids) && meiliResult.ids.length > 0) {
      const herbs = await Herb.find({ _id: { $in: meiliResult.ids } })
        .select(HerbService.LIST_FIELDS)
        .lean();

      const order = new Map(meiliResult.ids.map((id, idx) => [String(id), idx]));
      herbs.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));

      const response = {
        herbs,
        pagination: {
          currentPage: meiliResult.page,
          totalPages: Math.ceil(meiliResult.total / meiliResult.limit),
          totalItems: meiliResult.total,
          itemsPerPage: meiliResult.limit,
          hasNextPage: meiliResult.page < Math.ceil(meiliResult.total / meiliResult.limit),
          hasPrevPage: meiliResult.page > 1,
          nextPage: meiliResult.page < Math.ceil(meiliResult.total / meiliResult.limit) ? meiliResult.page + 1 : null,
          prevPage: meiliResult.page > 1 ? meiliResult.page - 1 : null
        }
      };
      cache.set(cacheKey, response, HerbService.HERB_SEARCH_CACHE_TTL_SECONDS);
      return {
        ...response,
        cache: { scope: 'search', hit: false },
      };
    }

    const clauses = HerbService.buildTokenizedSearchClauses(query, [
      'name',
      'scientificName',
      'commonNames',
      'description',
      'symptoms',
      'properties',
    ]);
    let searchQuery = { isActive: true };
    if (clauses.length > 0) {
      searchQuery.$and = clauses;
    }

    // Category filter
    if (category && category !== 'all') {
      searchQuery.category = category;
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(searchQuery)
        .select(HerbService.LIST_FIELDS)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Herb.countDocuments(searchQuery)
    ]);

    const response = {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
    cache.set(cacheKey, response, HerbService.HERB_SEARCH_CACHE_TTL_SECONDS);
    return {
      ...response,
      cache: { scope: 'search', hit: false },
    };
  }

  /**
   * Get herb by ID
   */
  static async getHerbById(id) {
    // Try by _id first, then by slug for compatibility
    let herb = await Herb.findOne({ _id: id })
      .populate('phytochemicals.compound', 'name category effects')
      .lean();
    
    // If not found by ID, try by slug
    if (!herb) {
      herb = await Herb.findOne({ slug: id })
        .populate('phytochemicals.compound', 'name category effects')
        .lean();
    }
    
    return herb;
  }

  /**
   * Process uploaded images and upload to Cloudinary
   */
  static async uploadImageToCloudinary(image, uploadOptions) {
    if (!image) {
      throw new Error('Image payload is required');
    }

    try {
      if (Buffer.isBuffer(image.buffer)) {
        return await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (error) return reject(error);
            return resolve(result);
          });
          stream.end(image.buffer);
        });
      }

      if (image.path) {
        return await cloudinary.uploader.upload(image.path, uploadOptions);
      }

      throw new Error('Invalid image upload payload');
    } finally {
      if (image.path) {
        try {
          await fs.unlink(image.path);
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') {
            logger.error('Error cleaning up temp file:', cleanupError);
          }
        }
      }
    }
  }

  static async processImages(images = [], herbId, scientificName = null) {
    const processedImages = [];
    
    // Create folder name from scientific name if available
    const folderName = scientificName 
      ? `${CLOUDINARY_FOLDERS.HERBS}/${scientificName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')}`
      : CLOUDINARY_FOLDERS.HERBS;
    
    for (const image of images) {
      try {
        // Upload to Cloudinary with scientific name folder
        const result = await this.uploadImageToCloudinary(image, {
          folder: folderName,
          public_id: `${herbId}_${Date.now()}_${processedImages.length}`,
          resource_type: 'image',
          transformation: TRANSFORMATIONS.herbImage,
          overwrite: true
        });

        processedImages.push({
          url: result.secure_url,
          alt: image.originalname || 'Herb image',
          publicId: result.public_id,
          isPrimary: processedImages.length === 0,
        });
      } catch (error) {
        logger.error('Error processing image:', error);
      }
    }

    return processedImages;
  }

  /**
   * Create new herb
   */
  static async createHerb(herbData, images = [], userId = null) {
    // Generate a unique string ID for the herb
    const herbId = this.generateHerbId();
    
    // Process images and upload to Cloudinary with scientific name folder
    const processedImages = await this.processImages(images, herbId, herbData.scientificName);
    
    const phytochemicals = await this.resolvePhytochemicals(herbData.phytochemicals || []);

    const herb = new Herb({
      _id: herbId,
      ...herbData,
      phytochemicals,
      slug: herbData.slug || this.generateSlug(herbData.name, herbData.scientificName),
      createdBy: userId || herbData.createdBy,
      images: processedImages
    });

    const created = await herb.save();
    HerbService.clearHerbQueryCaches();
    return created;
  }

  /**
   * Generate unique herb ID
   */
  static generateHerbId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `herb_${timestamp}_${random}`;
  }

  /**
   * Generate slug from scientific name
   */
  static generateSlug(name, scientificName) {
    // Use scientific name for slug, fallback to common name if scientific name not provided
    const slugSource = scientificName || name;
    
    return slugSource
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  /**
   * Update herb
   */
  static async updateHerb(id, updateData, images = []) {
    const resolvedPhytochemicals = updateData.phytochemicals !== undefined
      ? await this.resolvePhytochemicals(updateData.phytochemicals)
      : undefined;

    const updateDoc = {
      ...updateData,
      ...(resolvedPhytochemicals !== undefined ? { phytochemicals: resolvedPhytochemicals } : {}),
      updatedAt: new Date()
    };

    if (updateData.images !== undefined) {
      updateDoc.images = this.normalizeHerbImages(updateData.images);
    }

    if (images && images.length > 0) {
      // Get existing herb to extract scientific name for folder organization
      const existingHerb = await Herb.findById(id);
      const scientificName = updateData.scientificName || existingHerb?.scientificName;
      
      // Process new images and upload to Cloudinary with scientific name folder
      const processedImages = await this.processImages(images, id, scientificName);
      updateDoc.images = processedImages;
    }

    const updated = await Herb.findByIdAndUpdate(
      id,
      updateDoc,
      { new: true, runValidators: true }
    );
    HerbService.clearHerbQueryCaches();
    return updated;
  }

  /**
   * Update herb status
   */
  static async updateHerbStatus(id, status) {
    const validStatuses = ['active', 'inactive', 'pending'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }

    // Convert string status to boolean isActive
    const isActive = status === 'active';

    const updated = await Herb.findByIdAndUpdate(
      id,
      { isActive, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    HerbService.clearHerbQueryCaches();
    return updated;
  }

  /**
   * Bulk update herb status
   */
  static async bulkUpdateHerbStatus(ids, status) {
    const validStatuses = ['active', 'inactive', 'pending'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }

    // Convert string status to boolean isActive
    const isActive = status === 'active';

    const result = await Herb.updateMany(
      { _id: { $in: ids } },
      { isActive, updatedAt: new Date() }
    );

    HerbService.clearHerbQueryCaches();
    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    };
  }

  /**
   * Get herbs by symptom
   */
  static async getHerbsBySymptom(symptom, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const query = {
      isActive: true,
      'traditionalUses.symptoms': {
        $regex: symptom,
        $options: 'i'
      }
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('phytochemicals.compound', 'name category effects')
                .lean(),
      Herb.countDocuments(query)
    ]);

    return {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  /**
   * Get herbs by category
   */
  static async getHerbsByCategory(category, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const query = {
      isActive: true,
      'category.name': category
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(query)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('phytochemicals.compound', 'name category effects')
                .lean(),
      Herb.countDocuments(query)
    ]);

    return {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  /**
   * Get favorite herbs for a user
   */
  static async getFavoriteHerbs(userId, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const query = {
      isActive: true,
      'favoritedBy.user': userId
    };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(query)
        .sort({ 'favoritedBy.favoritedAt': -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('phytochemicals.compound', 'name category effects')
                .lean(),
      Herb.countDocuments(query)
    ]);

    return {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  /**
   * Get recent herbs
   */
  static async getRecentHerbs(options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const query = { isActive: true };

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('phytochemicals.compound', 'name category effects')
                .lean(),
      Herb.countDocuments(query)
    ]);

    return {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }
}

module.exports = HerbService;
