// Cloudinary configuration for frontend
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloudinary-name';

export const CLOUDINARY_URLS = {
  // Carousel
  HERO_1: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1770697756/carousel-1_rns0n9.webp`,
  HERO_2: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1770697754/carousel-2_xws0h5.jpg`,
  HERO_3: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1770697754/carousel-3_jlakq5.jpg`,
  HERO_4: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1770697753/carousel-4_pouawu.jpg`,
  HERO_5: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/v1770697758/carousel-5_phfbcy.png`
};

export default CLOUDINARY_URLS;
