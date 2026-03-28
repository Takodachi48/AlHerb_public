import api from './api';
import firebaseService from './firebaseService';

/**
 * Centralized authentication helper for image service
 * Eliminates duplicate auth token retrieval logic
 */
class AuthHelper {
  /**
   * Get auth headers for API requests
   */
  static async getAuthHeaders() {
    const token = await firebaseService.getAuthToken();
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    return {
      'Content-Type': 'multipart/form-data',
      'Authorization': `Bearer ${token}`
    };
  }

  /**
   * Execute API call with auth headers
   */
  static async executeWithAuth(method, url, data = null) {
    const headers = await this.getAuthHeaders();
    
    switch (method.toLowerCase()) {
      case 'post':
        return api.post(url, data, { headers });
      case 'delete':
        return api.delete(url, { headers });
      case 'put':
        return api.put(url, data, { headers });
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}

export const imageService = {
  // Upload user avatar
  uploadAvatar: async (file) => {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await AuthHelper.executeWithAuth('POST', '/images/avatar', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadAvatar error:', error);
      throw error;
    }
  },

  // Delete user avatar
  deleteAvatar: async () => {
    try {
      const response = await AuthHelper.executeWithAuth('DELETE', '/images/avatar');
      return response.data;
    } catch (error) {
      console.error('ImageService deleteAvatar error:', error);
      throw error;
    }
  },

  // Delete user banner
  deleteBanner: async () => {
    try {
      const response = await AuthHelper.executeWithAuth('DELETE', '/images/banner');
      return response.data;
    } catch (error) {
      console.error('ImageService deleteBanner error:', error);
      throw error;
    }
  },

  // Delete a temporary image by URL (avatar/banner)
  deleteTempImage: async (url) => {
    try {
      const token = await firebaseService.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      const response = await api.post(
        '/images/temp',
        { url },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('ImageService deleteTempImage error:', error);
      throw error;
    }
  },

  // Upload user banner
  uploadBanner: async (file) => {
    try {
      const formData = new FormData();
      formData.append('banner', file);

      const response = await AuthHelper.executeWithAuth('POST', '/images/banner', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadBanner error:', error);
      throw error;
    }
  },

  // Upload plant identification image
  uploadPlantIdentification: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await AuthHelper.executeWithAuth('POST', '/images/plant-identification', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadPlantIdentification error:', error);
      throw error;
    }
  },

  // Upload herb image
  uploadHerbImage: async (herbId, file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await AuthHelper.executeWithAuth('POST', `/herbs/${herbId}/image`, formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadHerbImage error:', error);
      throw error;
    }
  },

  // Upload multiple herb images at once
  uploadMultipleHerbImages: async (herbId, files, scientificName) => {
    try {
      const formData = new FormData();
      
      // Add all files
      files.forEach((file, index) => {
        formData.append('images', file);
      });
      
      // Add scientific name for folder organization
      if (scientificName) {
        formData.append('scientificName', scientificName);
      }

      const response = await AuthHelper.executeWithAuth('POST', `/herbs/${herbId}/images`, formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadMultipleHerbImages error:', error);
      throw error;
    }
  },

  // Upload general image (for blog posts, etc.)
  uploadImage: async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await AuthHelper.executeWithAuth('POST', '/images/upload', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadImage error:', error);
      throw error;
    }
  },

  // Upload blog image (featured image)
  uploadBlogImage: async (file, label = 'blog-featured-image') => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('label', label);

      const response = await AuthHelper.executeWithAuth('POST', '/images/blog', formData);
      return response;
    } catch (error) {
      console.error('ImageService uploadBlogImage error:', error);
      throw error;
    }
  },

  // Upload landing/site background image (admin)
  uploadSiteBackgroundImage: async (file, label = 'landing-background') => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('label', label);

      const response = await AuthHelper.executeWithAuth('POST', '/images/site-background', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadSiteBackgroundImage error:', error);
      throw error;
    }
  },

  // Upload landing/site carousel image (admin)
  uploadSiteCarouselImage: async (file, label = 'landing-carousel') => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('label', label);

      const response = await AuthHelper.executeWithAuth('POST', '/images/site-carousel', formData);
      return response.data;
    } catch (error) {
      console.error('ImageService uploadSiteCarouselImage error:', error);
      throw error;
    }
  },

  // Delete herb image
  deleteHerbImage: async (herbId) => {
    try {
      const response = await AuthHelper.executeWithAuth('DELETE', `/herbs/${herbId}/image`);
      return response.data;
    } catch (error) {
      console.error('ImageService deleteHerbImage error:', error);
      throw error;
    }
  }
};
