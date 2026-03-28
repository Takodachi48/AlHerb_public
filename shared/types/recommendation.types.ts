import { Herb } from './herb.types';

export interface Recommendation {
  _id: string;
  user: string;
  symptoms: string[];
  age?: number;
  gender?: 'male' | 'female';
  additionalInfo: {
    medications: string[];
    allergies: string[];
    conditions: string[];
    preferences: string[];
  };
  recommendations: Array<{
    herb: string;
    confidence: number;
    reasoning?: string;
    dosage?: string;
    preparation?: string;
    warnings?: string[];
    alternatives?: Array<{
      herb: string;
      reason?: string;
    }>;
  }>;
  mlModel: {
    version: string;
    confidence: number;
    processingTime: number;
  };
  userFeedback?: {
    helpful?: boolean;
    effective?: boolean;
    sideEffects?: string[];
    notes?: string;
    rating?: number;
    wouldRecommend?: boolean;
    feedbackDate?: Date;
  };
  status: 'pending' | 'completed' | 'feedback_provided';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecommendationRequest {
  symptoms: string[];
  age?: number;
  gender?: 'male' | 'female';
  additionalInfo?: {
    medications?: string[];
    allergies?: string[];
    conditions?: string[];
    preferences?: string[];
  };
}

export interface RecommendationResponse {
  id: string;
  symptoms: string[];
  recommendations: Array<{
    herb: Herb;
    confidence: number;
    reasoning?: string;
    dosage?: string;
    preparation?: string;
    warnings?: string[];
    alternatives?: Array<{
      herb: Herb;
      reason?: string;
    }>;
  }>;
  confidence: number;
  mlModel: {
    version: string;
    processingTime: number;
  };
  createdAt: Date;
}

export interface RecommendationFeedback {
  helpful: boolean;
  effective: boolean;
  sideEffects?: string[];
  notes?: string;
  rating: number;
  wouldRecommend: boolean;
}
