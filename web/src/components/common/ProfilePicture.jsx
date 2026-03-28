import React, { useRef, useState, useEffect } from 'react';
import { UserRound, Camera } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { imageService } from '../../services/imageService';
import firebaseService from '../../services/firebaseService';
import Loading from './Loading';

const ProfilePicture = ({
  size = 'md',
  showUploadOverlay = false,
  onUploadSuccess,
  onTempUpload,
  currentPhotoURL,
  className = '',
  clickable = false,
  onClick
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset image error when photo URL changes
  useEffect(() => {
    setImageError(false);
  }, [user?.photoURL, currentPhotoURL]);

  // Size configurations
  const sizeClasses = {
    xs: 'w-8 h-8',
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-20 h-20',
    '2xl': 'w-24 h-24',
    '3xl': 'w-32 h-32',
  };

  const ringClasses = {
    xs: 'ring-2',
    sm: 'ring-2',
    md: 'ring-2',
    lg: 'ring-4',
    xl: 'ring-4',
    '2xl': 'ring-4',
    '3xl': 'ring-4',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
    '2xl': 'w-8 h-8',
    '3xl': 'w-10 h-10',
  };

  // Get profile picture with letter fallback
  const getProfilePicture = () => {
    // Prioritize currentPhotoURL (temporary upload) over saved photoURL
    const rawUrl = currentPhotoURL || user?.photoURL;
    if (rawUrl) {
      return normalizeProfilePictureUrl(rawUrl);
    }
    return null; // No photoURL, will show initials
  };

  const normalizeProfilePictureUrl = (url) => {
    if (!url || typeof url !== 'string') return null;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      // Google profile image URLs are sometimes sensitive to referrer/size params.
      if (host.includes('googleusercontent.com')) {
        parsed.protocol = 'https:';

        const hasSizeParam =
          parsed.searchParams.has('sz') ||
          /=s\d+(-c)?$/i.test(parsed.pathname) ||
          /=s\d+(-c)?$/i.test(parsed.href);

        if (!hasSizeParam) {
          parsed.searchParams.set('sz', '256');
        }
      }

      return parsed.toString();
    } catch {
      return url;
    }
  };

  const getInitials = () => {
    const source =
      user?.displayName ||
      user?.name ||
      user?.email ||
      '';

    const trimmed = source.trim();
    if (!trimmed) return 'U';

    if (trimmed.includes('@')) {
      const localPart = trimmed.split('@')[0] || '';
      return localPart.slice(0, 2).toUpperCase() || 'U';
    }

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase() || 'U';
  };

  const isAdmin = user?.role === 'admin';
  const baseClasses = sizeClasses[size] || sizeClasses.md;
  const ringClass = ringClasses[size] || ringClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;

  const handleFileChange = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
      return;
    }

    // Validate file size (8MB)
    if (file.size > 8 * 1024 * 1024) {
      console.error('File size must be less than 8MB');
      return;
    }

    setUploading(true);

    try {
      // Get fresh auth token before upload
      const token = await firebaseService.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Create a custom API call with explicit auth header
      const response = await imageService.uploadAvatar(file);
      console.log('Avatar uploaded successfully:', response);

      // Validate response structure - response should be {photoURL: url}
      if (!response || typeof response.photoURL !== 'string') {
        console.error('Invalid response structure:', response);
        throw new Error('Invalid response from server');
      }

      // Call temporary upload callback - let parent handle when to save
      if (onTempUpload) {
        onTempUpload(response.photoURL, file);
      }

      // Show success message (optional - can be handled by parent component)
      console.log('Profile picture uploaded (temporary)!');
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      // If it's an auth error, we might need to refresh the token
      if (error.response?.status === 401) {
        console.error('Authentication error - please try logging in again');
      }
      // Error handling can be enhanced with toast notifications or parent component callbacks
      // For now, keeping it simple with console logging
    } finally {
      setUploading(false);
    }
  };

  const handleProfilePictureClick = (e) => {
    e.preventDefault(); // Prevent any default behavior
    if (clickable && showUploadOverlay) {
      fileInputRef.current?.click();
    }
    if (onClick) {
      onClick();
    }
  };

  const profilePictureUrl = getProfilePicture();

  return (
    <div className={`relative inline-block ${className}`}>
      {/* Profile Picture */}
      {clickable ? (
        <button
          onClick={handleProfilePictureClick}
          disabled={uploading}
          className={`
            ${baseClasses} 
            rounded-full 
            flex 
            items-center 
            justify-center 
            ${ringClass} 
            transition-all 
            overflow-hidden 
            group
            ${isAdmin
              ? 'bg-surface-secondary ring-border-brand'
              : !user
                ? 'bg-base-primary ring-border-brand'
                : 'bg-surface-brand ring-border-brand'
            }
            ${clickable && showUploadOverlay
              ? 'hover:ring-brand/50 hover:scale-105 cursor-pointer'
              : ''
            }
            ${uploading ? 'cursor-not-allowed' : ''
            }
          `}
        >
          {profilePictureUrl && !imageError ? (
            <img
              src={profilePictureUrl}
              alt="Profile"
              className="w-full h-full object-cover transition-all group-hover:brightness-75"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
          ) : user ? (
            <div className="w-full h-full flex items-center justify-center bg-primary text-white rounded-full font-semibold text-sm">
              {getInitials()}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserRound size={20} className="text-primary" />
            </div>
          )}
          {showUploadOverlay && clickable && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <Camera size={40} className="text-white" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full">
              <div className="absolute inset-0 bg-black/50 rounded-full"></div>
              <Loading size="large" admin={isAdmin} />
            </div>
          )}
        </button>
      ) : (
        <div
          onClick={onClick}
          className={`
            ${baseClasses} 
            rounded-full 
            flex 
            items-center 
            justify-center 
            ${ringClass} 
            transition-all 
            overflow-hidden 
            ${isAdmin
              ? 'bg-surface-secondary ring-border-brand'
              : !user
                ? 'bg-base-primary ring-border-brand'
                : 'bg-surface-brand ring-border-brand'
            }
          `}
        >
          {profilePictureUrl && !imageError ? (
            <img
              src={profilePictureUrl}
              alt="Profile"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
          ) : user ? (
            <div className="w-full h-full flex items-center justify-center bg-primary text-white rounded-full font-semibold text-sm">
              {getInitials()}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserRound size={20} className="text-tertiary" />
            </div>
          )}
        </div>
      )}

      {/* Hidden file input for upload */}
      {showUploadOverlay && clickable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
    </div>
  );
};

export default ProfilePicture;
