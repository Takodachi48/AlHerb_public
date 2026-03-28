import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { herbService } from '../../services/herbService';

const toCloudinarySizedUrl = (url, width) => {
  if (!url || typeof url !== 'string') return url;
  const marker = '/upload/';
  const markerIndex = url.indexOf(marker);
  if (markerIndex === -1) return url;

  const transform = `f_auto,q_auto,dpr_auto,w_${width},c_limit`;
  const prefix = url.slice(0, markerIndex + marker.length);
  const suffix = url.slice(markerIndex + marker.length);
  return `${prefix}${transform}/${suffix}`;
};

const ImageGallery = ({
  images = [],
  className = '',
  maxImages = 6,
  herb = null
}) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const normalizedImages = (Array.isArray(images) ? images : [])
    .map((image, index) => {
      if (!image) return null;
      if (typeof image === 'string') {
        const url = image.trim();
        return url ? { url, caption: '', name: '', isPrimary: index === 0 } : null;
      }
      const url = String(image.url || '').trim();
      if (!url) return null;
      return {
        ...image,
        url,
        isPrimary: Boolean(image.isPrimary),
      };
    })
    .filter(Boolean);

  const getCaptionParts = () => {
    if (!herb) return null;
    const firstName = herb.commonNames?.[0] || herb.name || '';
    const scientificName = herb.scientificName || '';
    if (!firstName && !scientificName) return null;
    return { firstName, scientificName };
  };

  const removeImage = async (imageToRemove) => {
    if (!onImagesChange) return;

    try {
      const updatedImages = images.filter(img => img.url !== imageToRemove.url);
      await herbService.updateHerb(images[0]?.herbId, { images: updatedImages });
      onImagesChange(updatedImages);
    } catch (error) {
      console.error('Failed to remove image:', error);
    }
  };

  if (!normalizedImages.length) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="w-16 h-16 mx-auto bg-surface-secondary/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-tertiary">
          No images available
        </p>
      </div>
    );
  }

  const mainImage = normalizedImages.find((img) => img.isPrimary) || normalizedImages[0];
  const otherImages = normalizedImages.filter((img) => !img.isPrimary && img !== mainImage);
  const captionParts = getCaptionParts();

  const getThemeClasses = () => {
    return 'rounded-lg overflow-hidden transition-all duration-200 border border-primary';
  };

  const getThumbnailClasses = () => {
    return 'cursor-pointer transition-all duration-200 rounded-lg overflow-hidden border border-primary hover:border-brand hover:shadow-lg';
  };

  // Modal component that will be rendered via portal
  const ImageModal = () => {
    if (!selectedImage) return null;

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center p-4"
        onClick={() => setSelectedImage(null)}
      >
        <div className="relative max-w-4xl max-h-full">
          <img
            src={selectedImage.url}
            alt={selectedImage.caption || selectedImage.name || 'Full size image'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-surface-secondary/20 hover:bg-surface-secondary/30 text-primary"
            onClick={() => setSelectedImage(null)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {captionParts && (
            <div className="absolute bottom-4 left-4 right-4 text-center">
              <p className="text-white text-lg bg-black bg-opacity-50 rounded px-3 py-1">
                {captionParts.firstName}
                {captionParts.firstName && captionParts.scientificName ? ' - ' : ''}
                {captionParts.scientificName ? <em>{captionParts.scientificName}</em> : null}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Image */}
      <div className="relative group">
        <img
          src={toCloudinarySizedUrl(mainImage.url, 1280)}
          srcSet={[
            `${toCloudinarySizedUrl(mainImage.url, 640)} 640w`,
            `${toCloudinarySizedUrl(mainImage.url, 960)} 960w`,
            `${toCloudinarySizedUrl(mainImage.url, 1280)} 1280w`,
            `${toCloudinarySizedUrl(mainImage.url, 1600)} 1600w`,
          ].join(', ')}
          sizes="(min-width: 1280px) 1100px, (min-width: 768px) 80vw, 100vw"
          alt={mainImage.caption || mainImage.name || 'Main image'}
          className={`w-full h-96 object-cover cursor-pointer ${getThemeClasses()}`}
          loading="eager"
          decoding="async"
          onClick={() => setSelectedImage(mainImage)}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all duration-200 flex items-center justify-center">
          <svg className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24" onClick={() => setSelectedImage(mainImage)}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16l5 5M10 4a6 6 0 100 12 6 6 0 000-12zM10 7v6M7 10h6" />
          </svg>
        </div>
        {captionParts && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-white text-sm">
              {captionParts.firstName}
              {captionParts.firstName && captionParts.scientificName ? ' - ' : ''}
              {captionParts.scientificName ? <em>{captionParts.scientificName}</em> : null}
            </p>
          </div>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {otherImages.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {otherImages.slice(0, maxImages - 1).map((image, index) => (
            <div key={index} className={getThumbnailClasses()}>
              <img
                src={toCloudinarySizedUrl(image.url, 320)}
                srcSet={[
                  `${toCloudinarySizedUrl(image.url, 160)} 160w`,
                  `${toCloudinarySizedUrl(image.url, 240)} 240w`,
                  `${toCloudinarySizedUrl(image.url, 320)} 320w`,
                ].join(', ')}
                sizes="(min-width: 768px) 25vw, 50vw"
                alt={image.caption || image.name || `Image ${index + 1}`}
                className="w-full h-24 object-cover"
                loading="lazy"
                decoding="async"
                onClick={() => setSelectedImage(image)}
              />
            </div>
          ))}

          {/* Show More Images Button */}
          {otherImages.length > maxImages - 1 && (
            <div className={getThumbnailClasses()}>
              <div className="w-full h-24 flex items-center justify-center bg-surface-secondary/20">
                <div className="text-center">
                  <span className="text-2xl font-bold text-primary">
                    +{otherImages.length - (maxImages - 1)}
                  </span>
                  <p className="text-xs mt-1 text-tertiary">
                    more
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render modal via portal to document.body */}
      {typeof document !== 'undefined' && document.body && selectedImage &&
        createPortal(<ImageModal />, document.body)
      }
    </div>
  );
};

export default ImageGallery;
