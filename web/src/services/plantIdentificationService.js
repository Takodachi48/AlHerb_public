import api from './api';
import { imageService } from './imageService';

export const plantIdentificationService = {
  // Upload image for plant identification (backend handles ML processing)
  identifyPlant: async (file) => {
    try {
      // Upload to backend - it will handle ML processing asynchronously
      const response = await imageService.uploadPlantIdentification(file);
      
      // The response from API interceptor is the full formatSuccess object
      return response;
    } catch (error) {
      console.error('PlantIdentificationService identifyPlant error:', error);
      throw error;
    }
  },

  // Get identification status and results
  getIdentificationStatus: async (identificationId) => {
    try {
      const response = await api.get(`/images/plant-identification/${identificationId}`);
      
      // The response from API interceptor is already the data payload
      return response;
    } catch (error) {
      console.error('PlantIdentificationService getIdentificationStatus error:', error);
      throw error;
    }
  },

  // Get user's identification history
  getIdentificationHistory: async (page = 1, limit = 10) => {
    try {
      const response = await api.get(`/images/plant-identification?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('PlantIdentificationService getIdentificationHistory error:', error);
      throw error;
    }
  },

  // Submit feedback for classification
  submitFeedback: async (identificationId, userCorrection, isCorrect, rating) => {
    try {
      const payload = {};
      if (typeof userCorrection === 'string') payload.userCorrection = userCorrection;
      if (typeof isCorrect === 'boolean') payload.isCorrect = isCorrect;
      if (typeof rating === 'number' && Number.isFinite(rating)) payload.rating = rating;

      const response = await api.post(`/images/plant-identification/${identificationId}/feedback`, payload);

      return response.data;
    } catch (error) {
      console.error('PlantIdentificationService submitFeedback error:', error);
      throw error;
    }
  }
};
