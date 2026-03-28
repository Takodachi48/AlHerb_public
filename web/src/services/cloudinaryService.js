import { CLOUDINARY_URLS } from '../config/cloudinary';

const cloudinaryService = {
  /**
   * Get carousel image URLs
   * @returns {Array} Array of carousel image URLs
   */
  getCarouselUrls: () => {
    return [
      CLOUDINARY_URLS.HERO_1,
      CLOUDINARY_URLS.HERO_2,
      CLOUDINARY_URLS.HERO_3,
      CLOUDINARY_URLS.HERO_4,
      CLOUDINARY_URLS.HERO_5
    ];
  },

  /**
   * Get Cloudinary cloud name
   * @returns {string} Cloudinary cloud name
   */
  getCloudName: () => {
    return import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloudinary-name';
  },

  /**
   * Generate a Cloudinary URL with transformations
   * @param {string} publicId - The public ID of the image
   * @param {Object} transformations - Image transformations
   * @returns {string} Complete Cloudinary URL
   */
  generateUrl: (publicId, transformations = {}) => {
    const cloudName = cloudinaryService.getCloudName();
    const transformationString = Object.entries(transformations)
      .map(([key, value]) => `${key}_${value}`)
      .join(',');
    
    const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
    return transformationString 
      ? `${baseUrl}/${transformationString}/${publicId}`
      : `${baseUrl}/${publicId}`;
  }
};

export default cloudinaryService;
