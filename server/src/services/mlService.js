const axios = require('axios');
const { logger } = require('../utils/logger');

class MLService {
  constructor() {
    const configuredBaseUrl = process.env.IMAGE_CLASSIFIER_URL || 'http://127.0.0.1:8000';
    this.baseURL = this.normalizeImageClassifierBaseUrl(configuredBaseUrl);
    this.timeout = parseInt(process.env.ML_SERVICE_TIMEOUT) || 30000;

    const internalKey = process.env.INTERNAL_API_KEY;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(internalKey ? { 'X-Internal-Key': internalKey } : {}),
      },
    });

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`Image Classifier Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Image Classifier Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`Image Classifier Response: ${response.status} for ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error('Image Classifier Response Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  normalizeImageClassifierBaseUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.hostname === 'localhost' || parsed.hostname === '::1' || parsed.hostname === '[::1]') {
        parsed.hostname = '127.0.0.1';
      }

      // Prevent doubled paths like /api/api/v1/... when callers use /api/v1 endpoints.
      parsed.pathname = parsed.pathname.replace(/\/+$/, '').replace(/\/api$/, '') || '';

      return parsed.toString().replace(/\/$/, '');
    } catch {
      return rawUrl;
    }
  }

  // Get herb recommendation
  async getRecommendation(data) {
    try {
      const response = await this.client.post('/api/predict', data);
      return response.data;
    } catch (error) {
      logger.error('Get recommendation error:', error);
      throw new Error('Failed to get recommendation from ML service');
    }
  }

  // Classify plant image
  async classifyImage(imageData) {
    try {
      // The classifier expects JSON with image_url, not FormData
      const response = await this.client.post('/api/v1/classify-image', {
        image_url: imageData // imageData should be the image URL
      });
      return response.data;
    } catch (error) {
      logger.error('Classify image error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        detail: error.response?.data,
      });
      throw new Error('Failed to classify image');
    }
  }

  // Trigger model update
  async updateModel(options = {}) {
    try {
      const response = await this.client.post('/api/update-model', options);
      return response.data;
    } catch (error) {
      logger.error('Update model error:', error);
      throw new Error('Failed to update ML model');
    }
  }

  // Get model metrics
  async getMetrics() {
    try {
      const response = await this.client.get('/api/metrics');
      return response.data;
    } catch (error) {
      logger.error('Get metrics error:', error);
      throw new Error('Failed to get ML model metrics');
    }
  }

  // Check training status
  async getTrainingStatus() {
    try {
      const response = await this.client.get('/api/training-status');
      return response.data;
    } catch (error) {
      logger.error('Get training status error:', error);
      throw new Error('Failed to get training status');
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Image classifier health check error:', error);
      throw new Error('Image classifier service is not available');
    }
  }

  // Check if ML service is available
  async isAvailable() {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get model version
  async getModelVersion() {
    try {
      const health = await this.healthCheck();
      return health.version || 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  // Process recommendation with fallback
  async processRecommendation(data, fallbackData = null) {
    try {
      const isServiceAvailable = await this.isAvailable();

      if (!isServiceAvailable) {
        logger.warn('ML service not available, using fallback');
        return this.getFallbackRecommendation(fallbackData || data);
      }

      const recommendation = await this.getRecommendation(data);

      // Validate response
      if (!recommendation || !recommendation.recommendations) {
        throw new Error('Invalid recommendation response');
      }

      return recommendation;
    } catch (error) {
      logger.error('Process recommendation error:', error);

      if (fallbackData) {
        logger.info('Using fallback recommendation');
        return this.getFallbackRecommendation(fallbackData);
      }

      throw error;
    }
  }

  // Fallback recommendation logic
  getFallbackRecommendation(data) {
    const { symptoms, age, gender } = data;

    // Simple fallback logic based on symptoms
    const fallbackHerbs = {
      'headache': ['lavender', 'peppermint', 'ginger'],
      'nausea': ['ginger', 'peppermint', 'chamomile'],
      'anxiety': ['lavender', 'chamomile', 'lemon balm'],
      'insomnia': ['lavender', 'chamomile', 'valerian'],
      'digestion': ['peppermint', 'ginger', 'fennel'],
      'cold': ['echinacea', 'elderberry', 'ginger'],
    };

    const recommendations = [];

    symptoms.forEach(symptom => {
      const herbs = fallbackHerbs[symptom.toLowerCase()] || fallbackHerbs['headache'];
      herbs.forEach(herb => {
        if (!recommendations.find(r => r.herb === herb)) {
          recommendations.push({
            herb,
            confidence: 0.7, // Lower confidence for fallback
            reasoning: `Fallback recommendation for ${symptom}`,
            dosage: 'Consult healthcare provider',
            preparation: 'Tea or supplement',
            warnings: ['Consult healthcare provider before use'],
          });
        }
      });
    });

    return {
      recommendations,
      confidence: 0.6,
      mlModel: {
        version: 'fallback',
        confidence: 0.6,
        processingTime: 0,
      },
      fallback: true,
    };
  }

  // Process image classification with fallback
  async processImageClassification(imageData, fallbackResult = null) {
    try {
      const isServiceAvailable = await this.isAvailable();

      if (!isServiceAvailable) {
        logger.warn('Image classifier not available, using fallback');
        return fallbackResult || this.getFallbackImageResult();
      }

      const result = await this.classifyImage(imageData);

      // Validate response
      if (!result || !result.classification) {
        throw new Error('Invalid classification response');
      }

      return result;
    } catch (error) {
      logger.error('Process image classification error:', error);

      if (fallbackResult) {
        logger.info('Using fallback image result');
        return fallbackResult;
      }

      throw error;
    }
  }

  // Fallback image result
  getFallbackImageResult() {
    return {
      classification: {
        plant: 'Unknown',
        scientificName: 'Unknown',
        confidence: 0.0,
      },
      fallback: true,
      message: 'Image classification service unavailable',
    };
  }
}

module.exports = new MLService();
