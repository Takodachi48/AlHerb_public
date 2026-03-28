import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './apiClient';
import { Herb } from '../shared/types/herb.types';
import { COMMON_SYMPTOMS } from '../shared/constants/symptoms';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';

const CHAT_SESSION_KEY = 'chatSessionId';
const isRouteNotFoundError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const serverMessage = String(error?.response?.data?.message || error?.response?.data?.error || '').toLowerCase();
  return message.includes('route not found') || serverMessage.includes('route not found');
};

const assertString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
};

const normalizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  return [];
};

const asData = (raw: any) => raw?.data ?? raw;

const splitCsvList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') return [];

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapAgeGroupToProfile = (
  ageGroup: string,
  gender: string,
  options: { medications?: string[]; conditions?: string[]; allergies?: string[]; severity?: string; isPregnant?: boolean; isBreastfeeding?: boolean } = {},
) => {
  const ageMap: Record<string, number> = {
    children: 10,
    teens: 16,
    adults: 30,
    seniors: 70,
  };

  const normalizedGender = ['male', 'female'].includes(String(gender).toLowerCase())
    ? String(gender).toLowerCase()
    : undefined;

  return {
    age: ageMap[ageGroup] || 30,
    gender: normalizedGender,
    medications: splitCsvList(options?.medications),
    conditions: splitCsvList(options?.conditions),
    allergies: splitCsvList(options?.allergies),
    severity: options?.severity || 'moderate',
    ...(normalizedGender === 'female' ? { isPregnant: Boolean(options?.isPregnant), isBreastfeeding: Boolean(options?.isBreastfeeding) } : {}),
  };
};

const mapRecommendationResult = (entry: any, selectedSymptoms: string[]) => {
  const herb = entry?.herb || {};
  const score = parseOptionalNumber(entry?.score);
  const predictedRating = parseOptionalNumber(entry?.predictedRating);
  const predictedEffectiveness = parseOptionalNumber(entry?.predictedEffectiveness);

  // Confidence should be 0.0 to 1.0
  let confidence = 0;
  if (score !== null) {
    confidence = score > 1 ? score / 5 : score;
  } else if (predictedRating !== null) {
    confidence = predictedRating / 5;
  } else if (predictedEffectiveness !== null) {
    confidence = predictedEffectiveness > 1 ? predictedEffectiveness / 5 : predictedEffectiveness;
  } else if (entry?.confidence !== undefined) {
    confidence = entry.confidence;
  }

  // Effectiveness is 1 to 5
  const effectiveness = Math.max(1, Math.min(5, confidence * 5 || 3));

  const herbSymptoms = normalizeArray<string>(herb?.symptoms).map((s) => String(s).toLowerCase());
  const matchedSymptoms = selectedSymptoms.filter((sym) => {
    const needle = String(sym).toLowerCase();
    return herbSymptoms.some((hs) => hs.includes(needle) || needle.includes(hs));
  });

  const evidenceParts: string[] = [];
  if (predictedRating !== null) evidenceParts.push(`Predicted rating: ${predictedRating.toFixed(2)}/5`);
  if (predictedEffectiveness !== null) evidenceParts.push(`Predicted effectiveness: ${predictedEffectiveness.toFixed(2)}`);
  if (score !== null && score > 0) evidenceParts.push(`Ranking score: ${score.toFixed(3)}`);
  if (typeof entry?.reasoning === 'string' && entry.reasoning.trim()) evidenceParts.push(entry.reasoning.trim());

  return {
    herb,
    effectiveness,
    totalEffectiveness: effectiveness,
    confidence: confidence || (score ?? 0),
    matchedSymptoms,
    notes: evidenceParts.join(' • '),
    reasoning: String(entry?.reasoning || ''),
    warnings: normalizeArray<string>(entry?.warnings),
    contraindications: normalizeArray<any>(entry?.contraindications),
    drugInteractions: normalizeArray<any>(entry?.drugInteractions),
    score: score ?? 0,
    predictedRating,
    predictedEffectiveness,
    evidence: predictedRating !== null ? 'model-scored' : 'heuristic',
  };
};

const normalizeUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return '';
};

const collectStudyLinksFromSources = (sources: unknown, fallbackLabel: string): Array<{ url: string; label: string }> => {
  const items: Array<{ url: string; label: string }> = [];
  normalizeArray<any>(sources).forEach((source) => {
    const directUrl = normalizeUrl(source?.url);
    const pubmedId = String(source?.pubmedId || '').trim();
    const pubmedUrl = pubmedId ? `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/` : '';
    const url = directUrl || pubmedUrl;
    if (!url) return;

    const label = String(source?.title || source?.citation || fallbackLabel).trim() || fallbackLabel;
    items.push({ url, label });
  });
  return items;
};

const dedupeStudyLinks = (items: Array<{ url: string; label: string }>) => {
  const map = new Map<string, { url: string; label: string }>();
  items.forEach((item) => {
    if (!item.url) return;
    if (!map.has(item.url)) map.set(item.url, item);
  });
  return Array.from(map.values());
};

const hydrateRecommendationHerbs = async (results: any[]) => {
  const detailEntries = await Promise.all(
    results.map(async (entry) => {
      const herbId = String(entry?.herb?._id || '').trim();
      if (!herbId) return [herbId, entry?.herb || {}] as [string, any];
      try {
        const detail = await herbService.getHerbById(herbId);
        return [herbId, detail] as [string, any];
      } catch {
        return [herbId, entry?.herb || {}] as [string, any];
      }
    }),
  );
  return new Map<string, any>(detailEntries);
};

const mapRecommendationResultWithStudies = (entry: any, selectedSymptoms: string[], detailedHerb: any = null) => {
  const mapped = mapRecommendationResult(entry, selectedSymptoms);
  const herb = detailedHerb || mapped.herb || {};
  const contraindications = normalizeArray<any>(entry?.contraindications);
  const drugInteractions = normalizeArray<any>(entry?.drugInteractions);

  const rawLinks: Array<{ url: string; label: string }> = [
    ...collectStudyLinksFromSources(herb?.info?.sources, 'Herb reference'),
    ...collectStudyLinksFromSources(herb?.dosage?.sources, 'Dosage reference'),
  ];

  contraindications.forEach((item) => {
    const condition = String(item?.condition || '').trim();
    rawLinks.push(
      ...collectStudyLinksFromSources(
        item?.sources,
        condition ? `Contraindication (${condition})` : 'Contraindication reference',
      ),
    );
  });

  drugInteractions.forEach((item) => {
    const drugName = String(item?.interactsWith?.drugName || item?.with || '').trim();
    rawLinks.push(
      ...collectStudyLinksFromSources(
        item?.sources,
        drugName ? `Interaction (${drugName})` : 'Interaction reference',
      ),
    );
  });

  const studyLinks = dedupeStudyLinks(rawLinks);
  return {
    ...mapped,
    herb,
    notes: '',
    studyLinks,
    evidence: studyLinks.length > 0 ? 'study-links' : mapped.evidence,
  };
};

const extractBlogCollection = (payload: any) => {
  const data = asData(payload);

  if (Array.isArray(data)) {
    return { blogs: data, pagination: payload?.pagination || null };
  }

  if (Array.isArray(data?.blogs)) {
    return { blogs: data.blogs, pagination: data.pagination || payload?.pagination || null };
  }

  if (Array.isArray(payload?.blogs)) {
    return { blogs: payload.blogs, pagination: payload.pagination || null };
  }

  return { blogs: [], pagination: null };
};

const withApiGuard = async <T>(task: () => Promise<T>, context: string): Promise<T> => {
  try {
    return await task();
  } catch (error: any) {
    console.error(`[apiServices] ${context}:`, error?.message || error);
    throw error;
  }
};

export const herbService = {
  getAllHerbs: async (): Promise<any> => {
    return withApiGuard(async () => {
      const pageSize = 50;
      const firstResponse = await apiClient.get(API_ENDPOINTS.HERBS.LIST, { params: { page: 1, limit: pageSize } });
      const firstPayload = asData(firstResponse.data);
      const firstPageItems = normalizeArray<any>(firstPayload);
      const totalPages = Number(firstResponse?.data?.pagination?.totalPages || 1);

      if (!Number.isFinite(totalPages) || totalPages <= 1) {
        return firstPageItems;
      }

      const all = [...firstPageItems];
      for (let page = 2; page <= totalPages; page += 1) {
        const nextResponse = await apiClient.get(API_ENDPOINTS.HERBS.LIST, { params: { page, limit: pageSize } });
        const nextPayload = asData(nextResponse.data);
        all.push(...normalizeArray<any>(nextPayload));
      }
      return all;
    }, 'getAllHerbs');
  },

  getHerbById: async (id: string): Promise<Herb> => {
    assertString(id, 'Herb id');
    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.HERBS.DETAIL(id));
      const payload = asData(response.data);
      if (!payload || typeof payload !== 'object') {
        throw new Error('Invalid herb payload');
      }
      return payload as Herb;
    }, 'getHerbById');
  },

  searchHerbs: async (query: string): Promise<any> => {
    assertString(query, 'Search query');
    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.HERBS.SEARCH, { params: { q: query.trim() } });
      return asData(response.data);
    }, 'searchHerbs');
  },

  getHerbsBySymptom: async (symptom: string): Promise<any> => {
    assertString(symptom, 'Symptom');
    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.HERBS.BY_SYMPTOM(symptom.trim()));
      return asData(response.data);
    }, 'getHerbsBySymptom');
  },

  getFeaturedHerbs: async (): Promise<any> => {
    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.HERBS.LIST, { params: { limit: 20 } });
      const payload = asData(response.data);
      const list = normalizeArray<any>(payload);
      const featured = list.filter((h) => h?.isFeatured === true);
      return featured.length > 0 ? featured : list.slice(0, 6);
    }, 'getFeaturedHerbs');
  },
};

export const symptomService = {
  getAllSymptoms: async (): Promise<any> => {
    return withApiGuard(async () => {
      const list = Object.entries(COMMON_SYMPTOMS).flatMap(([category, symptoms]) =>
        normalizeArray<string>(symptoms).map((name) => ({
          _id: name,
          id: name,
          name,
          category,
        }))
      );
      return list;
    }, 'getAllSymptoms');
  },

  getRecommendationsBySymptoms: async (
    symptomIds: string[],
    ageGroup: string,
    gender: string,
    options: { medications?: string[]; conditions?: string[]; allergies?: string[]; severity?: string; isPregnant?: boolean; isBreastfeeding?: boolean } = {},
  ): Promise<any> => {
    if (!Array.isArray(symptomIds) || symptomIds.length === 0) {
      throw new Error('At least one symptom is required');
    }

    return withApiGuard(async () => {
      const profile = mapAgeGroupToProfile(ageGroup, gender, options);
      const response = await apiClient.post(API_ENDPOINTS.HERBS.RECOMMEND, {
        symptoms: symptomIds,
        userProfile: profile,
        topN: 10,
      });

      const payload = asData(response.data);
      const results = normalizeArray<any>(payload?.results);
      const herbDetailsMap = await hydrateRecommendationHerbs(results);

      return {
        recommendations: results.map((entry) => {
          const herbId = String(entry?.herb?._id || '').trim();
          const detailedHerb = herbId ? herbDetailsMap.get(herbId) : entry?.herb;
          return mapRecommendationResultWithStudies(entry, symptomIds, detailedHerb);
        }),
        status: payload?.status || 'ok',
        rankingSource: payload?.rankingSource || 'unknown',
        redFlags: normalizeArray<any>(payload?.redFlags),
        excluded: payload?.excluded || { contraindications: [], drugInteractions: [], combinationConflicts: [] },
        safetyPolicy: payload?.safetyPolicy || null,
        message: String(payload?.message || ''),
      };
    }, 'getRecommendationsBySymptoms');
  },
};

export const locationService = {
  getAllLocations: async (): Promise<any> => {
    return withApiGuard(async () => {
      const pageSize = 100;
      const allLocations: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await apiClient.get(API_ENDPOINTS.LOCATIONS.LIST, {
          params: { page, limit: pageSize },
        });
        const payload = asData(response.data);

        const pageLocations = Array.isArray(payload?.locations)
          ? payload.locations
          : normalizeArray<any>(payload);

        allLocations.push(...pageLocations);

        const pagination = payload?.pagination;
        if (!pagination || pagination.hasMore !== true) {
          hasMore = false;
        } else {
          page += 1;
          if (page > 100) hasMore = false;
        }
      }

      return allLocations;
    }, 'getAllLocations');
  },

  getLocationsByType: async (type: string): Promise<any> => {
    assertString(type, 'Location type');
    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.LOCATIONS.LIST, { params: { type } });
      return asData(response.data);
    }, 'getLocationsByType');
  },

  getNearbyLocations: async (latitude: number, longitude: number, maxDistance = 25): Promise<any> => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('Valid coordinates are required');
    }

    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.LOCATIONS.NEARBY, {
        params: {
          lat: latitude,
          lng: longitude,
          radius: maxDistance,
        },
      });
      return asData(response.data);
    }, 'getNearbyLocations');
  },

  getLocationClusters: async (
    bounds: { swLat: number; swLng: number; neLat: number; neLng: number; zoom?: number },
    options: { type?: string; herb?: string; search?: string } = {}
  ): Promise<any> => {
    const swLat = Number(bounds?.swLat);
    const swLng = Number(bounds?.swLng);
    const neLat = Number(bounds?.neLat);
    const neLng = Number(bounds?.neLng);
    const zoom = Number(bounds?.zoom ?? 10);

    const isValidBounds = [swLat, swLng, neLat, neLng].every((value) => Number.isFinite(value));
    if (!isValidBounds) {
      throw new Error('Valid map bounds are required');
    }

    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.LOCATIONS.CLUSTERS, {
        params: {
          swLat,
          swLng,
          neLat,
          neLng,
          zoom: Number.isFinite(zoom) ? Math.max(1, Math.min(20, Math.round(zoom))) : 10,
          type: options?.type,
          herb: options?.herb,
          search: options?.search,
        },
      });

      const payload = asData(response.data);
      return Array.isArray(payload) ? payload : [];
    }, 'getLocationClusters');
  },

  getLocationsWithHerbs: async (herbIds: string[], city: string | null = null): Promise<any> => {
    if (!Array.isArray(herbIds) || herbIds.length === 0) {
      throw new Error('At least one herb id is required');
    }

    return withApiGuard(async () => {
      const response = await apiClient.get(API_ENDPOINTS.LOCATIONS.LIST, {
        params: {
          herb: herbIds[0],
          search: city || undefined,
          limit: 100,
        },
      });
      return asData(response.data);
    }, 'getLocationsWithHerbs');
  },
};

export const blogService = {
  getAllBlogs: async (page = 1, limit = 10): Promise<any> => {
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs', { params: { page, limit } });
      const parsed = extractBlogCollection(response.data);
      return { data: parsed.blogs, pagination: parsed.pagination };
    }, 'getAllBlogs');
  },

  getBlogById: async (idOrSlug: string): Promise<any> => {
    assertString(idOrSlug, 'Blog identifier');
    return withApiGuard(async () => {
      try {
        const bySlug = await apiClient.get(`/blogs/slug/${encodeURIComponent(idOrSlug)}`);
        return asData(bySlug.data);
      } catch {
        // Draft/review/archived posts are not returned in public listings.
        // Try authenticated ID lookup before falling back to published list scan.
        try {
          const byId = await apiClient.get(`/blogs/${encodeURIComponent(idOrSlug)}`);
          return asData(byId.data);
        } catch {
          const listResponse = await apiClient.get('/blogs', { params: { page: 1, limit: 100 } });
          const parsed = extractBlogCollection(listResponse.data);
          const found = parsed.blogs.find((b: any) => b?._id === idOrSlug || b?.slug === idOrSlug);
          if (!found) throw new Error('Blog not found');
          return found;
        }
      }
    }, 'getBlogById');
  },

  getBlogsByCategory: async (category: string): Promise<any> => {
    assertString(category, 'Category');
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs', { params: { category } });
      const parsed = extractBlogCollection(response.data);
      return parsed.blogs;
    }, 'getBlogsByCategory');
  },

  searchBlogs: async (query: string): Promise<any> => {
    assertString(query, 'Search query');
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs/search', { params: { q: query.trim() } });
      const payload = asData(response.data);
      return normalizeArray<any>(payload);
    }, 'searchBlogs');
  },

  getCommunityBlogs: async (params: any = {}): Promise<any> => {
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs', { params });
      const parsed = extractBlogCollection(response.data);
      return { data: parsed.blogs, pagination: parsed.pagination };
    }, 'getCommunityBlogs');
  },

  getBlogsByHerb: async (herbId: string): Promise<any> => {
    assertString(herbId, 'Herb id');
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs', { params: { herbId } });
      const parsed = extractBlogCollection(response.data);
      return { data: parsed.blogs, pagination: parsed.pagination };
    }, 'getBlogsByHerb');
  },

  getMyBlogs: async (page = 1, limit = 10): Promise<any> => {
    return withApiGuard(async () => {
      const response = await apiClient.get('/blogs/user/blogs', { params: { page, limit } });
      const payload = asData(response.data);
      if (Array.isArray(payload)) {
        return { data: payload, pagination: null };
      }
      return { data: normalizeArray<any>(payload?.blogs), pagination: payload?.pagination || null };
    }, 'getMyBlogs');
  },

  createBlog: async (blogData: any): Promise<any> => {
    return withApiGuard(async () => {
      const response = await apiClient.post('/blogs', blogData);
      return asData(response.data);
    }, 'createBlog');
  },

  requestBlogApproval: async (id: string): Promise<any> => {
    assertString(id, 'Blog id');
    return withApiGuard(async () => {
      const response = await apiClient.patch(`/blogs/${id}/request-approval`);
      return asData(response.data);
    }, 'requestBlogApproval');
  },

  archiveBlog: async (id: string): Promise<any> => {
    assertString(id, 'Blog id');
    return withApiGuard(async () => {
      try {
        const statusResponse = await apiClient.patch(`/blogs/${id}/status`, { status: 'archived' });
        return asData(statusResponse.data);
      } catch {
        // Fallback to legacy update flow on older deployments.
      }

      try {
        const response = await apiClient.put(`/blogs/${id}`, { status: 'archived' });
        return asData(response.data);
      } catch (error: any) {
        if (error?.status !== 400 || !String(error?.message || '').toLowerCase().includes('validation')) {
          throw error;
        }

        const current = await blogService.getBlogById(id);
        const blog = current?.data || current;
        const fallbackPayload = {
          title: String(blog?.title || ''),
          excerpt: String(blog?.excerpt || ''),
          content: String(blog?.content || ''),
          category: String(blog?.category || 'general'),
          tags: Array.isArray(blog?.tags) ? blog.tags : [],
          status: 'archived',
          ...(blog?.featuredImage ? { featuredImage: blog.featuredImage } : {}),
        };
        const response = await apiClient.put(`/blogs/${id}`, fallbackPayload);
        return asData(response.data);
      }
    }, 'archiveBlog');
  },

  unarchiveBlog: async (id: string): Promise<any> => {
    assertString(id, 'Blog id');
    return withApiGuard(async () => {
      try {
        const statusResponse = await apiClient.patch(`/blogs/${id}/status`, { status: 'draft' });
        return asData(statusResponse.data);
      } catch {
        // Fallback to legacy update flow on older deployments.
      }

      try {
        const response = await apiClient.put(`/blogs/${id}`, { status: 'draft' });
        return asData(response.data);
      } catch (error: any) {
        if (error?.status !== 400 || !String(error?.message || '').toLowerCase().includes('validation')) {
          throw error;
        }

        const current = await blogService.getBlogById(id);
        const blog = current?.data || current;
        const fallbackPayload = {
          title: String(blog?.title || ''),
          excerpt: String(blog?.excerpt || ''),
          content: String(blog?.content || ''),
          category: String(blog?.category || 'general'),
          tags: Array.isArray(blog?.tags) ? blog.tags : [],
          status: 'draft',
          ...(blog?.featuredImage ? { featuredImage: blog.featuredImage } : {}),
        };
        const response = await apiClient.put(`/blogs/${id}`, fallbackPayload);
        return asData(response.data);
      }
    }, 'unarchiveBlog');
  },

  updateBlog: async (id: string, blogData: any): Promise<any> => {
    assertString(id, 'Blog id');
    return withApiGuard(async () => {
      const response = await apiClient.put(`/blogs/${id}`, blogData);
      return asData(response.data);
    }, 'updateBlog');
  },

  deleteBlog: async (id: string): Promise<any> => {
    assertString(id, 'Blog id');
    return withApiGuard(async () => {
      const response = await apiClient.delete(`/blogs/${id}`);
      return asData(response.data);
    }, 'deleteBlog');
  },

  toggleBlogLike: async (_id: string): Promise<any> => {
    assertString(_id, 'Blog id');
    return withApiGuard(async () => {
      try {
        const response = await apiClient.post(`/blogs/${_id}/like`);
        return asData(response.data);
      } catch (error) {
        if (isRouteNotFoundError(error)) {
          return { localOnly: true };
        }
        throw error;
      }
    }, 'toggleBlogLike');
  },

  addBlogComment: async (blogId: string, commentData: any): Promise<any> => {
    assertString(blogId, 'Blog id');
    return withApiGuard(async () => {
      const payload = {
        blogId,
        content: String(commentData?.content || '').trim(),
        parentId: commentData?.parentId,
      };

      assertString(payload.content, 'Comment content');
      const response = await apiClient.post('/comments', payload);
      return asData(response.data);
    }, 'addBlogComment');
  },

  toggleBlogBookmark: async (_id: string): Promise<any> => {
    assertString(_id, 'Blog id');
    return withApiGuard(async () => {
      try {
        const response = await apiClient.post(`/blogs/${_id}/bookmark`);
        return asData(response.data);
      } catch (error) {
        if (isRouteNotFoundError(error)) {
          return { localOnly: true };
        }
        throw error;
      }
    }, 'toggleBlogBookmark');
  },

  getSavedBlogs: async (page = 1, limit = 10): Promise<any> => {
    return withApiGuard(async () => {
      try {
        const response = await apiClient.get('/blogs/saved', { params: { page, limit } });
        const payload = asData(response.data);
        if (Array.isArray(payload?.blogs)) {
          return { data: payload.blogs, pagination: payload.pagination || null };
        }
        return { data: [], pagination: payload?.pagination || null };
      } catch (primaryError: any) {
        // Some deployments return 500 for saved blogs when one bookmarked blog is stale.
        // Fallback to regular listing and derive bookmarked items from serialized flags.
        console.warn('[apiServices] getSavedBlogs fallback:', primaryError?.message || primaryError);
        try {
          const fallbackResponse = await apiClient.get('/blogs', { params: { page: 1, limit: 100 } });
          const parsed = extractBlogCollection(fallbackResponse.data);
          const savedBlogs = parsed.blogs.filter((blog: any) => Boolean(blog?.isBookmarked));
          const safePage = Math.max(1, Number(page) || 1);
          const safeLimit = Math.max(1, Number(limit) || 10);
          const start = (safePage - 1) * safeLimit;
          const paged = savedBlogs.slice(start, start + safeLimit);

          return {
            data: paged,
            pagination: {
              page: safePage,
              limit: safeLimit,
              total: savedBlogs.length,
              totalPages: Math.max(1, Math.ceil(savedBlogs.length / safeLimit)),
            },
          };
        } catch (fallbackError: any) {
          console.warn('[apiServices] getSavedBlogs fallback failed:', fallbackError?.message || fallbackError);
          return {
            data: [],
            pagination: {
              page: Math.max(1, Number(page) || 1),
              limit: Math.max(1, Number(limit) || 10),
              total: 0,
              totalPages: 1,
            },
          };
        }
      }
    }, 'getSavedBlogs');
  },

  getBlogComments: async (blogId: string, page = 1, limit = 10): Promise<any> => {
    assertString(blogId, 'Blog id');
    return withApiGuard(async () => {
      const response = await apiClient.get(`/comments/blog/${blogId}`, {
        params: { page, limit, includeReplies: true }
      });
      return asData(response.data);
    }, 'getBlogComments');
  },

  updateBlogComment: async (commentId: string, content: string): Promise<any> => {
    assertString(commentId, 'Comment id');
    assertString(content, 'Comment content');
    return withApiGuard(async () => {
      const response = await apiClient.put(`/comments/${commentId}`, {
        content: content.trim(),
      });
      return asData(response.data);
    }, 'updateBlogComment');
  },

  deleteBlogComment: async (commentId: string): Promise<any> => {
    assertString(commentId, 'Comment id');
    return withApiGuard(async () => {
      const response = await apiClient.delete(`/comments/${commentId}`);
      return asData(response.data);
    }, 'deleteBlogComment');
  },

  getBlogLikes: async (blogId: string): Promise<any> => {
    assertString(blogId, 'Blog id');
    return withApiGuard(async () => {
      const response = await apiClient.get(`/blogs/${blogId}/likes`);
      return asData(response.data);
    }, 'getBlogLikes');
  },

  toggleCommentLike: async (_commentId: string): Promise<any> => {
    assertString(_commentId, 'Comment id');
    return withApiGuard(async () => {
      const response = await apiClient.post(`/comments/${_commentId}/like`);
      return asData(response.data);
    }, 'toggleCommentLike');
  },
};

export const interactionService = {
  getHerbInteractions: async (herbId: string): Promise<any> => {
    assertString(herbId, 'Herb id');
    return withApiGuard(async () => {
      const response = await apiClient.post(API_ENDPOINTS.HERBS.SAFETY_INTERACTIONS(herbId), {
        type: 'drug-herb',
      });
      const payload = asData(response.data);
      return payload?.all || [];
    }, 'getHerbInteractions');
  },

  checkDrugInteractions: async (herbId: string, drugName: string): Promise<any> => {
    assertString(herbId, 'Herb id');
    assertString(drugName, 'Drug name');

    return withApiGuard(async () => {
      const response = await apiClient.post(API_ENDPOINTS.HERBS.SAFETY_INTERACTIONS(herbId), {
        type: 'drug-herb',
        medications: [drugName],
      });
      const payload = asData(response.data);
      return payload;
    }, 'checkDrugInteractions');
  },

  getInteractionsBySeverity: async (_severity: string): Promise<any> => {
    return [] as any;
  },
};

const getOrCreateChatSessionId = async () => {
  const existing = await AsyncStorage.getItem(CHAT_SESSION_KEY);
  if (existing) return existing;
  const created = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(CHAT_SESSION_KEY, created);
  return created;
};

export const chatbotService = {
  sendMessage: async (message: string, _history: any[] = []): Promise<any> => {
    assertString(message, 'Message');

    return withApiGuard(async () => {
      const sessionId = await getOrCreateChatSessionId();
      const response = await apiClient.post(API_ENDPOINTS.CHAT.SEND, {
        message: message.trim(),
        sessionId,
      });

      const payload = asData(response.data);
      const reply = payload?.reply || '';

      return {
        success: true,
        data: {
          role: 'assistant',
          content: reply,
          reply,
          timestamp: new Date().toISOString(),
          conversationId: payload?.conversationId || null,
        },
      } as any;
    }, 'chatbotService.sendMessage');
  },
};

export const identificationService = {
  submitFeedback: async (identificationId: string, isCorrect: boolean, rating: number, userCorrection?: string): Promise<any> => {
    assertString(identificationId, 'Identification ID');

    return withApiGuard(async () => {
      const payload: any = {
        isCorrect,
        rating,
      };
      if (userCorrection) {
        payload.userCorrection = userCorrection.trim();
      }

      const response = await apiClient.post(API_ENDPOINTS.IMAGES.IDENTIFICATION_FEEDBACK(identificationId), payload);
      return asData(response.data);
    }, 'identificationService.submitFeedback');
  },
};
