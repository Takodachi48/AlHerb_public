// Location type definitions for the Herbal Medicine System

export interface Location {
  _id: string;
  name: string;
  type: 'market' | 'store' | 'foraging_spot' | 'clinic' | 'garden' | 'pharmacy';
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone?: string;
    email?: string;
    website?: string;
  };
  operatingHours: Array<{
    day: string;
    open: string;
    close: string;
    closed?: boolean;
  }>;
  availableHerbs: string[];
  services: string[];
  rating: {
    average: number;
    count: number;
  };
  reviews: Array<{
    user: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }>;
  images: Array<{
    url: string;
    caption?: string;
    isPrimary?: boolean;
  }>;
  description?: string;
  features: string[];
  priceRange: '$' | '$$' | '$$$' | '$$$$';
  verified: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
  type?: Location['type'];
  limit?: number;
  offset?: number;
}

export interface LocationSearchFilters {
  type?: Location['type'][];
  priceRange?: Location['priceRange'][];
  features?: string[];
  services?: string[];
  availableHerbs?: string[];
  minRating?: number;
  verified?: boolean;
}

export interface LocationReview {
  user: string;
  location: string;
  rating: number;
  comment: string;
  images?: Array<{
    url: string;
    caption?: string;
  }>;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocationCreateData {
  name: string;
  type: Location['type'];
  coordinates: {
    latitude: number;
    longitude: number;
  };
  address: Location['address'];
  contact?: Location['contact'];
  operatingHours?: Array<{
    day: string;
    open: string;
    close: string;
    closed?: boolean;
  }>;
  availableHerbs?: string[];
  services?: string[];
  description?: string;
  features?: string[];
  priceRange?: Location['priceRange'];
  images?: Array<{
    url: string;
    caption?: string;
    isPrimary?: boolean;
  }>;
}

export interface LocationUpdateData {
  name?: string;
  type?: Location['type'];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  address?: Partial<Location['address']>;
  contact?: Partial<Location['contact']>;
  operatingHours?: Array<{
    day: string;
    open: string;
    close: string;
    closed?: boolean;
  }>;
  availableHerbs?: string[];
  services?: string[];
  description?: string;
  features?: string[];
  priceRange?: Location['priceRange'];
  images?: Array<{
    url: string;
    caption?: string;
    isPrimary?: boolean;
  }>;
  isActive?: boolean;
}

export interface LocationStats {
  totalLocations: number;
  locationsByType: Record<Location['type'], number>;
  averageRating: number;
  totalReviews: number;
  verifiedLocations: number;
  topRatedLocations: Array<{
    location: Location;
    rating: number;
  }>;
  recentLocations: Array<{
    location: Location;
    createdAt: Date;
  }>;
}
