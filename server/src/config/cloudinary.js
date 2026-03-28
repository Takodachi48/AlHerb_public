const cloudinary = require('cloudinary').v2;

// Initialize Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Folder path constants
const ROOT = process.env.CLOUDINARY_ROOT_FOLDER || 'herbal-medicine';

const CLOUDINARY_FOLDERS = {
  // Herbs
  HERBS: `${ROOT}/herbs`,
  
  // Locations
  LOCATIONS_MARKETS: `${ROOT}/locations/markets`,
  LOCATIONS_FORAGING: `${ROOT}/locations/foraging`,
  
  // Blogs
  BLOGS_COVERS: `${ROOT}/blogs/covers`,
  BLOGS_CONTENT: `${ROOT}/blogs/content`,
  
  // Users
  USER_AVATARS: `${ROOT}/users/avatars`,
  USER_BANNERS: `${ROOT}/users/banners`,
  USER_COVERS: `${ROOT}/users/cover-photos`,
  
  // Plant Identifications
  PLANT_IDENTIFICATIONS: `${ROOT}/plant-identifications`,
  PLANT_IDENTIFICATIONS_UNCERTAIN: `${ROOT}/plant-identifications/uncertain`,
  UNCLASSIFIED_IMAGES: `${ROOT}/unclassified-images`,
  UNIDENTIFIED_IMAGES: `${ROOT}/unidentified-images`,
  
  // System
  SITE_ASSETS: `${ROOT}/site-assets`,
  PLACEHOLDER: `${ROOT}/site-assets/placeholder`,
  CAROUSEL: `${ROOT}/site-assets/carousel`,
  BACKGROUNDS: `${ROOT}/site-assets/backgrounds`
};

// Preset transformations
const TRANSFORMATIONS = {
  avatar: {
    width: 400,
    height: 400,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  banner: {
    width: 1200,
    height: 300,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  coverPhoto: {
    width: 1500,
    height: 500,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  herbImage: {
    width: 800,
    height: 800,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  blogCover: {
    width: 1200,
    height: 630,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  blogContent: {
    width: 1200,
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  plantIdentification: {
    width: 1200,
    quality: 'auto',
    fetch_format: 'auto'
  },
  
  thumbnail: {
    width: 200,
    height: 200,
    crop: 'fill',
    quality: 'auto',
    fetch_format: 'auto'
  }
};

// Helper functions for image management
const imageHelpers = {
  // Move image from unclassified to classified folder with scientific name
  async moveToClassified(publicId, scientificName) {
    try {
      const sourcePublicId = publicId;
      const targetFolder = `${CLOUDINARY_FOLDERS.PLANT_IDENTIFICATIONS}/${scientificName.toLowerCase().replace(/\s+/g, '-')}`;
      const targetPublicId = `${targetFolder}/${publicId.split('/').pop()}`;
      
      // Create new image with metadata (using only allowed fields)
      const result = await cloudinary.uploader.upload(
        cloudinary.url(sourcePublicId, { resource_type: 'image' }),
        {
          public_id: targetPublicId,
          folder: targetFolder,
          resource_type: 'image',
          overwrite: true
          // Note: Custom metadata fields need to be pre-registered in Cloudinary
          // For now, we'll skip custom metadata and just move the image
        }
      );
      
      // Delete the original unclassified image
      await cloudinary.uploader.destroy(sourcePublicId, { resource_type: 'image' });
      
      return {
        success: true,
        newPublicId: result.public_id,
        url: result.secure_url,
        folder: targetFolder
      };
    } catch (error) {
      console.error('Error moving image to classified folder:', error);
      throw new Error(`Failed to move image: ${error.message}`);
    }
  },

  // Move image to uncertain folder for low-confidence/ambiguous predictions
  async moveToUncertain(publicId) {
    try {
      const sourcePublicId = publicId;
      const targetFolder = CLOUDINARY_FOLDERS.PLANT_IDENTIFICATIONS_UNCERTAIN;
      const targetPublicId = `${targetFolder}/${publicId.split('/').pop()}`;

      const result = await cloudinary.uploader.upload(
        cloudinary.url(sourcePublicId, { resource_type: 'image' }),
        {
          public_id: targetPublicId,
          folder: targetFolder,
          resource_type: 'image',
          overwrite: true,
        }
      );

      await cloudinary.uploader.destroy(sourcePublicId, { resource_type: 'image' });

      return {
        success: true,
        newPublicId: result.public_id,
        url: result.secure_url,
        folder: targetFolder,
      };
    } catch (error) {
      console.error('Error moving image to uncertain folder:', error);
      throw new Error(`Failed to move image: ${error.message}`);
    }
  },

  // Get classified folder path for a scientific name
  getClassifiedFolder(scientificName) {
    return `${CLOUDINARY_FOLDERS.PLANT_IDENTIFICATIONS}/${scientificName.toLowerCase().replace(/\s+/g, '-')}`;
  },

  // Upload unclassified image
  async uploadUnclassified(imageBuffer, fileName) {
    try {
      const result = await cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_FOLDERS.UNCLASSIFIED_IMAGES,
          public_id: fileName,
          resource_type: 'image',
          overwrite: true,
          metadata: {
            classification_status: 'unclassified',
            uploaded_at: new Date().toISOString()
          }
        },
        (error, result) => {
          if (error) throw error;
          return result;
        }
      );
      
      return new Promise((resolve, reject) => {
        imageBuffer.pipe(result).on('close', resolve).on('error', reject);
      });
    } catch (error) {
      console.error('Error uploading unclassified image:', error);
      throw new Error(`Failed to upload unclassified image: ${error.message}`);
    }
  }
};

module.exports = {
  cloudinary,
  CLOUDINARY_FOLDERS,
  TRANSFORMATIONS,
  imageHelpers
};
