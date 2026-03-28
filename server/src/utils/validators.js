// Validation utilities for the herbal medicine system
const sanitizeHtml = require('sanitize-html');

/**
 * Factory function to create regex-based validators
 * @param {RegExp} regex - The regex pattern to test against
 * @param {Function|null} additionalCheck - Optional additional validation function
 * @returns {Function} Validator function that returns boolean
 */
const createRegexValidator = (regex, additionalCheck = null) => (value) => {
  if (!value || typeof value !== 'string') return false;
  if (!regex.test(value)) return false;
  return additionalCheck ? additionalCheck(value) : true;
};

// Common regex patterns
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[\d\s\-\(\)]+$/,
  objectId: /^[0-9a-fA-F]{24}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};

// Validators using factory
const validateEmail = createRegexValidator(PATTERNS.email);

const validatePhoneNumber = createRegexValidator(
  PATTERNS.phone,
  (phone) => phone.replace(/\D/g, '').length >= 10
);

const validatePassword = createRegexValidator(PATTERNS.password);

const validateObjectId = createRegexValidator(PATTERNS.objectId);

// Validators that don't fit factory pattern
const validateAge = (age) => {
  return typeof age === 'number' && age >= 0 && age <= 150;
};

const validateGender = (gender) => {
  const validGenders = ['male', 'female'];
  return validGenders.includes(gender);
};

const validateSymptoms = (symptoms) => {
  if (!Array.isArray(symptoms)) return false;
  return symptoms.every(symptom =>
    typeof symptom === 'string' && symptom.trim().length > 0
  );
};

const validateRating = (rating) => {
  return typeof rating === 'number' && rating >= 1 && rating <= 5;
};

const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  return (
    typeof lng === 'number' && lng >= -180 && lng <= 180 &&
    typeof lat === 'number' && lat >= -90 && lat <= 90
  );
};

const validateDosage = (dosage) => {
  if (!dosage || typeof dosage !== 'object') return false;

  const requiredFields = ['min', 'max', 'unit', 'frequency'];
  return requiredFields.every(
    (field) => typeof dosage[field] === 'string' && dosage[field].trim().length > 0
  );
};

const validateHerbData = (herbData) => {
  if (!herbData || typeof herbData !== 'object') return false;
  const required = ['name', 'scientificName', 'description'];
  return required.every(field =>
    herbData[field] && typeof herbData[field] === 'string' && herbData[field].trim().length > 0
  );
};

const validateBlogData = (blogData) => {
  if (!blogData || typeof blogData !== 'object') return false;
  const required = ['title', 'content', 'category', 'author'];
  return required.every(field =>
    blogData[field] && (typeof blogData[field] === 'string' || field === 'author')
  );
};

const validateComment = (comment) => {
  return (
    comment &&
    typeof comment === 'string' &&
    comment.trim().length > 0 &&
    comment.trim().length <= 2000
  );
};

const validateFeedback = (feedback) => {
  if (!feedback || typeof feedback !== 'object') return false;
  const required = ['rating', 'wouldRecommend', 'wouldUseAgain'];
  return required.every(field =>
    Object.prototype.hasOwnProperty.call(feedback, field) &&
    (field === 'rating' ? validateRating(feedback[field]) : typeof feedback[field] === 'boolean')
  );
};

const validateImage = (image) => {
  if (!image || typeof image !== 'object') return false;

  // Check if image has required properties
  if (!image.url || typeof image.url !== 'string') return false;

  // Check file extension
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const extension = image.url.toLowerCase().substring(image.url.lastIndexOf('.'));
  return validExtensions.includes(extension);
};

const validateSearchQuery = (query) => {
  return (
    query &&
    typeof query === 'string' &&
    query.trim().length >= 2 &&
    query.trim().length <= 100
  );
};

const validatePagination = (page, limit) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);

  return (
    !isNaN(pageNum) && pageNum >= 1 &&
    !isNaN(limitNum) && limitNum >= 1 && limitNum <= 100
  );
};

const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return (
    start instanceof Date && !isNaN(start) &&
    end instanceof Date && !isNaN(end) &&
    start <= end
  );
};

const validateMedicalInfo = (medicalInfo) => {
  if (!medicalInfo || typeof medicalInfo !== 'object') return false;

  const { allergies, medications, conditions } = medicalInfo;

  if (allergies && !Array.isArray(allergies)) return false;
  if (medications && !Array.isArray(medications)) return false;
  if (conditions && !Array.isArray(conditions)) return false;

  return true;
};

const validatePreparation = (preparation) => {
  if (!preparation || typeof preparation !== 'object') return false;

  const validMethods = [
    'tea', 'tincture', 'capsule', 'powder', 'ointment', 'essential_oil', 'compress'
  ];

  return (
    preparation.method && validMethods.includes(preparation.method) &&
    preparation.instructions && typeof preparation.instructions === 'string'
  );
};

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
      allowedSchemes: ['http', 'https', 'mailto'],
      disallowedTagsMode: 'discard',
    }).trim();
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }

  if (input && typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, sanitizeInput(value)])
    );
  }

  return input;
};

const validateFileType = (filename, allowedTypes) => {
  if (!filename || typeof filename !== 'string') return false;
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) return false;

  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return allowedTypes.includes(extension);
};

const validateFileSize = (size, maxSize) => {
  return typeof size === 'number' && size > 0 && size <= maxSize;
};

module.exports = {
  // Factory functions (new)
  createRegexValidator,
  PATTERNS,
  // Existing exports (backwards compatible)
  validateEmail,
  validatePassword,
  validatePhoneNumber,
  validateAge,
  validateGender,
  validateSymptoms,
  validateRating,
  validateCoordinates,
  validateDosage,
  validateHerbData,
  validateBlogData,
  validateComment,
  validateFeedback,
  validateImage,
  validateSearchQuery,
  validatePagination,
  validateDateRange,
  validateMedicalInfo,
  validatePreparation,
  sanitizeInput,
  validateObjectId,
  validateFileType,
  validateFileSize,
};
