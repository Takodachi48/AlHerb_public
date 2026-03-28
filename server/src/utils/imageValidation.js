/**
 * Validate image file
 */
exports.validateImageFile = (file) => {
  if (!file) {
    throw new Error('No file uploaded');
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed');
  }

  const maxSize = 8 * 1024 * 1024; // 8MB
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 8MB');
  }

  return true;
};

/**
 * Validate image dimensions (if needed)
 */
exports.validateImageDimensions = async (filePath, minWidth, minHeight) => {
  const sharp = require('sharp');
  
  try {
    const metadata = await sharp(filePath).metadata();
    
    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new Error(`Image must be at least ${minWidth}x${minHeight}px`);
    }
    
    return true;
  } catch (error) {
    throw new Error(`Invalid image: ${error.message}`);
  }
};
