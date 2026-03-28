import Constants from 'expo-constants';
import { debugLog } from '../utils/logger';

const getExtraEnv = (key: string): string | undefined => {
  const value = (Constants.expoConfig?.extra as any)?.env?.[key];
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
};

// Cloudinary configuration from environment
const CLOUDINARY_CLOUD_NAME =
  getExtraEnv('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME') ||
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ||
  'dubhcjmti';
const CLOUDINARY_UPLOAD_PRESET =
  getExtraEnv('EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET') ||
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
  'blog_uploads'; // Create this in Cloudinary dashboard

export interface CloudinaryUploadResponse {
  url: string;
  publicId: string;
  alt: string;
}

// Upload image to Cloudinary
export const uploadImage = async (imageUri: string, folder: string = 'herbal-medicine/blogs/covers'): Promise<CloudinaryUploadResponse> => {
  try {
    debugLog('📸 Starting Cloudinary upload for:', imageUri);
    debugLog('📸 Upload folder:', folder);
    debugLog('☁️ Cloud name:', CLOUDINARY_CLOUD_NAME);
    debugLog('🔧 Upload preset:', CLOUDINARY_UPLOAD_PRESET);
    
    // Create a proper fetch request for image
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64data = await new Promise<string>((resolve, reject) => {
      reader.onload = () => {
        const result = (reader.result as string).split(',')[1];
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(blob);
    });

    const base64Image = await base64data;
    debugLog('📸 Base64 image length:', base64Image.length);
    
    // Create form data for unsigned Cloudinary upload with preset
    const formData = new FormData();
    formData.append('file', `data:image/jpeg;base64,${base64Image}`);
    formData.append('folder', folder);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('resource_type', 'image');
    
    debugLog('📤 Uploading with unsigned preset...');
    
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header for FormData - let browser set it with boundary
      }
    );

    const result = await uploadResponse.json();
    debugLog('📸 Cloudinary response:', result);
    
    if (result.secure_url) {
      debugLog('✅ Image uploaded successfully to Cloudinary:', result.secure_url);
      debugLog('📁 Folder created/used:', folder);
      debugLog('🆔 Public ID:', result.public_id);
      return {
        url: result.secure_url,
        publicId: result.public_id,
        alt: 'Blog image'
      };
    } else {
      console.error('❌ Cloudinary upload failed:', result);
      console.error('❌ Error details:', result.error?.message);
      throw new Error(`Cloudinary upload failed: ${result.error?.message || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('❌ Image upload error:', error);
    throw error;
  }
};

