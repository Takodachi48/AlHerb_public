import apiClient from './apiClient';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';

type RecommendationHistoryFilters = {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  rankingSource?: string;
  blocked?: string;
};

type PaginationShape = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

const toArray = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

const toObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' ? (value as Record<string, any>) : {};

const toIsoDate = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const normalizeRecommendationPagination = (value: unknown): PaginationShape => {
  const pagination = toObject(value);
  const page = Math.max(1, Number.parseInt(String(pagination.page || 1), 10) || 1);
  const limit = Math.max(1, Number.parseInt(String(pagination.limit || 20), 10) || 20);
  const total = Math.max(0, Number.parseInt(String(pagination.total || 0), 10) || 0);
  const totalPages = Math.max(1, Number.parseInt(String(pagination.totalPages || 1), 10) || 1);
  const hasNextPage = Boolean(pagination.hasNextPage);
  const hasPrevPage = Boolean(pagination.hasPrevPage);

  return { page, limit, total, totalPages, hasNextPage, hasPrevPage };
};

const normalizeScanPagination = (value: unknown): PaginationShape => {
  const pagination = toObject(value);
  const page = Math.max(1, Number.parseInt(String(pagination.page || 1), 10) || 1);
  const limit = Math.max(1, Number.parseInt(String(pagination.limit || 10), 10) || 10);
  const total = Math.max(0, Number.parseInt(String(pagination.total || 0), 10) || 0);
  const pages = Math.max(1, Number.parseInt(String(pagination.pages || 1), 10) || 1);

  return {
    page,
    limit,
    total,
    totalPages: pages,
    hasNextPage: page < pages,
    hasPrevPage: page > 1,
  };
};

const userActivityService = {
  async getRecommendationHistory(filters: RecommendationHistoryFilters = {}) {
    const response = await apiClient.get(API_ENDPOINTS.USERS.RECOMMENDATION_HISTORY, {
      params: {
        page: filters.page || 1,
        limit: filters.limit || 20,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        rankingSource: filters.rankingSource || undefined,
        blocked: filters.blocked || undefined,
      },
    });

    const payload = toObject(response?.data?.data || response?.data);
    const items = toArray<any>(payload.items).map((entry) => ({
      id: String(entry?.id || ''),
      createdAt: toIsoDate(entry?.createdAt),
      status: String(entry?.status || 'completed'),
      isBlocked: Boolean(entry?.isBlocked),
      rankingSource: String(entry?.rankingSource || 'unknown'),
      symptoms: toArray<string>(entry?.symptoms).map((item) => String(item || '').trim()).filter(Boolean),
      recommendationCount: Number(entry?.recommendationCount || 0),
      symptomCount: Number(entry?.symptomCount || 0),
      topHerbs: toArray<any>(entry?.topHerbs).map((herb) => ({
        id: String(herb?.id || ''),
        name: String(herb?.name || ''),
        scientificName: String(herb?.scientificName || ''),
        slug: String(herb?.slug || ''),
        confidence: Number(herb?.confidence || 0),
      })),
      feedbackRating:
        entry?.feedbackRating === null || entry?.feedbackRating === undefined
          ? null
          : Number(entry.feedbackRating),
    }));

    return {
      items,
      pagination: normalizeRecommendationPagination(payload.pagination),
    };
  },

  async getScanHistory({ page = 1, limit = 20 }: { page?: number; limit?: number } = {}) {
    const response = await apiClient.get(API_ENDPOINTS.IMAGES.IDENTIFICATION, {
      params: { page, limit },
    });

    const payload = toObject(response?.data?.data || response?.data);
    const identifications = toArray<any>(payload.identifications).map((entry) => ({
      id: String(entry?._id || ''),
      status: String(entry?.status || 'pending'),
      createdAt: toIsoDate(entry?.createdAt || entry?.metadata?.uploadedAt),
      imageUrl: String(entry?.image?.url || ''),
      herbId: String(entry?.classification?.herbId || ''),
      commonName: String(entry?.classification?.commonName || ''),
      scientificName: String(entry?.classification?.scientificName || ''),
      confidence: Number(entry?.classification?.confidence || 0),
      alternatives: toArray<any>(entry?.classification?.alternatives),
      notes: String(entry?.notes || ''),
    }));

    return {
      items: identifications,
      pagination: normalizeScanPagination(payload.pagination),
    };
  },
};

export default userActivityService;
