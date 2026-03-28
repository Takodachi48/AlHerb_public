// Shared validation utilities for the Herbal Medicine System

// Email validation
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation
export const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Phone number validation
export const validatePhoneNumber = (phone) => {
  // Basic phone number validation (international format)
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// Age validation
export const validateAge = (age) => {
  if (typeof age !== 'number') return false;
  return age >= 0 && age <= 150;
};

// Gender validation
export const validateGender = (gender) => {
  if (!gender || typeof gender !== 'string') return false;
  const validGenders = ['male', 'female'];
  return validGenders.includes(gender);
};

// Symptoms validation
export const validateSymptoms = (symptoms) => {
  if (!Array.isArray(symptoms)) return false;
  return symptoms.every(symptom => 
    typeof symptom === 'string' && symptom.trim().length > 0
  );
};

export const validateRating = (rating) => {
  return typeof rating === 'number' && rating >= 1 && rating <= 5;
};

export const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  return (
    typeof lng === 'number' && lng >= -180 && lng <= 180 &&
    typeof lat === 'number' && lat >= -90 && lat <= 90
  );
};

export const validateDosage = (dosage) => {
  if (!dosage || typeof dosage !== 'object') return false;
  
  const requiredFields = ['min', 'max', 'unit', 'frequency'];
  return requiredFields.every(field => dosage[field] && typeof dosage[field] === 'string');
};

export const validateHerbData = (herbData) => {
  const required = ['name', 'scientificName', 'description'];
  return required.every(field => 
    herbData[field] && typeof herbData[field] === 'string' && herbData[field].trim().length > 0
  );
};

export const validateBlogData = (blogData) => {
  const required = ['title', 'content', 'category', 'author'];
  return required.every(field => 
    blogData[field] && (typeof blogData[field] === 'string' || field === 'author')
  );
};

export const validateComment = (comment) => {
  return (
    comment &&
    typeof comment === 'string' &&
    comment.trim().length > 0 &&
    comment.trim().length <= 2000
  );
};

export const validateFeedback = (feedback) => {
  const required = ['rating', 'wouldRecommend', 'wouldUseAgain'];
  return required.every(field => 
    feedback.hasOwnProperty(field) && 
    (field === 'rating' ? validateRating(feedback[field]) : typeof feedback[field] === 'boolean')
  );
};

export const validateImage = (image) => {
  if (!image || typeof image !== 'object') return false;
  
  // Check if image has required properties
  if (!image.url || typeof image.url !== 'string') return false;
  
  // Check file extension
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const extension = image.url.toLowerCase().substring(image.url.lastIndexOf('.'));
  return validExtensions.includes(extension);
};

export const validateSearchQuery = (query) => {
  return (
    query &&
    typeof query === 'string' &&
    query.trim().length >= 2 &&
    query.trim().length <= 100
  );
};

export const validatePagination = (page, limit) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  return (
    !isNaN(pageNum) && pageNum >= 1 &&
    !isNaN(limitNum) && limitNum >= 1 && limitNum <= 100
  );
};

export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return (
    start instanceof Date && !isNaN(start) &&
    end instanceof Date && !isNaN(end) &&
    start <= end
  );
};

export const validateMedicalInfo = (medicalInfo) => {
  if (!medicalInfo || typeof medicalInfo !== 'object') return false;
  
  const { allergies, medications, conditions } = medicalInfo;
  
  if (allergies && !Array.isArray(allergies)) return false;
  if (medications && !Array.isArray(medications)) return false;
  if (conditions && !Array.isArray(conditions)) return false;
  
  return true;
};

export const validatePreparation = (preparation) => {
  if (!preparation || typeof preparation !== 'object') return false;
  
  const validMethods = [
    'tea', 'tincture', 'capsule', 'powder', 'ointment', 'essential_oil', 'compress'
  ];
  
  return (
    preparation.method && validMethods.includes(preparation.method) &&
    preparation.instructions && typeof preparation.instructions === 'string'
  );
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove potential JavaScript
    .replace(/on\w+=/gi, ''); // Remove potential event handlers
};

export const validateObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

export const validateFileType = (filename, allowedTypes) => {
  if (!filename || typeof filename !== 'string') return false;
  
  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return allowedTypes.includes(extension);
};

export const validateFileSize = (size, maxSize) => {
  return typeof size === 'number' && size > 0 && size <= maxSize;
};
