// Global Application Configuration
export const APP_CONFIG = {
  // System name - Change this to update throughout the entire application
  SYSTEM_NAME: '[System Name]',
  SYSTEM_SHORT_NAME: '[System]',
  
  // App identifiers
  APP_SLUG: 'herbal-medicine',
  BUNDLE_ID: 'com.herbalmedicine.app',
  
  // Meta information
  APP_DESCRIPTION: 'Discover natural remedies for your health needs',
  APP_AUTHOR: 'Herbal Medicine Team',
  
  // URLs
  APP_URL: 'https://herbal-medicine.com/',
  
  // Keywords for SEO
  APP_KEYWORDS: ['herbal medicine', 'natural remedies', 'herbs', 'health', ' wellness'],
};

// Export individual constants for convenience
export const { 
  SYSTEM_NAME, 
  SYSTEM_SHORT_NAME, 
  APP_SLUG, 
  BUNDLE_ID, 
  APP_DESCRIPTION, 
  APP_AUTHOR, 
  APP_URL, 
  APP_KEYWORDS 
} = APP_CONFIG;

// CommonJS compatibility for app.config.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    APP_CONFIG,
    SYSTEM_NAME,
    SYSTEM_SHORT_NAME,
    APP_SLUG,
    BUNDLE_ID,
    APP_DESCRIPTION,
    APP_AUTHOR,
    APP_URL,
    APP_KEYWORDS,
  };
}
