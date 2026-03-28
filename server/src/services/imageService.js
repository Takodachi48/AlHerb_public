const { cloudinary, CLOUDINARY_FOLDERS, TRANSFORMATIONS } = require('../config/cloudinary');
const fs = require('fs').promises;

class ImageService {
  /**
   * Generic upload method
   * @param {object} file - Multer file object
   * @param {string} folder - Cloudinary folder
   * @param {string} publicId - Public ID for the image
   * @param {object} transformation - Cloudinary transformation object
   * @returns {Promise<string>} - Secure URL of uploaded image
   */
  async uploadImage(file, folder, publicId, transformation = {}) {
    if (!file) {
      throw new Error('Image upload failed: file is required');
    }

    const uploadOptions = {
      folder,
      public_id: publicId,
      transformation,
      overwrite: true,
      resource_type: 'image'
    };

    try {
      let result;
      if (Buffer.isBuffer(file.buffer)) {
        result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
            if (error) return reject(error);
            return resolve(uploadResult);
          });
          stream.end(file.buffer);
        });
      } else if (file.path) {
        result = await cloudinary.uploader.upload(file.path, uploadOptions);
      } else {
        throw new Error('Invalid upload payload');
      }

      return result.secure_url;
    } catch (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    } finally {
      // Backward compatibility: clean up if disk-based uploads are still used.
      if (file.path) {
        await this.deleteLocalFile(file.path);
      }
    }
  }

  /**
   * Upload herb image
   */
  async uploadHerbImage(file, scientificName) {
    const publicId = `${this.sanitizeFileName(scientificName)}-${Date.now()}`;
    const folder = `${CLOUDINARY_FOLDERS.HERBS}/${this.sanitizeFileName(scientificName)}`;

    try {
      const result = await this.uploadImage(
        file,
        folder,
        publicId,
        TRANSFORMATIONS.herbImage
      );
      return result;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  /**
   * Upload user avatar
   */
  async uploadAvatar(file, userId) {
    const publicId = `user-${userId}-${Date.now()}`;
    return await this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.USER_AVATARS,
      publicId,
      TRANSFORMATIONS.avatar
    );
  }

  /**
   * Upload user banner
   */
  async uploadBanner(file, userId) {
    const publicId = `user-${userId}-${Date.now()}`;
    return await this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.USER_BANNERS,
      publicId,
      TRANSFORMATIONS.banner
    );
  }

  /**
   * Upload user cover photo
   */
  async uploadCoverPhoto(file, userId) {
    const publicId = `user-${userId}-cover`;
    return await this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.USER_COVERS,
      publicId,
      TRANSFORMATIONS.coverPhoto
    );
  }

  /**
   * Upload blog cover image
   */
  async uploadBlogCover(file, blogId) {
    const publicId = `blog-${blogId}-cover`;
    return await this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.BLOGS_COVERS,
      publicId,
      TRANSFORMATIONS.blogCover
    );
  }

  /**
   * Upload blog content image
   */
  async uploadBlogContentImage(file, blogId) {
    const publicId = `blog-${blogId}-${Date.now()}`;
    return await this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.BLOGS_CONTENT,
      publicId,
      TRANSFORMATIONS.blogContent
    );
  }

  /**
   * Upload plant identification image
   */
  async uploadPlantIdentification(file, scientificName) {
    const folder = `${CLOUDINARY_FOLDERS.PLANT_IDENTIFICATIONS}/${this.sanitizeFileName(scientificName)}`;
    const publicId = `${this.sanitizeFileName(scientificName)}-${Date.now()}`;

    return await this.uploadImage(
      file,
      folder,
      publicId,
      TRANSFORMATIONS.plantIdentification
    );
  }

  /**
   * Upload unclassified plant identification image
   */
  async uploadUnclassifiedPlantImage(file, userId) {
    const folder = CLOUDINARY_FOLDERS.UNCLASSIFIED_IMAGES;
    const publicId = `user-${userId}-${Date.now()}`;

    return await this.uploadImage(
      file,
      folder,
      publicId,
      TRANSFORMATIONS.plantIdentification
    );
  }

  /**
   * Upload location image
   */
  async uploadLocationImage(file, locationId, type = 'market') {
    const folder = type === 'market'
      ? CLOUDINARY_FOLDERS.LOCATIONS_MARKETS
      : CLOUDINARY_FOLDERS.LOCATIONS_FORAGING;

    const publicId = `location-${locationId}`;

    return await this.uploadImage(
      file,
      folder,
      publicId,
      TRANSFORMATIONS.herbImage
    );
  }

  /**
   * Delete image from Cloudinary
   */
  async deleteImage(imageUrl) {
    try {
      // Extract public_id from URL
      const publicId = this.extractPublicIdFromUrl(imageUrl);

      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get optimized image URL with custom transformations
   */
  getOptimizedUrl(publicId, options = {}) {
    const { width, height, crop = 'fill', quality = 'auto', format = 'auto' } = options;

    return cloudinary.url(publicId, {
      width,
      height,
      crop,
      quality,
      fetch_format: format
    });
  }

  /**
   * Get thumbnail URL
   */
  getThumbnailUrl(imageUrl, size = 200) {
    const publicId = this.extractPublicIdFromUrl(imageUrl);
    return this.getOptimizedUrl(publicId, { width: size, height: size });
  }

  /**
   * Get responsive image URLs (for srcset)
   */
  getResponsiveUrls(imageUrl) {
    const publicId = this.extractPublicIdFromUrl(imageUrl);

    return {
      small: this.getOptimizedUrl(publicId, { width: 400 }),
      medium: this.getOptimizedUrl(publicId, { width: 800 }),
      large: this.getOptimizedUrl(publicId, { width: 1200 }),
      xlarge: this.getOptimizedUrl(publicId, { width: 1920 })
    };
  }

  /**
   * Helper: Extract public_id from Cloudinary URL
   */
  extractPublicIdFromUrl(url) {
    if (!url) return null;

    try {
      const matches = url.match(/\/v\d+\/(.+)\./);
      return matches ? matches[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Helper: Sanitize filename for public_id
   */
  sanitizeFileName(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')           // Replace spaces with hyphens
      .replace(/[^a-z0-9-_]/g, '')    // Remove special characters
      .replace(/-+/g, '-')             // Replace multiple hyphens with single
      .trim();
  }

  /**
   * Helper: Delete local temporary file
   */
  async deleteLocalFile(filePath) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Don't throw error if file doesn't exist (it might have been already processed)
      if (error.code !== 'ENOENT') {
        console.error('Error deleting local file:', error);
      }
    }
  }

  /**
   * Upload general image (for blog posts, etc.)
   */
  async uploadGeneralImage(file) {
    const publicId = `general-${Date.now()}`;
    const folder = CLOUDINARY_FOLDERS.BLOGS_CONTENT || 'general';
    const result = await this.uploadImage(
      file,
      folder,
      publicId,
      TRANSFORMATIONS.blogCover
    );

    // uploadImage already returns the secure URL string.
    return result;
  }

  /**
   * Upload blog featured image
   */
  async uploadBlogImage(file, label = 'blog-image') {
    const publicId = `${this.sanitizeFileName(label)}-${Date.now()}`;

    return this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.BLOGS_COVERS || `${CLOUDINARY_FOLDERS.SITE_ASSETS}/blogs/covers`,
      publicId,
      TRANSFORMATIONS.blogCover
    );
  }

  /**
   * Upload landing/site background image
   */
  async uploadSiteBackgroundImage(file, label = 'background') {
    const publicId = `${this.sanitizeFileName(label)}-${Date.now()}`;

    return this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.BACKGROUNDS || `${CLOUDINARY_FOLDERS.SITE_ASSETS}/backgrounds`,
      publicId,
      TRANSFORMATIONS.blogCover
    );
  }

  /**
   * Upload landing/site carousel image
   */
  async uploadSiteCarouselImage(file, label = 'carousel') {
    const publicId = `${this.sanitizeFileName(label)}-${Date.now()}`;

    return this.uploadImage(
      file,
      CLOUDINARY_FOLDERS.CAROUSEL || `${CLOUDINARY_FOLDERS.SITE_ASSETS}/carousel`,
      publicId,
      TRANSFORMATIONS.blogCover
    );
  }
}

module.exports = new ImageService();
