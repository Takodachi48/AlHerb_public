import apiClient from './apiClient';
import { ApiResponse } from '../shared/types/api.types';
import { API_ENDPOINTS } from '../shared/constants/api-endpoints';

const asData = (raw: any) => raw?.data ?? raw;
const normalizeMedicationName = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim();

const dedupeMedications = (medications: unknown[]) => {
  const seen = new Set<string>();
  const list: string[] = [];

  medications.forEach((entry) => {
    const raw = typeof entry === 'string' ? entry : (entry as any)?.name;
    const normalized = normalizeMedicationName(raw);
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    list.push(normalized);
  });

  return list;
};

const toInteractionRecord = (item: any, herbMap: Record<string, any>) => {
  const herbId = String(item?.herbId?._id || item?.herbId || '');
  const otherHerbId = String(item?.interactsWith?.herbId?._id || item?.interactsWith?.herbId || '');

  return {
    ...item,
    herbId: {
      _id: herbId,
      name: herbMap[herbId]?.name || herbId,
      scientificName: herbMap[herbId]?.scientificName || '',
    },
    interactsWith: {
      ...item?.interactsWith,
      herbId: otherHerbId
        ? {
            _id: otherHerbId,
            name: herbMap[otherHerbId]?.name || otherHerbId,
            scientificName: herbMap[otherHerbId]?.scientificName || '',
          }
        : item?.interactsWith?.herbId,
      type: item?.interactsWith?.drugName ? 'drug' : 'herb',
    },
  };
};

export const interactionService = {
  getUserMedications: async (): Promise<ApiResponse<string[]>> => {
    const response = await apiClient.get(API_ENDPOINTS.USERS.MEDICAL_INFO);
    const payload = asData(response.data);
    const medications = Array.isArray(payload?.medications) ? payload.medications : [];

    return {
      success: true,
      data: dedupeMedications(medications),
    } as any;
  },

  getAvailableHerbs: async (params: any = {}): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.get(API_ENDPOINTS.HERBS.LIST, {
      params: {
        limit: params?.limit || 100,
        page: 1,
      },
    });

    const payload = asData(response.data);
    const herbs = Array.isArray(payload) ? payload : [];

    return {
      success: true,
      data: herbs,
    } as any;
  },

  checkInteractions: async (data: any): Promise<ApiResponse<any>> => {
    const herbs = Array.isArray(data?.herbs) ? data.herbs.filter(Boolean) : [];
    const drugs = Array.isArray(data?.drugs) ? data.drugs.filter(Boolean) : [];
    const type = data?.type;

    if (herbs.length === 0) {
      throw new Error('At least one herb is required');
    }

    const herbLookupResponse = await apiClient.get(API_ENDPOINTS.HERBS.LIST, { params: { limit: 100, page: 1 } });
    const herbList = asData(herbLookupResponse.data);
    const herbMap = Array.isArray(herbList)
      ? herbList.reduce((acc: Record<string, any>, herb: any) => {
          acc[String(herb?._id)] = herb;
          return acc;
        }, {})
      : {};

    if (type === 'herb-herb') {
      const response = await apiClient.post(API_ENDPOINTS.HERBS.SAFETY_COMBINATION, { herbIds: herbs });
      const payload = asData(response.data);
      const records = Array.isArray(payload) ? payload.map((item) => toInteractionRecord(item, herbMap)) : [];

      return {
        success: true,
        data: {
          herbHerbInteractions: records,
        },
      } as any;
    }

    const herbDrugInteractions: any[] = [];

    for (const herbId of herbs) {
      const response = await apiClient.post(API_ENDPOINTS.HERBS.SAFETY_INTERACTIONS(herbId), {
        type: 'drug-herb',
        medications: drugs,
      });

      const payload = asData(response.data);
      const records = Array.isArray(payload?.matchedDrugs)
        ? payload.matchedDrugs.map((item: any) => toInteractionRecord(item, herbMap))
        : [];

      herbDrugInteractions.push(...records);
    }

    return {
      success: true,
      data: {
        herbDrugInteractions,
      },
    } as any;
  },

  getHerbInteractions: async (herbId: string, params: any = {}): Promise<ApiResponse<any[]>> => {
    const response = await apiClient.post(API_ENDPOINTS.HERBS.SAFETY_INTERACTIONS(herbId), {
      type: params?.type || 'drug-herb',
      minSeverity: params?.minSeverity,
      medications: Array.isArray(params?.medications) ? params.medications : [],
    });

    const payload = asData(response.data);
    return {
      success: true,
      data: Array.isArray(payload?.all) ? payload.all : [],
    } as any;
  },

  getHerbsByDrug: async (_drugName: string, _params: any = {}): Promise<ApiResponse<any[]>> => {
    return { success: true, data: [] } as any;
  },

  createInteraction: async (_data: any): Promise<ApiResponse<any>> => {
    throw new Error('Interaction creation is not supported by the current server contract');
  },

  updateInteraction: async (_id: string, _data: any): Promise<ApiResponse<any>> => {
    throw new Error('Interaction update is not supported by the current server contract');
  },

  deleteInteraction: async (_id: string): Promise<ApiResponse<any>> => {
    throw new Error('Interaction deletion is not supported by the current server contract');
  },
};

export default interactionService;
