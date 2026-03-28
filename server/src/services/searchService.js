const Herb = require('../models/Herb');
const User = require('../models/User');
const Location = require('../models/Location');
const Blog = require('../models/Blog');
const Phytochemical = require('../models/Phytochemical');
const { getMeiliClient, isMeiliEnabled } = require('../config/meilisearch');
const { logger } = require('../utils/logger');

const INDEX = {
  HERBS: 'herbs',
  USERS: 'users',
  LOCATIONS: 'locations',
  BLOGS: 'blogs',
  PHYTOCHEMICALS: 'phytochemicals',
};

const toPositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const escapeFilterString = (value = '') => String(value).replace(/"/g, '\\"');

class SearchService {
  static bootstrapped = false;
  static bootstrapPromise = null;

  static isEnabled() {
    return isMeiliEnabled() && Boolean(getMeiliClient());
  }

  static async waitTask(taskInfo) {
    const client = getMeiliClient();
    const taskUid = taskInfo?.taskUid ?? taskInfo?.uid;
    if (!client || !taskUid) return;
    await client.waitForTask(taskUid);
  }

  static async configureIndex(indexName, settings) {
    const client = getMeiliClient();
    if (!client) return;
    await client.createIndex(indexName, { primaryKey: 'id' }).catch(() => {});
    const task = await client.index(indexName).updateSettings(settings);
    await this.waitTask(task);
  }

  static async bootstrap() {
    if (!this.isEnabled()) return false;
    if (this.bootstrapped) return true;
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      await Promise.all([
        this.configureIndex(INDEX.HERBS, {
          searchableAttributes: ['name', 'scientificName', 'commonNames', 'category'],
          filterableAttributes: ['isActive', 'category'],
          sortableAttributes: ['name', 'updatedAt'],
        }),
        this.configureIndex(INDEX.USERS, {
          searchableAttributes: ['displayName', 'email', 'role'],
          filterableAttributes: ['isActive', 'role'],
          sortableAttributes: ['createdAt'],
        }),
        this.configureIndex(INDEX.LOCATIONS, {
          searchableAttributes: ['name', 'description', 'type'],
          filterableAttributes: ['isActive', 'type'],
          sortableAttributes: ['name', 'updatedAt'],
        }),
        this.configureIndex(INDEX.BLOGS, {
          searchableAttributes: ['title', 'excerpt', 'content', 'tags', 'category'],
          filterableAttributes: ['status', 'isActive', 'category'],
          sortableAttributes: ['publishedAt', 'updatedAt', 'createdAt'],
        }),
        this.configureIndex(INDEX.PHYTOCHEMICALS, {
          searchableAttributes: ['name', 'category', 'description', 'effects'],
          filterableAttributes: ['isActive', 'category'],
          sortableAttributes: ['name', 'updatedAt'],
        }),
      ]);

      await this.syncAll();
      this.bootstrapped = true;
      logger.info('Meilisearch bootstrap completed');
      return true;
    })()
      .catch((error) => {
        logger.warn(`Meilisearch bootstrap failed: ${error.message}`);
        return false;
      })
      .finally(() => {
        this.bootstrapPromise = null;
      });

    return this.bootstrapPromise;
  }

  static async ensureReady() {
    if (!this.isEnabled()) return false;
    if (this.bootstrapped) return true;
    return this.bootstrap();
  }

  static async syncIndex(indexName, documents = []) {
    const client = getMeiliClient();
    if (!client) return;
    const task = await client.index(indexName).addDocuments(documents, { primaryKey: 'id' });
    await this.waitTask(task);
  }

  static async syncAll() {
    if (!this.isEnabled()) return false;

    const [herbs, users, locations, blogs, phytochemicals] = await Promise.all([
      Herb.find({}).select('_id name scientificName commonNames category isActive updatedAt').lean(),
      User.find({}).select('_id displayName email role isActive createdAt').lean(),
      Location.find({}).select('_id name description type isActive updatedAt').lean(),
      Blog.find({}).select('_id title excerpt content tags category status isActive publishedAt updatedAt createdAt').lean(),
      Phytochemical.find({}).select('_id name category description effects isActive updatedAt').lean(),
    ]);

    await Promise.all([
      this.syncIndex(INDEX.HERBS, herbs.map((item) => ({
        id: String(item._id),
        name: item.name || '',
        scientificName: item.scientificName || '',
        commonNames: Array.isArray(item.commonNames) ? item.commonNames : [],
        category: item.category || 'unknown',
        isActive: item.isActive !== false,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      }))),
      this.syncIndex(INDEX.USERS, users.map((item) => ({
        id: String(item._id),
        displayName: item.displayName || '',
        email: item.email || '',
        role: item.role || 'user',
        isActive: item.isActive !== false,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      }))),
      this.syncIndex(INDEX.LOCATIONS, locations.map((item) => ({
        id: String(item._id),
        name: item.name || '',
        description: item.description || '',
        type: item.type || 'unknown',
        isActive: item.isActive !== false,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      }))),
      this.syncIndex(INDEX.BLOGS, blogs.map((item) => ({
        id: String(item._id),
        title: item.title || '',
        excerpt: item.excerpt || '',
        content: item.content || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        category: item.category || 'general',
        status: item.status || 'draft',
        isActive: item.isActive !== false,
        publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null,
      }))),
      this.syncIndex(INDEX.PHYTOCHEMICALS, phytochemicals.map((item) => ({
        id: String(item._id),
        name: item.name || '',
        category: item.category || 'other',
        description: item.description || '',
        effects: Array.isArray(item.effects) ? item.effects : [],
        isActive: item.isActive !== false,
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : null,
      }))),
    ]);

    return true;
  }

  static async searchIndex(indexName, query, { page = 1, limit = 20, filters = [], sort } = {}) {
    const ready = await this.ensureReady();
    if (!ready) return null;

    const client = getMeiliClient();
    const pageNum = toPositiveInt(page, 1, 100000);
    const limitNum = toPositiveInt(limit, 20, 200);
    const offset = (pageNum - 1) * limitNum;
    const filter = Array.isArray(filters) && filters.length > 0 ? filters : undefined;

    const result = await client.index(indexName).search(String(query || '').trim(), {
      limit: limitNum,
      offset,
      filter,
      sort: sort ? [sort] : undefined,
    });

    return {
      ids: (result.hits || []).map((hit) => String(hit.id)),
      total: Number(result.estimatedTotalHits || result.nbHits || 0),
      page: pageNum,
      limit: limitNum,
    };
  }

  static async searchHerbIds(query, options = {}) {
    const filters = [];
    if (options.status && options.status !== 'all') {
      filters.push(`isActive = ${options.status === 'active'}`);
    } else {
      filters.push('isActive = true');
    }
    if (options.category && options.category !== 'all') {
      filters.push(`category = "${escapeFilterString(options.category)}"`);
    }
    return this.searchIndex(INDEX.HERBS, query, { ...options, filters, sort: 'name:asc' });
  }

  static async searchUserIds(query, options = {}) {
    const filters = [];
    if (options.status && options.status !== 'all') {
      filters.push(`isActive = ${options.status === 'active'}`);
    }
    if (options.role && options.role !== 'all') {
      filters.push(`role = "${escapeFilterString(options.role)}"`);
    }
    return this.searchIndex(INDEX.USERS, query, { ...options, filters, sort: 'createdAt:desc' });
  }

  static async searchLocationIds(query, options = {}) {
    const filters = [];
    if (options.status && options.status !== 'all') {
      filters.push(`isActive = ${options.status === 'active'}`);
    } else {
      filters.push('isActive = true');
    }
    if (options.type && options.type !== 'all') {
      filters.push(`type = "${escapeFilterString(options.type)}"`);
    }
    return this.searchIndex(INDEX.LOCATIONS, query, { ...options, filters, sort: 'name:asc' });
  }

  static async searchBlogIds(query, options = {}) {
    const filters = ['isActive = true'];
    if (options.status) filters.push(`status = "${escapeFilterString(options.status)}"`);
    if (options.category && options.category !== 'all') {
      filters.push(`category = "${escapeFilterString(options.category)}"`);
    }
    return this.searchIndex(INDEX.BLOGS, query, { ...options, filters, sort: 'publishedAt:desc' });
  }

  static async searchPhytochemicalIds(query, options = {}) {
    const filters = [];
    if (options.status === 'active') filters.push('isActive = true');
    if (options.status === 'archived') filters.push('isActive = false');
    if (options.category && options.category !== 'all') {
      filters.push(`category = "${escapeFilterString(options.category)}"`);
    }
    return this.searchIndex(INDEX.PHYTOCHEMICALS, query, { ...options, filters, sort: 'name:asc' });
  }
}

module.exports = SearchService;

