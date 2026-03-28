import apiClient from './apiClient';
import { ApiResponse } from '../shared/types/api.types';

export interface UserStats {
  favoriteHerbCount: number;
  totalRecommendations: number;
  savedRecommendationCount: number;
  totalFeedback: number;
  lastActiveDate: string;
  joinDate: string;
}

class StatsService {
  // Get user-specific statistics
  async getUserStats(): Promise<UserStats> {
    try {
      const response = await apiClient.get('/users/stats');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error fetching user stats:', error?.message);
      throw error;
    }
  }

  // Get system-wide statistics
  async getSystemStats(): Promise<any> {
    try {
      const response = await apiClient.get('/admin/monitoring/dashboard-overview');
      return response.data?.data || response.data;
    } catch (error: any) {
      console.error('Error fetching system stats:', error?.message);
      return null;
    }
  }

  // Get daily herbal tip (could be expanded to fetch from API)
  getDailyTips(): string[] {
    return [
      'Ginger can help reduce nausea and motion sickness when taken before travel.',
      'Turmeric contains curcumin, which has powerful anti-inflammatory and antioxidant properties.',
      'Peppermint oil may help relieve tension headaches and improve digestion.',
      'Lavender can promote relaxation and improve sleep quality when used as aromatherapy.',
      'Echinacea may help boost the immune system and reduce the duration of colds.',
      'Chamomile tea can help reduce anxiety and improve sleep quality.',
      'Garlic has natural antibiotic properties and may help lower blood pressure.',
      'Green tea contains antioxidants that may help reduce inflammation and improve brain function.',
    ];
  }
}

export default new StatsService();
