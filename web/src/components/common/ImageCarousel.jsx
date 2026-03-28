import React, { useState, useEffect } from 'react';
import cloudinaryService from '../../services/cloudinaryService';

const ImageCarousel = ({ className = '' }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImages = async () => {
      try {
        // Try to get images from service, fallback to predefined URLs
        const carouselImages = cloudinaryService.getCarouselUrls();
        const imageArray = carouselImages.map((url, index) => ({
          url,
          id: `slide-${index}`,
          alt: `Hero slide ${index + 1}`
        }));

        setImages(imageArray);
        setLoading(false);
      } catch (error) {
        console.error('Error loading carousel images:', error);
        setLoading(false);
      }
    };

    loadImages();
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + images.length) % images.length);
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
  };

  if (loading) {
    return (
      <div className={`h-96 bg-surface-primary animate-pulse ${className}`}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-tertiary">Loading carousel...</div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className={`h-96 bg-surface-primary border border-primary ${className}`}>
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-tertiary">No images available</div>
        </div>
      </div>
    );
  }

  return (
    <section className={`relative h-96 overflow-hidden bg-surface-primary ${className}`}>
      <div className="relative h-full">
        {images.map((image, index) => (
          <div
            key={image.id}
            className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <img
              src={image.url}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* Carousel Controls */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-surface-secondary/20 hover:bg-surface-secondary/30 text-primary p-2 rounded-full backdrop-blur-sm transition-colors"
          aria-label="Previous slide"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-surface-secondary/20 hover:bg-surface-secondary/30 text-primary p-2 rounded-full backdrop-blur-sm transition-colors"
          aria-label="Next slide"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Carousel Indicators */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2 h-2 rounded-full transition-colors ${index === currentSlide ? 'bg-brand' : 'bg-surface-secondary/50'
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ImageCarousel;
