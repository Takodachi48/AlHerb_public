// API response types for the Herbal Medicine System

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
  error?: string;
  statusCode?: number;
  details?: any;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    nextPage: number | null;
    prevPage: number | null;
  };
  meta: {
    timestamp: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface AuthResponse {
  user: {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string;
    emailVerified: boolean;
  };
  token: string;
}

export interface SearchParams {
  query?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  url: string;
  uploadedAt: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version?: string;
  services?: Record<string, any>;
  uptime?: string;
  error?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  details?: any;
  meta: {
    timestamp: string;
  };
}

export interface BulkOperationResult<T = any> {
  results: Array<{
    success: boolean;
    data?: T;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    successRate: string;
  };
}

export interface AnalyticsResponse {
  type: string;
  period: string;
  metrics: Record<string, any>;
}

export interface LocationQuery {
  latitude: number;
  longitude: number;
  radius?: number;
  limit?: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  fields?: string[];
  filters?: Record<string, any>;
}

export interface NotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
  icon?: string;
  badge?: number;
  tag?: string;
  requireInteraction?: boolean;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  id?: string;
}
