const axios = require('axios');
const User = require('../models/User');
const Herb = require('../models/Herb');
const Location = require('../models/Location');
const Feedback = require('../models/Feedback');
const Recommendation = require('../models/Recommendation');
const RecommendationTrainingRun = require('../models/RecommendationTrainingRun');
const Inquiry = require('../models/Inquiry');
const HerbSafety = require('../models/HerbSafety');
const HerbInteraction = require('../models/HerbInteraction');
const Contraindication = require('../models/Contraindication');
const Phytochemical = require('../models/Phytochemical');
const PhytochemicalAssignment = require('../models/PhytochemicalAssignment');
const Symptom = require('../models/Symptom');
const ImageClassifierPrediction = require('../models/ImageClassifierPrediction');
const ImageClassifierFeedback = require('../models/ImageClassifierFeedback');
const ImageClassifierTrainingData = require('../models/ImageClassifierTrainingData');
const ImageClassifierModelVersion = require('../models/ImageClassifierModelVersion');
const PlantIdentification = require('../models/PlantIdentification');
const Blog = require('../models/Blog');
const ChatConversation = require('../models/ChatConversation');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const AnalyticsDailySnapshot = require('../models/AnalyticsDailySnapshot');
const MonitoringAlertRule = require('../models/MonitoringAlertRule');
const { cloudinary } = require('../config/cloudinary');
const { logger } = require('../utils/logger');
const notificationService = require('./notificationService');
const emailService = require('./emailService');
const SearchService = require('./searchService');
const fs = require('fs').promises;
const path = require('path');
const {
  getUserStatusTemplate,
  getUserStatusTemplateOptions,
} = require('../constants/emailTemplates');

/**
 * Admin Service Layer
 * Handles all admin business logic separated from routes
 */

const ADMIN_STATS_CACHE_TTL_MS = {
  storage: 5 * 60 * 1000,
  herbs: 60 * 1000,
  users: 60 * 1000,
};
const adminStatsCache = new Map();

const getAdminStatsCache = (key, ttlMs) => {
  const entry = adminStatsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    adminStatsCache.delete(key);
    return null;
  }
  return entry.data;
};

const setAdminStatsCache = (key, data) => {
  adminStatsCache.set(key, { timestamp: Date.now(), data });
};

const clearAdminStatsCache = (keys = []) => {
  keys.forEach((key) => adminStatsCache.delete(key));
};

class AdminService {
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
      const tokenRegex = new RegExp(AdminService.escapeRegex(token), 'i');
      return {
        $or: fields.map((field) => ({ [field]: tokenRegex })),
      };
    });
  }

  static normalizeLoopbackBaseUrl(rawUrl, fallbackPort) {
    const fallback = `http://127.0.0.1:${fallbackPort}`;
    try {
      const parsed = new URL(rawUrl || fallback);
      if (parsed.hostname === 'localhost' || parsed.hostname === '::1' || parsed.hostname === '[::1]') {
        parsed.hostname = '127.0.0.1';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return fallback;
    }
  }

  static getInternalMlHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (process.env.INTERNAL_API_KEY) {
      headers['X-Internal-Key'] = process.env.INTERNAL_API_KEY;
    }
    return headers;
  }

  static getImageClassifierBaseUrl() {
    return this.normalizeLoopbackBaseUrl(process.env.IMAGE_CLASSIFIER_URL, 8000);
  }

  static getRecommendationEngineBaseUrl() {
    return this.normalizeLoopbackBaseUrl(process.env.RECOMMENDATION_ENGINE_URL, 8001);
  }

  static async triggerImageClassifierRetrain() {
    try {
      const response = await axios.post(
        `${this.getImageClassifierBaseUrl()}/api/v1/retrain`,
        {},
        {
          headers: this.getInternalMlHeaders(),
          timeout: Number(process.env.IMAGE_CLASSIFIER_TIMEOUT_MS || 15000),
        }
      );
      return response.data || { status: 'queued' };
    } catch (error) {
      const statusCode = Number(error?.response?.status) || 500;
      const detail = error?.response?.data || error?.message || 'Unknown error';
      const wrapped = new Error(`Failed to trigger image-classifier retrain: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      wrapped.statusCode = statusCode;
      throw wrapped;
    }
  }

  static async triggerRecommendationRetrain() {
    try {
      const response = await axios.post(
        `${this.getRecommendationEngineBaseUrl()}/retrain`,
        {},
        {
          headers: this.getInternalMlHeaders(),
          timeout: Number(process.env.RECOMMENDATION_ENGINE_TIMEOUT_MS || 120000),
        }
      );
      return response.data || { ok: true };
    } catch (error) {
      const statusCode = Number(error?.response?.status) || 500;
      const detail = error?.response?.data || error?.message || 'Unknown error';
      const wrapped = new Error(`Failed to trigger recommendation-engine retrain: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      wrapped.statusCode = statusCode;
      throw wrapped;
    }
  }

  static async getImageClassifierRetrainStatus(taskId) {
    if (!taskId || typeof taskId !== 'string') {
      throw new Error('taskId is required');
    }
    try {
      const response = await axios.get(
        `${this.getImageClassifierBaseUrl()}/api/v1/retrain/status/${encodeURIComponent(taskId)}`,
        {
          headers: this.getInternalMlHeaders(),
          timeout: Number(process.env.IMAGE_CLASSIFIER_TIMEOUT_MS || 15000),
        }
      );
      return response.data || {};
    } catch (error) {
      const statusCode = Number(error?.response?.status) || 500;
      const detail = error?.response?.data || error?.message || 'Unknown error';
      const wrapped = new Error(`Failed to fetch image-classifier retrain status: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      wrapped.statusCode = statusCode;
      throw wrapped;
    }
  }

  static async getImageClassifierQueueHealth() {
    try {
      const response = await axios.get(
        `${this.getImageClassifierBaseUrl()}/api/v1/queue/health`,
        {
          headers: this.getInternalMlHeaders(),
          timeout: Number(process.env.IMAGE_CLASSIFIER_TIMEOUT_MS || 15000),
        }
      );
      return response.data || {};
    } catch (error) {
      const statusCode = Number(error?.response?.status) || 500;
      const detail = error?.response?.data || error?.message || 'Unknown error';
      const wrapped = new Error(`Failed to fetch image-classifier queue health: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      wrapped.statusCode = statusCode;
      throw wrapped;
    }
  }

  static async readJsonLogLines(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  static parseDurationMs(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/ms$/i, '').trim());
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  static percentile(values, p) {
    if (!Array.isArray(values) || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
  }

  static getUtcDayBounds(inputDate = new Date()) {
    const date = inputDate instanceof Date ? inputDate : new Date(inputDate);
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  static dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  static stripAnsi(value) {
    if (value == null) return '';
    return String(value).replace(/\u001b\[[0-9;]*m/g, '');
  }

  static parseStatusCodeFromEntry(entry, sanitizedRaw = '') {
    const directStatus = Number(
      entry.statusCode
      || entry?.meta?.statusCode
      || entry?.details?.statusCode
      || entry?.context?.statusCode
    );
    if (Number.isFinite(directStatus) && directStatus >= 100 && directStatus <= 599) {
      return directStatus;
    }

    const fromMessage = sanitizedRaw.match(/\bstatus(?:\s*code)?\s*[:=]?\s*(\d{3})\b/i);
    if (fromMessage) {
      const parsed = Number(fromMessage[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  }

  static parsePathFromEntry(entry, sanitizedRaw = '') {
    const directPath = this.stripAnsi(
      entry.path
      || entry.url
      || entry?.meta?.path
      || entry?.details?.path
      || entry?.context?.path
      || ''
    );
    if (directPath) return directPath;

    const fromMessage = sanitizedRaw.match(/(\/api\/[a-zA-Z0-9/_-]+)/);
    return fromMessage ? fromMessage[1] : null;
  }

  static parseMethodFromEntry(entry, sanitizedRaw = '') {
    const directMethod = this.stripAnsi(
      entry.method
      || entry?.meta?.method
      || entry?.details?.method
      || entry?.context?.method
      || ''
    ).toUpperCase();
    if (directMethod) return directMethod;

    const fromMessage = sanitizedRaw.match(/\b(GET|POST|PUT|PATCH|DELETE)\b/i);
    return fromMessage ? fromMessage[1].toUpperCase() : null;
  }

  static async getMonitoringOverview() {
    const [
      usersTotal,
      usersActive,
      usersMissingDemographics,
      herbsTotal,
      activeHerbs,
      herbsMissingSafetyProfile,
      herbsWithoutPhytochemicals,
      locationsTotal,
      symptomsTotal,
      redFlagSymptoms,
      phytochemicalsTotal,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({
        $or: [
          { dateOfBirth: { $exists: false } },
          { dateOfBirth: null },
          { gender: { $exists: false } },
          { gender: null },
        ],
      }),
      Herb.countDocuments(),
      Herb.countDocuments({ isActive: true }),
      Herb.countDocuments({
        isActive: true,
        $or: [
          { safetyProfile: { $exists: false } },
          { 'safetyProfile.lastComputedAt': { $exists: false } },
        ],
      }),
      Herb.countDocuments({
        isActive: true,
        $or: [
          { phytochemicals: { $exists: false } },
          { phytochemicals: { $size: 0 } },
        ],
      }),
      Location.countDocuments(),
      Symptom.countDocuments({ isActive: true }),
      Symptom.countDocuments({ isActive: true, seekMedicalAttention: true }),
      Phytochemical.countDocuments({ isActive: true }),
    ]);

    return {
      users: {
        total: usersTotal,
        active: usersActive,
        missingDemographics: usersMissingDemographics,
      },
      herbs: {
        total: herbsTotal,
        active: activeHerbs,
        missingSafetyProfile: herbsMissingSafetyProfile,
        withoutPhytochemicals: herbsWithoutPhytochemicals,
      },
      domain: {
        locations: locationsTotal,
        symptoms: symptomsTotal,
        redFlagSymptoms,
        phytochemicals: phytochemicalsTotal,
      },
    };
  }

  static async upsertDailySnapshot(inputDate = new Date()) {
    const { start, end } = this.getUtcDayBounds(inputDate);

    const [
      signups,
      blogsCreated,
      blogsPublished,
      inquiries,
      classifications,
      recommendations,
      pendingBlogReview,
      missingSafetyProfile,
      missingDemographics,
      requestAgg,
      latencyDocs,
    ] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      Blog.countDocuments({ isActive: true, createdAt: { $gte: start, $lt: end } }),
      Blog.countDocuments({ isActive: true, status: 'published', publishedAt: { $gte: start, $lt: end } }),
      Inquiry.countDocuments({ createdAt: { $gte: start, $lt: end } }),
      ImageClassifierPrediction.countDocuments({ created_at: { $gte: start, $lt: end } }),
      Recommendation.countDocuments({ isActive: true, createdAt: { $gte: start, $lt: end } }),
      Blog.countDocuments({ isActive: true, status: 'review' }),
      Herb.countDocuments({
        isActive: true,
        $or: [
          { safetyProfile: { $exists: false } },
          { 'safetyProfile.lastComputedAt': { $exists: false } },
        ],
      }),
      User.countDocuments({
        $or: [
          { dateOfBirth: { $exists: false } },
          { dateOfBirth: null },
          { gender: { $exists: false } },
          { gender: null },
        ],
      }),
      AnalyticsEvent.aggregate([
        {
          $match: {
            eventType: 'api_request',
            timestamp: { $gte: start, $lt: end },
          },
        },
        {
          $group: {
            _id: null,
            requests: { $sum: 1 },
            errors5xx: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
              },
            },
            avgResponseMs: { $avg: '$responseTimeMs' },
          },
        },
      ]),
      AnalyticsEvent.find(
        {
          eventType: 'api_request',
          timestamp: { $gte: start, $lt: end },
          responseTimeMs: { $ne: null },
        },
        { responseTimeMs: 1 }
      )
        .sort({ timestamp: -1 })
        .limit(5000)
        .lean(),
    ]);

    const requests = requestAgg[0]?.requests || 0;
    const errors5xx = requestAgg[0]?.errors5xx || 0;
    const avgResponseMs = Number((requestAgg[0]?.avgResponseMs || 0).toFixed(2));
    const p95ResponseMs = this.percentile(
      latencyDocs
        .map((item) => Number(item.responseTimeMs))
        .filter((value) => Number.isFinite(value)),
      95
    );

    return AnalyticsDailySnapshot.findOneAndUpdate(
      { date: start },
      {
        date: start,
        counts: {
          signups,
          blogsCreated,
          blogsPublished,
          inquiries,
          classifications,
          recommendations,
        },
        operations: {
          requests,
          errors5xx,
          errorRate5xx: requests > 0 ? Number(((errors5xx / requests) * 100).toFixed(2)) : 0,
          avgResponseMs,
          p95ResponseMs,
        },
        quality: {
          pendingBlogReview,
          missingSafetyProfile,
          missingDemographics,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  static async ensureRecentSnapshots(days = 30) {
    const windowDays = Math.min(365, Math.max(2, Number(days) || 30));
    const todayBounds = this.getUtcDayBounds(new Date());

    const targetDates = [];
    for (let offset = 0; offset < windowDays; offset += 1) {
      const date = new Date(todayBounds.start);
      date.setUTCDate(date.getUTCDate() - offset);
      targetDates.push(date);
    }

    const existing = await AnalyticsDailySnapshot.find(
      { date: { $in: targetDates } },
      { date: 1 }
    ).lean();

    const existingKeys = new Set(existing.map((item) => this.dayKey(new Date(item.date))));
    const missingDates = targetDates.filter((date) => !existingKeys.has(this.dayKey(date)));

    if (missingDates.length > 0) {
      await Promise.all(missingDates.map((date) => this.upsertDailySnapshot(date)));
    }

    // Always refresh today's snapshot so dashboard stays current.
    await this.upsertDailySnapshot(todayBounds.start);
  }

  static async getDashboardOverview(days = 30) {
    const windowDays = Math.min(365, Math.max(7, Number(days) || 30));
    await this.ensureRecentSnapshots(windowDays);

    const todayBounds = this.getUtcDayBounds(new Date());
    const startDate = new Date(todayBounds.start);
    startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));

    const snapshots = await AnalyticsDailySnapshot.find(
      { date: { $gte: startDate, $lte: todayBounds.start } }
    )
      .sort({ date: 1 })
      .lean();

    const todayKey = this.dayKey(todayBounds.start);
    const yesterday = new Date(todayBounds.start);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayKey = this.dayKey(yesterday);

    const byKey = new Map(
      snapshots.map((snapshot) => [this.dayKey(new Date(snapshot.date)), snapshot])
    );

    const todaySnapshot = byKey.get(todayKey) || null;
    const yesterdaySnapshot = byKey.get(yesterdayKey) || null;

    return {
      windowDays,
      updatedAt: new Date().toISOString(),
      today: todaySnapshot,
      yesterday: yesterdaySnapshot,
      trends: {
        signups: snapshots.map((item) => ({ date: this.dayKey(new Date(item.date)), value: item.counts?.signups || 0 })),
        blogsCreated: snapshots.map((item) => ({ date: this.dayKey(new Date(item.date)), value: item.counts?.blogsCreated || 0 })),
        inquiries: snapshots.map((item) => ({ date: this.dayKey(new Date(item.date)), value: item.counts?.inquiries || 0 })),
        classifications: snapshots.map((item) => ({ date: this.dayKey(new Date(item.date)), value: item.counts?.classifications || 0 })),
      },
      attention: {
        pendingBlogReview: todaySnapshot?.quality?.pendingBlogReview || 0,
        missingSafetyProfile: todaySnapshot?.quality?.missingSafetyProfile || 0,
        missingDemographics: todaySnapshot?.quality?.missingDemographics || 0,
        requests5xxToday: todaySnapshot?.operations?.errors5xx || 0,
      },
    };
  }

  static async getOperationalMetrics(hours = 24) {
    const cutoff = Date.now() - (Math.max(1, Number(hours) || 24) * 60 * 60 * 1000);
    const logsDir = path.join(__dirname, '../../logs');
    const [combinedLogs, errorLogs] = await Promise.all([
      this.readJsonLogLines(path.join(logsDir, 'combined.log')),
      this.readJsonLogLines(path.join(logsDir, 'error.log')),
    ]);

    const apiLogs = combinedLogs.filter((entry) => {
      const ts = new Date(entry.timestamp || entry.time || 0).getTime();
      return ts >= cutoff && (entry.type === 'api' || String(entry.message || '').startsWith('API:'));
    });

    const durations = apiLogs
      .map((entry) => this.parseDurationMs(entry.responseTime))
      .filter((value) => Number.isFinite(value));

    const statusCodes = apiLogs
      .map((entry) => Number(entry.statusCode))
      .filter((code) => Number.isFinite(code));

    const total = statusCodes.length;
    const failures5xx = statusCodes.filter((code) => code >= 500).length;
    const failures4xx = statusCodes.filter((code) => code >= 400 && code < 500).length;

    const recentErrors = errorLogs.filter((entry) => {
      const ts = new Date(entry.timestamp || entry.time || 0).getTime();
      return ts >= cutoff;
    });

    const bucketMap = new Map();
    apiLogs.forEach((entry) => {
      const ts = new Date(entry.timestamp || entry.time || 0);
      if (Number.isNaN(ts.getTime())) return;
      const label = `${String(ts.getHours()).padStart(2, '0')}:00`;
      if (!bucketMap.has(label)) {
        bucketMap.set(label, { label, requests: 0, errors5xx: 0, latencySum: 0, latencyCount: 0 });
      }
      const bucket = bucketMap.get(label);
      bucket.requests += 1;
      const status = Number(entry.statusCode);
      if (Number.isFinite(status) && status >= 500) bucket.errors5xx += 1;
      const latency = this.parseDurationMs(entry.responseTime);
      if (Number.isFinite(latency)) {
        bucket.latencySum += latency;
        bucket.latencyCount += 1;
      }
    });

    const requestTrend = Array.from(bucketMap.values())
      .map((bucket) => ({
        label: bucket.label,
        requests: bucket.requests,
        errors5xx: bucket.errors5xx,
        avgLatencyMs: bucket.latencyCount > 0 ? Number((bucket.latencySum / bucket.latencyCount).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    const hasFileMetrics = apiLogs.length > 0 || recentErrors.length > 0;
    if (hasFileMetrics) {
      return {
        windowHours: Math.max(1, Number(hours) || 24),
        api: {
          totalRequests: total,
          error5xxCount: failures5xx,
          error4xxCount: failures4xx,
          errorRate5xx: total > 0 ? Number(((failures5xx / total) * 100).toFixed(2)) : 0,
          p95LatencyMs: this.percentile(durations, 95),
        },
        logs: {
          errorEntries: recentErrors.length,
        },
        trends: {
          requestByHour: requestTrend,
        },
        process: {
          uptimeSeconds: Math.floor(process.uptime()),
          memory: process.memoryUsage(),
        },
      };
    }

    const cutoffDate = new Date(cutoff);
    const events = await AnalyticsEvent.find(
      {
        eventType: 'api_request',
        timestamp: { $gte: cutoffDate },
      },
      { timestamp: 1, statusCode: 1, responseTimeMs: 1 }
    )
      .lean();

    const eventDurations = events
      .map((entry) => Number(entry.responseTimeMs))
      .filter((value) => Number.isFinite(value));

    const eventStatusCodes = events
      .map((entry) => Number(entry.statusCode))
      .filter((code) => Number.isFinite(code));

    const eventTotal = eventStatusCodes.length;
    const eventFailures5xx = eventStatusCodes.filter((code) => code >= 500).length;
    const eventFailures4xx = eventStatusCodes.filter((code) => code >= 400 && code < 500).length;

    const eventBucketMap = new Map();
    events.forEach((entry) => {
      const ts = new Date(entry.timestamp || 0);
      if (Number.isNaN(ts.getTime())) return;
      const label = `${String(ts.getHours()).padStart(2, '0')}:00`;
      if (!eventBucketMap.has(label)) {
        eventBucketMap.set(label, { label, requests: 0, errors5xx: 0, latencySum: 0, latencyCount: 0 });
      }
      const bucket = eventBucketMap.get(label);
      bucket.requests += 1;
      const status = Number(entry.statusCode);
      if (Number.isFinite(status) && status >= 500) bucket.errors5xx += 1;
      const latency = Number(entry.responseTimeMs);
      if (Number.isFinite(latency)) {
        bucket.latencySum += latency;
        bucket.latencyCount += 1;
      }
    });

    const eventTrend = Array.from(eventBucketMap.values())
      .map((bucket) => ({
        label: bucket.label,
        requests: bucket.requests,
        errors5xx: bucket.errors5xx,
        avgLatencyMs: bucket.latencyCount > 0 ? Number((bucket.latencySum / bucket.latencyCount).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      windowHours: Math.max(1, Number(hours) || 24),
      api: {
        totalRequests: eventTotal,
        error5xxCount: eventFailures5xx,
        error4xxCount: eventFailures4xx,
        errorRate5xx: eventTotal > 0 ? Number(((eventFailures5xx / eventTotal) * 100).toFixed(2)) : 0,
        p95LatencyMs: this.percentile(eventDurations, 95),
      },
      logs: {
        errorEntries: eventFailures5xx,
      },
      trends: {
        requestByHour: eventTrend,
      },
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
      },
    };
  }

  static async getRecentErrorLogs(limit = 50, hours = 24, filters = {}) {
    const size = Math.min(200, Math.max(1, Number(limit) || 50));
    const windowHours = Math.min(720, Math.max(1, Number(hours) || 24));
    const cutoff = Date.now() - (windowHours * 60 * 60 * 1000);
    const statusClass = String(filters.statusClass || 'all').toLowerCase();
    const endpoint = String(filters.endpoint || '').trim().toLowerCase();
    const search = String(filters.search || '').trim().toLowerCase();
    const logsDir = path.join(__dirname, '../../logs');

    const errorLogs = await this.readJsonLogLines(path.join(logsDir, 'error.log'));

    const entries = errorLogs
      .map((entry) => {
        const rawTs = entry.timestamp || entry.time || entry.createdAt;
        const ts = new Date(rawTs || 0).getTime();
        if (!Number.isFinite(ts) || ts < cutoff) return null;

        const sanitizedRaw = this.stripAnsi(JSON.stringify(entry || {}));
        const parsedStatusCode = this.parseStatusCodeFromEntry(entry, sanitizedRaw);
        const parsedPath = this.parsePathFromEntry(entry, sanitizedRaw);
        const parsedMethod = this.parseMethodFromEntry(entry, sanitizedRaw);

        return {
          timestamp: new Date(ts).toISOString(),
          level: this.stripAnsi(entry.level || 'error'),
          message: this.stripAnsi(entry.message || entry.error || 'Unknown error').slice(0, 500),
          path: parsedPath,
          method: parsedMethod,
          statusCode: parsedStatusCode,
          requestId: this.stripAnsi(entry.requestId || entry.meta?.requestId || '') || null,
          raw: sanitizedRaw,
        };
      })
      .filter(Boolean)
      .filter((entry) => {
        if (statusClass === '5xx') {
          return Number(entry.statusCode) >= 500;
        }
        if (statusClass === '4xx') {
          const status = Number(entry.statusCode);
          return status >= 400 && status < 500;
        }
        return true;
      })
      .filter((entry) => (endpoint ? String(entry.path || '').toLowerCase().includes(endpoint) : true))
      .filter((entry) => {
        if (!search) return true;
        return (
          String(entry.message || '').toLowerCase().includes(search)
          || String(entry.path || '').toLowerCase().includes(search)
          || String(entry.requestId || '').toLowerCase().includes(search)
          || String(entry.raw || '').toLowerCase().includes(search)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, size)
      .map(({ raw, ...rest }) => rest);

    return {
      windowHours,
      limit: size,
      total: entries.length,
      entries,
    };
  }

  static async getTopFailingEndpoints(hours = 24, limit = 10) {
    const windowHours = Math.min(720, Math.max(1, Number(hours) || 24));
    const size = Math.min(50, Math.max(1, Number(limit) || 10));
    const cutoff = new Date(Date.now() - (windowHours * 60 * 60 * 1000));

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: 'api_request',
          timestamp: { $gte: cutoff },
        },
      },
      {
        $group: {
          _id: { method: '$method', path: '$path' },
          totalRequests: { $sum: 1 },
          errors5xx: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
            },
          },
          p95Candidates: { $push: '$responseTimeMs' },
        },
      },
      {
        $addFields: {
          errorRate5xx: {
            $cond: [
              { $gt: ['$totalRequests', 0] },
              { $multiply: [{ $divide: ['$errors5xx', '$totalRequests'] }, 100] },
              0,
            ],
          },
        },
      },
      { $match: { errors5xx: { $gt: 0 } } },
      { $sort: { errors5xx: -1, errorRate5xx: -1 } },
      { $limit: size },
    ]);

    return rows.map((row) => {
      const responseTimes = (row.p95Candidates || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));

      return {
        method: row._id?.method || 'GET',
        path: row._id?.path || 'unknown',
        totalRequests: row.totalRequests || 0,
        errors5xx: row.errors5xx || 0,
        errorRate5xx: Number((row.errorRate5xx || 0).toFixed(2)),
        p95ResponseMs: this.percentile(responseTimes, 95),
      };
    });
  }

  static async getLatencyByEndpoint(hours = 24, limit = 20, minCount = 10, options = {}) {
    const scope = String(options.scope || 'all').trim().toLowerCase();
    const windowHours = Math.min(720, Math.max(1, Number(hours) || 24));
    const size = Math.min(100, Math.max(1, Number(limit) || 20));
    const minRequests = Math.max(1, Number(minCount) || 10);
    const cutoff = new Date(Date.now() - (windowHours * 60 * 60 * 1000));
    const scopeMatch = (() => {
      if (scope === 'all') return {};
      if (scope === 'admin') return { path: { $regex: '^/api/admin/' } };
      if (scope === 'uploads') return { path: { $regex: '^/api/images/' } };
      if (scope === 'ml') return { path: '/api/images/plant-identification' };
      if (scope === 'core') {
        return {
          path: {
            $not: {
              $regex: '^/api/(admin/|images/|site-assets/|monitoring/)',
            },
          },
        };
      }
      return {};
    })();

    const rows = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: 'api_request',
          timestamp: { $gte: cutoff },
          responseTimeMs: { $ne: null },
          ...(scopeMatch || {}),
        },
      },
      {
        $group: {
          _id: { method: '$method', path: '$path' },
          totalRequests: { $sum: 1 },
          errors5xx: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
            },
          },
          avgResponseMs: { $avg: '$responseTimeMs' },
          p95Candidates: { $push: '$responseTimeMs' },
        },
      },
    ]).allowDiskUse(true);

    return rows
      .filter((row) => (row.totalRequests || 0) >= minRequests)
      .map((row) => {
        const responseTimes = (row.p95Candidates || [])
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        const avg = Number.isFinite(row.avgResponseMs) ? Number(row.avgResponseMs.toFixed(2)) : 0;
        return {
          method: row._id?.method || 'GET',
          path: row._id?.path || 'unknown',
          totalRequests: row.totalRequests || 0,
          errors5xx: row.errors5xx || 0,
          errorRate5xx: row.totalRequests > 0
            ? Number(((row.errors5xx || 0) / row.totalRequests * 100).toFixed(2))
            : 0,
          avgResponseMs: avg,
          p95ResponseMs: this.percentile(responseTimes, 95),
        };
      })
      .sort((a, b) => (b.p95ResponseMs - a.p95ResponseMs) || (b.totalRequests - a.totalRequests))
      .slice(0, size);
  }

  static async getMonitoringAlertRule() {
    const defaults = {
      key: 'default',
      enabled: false,
      cooldownMinutes: 30,
      thresholds: {
        availabilityPctMin: 99,
        p95LatencyMsMax: 1200,
        errorRate5xxPctMax: 1,
      },
      channels: {
        email: { enabled: false, to: [] },
        slack: { enabled: false, webhookUrl: '' },
        webhook: { enabled: false, url: '' },
      },
    };

    return MonitoringAlertRule.findOneAndUpdate(
      { key: 'default' },
      { $setOnInsert: defaults },
      { upsert: true, new: true }
    ).lean();
  }

  static async updateMonitoringAlertRule(payload = {}) {
    const current = await this.getMonitoringAlertRule();
    const next = {
      ...current,
      enabled: typeof payload.enabled === 'boolean' ? payload.enabled : current.enabled,
      cooldownMinutes: Number.isFinite(Number(payload.cooldownMinutes))
        ? Math.min(1440, Math.max(1, Number(payload.cooldownMinutes)))
        : current.cooldownMinutes,
      thresholds: {
        availabilityPctMin: Number.isFinite(Number(payload?.thresholds?.availabilityPctMin))
          ? Math.min(100, Math.max(0, Number(payload.thresholds.availabilityPctMin)))
          : current.thresholds.availabilityPctMin,
        p95LatencyMsMax: Number.isFinite(Number(payload?.thresholds?.p95LatencyMsMax))
          ? Math.max(1, Number(payload.thresholds.p95LatencyMsMax))
          : current.thresholds.p95LatencyMsMax,
        errorRate5xxPctMax: Number.isFinite(Number(payload?.thresholds?.errorRate5xxPctMax))
          ? Math.min(100, Math.max(0, Number(payload.thresholds.errorRate5xxPctMax)))
          : current.thresholds.errorRate5xxPctMax,
      },
      channels: {
        email: {
          enabled: typeof payload?.channels?.email?.enabled === 'boolean'
            ? payload.channels.email.enabled
            : current.channels?.email?.enabled,
          to: Array.isArray(payload?.channels?.email?.to)
            ? payload.channels.email.to.map((item) => String(item).trim()).filter(Boolean)
            : (current.channels?.email?.to || []),
        },
        slack: {
          enabled: typeof payload?.channels?.slack?.enabled === 'boolean'
            ? payload.channels.slack.enabled
            : current.channels?.slack?.enabled,
          webhookUrl: typeof payload?.channels?.slack?.webhookUrl === 'string'
            ? payload.channels.slack.webhookUrl.trim()
            : (current.channels?.slack?.webhookUrl || ''),
        },
        webhook: {
          enabled: typeof payload?.channels?.webhook?.enabled === 'boolean'
            ? payload.channels.webhook.enabled
            : current.channels?.webhook?.enabled,
          url: typeof payload?.channels?.webhook?.url === 'string'
            ? payload.channels.webhook.url.trim()
            : (current.channels?.webhook?.url || ''),
        },
      },
    };

    return MonitoringAlertRule.findOneAndUpdate(
      { key: 'default' },
      {
        $set: {
          enabled: next.enabled,
          cooldownMinutes: next.cooldownMinutes,
          thresholds: next.thresholds,
          channels: next.channels,
        },
      },
      { new: true }
    ).lean();
  }

  static async sendMonitoringAlertNotifications(rule, summary, violations = []) {
    const subject = `[Herb Monitoring Alert] ${violations.join(', ')}`;
    const body = [
      'Monitoring thresholds breached.',
      `Availability: ${summary.availabilityPct}%`,
      `Error rate (5xx): ${summary.errorRate5xxPct}%`,
      `P95 latency: ${summary.p95LatencyMs}ms`,
      `Window days: ${summary.windowDays}`,
      `Timestamp: ${new Date().toISOString()}`,
    ].join('\n');

    if (rule.channels?.email?.enabled && Array.isArray(rule.channels.email.to) && rule.channels.email.to.length > 0) {
      await Promise.all(
        rule.channels.email.to.map((to) => emailService.sendEmail({
          to,
          subject,
          text: body,
          html: `<pre>${body}</pre>`,
        }).catch((error) => logger.warn(`Alert email failed for ${to}: ${error.message}`)))
      );
    }

    if (rule.channels?.slack?.enabled && rule.channels?.slack?.webhookUrl) {
      await axios.post(rule.channels.slack.webhookUrl, {
        text: `${subject}\n${body}`,
      }, { timeout: 5000 }).catch((error) => logger.warn(`Slack alert failed: ${error.message}`));
    }

    if (rule.channels?.webhook?.enabled && rule.channels?.webhook?.url) {
      await axios.post(rule.channels.webhook.url, {
        event: 'monitoring_alert',
        subject,
        summary,
        violations,
      }, { timeout: 5000 }).catch((error) => logger.warn(`Webhook alert failed: ${error.message}`));
    }
  }

  static async evaluateMonitoringAlert(rule, summary) {
    if (!rule?.enabled) {
      return { triggered: false, reason: 'disabled' };
    }

    const violations = [];
    if (summary.availabilityPct < rule.thresholds.availabilityPctMin) {
      violations.push('availability');
    }
    if (summary.p95LatencyMs > rule.thresholds.p95LatencyMsMax) {
      violations.push('p95_latency');
    }
    if (summary.errorRate5xxPct > rule.thresholds.errorRate5xxPctMax) {
      violations.push('error_rate_5xx');
    }

    if (violations.length === 0) {
      return { triggered: false, reason: 'within-thresholds' };
    }

    const cooldownMs = (rule.cooldownMinutes || 30) * 60 * 1000;
    const lastTriggeredAt = rule.lastTriggeredAt ? new Date(rule.lastTriggeredAt).getTime() : 0;
    if (lastTriggeredAt > 0 && (Date.now() - lastTriggeredAt) < cooldownMs) {
      return { triggered: false, reason: 'cooldown', violations };
    }

    await this.sendMonitoringAlertNotifications(rule, summary, violations);
    await MonitoringAlertRule.updateOne(
      { _id: rule._id },
      {
        $set: {
          lastTriggeredAt: new Date(),
          lastTriggeredMetrics: {
            summary,
            violations,
          },
        },
      }
    );

    return { triggered: true, violations };
  }

  static async getSloSlaSummary(days = 30, options = {}) {
    const scope = String(options.scope || 'all').trim().toLowerCase();
    const windowDays = Math.min(365, Math.max(7, Number(days) || 30));
    await this.ensureRecentSnapshots(windowDays);
    const rule = await this.getMonitoringAlertRule();

    const todayBounds = this.getUtcDayBounds(new Date());
    const startDate = new Date(todayBounds.start);
    startDate.setUTCDate(startDate.getUTCDate() - (windowDays - 1));
    const cutoff = new Date(startDate);

    const scopeMatch = (() => {
      if (scope === 'all') return {};
      if (scope === 'admin') return { path: { $regex: '^/api/admin/' } };
      if (scope === 'uploads') return { path: { $regex: '^/api/images/' } };
      if (scope === 'ml') return { path: '/api/images/plant-identification' };
      if (scope === 'core') {
        return {
          path: {
            $not: {
              $regex: '^/api/(admin/|images/|site-assets/|monitoring/)',
            },
          },
        };
      }
      return {};
    })();

    const [eventsAgg, latencyRows, trendRows] = await Promise.all([
      AnalyticsEvent.aggregate([
        {
          $match: {
            eventType: 'api_request',
            timestamp: { $gte: cutoff },
            ...(scopeMatch || {}),
          },
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            errors5xx: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
              },
            },
          },
        },
      ]),
      AnalyticsEvent.find(
        {
          eventType: 'api_request',
          timestamp: { $gte: cutoff },
          responseTimeMs: { $ne: null },
          ...(scopeMatch || {}),
        },
        { responseTimeMs: 1 }
      )
        .sort({ timestamp: -1 })
        .limit(20000)
        .lean(),
      scope === 'all'
        ? AnalyticsDailySnapshot.find({ date: { $gte: cutoff, $lte: todayBounds.start } })
          .sort({ date: 1 })
          .lean()
        : AnalyticsEvent.aggregate([
          {
            $match: {
              eventType: 'api_request',
              timestamp: { $gte: cutoff },
              ...(scopeMatch || {}),
            },
          },
          {
            $group: {
              _id: {
                day: {
                  $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
                },
              },
              totalRequests: { $sum: 1 },
              errors5xx: {
                $sum: {
                  $cond: [{ $gte: ['$statusCode', 500] }, 1, 0],
                },
              },
              p95Candidates: { $push: '$responseTimeMs' },
            },
          },
          { $sort: { '_id.day': 1 } },
        ]),
    ]);

    const totalRequests = eventsAgg[0]?.totalRequests || 0;
    const errors5xx = eventsAgg[0]?.errors5xx || 0;
    const availabilityPct = totalRequests > 0
      ? Number((((totalRequests - errors5xx) / totalRequests) * 100).toFixed(3))
      : 100;
    const errorRate5xxPct = totalRequests > 0
      ? Number(((errors5xx / totalRequests) * 100).toFixed(3))
      : 0;
    const p95LatencyMs = this.percentile(
      latencyRows
        .map((entry) => Number(entry.responseTimeMs))
        .filter((value) => Number.isFinite(value)),
      95
    );

    const summary = {
      windowDays,
      availabilityPct,
      errorRate5xxPct,
      p95LatencyMs,
    };

    const alertEval = scope === 'all'
      ? await this.evaluateMonitoringAlert(rule, summary)
      : { triggered: false, reason: 'scope-disabled' };

    return {
      ...summary,
      thresholds: rule.thresholds,
      alerting: {
        enabled: rule.enabled,
        cooldownMinutes: rule.cooldownMinutes,
        lastTriggeredAt: rule.lastTriggeredAt || null,
        lastTriggeredMetrics: rule.lastTriggeredMetrics || null,
        lastEvaluation: alertEval,
      },
      p95TrendByDay: scope === 'all'
        ? trendRows.map((row) => ({
          date: this.dayKey(new Date(row.date)),
          p95LatencyMs: row.operations?.p95ResponseMs || 0,
          availabilityPct: row.operations?.requests > 0
            ? Number((((row.operations.requests - row.operations.errors5xx) / row.operations.requests) * 100).toFixed(3))
            : 100,
        }))
        : trendRows.map((row) => {
          const responseTimes = (row.p95Candidates || [])
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));
          const total = row.totalRequests || 0;
          const errors = row.errors5xx || 0;
          return {
            date: row._id?.day || '',
            p95LatencyMs: this.percentile(responseTimes, 95),
            availabilityPct: total > 0
              ? Number((((total - errors) / total) * 100).toFixed(3))
              : 100,
          };
        }),
    };
  }

  static async getSafetyGovernanceMetrics() {
    const [
      unverifiedSafety,
      unverifiedInteractions,
      unverifiedContraindications,
      oldestSafetyRecords,
    ] = await Promise.all([
      HerbSafety.countDocuments({ verified: false }),
      HerbInteraction.countDocuments({ isActive: true, verified: false }),
      Contraindication.countDocuments({ isActive: true, verified: false }),
      HerbSafety.find({})
        .select('herbId lastReviewed updatedAt verified')
        .sort({ lastReviewed: 1, updatedAt: 1 })
        .limit(5)
        .populate('herbId', 'name scientificName'),
    ]);

    return {
      unverified: {
        herbSafety: unverifiedSafety,
        interactions: unverifiedInteractions,
        contraindications: unverifiedContraindications,
      },
      oldestReviewQueue: oldestSafetyRecords.map((item) => ({
        id: item._id,
        herb: item.herbId?.name || 'Unknown herb',
        scientificName: item.herbId?.scientificName || null,
        lastReviewed: item.lastReviewed || null,
        updatedAt: item.updatedAt || null,
        verified: item.verified,
      })),
    };
  }

  static async getRecommendationInsights(days = 30) {
    const now = new Date();
    const windowDays = Math.min(365, Math.max(7, Number(days) || 30));
    const lastWindow = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
    const prevWindow = new Date(now.getTime() - (windowDays * 2 * 24 * 60 * 60 * 1000));

    const trendCutoff = new Date(now.getTime() - (windowDays * 24 * 60 * 60 * 1000));
    const [
      recommendationVolume30d,
      totalRecommendations,
      fallbackRecommendations,
      severeSideEffects30d,
      totalFeedback30d,
      latestTrainingRun,
      avgRecentFeedback,
      avgPreviousFeedback,
      recommendationTrendRaw,
      feedbackTrendRaw,
      trainingTrendRaw,
      symptomFrequencyRaw,
    ] = await Promise.all([
      Recommendation.countDocuments({ isActive: true, createdAt: { $gte: lastWindow } }),
      Recommendation.countDocuments({ isActive: true }),
      Recommendation.countDocuments({ isActive: true, 'mlModel.version': 'fallback' }),
      Feedback.countDocuments({ isActive: true, createdAt: { $gte: lastWindow }, sideEffects: 'severe' }),
      Feedback.countDocuments({ isActive: true, createdAt: { $gte: lastWindow } }),
      RecommendationTrainingRun.findOne({ saved: true })
        .sort({ trained_at: -1, createdAt: -1 })
        .lean(),
      Feedback.aggregate([
        { $match: { isActive: true, createdAt: { $gte: lastWindow } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
      Feedback.aggregate([
        { $match: { isActive: true, createdAt: { $gte: prevWindow, $lt: lastWindow } } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } },
      ]),
      Recommendation.aggregate([
        { $match: { isActive: true, createdAt: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Feedback.aggregate([
        { $match: { isActive: true, createdAt: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, avgRating: { $avg: '$rating' } } },
        { $sort: { _id: 1 } },
      ]),
      RecommendationTrainingRun.find({ saved: true })
        .sort({ trained_at: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      // Symptom frequency aggregation
      Recommendation.aggregate([
        { $match: { isActive: true, createdAt: { $gte: lastWindow } } },
        { $unwind: '$symptoms' },
        { $group: { _id: '$symptoms', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { symptom: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    const recentAvg = avgRecentFeedback[0]?.avgRating || 0;
    const prevAvg = avgPreviousFeedback[0]?.avgRating || 0;

    return {
      recommendations: {
        volume30d: recommendationVolume30d,
        volumeToday: await Recommendation.countDocuments({ 
          isActive: true, 
          createdAt: { $gte: new Date(now.getTime() - (24 * 60 * 60 * 1000)) } 
        }),
        fallbackRate: totalRecommendations > 0
          ? Number(((fallbackRecommendations / totalRecommendations) * 100).toFixed(2))
          : 0,
      },
      feedback: {
        total30d: totalFeedback30d,
        severeSideEffects30d,
        severeSideEffectRate: totalFeedback30d > 0
          ? Number(((severeSideEffects30d / totalFeedback30d) * 100).toFixed(2))
          : 0,
        avgRatingRecent30d: Number(recentAvg.toFixed(3)),
        avgRatingPrevious30d: Number(prevAvg.toFixed(3)),
        ratingDelta: Number((recentAvg - prevAvg).toFixed(3)),
      },
      model: {
        latestTrainingRun: latestTrainingRun || null,
      },
      trends: {
        recommendationsByDay: recommendationTrendRaw.map((item) => ({ date: item._id, value: item.value, key: item._id })),
        feedbackRatingByDay: feedbackTrendRaw.map((item) => ({ date: item._id, value: Number((item.avgRating || 0).toFixed(3)), key: item._id })),
        trainingRuns: trainingTrendRaw
          .map((item) => ({
            date: item.trained_at || item.createdAt,
            rmse: item.cv_scores?.rmse_mean ?? null,
            accuracy: item.cv_scores?.accuracy_mean ?? null,
          }))
          .reverse(),
      },
      symptomFrequency: symptomFrequencyRaw,
    };
  }

  static async getAdminAuditTrail(limit = 25, days = 30) {
    const size = Math.min(100, Math.max(1, Number(limit) || 25));
    const windowDays = Math.min(365, Math.max(1, Number(days) || 30));
    const cutoff = new Date(Date.now() - (windowDays * 24 * 60 * 60 * 1000));
    const windowMatch = { updatedAt: { $gte: cutoff } };
    const [safety, interactions, contraindications, phytochemicals] = await Promise.all([
      HerbSafety.find(windowMatch).select('updatedAt verified herbId').sort({ updatedAt: -1 }).limit(size).populate('herbId', 'name'),
      HerbInteraction.find(windowMatch).select('updatedAt verified herbId').sort({ updatedAt: -1 }).limit(size).populate('herbId', 'name'),
      Contraindication.find(windowMatch).select('updatedAt verified herbId').sort({ updatedAt: -1 }).limit(size).populate('herbId', 'name'),
      Phytochemical.find(windowMatch).select('updatedAt verified name').sort({ updatedAt: -1 }).limit(size),
    ]);

    const events = [
      ...safety.map((item) => ({
        type: 'herb_safety',
        target: item.herbId?.name || 'Unknown herb',
        verified: item.verified,
        updatedAt: item.updatedAt,
      })),
      ...interactions.map((item) => ({
        type: 'interaction',
        target: item.herbId?.name || 'Unknown herb',
        verified: item.verified,
        updatedAt: item.updatedAt,
      })),
      ...contraindications.map((item) => ({
        type: 'contraindication',
        target: item.herbId?.name || 'Unknown herb',
        verified: item.verified,
        updatedAt: item.updatedAt,
      })),
      ...phytochemicals.map((item) => ({
        type: 'phytochemical',
        target: item.name,
        verified: item.verified,
        updatedAt: item.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, size);

    return events;
  }

  static async getImageClassifierInsights(hours = 168) {
    const windowHours = Math.max(1, Number(hours) || 168);
    const now = new Date();
    const cutoff = new Date(now.getTime() - (windowHours * 60 * 60 * 1000));
    const trendCutoff = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    const [
      predictionAgg,
      feedbackCount,
      correctionFeedbackCount,
      lowConfidenceCount,
      backlogNew,
      backlogUnused,
      activeModel,
      latestModel,
      modelVersionCount,
      predictionsByDayRaw,
      confidenceByDayRaw,
      feedbackByDayRaw,
      identificationsWithFeedbackCount,
      totalIdentificationsCount,
      classificationCountsRaw,
      retrainThreshold,
    ] = await Promise.all([
      ImageClassifierPrediction.aggregate([
        { $match: { created_at: { $gte: cutoff } } },
        {
          $group: {
            _id: null,
            totalPredictions: { $sum: 1 },
            avgConfidence: { $avg: '$confidence' },
            avgInferenceMs: { $avg: '$inference_time_ms' },
            maxInferenceMs: { $max: '$inference_time_ms' },
          },
        },
      ]),
      ImageClassifierFeedback.countDocuments({ created_at: { $gte: cutoff } }),
      ImageClassifierFeedback.countDocuments({ created_at: { $gte: cutoff }, feedback_type: 'correction' }),
      ImageClassifierPrediction.countDocuments({ created_at: { $gte: cutoff }, confidence: { $lt: 0.6 } }),
      ImageClassifierTrainingData.countDocuments({ is_new: true }),
      ImageClassifierTrainingData.countDocuments({ used_in_training: false }),
      ImageClassifierModelVersion.findOne({ is_active: true }).sort({ trained_at: -1 }).lean(),
      ImageClassifierModelVersion.findOne({}).sort({ trained_at: -1 }).lean(),
      ImageClassifierModelVersion.countDocuments({}),
      ImageClassifierPrediction.aggregate([
        { $match: { created_at: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ImageClassifierPrediction.aggregate([
        { $match: { created_at: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, value: { $avg: '$confidence' } } },
        { $sort: { _id: 1 } },
      ]),
      ImageClassifierFeedback.aggregate([
        { $match: { created_at: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      PlantIdentification.countDocuments({
        createdAt: { $gte: cutoff },
        status: { $in: ['classified', 'uncertain', 'verified', 'rejected'] },
        $or: [
          { 'feedback.isCorrect': { $in: [true, false] } },
          { 'feedback.rating': { $exists: true } },
          { 'feedback.userCorrection': { $exists: true, $ne: '' } },
        ],
      }),
      PlantIdentification.countDocuments({
        createdAt: { $gte: cutoff },
        status: { $in: ['classified', 'uncertain', 'verified', 'rejected'] },
      }),
      ImageClassifierPrediction.aggregate([
        { $match: { created_at: { $gte: cutoff } } },
        { $group: { _id: '$predicted_herb_name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
        { $project: { herb_name: '$_id', count: 1, _id: 0 } },
      ]),
      // Get retrain threshold from settings or use default
      Promise.resolve({ threshold: 500 }) // Default threshold, can be made configurable
    ]);

    const predictionSummary = predictionAgg[0] || {};
    const inferenceSamples = await ImageClassifierPrediction.find(
      { created_at: { $gte: cutoff }, inference_time_ms: { $ne: null } },
      { inference_time_ms: 1 }
    )
      .sort({ created_at: -1 })
      .limit(5000)
      .lean();
    const inferenceValues = inferenceSamples
      .map((item) => Number(item.inference_time_ms))
      .filter((value) => Number.isFinite(value));
    const p95InferenceMs = this.percentile(inferenceValues, 95);
    const totalPredictions = predictionSummary.totalPredictions || 0;

    return {
      windowHours,
      predictions: {
        total: totalPredictions,
        avgConfidence: Number((predictionSummary.avgConfidence || 0).toFixed(4)),
        lowConfidenceCount,
        lowConfidenceRate: totalPredictions > 0
          ? Number(((lowConfidenceCount / totalPredictions) * 100).toFixed(2))
          : 0,
      },
      performance: {
        avgInferenceMs: Number((predictionSummary.avgInferenceMs || 0).toFixed(2)),
        p95InferenceMs,
        maxInferenceMs: Number((predictionSummary.maxInferenceMs || 0).toFixed(2)),
      },
      feedback: {
        total: feedbackCount,
        corrections: correctionFeedbackCount,
        submittedCount: identificationsWithFeedbackCount,
        submittedRate: totalIdentificationsCount > 0
          ? Number(((identificationsWithFeedbackCount / totalIdentificationsCount) * 100).toFixed(2))
          : 0,
        // Backward-compatible field name, but now explicitly correction-only.
        correctionRate: totalPredictions > 0
          ? Number(((correctionFeedbackCount / totalPredictions) * 100).toFixed(2))
          : 0,
        feedbackRate: totalPredictions > 0
          ? Number(((feedbackCount / totalPredictions) * 100).toFixed(2))
          : 0,
      },
      training: {
        backlogNew,
        backlogUnused,
        retrainThreshold: retrainThreshold.threshold,
      },
      model: {
        active: activeModel || null,
        latest: latestModel || null,
        versionCount: modelVersionCount,
      },
      trends: {
        predictionsByDay: predictionsByDayRaw.map((item) => ({ date: item._id, value: item.value })),
        avgConfidenceByDay: confidenceByDayRaw.map((item) => ({ date: item._id, value: Number((item.value || 0).toFixed(4)) })),
        feedbackByDay: feedbackByDayRaw.map((item) => ({ date: item._id, value: item.value })),
      },
      classifications: classificationCountsRaw || [],
    };
  }

  static async getBlogInsights(hours = 168) {
    const windowHours = Math.max(1, Number(hours) || 168);
    const now = new Date();
    const cutoff = new Date(now.getTime() - (windowHours * 60 * 60 * 1000));
    const trendCutoff = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    const last7Days = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    const [
      statusCountsRaw,
      publishedLast7Days,
      reviewQueueOldest,
      createdTrendRaw,
      publishedTrendRaw,
      recentModerationsRaw,
    ] = await Promise.all([
      Blog.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Blog.countDocuments({ isActive: true, status: 'published', publishedAt: { $gte: last7Days } }),
      Blog.find({ isActive: true, status: 'review' })
        .sort({ updatedAt: 1 })
        .limit(5)
        .select('title slug updatedAt createdAt author')
        .populate('author', 'displayName email')
        .lean(),
      Blog.aggregate([
        { $match: { isActive: true, createdAt: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Blog.aggregate([
        { $match: { isActive: true, publishedAt: { $gte: trendCutoff } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } }, value: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Blog.aggregate([
        { $match: { isActive: true, moderationHistory: { $exists: true, $ne: [] } } },
        { $unwind: '$moderationHistory' },
        { $match: { 'moderationHistory.actedAt': { $gte: cutoff } } },
        { $sort: { 'moderationHistory.actedAt': -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: 'moderationHistory.actedBy',
            foreignField: '_id',
            as: 'moderationActor',
          },
        },
        {
          $project: {
            _id: 0,
            blogId: '$_id',
            title: 1,
            slug: 1,
            currentStatus: '$status',
            previousStatus: '$moderationHistory.previousStatus',
            nextStatus: '$moderationHistory.nextStatus',
            reason: '$moderationHistory.reason',
            actedAt: '$moderationHistory.actedAt',
            actedByDisplayName: { $arrayElemAt: ['$moderationActor.displayName', 0] },
            actedByEmail: { $arrayElemAt: ['$moderationActor.email', 0] },
          },
        },
      ]),
    ]);

    const statusCounts = { total: 0, draft: 0, review: 0, published: 0, archived: 0 };
    statusCountsRaw.forEach((row) => {
      const key = row?._id;
      if (key && Object.prototype.hasOwnProperty.call(statusCounts, key)) {
        statusCounts[key] = row.count;
      }
    });
    statusCounts.total = statusCounts.draft + statusCounts.review + statusCounts.published + statusCounts.archived;

    return {
      windowHours,
      status: statusCounts,
      publishing: {
        publishedLast7Days,
      },
      reviewQueue: reviewQueueOldest.map((item) => ({
        title: item.title,
        slug: item.slug,
        queuedAt: item.updatedAt || item.createdAt,
        author: item.author?.displayName || item.author?.email || 'Unknown',
      })),
      trends: {
        createdByDay: createdTrendRaw.map((item) => ({ date: item._id, value: item.value })),
        publishedByDay: publishedTrendRaw.map((item) => ({ date: item._id, value: item.value })),
      },
      recentModerations: recentModerationsRaw.map((item) => ({
        blogId: item.blogId,
        title: item.title,
        slug: item.slug,
        currentStatus: item.currentStatus,
        previousStatus: item.previousStatus,
        nextStatus: item.nextStatus,
        reason: item.reason,
        actedAt: item.actedAt,
        actedBy: item.actedByDisplayName || item.actedByEmail || 'Unknown',
      })),
    };
  }

  static async getChatbotInsights(hours = 24, limit = 20) {
    const windowHours = Math.max(1, Math.min(24 * 30, Number(hours) || 24));
    const modelLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const cutoff = new Date(Date.now() - (windowHours * 60 * 60 * 1000));
    const configuredModel = String(process.env.GROQ_MODEL || 'llama-3.3-70b-versatile');
    const configuredCompletionsUrl = String(process.env.GROQ_API_URL || 'https://api.groq.com/openai/v1/chat/completions');
    const timeoutMs = Number(process.env.GROQ_TIMEOUT_MS || 30000);
    const apiKeyConfigured = Boolean(process.env.GROQ_API_KEY);

    let modelsUrl = 'https://api.groq.com/openai/v1/models';
    try {
      const parsed = new URL(configuredCompletionsUrl);
      modelsUrl = `${parsed.origin}/openai/v1/models`;
    } catch (_) {
      // Keep default models URL.
    }

    let providerStatus = 'misconfigured';
    let providerError = null;
    let providerResponseTimeMs = null;
    let providerModelCount = 0;
    let configuredModelAvailable = false;
    let models = [];

    if (!apiKeyConfigured) {
      providerError = 'Missing GROQ_API_KEY environment variable.';
    } else {
      const startedAt = Date.now();
      try {
        const response = await axios.get(modelsUrl, {
          timeout: timeoutMs,
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
        });

        providerResponseTimeMs = Date.now() - startedAt;
        const rawModels = Array.isArray(response?.data?.data) ? response.data.data : [];
        models = rawModels
          .map((item) => ({
            id: item?.id || null,
            created: item?.created || null,
            ownedBy: item?.owned_by || null,
            contextWindow: item?.context_window || null,
          }))
          .filter((item) => Boolean(item.id))
          .slice(0, modelLimit);

        providerModelCount = rawModels.length;
        configuredModelAvailable = rawModels.some((item) => item?.id === configuredModel);
        providerStatus = configuredModelAvailable ? 'ok' : 'degraded';
        if (!configuredModelAvailable) {
          providerError = `Configured model "${configuredModel}" is not listed by Groq.`;
        }
      } catch (error) {
        providerStatus = 'error';
        providerResponseTimeMs = Date.now() - startedAt;
        providerError = error?.response?.data?.error?.message || error?.message || 'Failed to query Groq provider.';
      }
    }

    const [usageAgg, recentConversationsRaw] = await Promise.all([
      ChatConversation.aggregate([
        { $match: { createdAt: { $gte: cutoff }, isActive: true } },
        { $unwind: { path: '$messages', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            conversations: { $addToSet: '$_id' },
            messageCount: { $sum: { $cond: [{ $ifNull: ['$messages', false] }, 1, 0] } },
            userMessages: { $sum: { $cond: [{ $eq: ['$messages.role', 'user'] }, 1, 0] } },
            assistantMessages: { $sum: { $cond: [{ $eq: ['$messages.role', 'assistant'] }, 1, 0] } },
            avgAssistantResponseMs: {
              $avg: {
                $cond: [
                  { $eq: ['$messages.role', 'assistant'] },
                  '$messages.metadata.processingTime',
                  null,
                ],
              },
            },
          },
        },
      ]),
      ChatConversation.find({ createdAt: { $gte: cutoff }, isActive: true })
        .sort({ updatedAt: -1 })
        .limit(Math.max(1, Math.min(20, modelLimit)))
        .select('title updatedAt analytics messages')
        .lean(),
    ]);

    const usage = usageAgg[0] || {};
    const conversationCount = Array.isArray(usage.conversations) ? usage.conversations.length : 0;

    return {
      windowHours,
      generatedAt: new Date().toISOString(),
      usage: {
        conversationCount,
        messageCount: Number(usage.messageCount || 0),
        userMessages: Number(usage.userMessages || 0),
        assistantMessages: Number(usage.assistantMessages || 0),
        avgAssistantResponseMs: Number((usage.avgAssistantResponseMs || 0).toFixed(2)),
      },
      provider: {
        name: 'groq',
        status: providerStatus,
        apiKeyConfigured,
        configuredCompletionsUrl,
        modelsUrl,
        configuredModel,
        configuredModelAvailable,
        modelCount: providerModelCount,
        responseTimeMs: providerResponseTimeMs,
        timeoutMs,
        error: providerError,
      },
      models,
      recentConversations: recentConversationsRaw.map((item) => ({
        id: String(item._id),
        title: item.title || 'New chat',
        updatedAt: item.updatedAt || null,
        messageCount: Number(item?.analytics?.messageCount || (item.messages || []).length || 0),
      })),
    };
  }

  static toCsv(rows = [], columns = []) {
    const escape = (value) => {
      if (value == null) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = columns.join(',');
    const body = rows.map((row) => columns.map((col) => escape(row[col])).join(',')).join('\n');
    return `${header}\n${body}`;
  }

  /**
   * Get all users with pagination and filtering
   */
  static async getUsers(options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      role = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    // Build query
    const query = {};

    let meiliUserIds = null;
    let meiliUserTotal = null;
    if (search) {
      const meili = await SearchService.searchUserIds(search, { page, limit, role, status }).catch(() => null);
      if (meili) {
        meiliUserIds = meili.ids;
        meiliUserTotal = meili.total;
        query._id = { $in: meiliUserIds };
      } else {
        query.$or = [
          { displayName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
    }

    // Status filter
    if (status !== 'all') {
      query.isActive = status === 'active';
    }

    // Role filter
    if (role !== 'all') {
      query.role = role;
    }

    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .lean(),
      meiliUserIds ? Promise.resolve(meiliUserTotal) : User.countDocuments(query)
    ]);

    if (meiliUserIds) {
      const order = new Map(meiliUserIds.map((id, idx) => [String(id), idx]));
      users.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    // Transform location data for frontend compatibility
    const transformedUsers = users.map(user => ({
      ...user,
      location: user.location && (user.location.city || user.location.country) 
        ? {
            city: user.location.city || '',
            country: user.location.country || ''
          }
        : null,
      lastLogin: user.lastLoginAt || null
    }));

    return {
      users: transformedUsers,
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
   * Get user statistics
   */
  static async getUserStats(options = {}) {
    const { forceRefresh = false } = options;
    if (!forceRefresh) {
      const cached = getAdminStatsCache('users', ADMIN_STATS_CACHE_TTL_MS.users);
      if (cached) return cached;
    }

    const total = await User.countDocuments();
    const active = await User.countDocuments({ isActive: true });
    const inactive = await User.countDocuments({ isActive: false });
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 1);
    
    const newThisMonth = await User.countDocuments({
      createdAt: {
        $gte: monthStart,
        $lt: monthEnd
      }
    });

    const payload = {
      total,
      active,
      inactive,
      newThisMonth,
      roleBreakdown: {}
    };
    setAdminStatsCache('users', payload);
    return payload;
  }

  /**
   * Get user by ID
   */
  static async getUserById(id) {
    return await User.findById(id)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .lean();
  }

  /**
   * Update user status (activate/deactivate)
   */
  static async updateUserStatus(id, isActive, options = {}) {
    if (!isActive && !getUserStatusTemplate(options.reasonTemplateKey)) {
      throw new Error('Invalid reasonTemplateKey');
    }

    const existingUser = await User.findById(id).select('_id isActive email displayName preferences role');
    if (!existingUser) {
      return null;
    }

    const actorUserId = options.actorUserId ? String(options.actorUserId) : null;
    if (!isActive && actorUserId && String(existingUser._id) === actorUserId) {
      throw new Error('You cannot deactivate your own account');
    }

    if (!isActive && existingUser.role === 'admin' && existingUser.isActive) {
      const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdminCount <= 1) {
        throw new Error('Cannot deactivate the last active admin');
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');

    const statusChanged = existingUser.isActive !== isActive;

    if (user && statusChanged && !isActive && options.reasonTemplateKey) {
      notificationService
        .queueUserDeactivationEmails([user], options.reasonTemplateKey)
        .catch((error) => {
          logger.error(`Failed to queue deactivation email for user=${id}: ${error.message}`);
        });
    }

    if (user && statusChanged && isActive) {
      notificationService
        .queueUserReactivationEmails([user])
        .catch((error) => {
          logger.error(`Failed to queue reactivation email for user=${id}: ${error.message}`);
        });
    }

    clearAdminStatsCache(['users']);
    return user;
  }

  /**
   * Batch update user status
   */
  static async batchUpdateUserStatus(userIds, isActive, options = {}) {
    if (!isActive && !getUserStatusTemplate(options.reasonTemplateKey)) {
      throw new Error('Invalid reasonTemplateKey');
    }

    if (!isActive) {
      const [activeAdminCount, targetActiveAdminCount] = await Promise.all([
        User.countDocuments({ role: 'admin', isActive: true }),
        User.countDocuments({ _id: { $in: userIds }, role: 'admin', isActive: true }),
      ]);
      if (activeAdminCount - targetActiveAdminCount < 1) {
        throw new Error('Cannot deactivate the last active admin');
      }
    }

    const usersToNotify = await User.find({
      _id: { $in: userIds },
      isActive: { $ne: isActive },
    }).select('_id');

    const changedUserIds = usersToNotify.map((user) => user._id);

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { isActive }
    );

    if (!isActive && options.reasonTemplateKey && changedUserIds.length > 0) {
      notificationService
        .queueDeactivationEmailsByUserIds(changedUserIds, options.reasonTemplateKey)
        .catch((error) => {
          logger.error(`Failed to queue batch deactivation emails: ${error.message}`);
        });
    }

    if (isActive && changedUserIds.length > 0) {
      notificationService
        .queueReactivationEmailsByUserIds(changedUserIds)
        .catch((error) => {
          logger.error(`Failed to queue batch reactivation emails: ${error.message}`);
        });
    }

    clearAdminStatsCache(['users']);
    return {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    };
  }

  static getUserStatusEmailTemplates() {
    return getUserStatusTemplateOptions();
  }

  /**
   * Update user role
   */
  static async updateUserRole(id, role, options = {}) {
    const validRoles = ['admin', 'moderator', 'expert'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be one of: ' + validRoles.join(', '));
    }

    const existingUser = await User.findById(id).select('_id role isActive');
    if (!existingUser) return null;

    const actorUserId = options.actorUserId ? String(options.actorUserId) : null;
    if (actorUserId && String(existingUser._id) === actorUserId) {
      throw new Error('You cannot change your own role');
    }

    if (existingUser.role === 'admin' && role !== 'admin' && existingUser.isActive) {
      const activeAdminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (activeAdminCount <= 1) {
        throw new Error('Cannot change role for the last active admin');
      }
    }

    return await User.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires');
  }

  /**
   * Search users
   */
  static async searchUsers(query, options = {}) {
    const {
      page = 1,
      limit = 10,
      role = 'all',
      status = 'all'
    } = options;

    if (!query.trim()) {
      throw new Error('Search query is required');
    }

    const searchQuery = {};
    const meili = await SearchService.searchUserIds(query, { page, limit, role, status }).catch(() => null);
    let meiliIds = null;
    if (meili) {
      meiliIds = meili.ids;
      searchQuery._id = { $in: meiliIds };
    } else {
      searchQuery.$or = [
        { displayName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ];
    }

    // Add filters
    if (role !== 'all') {
      searchQuery.role = role;
    }
    if (status !== 'all') {
      searchQuery.isActive = status === 'active';
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('-password -resetPasswordToken -resetPasswordExpires')
        .lean(),
      meili ? Promise.resolve(meili.total) : User.countDocuments(searchQuery)
    ]);

    if (meiliIds) {
      const order = new Map(meiliIds.map((id, idx) => [String(id), idx]));
      users.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    return {
      users,
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
   * Get storage statistics from Cloudinary
   */
  static async getStorageStats(options = {}) {
    const { forceRefresh = false } = options;
    if (!forceRefresh) {
      const cached = getAdminStatsCache('storage', ADMIN_STATS_CACHE_TTL_MS.storage);
      if (cached) return cached;
    }

    try {
      const toNumber = (value) => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string' && value.trim() !== '') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const pickMetricValue = (metric, usageKeys, fallback = 0) => {
        if (typeof metric === 'number' || typeof metric === 'string') {
          const numeric = toNumber(metric);
          return numeric > 0 ? numeric : fallback;
        }

        if (!metric || typeof metric !== 'object') return fallback;

        for (const key of usageKeys) {
          const candidate = toNumber(metric[key]);
          if (candidate > 0) return candidate;
        }

        return fallback;
      };

      const DEFAULT_STORAGE_LIMIT_BYTES = toNumber(process.env.CLOUDINARY_STORAGE_LIMIT_BYTES) || 25 * 1024 * 1024 * 1024;
      const DEFAULT_BANDWIDTH_LIMIT_BYTES = toNumber(process.env.CLOUDINARY_BANDWIDTH_LIMIT_BYTES) || 25 * 1024 * 1024 * 1024;

      const fetchAllImages = async () => {
        const allResources = [];
        let nextCursor;

        do {
          const result = await cloudinary.api.resources({
            resource_type: 'image',
            type: 'upload',
            max_results: 500,
            ...(nextCursor ? { next_cursor: nextCursor } : {})
          });

          allResources.push(...(result.resources || []));
          nextCursor = result.next_cursor;
        } while (nextCursor);

        return allResources;
      };

      const [images, usage] = await Promise.all([
        fetchAllImages(),
        cloudinary.api.usage().catch(() => ({}))
      ]);

      const totalBytes = images.reduce((sum, img) => sum + img.bytes, 0);

      const formatBytes = (bytes) => {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
      };

      const storageUsed = pickMetricValue(
        usage?.storage,
        ['usage', 'used', 'current_usage', 'bytes_usage'],
        totalBytes
      ) || totalBytes;
      const storageLimit = pickMetricValue(
        usage?.storage,
        ['limit', 'allowed', 'max', 'bytes_limit', 'credits_limit'],
        toNumber(usage?.storage_limit) || DEFAULT_STORAGE_LIMIT_BYTES
      );
      const bandwidthUsed = pickMetricValue(
        usage?.bandwidth,
        ['usage', 'used', 'current_usage', 'bytes_usage'],
        toNumber(usage?.bandwidth_usage)
      );
      const bandwidthLimit = pickMetricValue(
        usage?.bandwidth,
        ['limit', 'allowed', 'max', 'bytes_limit', 'credits_limit', 'monthly_limit'],
        toNumber(usage?.bandwidth_limit) || DEFAULT_BANDWIDTH_LIMIT_BYTES
      );
      const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0;

      const payload = {
        plan: usage?.plan || null,
        total_images: images.length,
        total_size: totalBytes,
        total_size_formatted: formatBytes(totalBytes),
        storage_used: storageUsed,
        storage_used_formatted: formatBytes(storageUsed),
        storage_limit: storageLimit,
        storage_limit_formatted: formatBytes(storageLimit),
        storage_percentage: parseFloat(storagePercentage.toFixed(2)),
        bandwidth_used: bandwidthUsed,
        bandwidth_used_formatted: formatBytes(bandwidthUsed),
        bandwidth_limit: bandwidthLimit,
        bandwidth_limit_formatted: formatBytes(bandwidthLimit),
        last_updated: new Date().toISOString()
      };
      setAdminStatsCache('storage', payload);
      return payload;
    } catch (error) {
      throw new Error('Failed to fetch storage usage: ' + error.message);
    }
  }

  // Herb Management Methods
  static async getHerbs(options = {}) {
    const { page = 1, limit = 20, search, status, category, phytochemical } = options;
    
    const query = {};
    let meiliHerbIds = null;
    let meiliHerbTotal = null;
    if (search) {
      const meili = await SearchService.searchHerbIds(search, {
        page,
        limit,
        category: category || 'all',
        status: status || 'all',
      }).catch(() => null);
      if (meili && Array.isArray(meili.ids) && meili.ids.length > 0) {
        meiliHerbIds = meili.ids;
        meiliHerbTotal = meili.total;
        query._id = { $in: meiliHerbIds };
      } else {
        const clauses = AdminService.buildTokenizedSearchClauses(search, [
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
    }
    if (status !== undefined) {
      query.isActive = status === 'active'; // Convert string status to boolean
    }
    if (category) {
      query.category = category;
    }
    if (phytochemical) {
      const normalized = String(phytochemical || '').trim().toLowerCase();
      if (normalized && normalized !== 'all') {
        const categoryCandidates = new Set([normalized]);
        if (normalized === 'terpenes') {
          categoryCandidates.add('terpenoids');
        }
        const nameRegex = new RegExp(AdminService.escapeRegex(normalized), 'i');
        const phytochemicals = await Phytochemical.find({
          isActive: true,
          $or: [
            { category: { $in: Array.from(categoryCandidates) } },
            { name: nameRegex },
            { alternateNames: nameRegex },
          ],
        }).select('_id').lean();
        const compoundIds = phytochemicals.map((item) => item._id);

        if (compoundIds.length === 0) {
          query._id = { $in: [] };
        } else {
          const assignedHerbIds = await PhytochemicalAssignment.distinct('herbId', {
            phytochemicalId: { $in: compoundIds },
            status: 'active',
          });
          const phytochemicalClause = {
            $or: [
              { 'phytochemicals.compound': { $in: compoundIds } },
              ...(assignedHerbIds.length > 0 ? [{ _id: { $in: assignedHerbIds } }] : []),
            ],
          };
          query.$and = [...(query.$and || []), phytochemicalClause];
        }
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [herbs, total] = await Promise.all([
      Herb.find(query)
        .select('name scientificName commonNames symptoms properties phytochemicals images isActive slug')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('phytochemicals.compound', 'name')
        .lean(),
      meiliHerbIds ? Promise.resolve(meiliHerbTotal) : Herb.countDocuments(query)
    ]);

    if (meiliHerbIds) {
      const order = new Map(meiliHerbIds.map((id, idx) => [String(id), idx]));
      herbs.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    // Backfill from assignment source-of-truth when denormalized herb.phytochemicals is empty.
    const herbsNeedingBackfill = herbs.filter(
      (herb) => !Array.isArray(herb.phytochemicals) || herb.phytochemicals.length === 0
    );
    if (herbsNeedingBackfill.length > 0) {
      const herbIds = herbsNeedingBackfill.map((herb) => String(herb._id));
      const assignmentRows = await PhytochemicalAssignment.aggregate([
        {
          $match: {
            herbId: { $in: herbIds },
            status: 'active',
          },
        },
        { $sort: { concentrationValue: -1, updatedAt: -1 } },
        {
          $lookup: {
            from: 'phytochemicals',
            localField: 'phytochemicalId',
            foreignField: '_id',
            as: 'compound',
          },
        },
        { $unwind: { path: '$compound', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            herbId: 1,
            compound: {
              _id: '$compound._id',
              name: '$compound.name',
              category: '$compound.category',
              effects: '$compound.effects',
            },
            concentration: {
              $trim: {
                input: {
                  $concat: [
                    { $toString: '$concentrationValue' },
                    ' ',
                    { $ifNull: ['$concentrationUnit', ''] },
                  ],
                },
              },
            },
            partSource: '$herbPart',
          },
        },
        {
          $group: {
            _id: '$herbId',
            phytochemicals: { $push: '$$ROOT' },
          },
        },
      ]);

      const byHerbId = new Map(assignmentRows.map((row) => [String(row._id), row.phytochemicals || []]));
      herbs.forEach((herb) => {
        if (!Array.isArray(herb.phytochemicals) || herb.phytochemicals.length === 0) {
          herb.phytochemicals = byHerbId.get(String(herb._id)) || [];
        }
      });
    }

    return {
      herbs,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  static async getHerbStats(options = {}) {
    const { forceRefresh = false } = options;
    if (!forceRefresh) {
      const cached = getAdminStatsCache('herbs', ADMIN_STATS_CACHE_TTL_MS.herbs);
      if (cached) return cached;
    }

    const [total, active, inactive] = await Promise.all([
      Herb.countDocuments(),
      Herb.countDocuments({ isActive: true }),
      Herb.countDocuments({ isActive: false })
    ]);

    const payload = {
      total,
      active,
      inactive,
      pending: 0  // No pending status for herbs, using isActive boolean
    };
    setAdminStatsCache('herbs', payload);
    return payload;
  }

  static async getHerbById(id) {
    return await Herb.findOne({ _id: id }).lean();
  }

  static async updateHerbStatus(id, status) {
    const validStatuses = ['active', 'inactive', 'pending'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }

    const updated = await Herb.findOneAndUpdate(
      { _id: id },
      { status, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
    clearAdminStatsCache(['herbs']);
    return updated;
  }

  static async batchUpdateHerbStatus(ids, status) {
    const validStatuses = ['active', 'inactive', 'pending'];
    if (!validStatuses.includes(status)) {
      throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
    }

    const result = await Herb.updateMany(
      { _id: { $in: ids } },
      { status, updatedAt: new Date() },
      { multi: true }
    );
    clearAdminStatsCache(['herbs']);
    return result;
  }

  // Location Management Methods
  static async getLocations(options = {}) {
    const { page = 1, limit = 20, search, type, category, status } = options;
    
    const query = {};
    let meiliLocationIds = null;
    let meiliLocationTotal = null;
    const locationType = type || category;
    if (search) {
      const meili = await SearchService.searchLocationIds(search, {
        page,
        limit,
        type: locationType || 'all',
        status: status || 'all',
      }).catch(() => null);
      if (meili && Array.isArray(meili.ids) && meili.ids.length > 0) {
        meiliLocationIds = meili.ids;
        meiliLocationTotal = meili.total;
        query._id = { $in: meiliLocationIds };
      } else {
        const clauses = AdminService.buildTokenizedSearchClauses(search, [
          'name',
          'description',
          'type',
          'slug',
        ]);
        if (clauses.length > 0) {
          query.$and = [...(query.$and || []), ...clauses];
        }
      }
    }
    if (locationType && locationType !== 'all') {
      query.type = locationType;
    }
    if (status && status !== 'all') {
      query.isActive = status === 'active'; // Convert string status to boolean
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [locations, total] = await Promise.all([
      Location.find(query)
        .populate('herbs.herbId', 'name scientificName commonNames')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      meiliLocationIds ? Promise.resolve(meiliLocationTotal) : Location.countDocuments(query)
    ]);

    if (meiliLocationIds) {
      const order = new Map(meiliLocationIds.map((id, idx) => [String(id), idx]));
      locations.sort((a, b) => (order.get(String(a._id)) ?? Number.MAX_SAFE_INTEGER) - (order.get(String(b._id)) ?? Number.MAX_SAFE_INTEGER));
    }

    return {
      locations,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  static async getLocationStats() {
    const [total, active, inactive, byTypeRaw] = await Promise.all([
      Location.countDocuments(),
      Location.countDocuments({ isActive: true }),
      Location.countDocuments({ isActive: false }),
      Location.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const byType = {};
    byTypeRaw.forEach(item => {
      if (!item?._id) return;
      byType[String(item._id).trim().toLowerCase()] = item.count;
    });

    return {
      total,
      active,
      inactive,
      byType
    };
  }

  static async getLocationCategories() {
    const categories = await Location.distinct('type', { type: { $ne: null } });
    return categories
      .map(category => String(category).trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }

  static async getLocationStatuses() {
    return ['active', 'inactive'];
  }
}

module.exports = AdminService;
