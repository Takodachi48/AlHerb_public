// User type definitions for the Herbal Medicine System

export interface User {
  _id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
    city?: string;
    country?: string;
  };
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
    };
    language: string;
    theme: 'light' | 'dark' | 'auto';
  };
  medicalInfo: {
    allergies: string[];
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
    }>;
    conditions: string[];
  };
  profile: {
    bio?: string;
    favoriteHerbs: string[];
    savedRecommendations: string[];
  };
  isActive: boolean;
  lastLogin: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  displayName: string;
  photoURL?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female';
  bio?: string;
  location?: UserLocation;
  preferences?: UserPreferences;
  favoriteHerbs?: string[];
  savedRecommendations?: string[];
}

export interface UserPreferences {
  notifications: {
    email: boolean;
    push: boolean;
  };
  language: string;
  theme: 'light' | 'dark' | 'auto';
}

export interface MedicalInfo {
  allergies: string[];
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  conditions: string[];
}

export interface UserStats {
  totalRecommendations: number;
  totalFeedback: number;
  favoriteHerbCount: number;
  savedRecommendationCount: number;
  lastActiveDate: Date;
  joinDate: Date;
}

export interface UserLocation {
  address: string;
  city: string;
  country: string;
  coordinates: [number, number];
}
