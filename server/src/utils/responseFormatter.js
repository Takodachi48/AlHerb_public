// Response formatting utilities for consistent API responses

/**
 * Base response factory - creates standardized response structure
 * @param {boolean} success - Whether the operation succeeded
 * @param {string} message - Response message
 * @param {*} data - Response data
 * @param {Object} options - Additional options (pagination, details, meta)
 * @returns {Object} Standardized response object
 */
const createResponse = (success, message, data, options = {}) => ({
  success,
  message,
  data,
  ...(options.error && { error: options.error }),
  ...(options.statusCode && { statusCode: options.statusCode }),
  ...(options.details && { details: options.details }),
  ...(options.pagination && { pagination: options.pagination }),
  meta: {
    timestamp: new Date().toISOString(),
    ...options.meta,
  },
});

const formatSuccess = (data, message = 'Success', meta = {}) =>
  createResponse(true, message, data, { meta });

const formatError = (message, statusCode = 500, details = null) =>
  createResponse(false, message, null, { error: message, statusCode, details });

const formatPaginatedResponse = (data, page, limit, total, message = 'Success') => {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return createResponse(true, message, data, {
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: total,
      itemsPerPage: limit,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
  });
};

const formatValidationErrors = (errors) => {
  const formattedErrors = {};

  if (Array.isArray(errors)) {
    errors.forEach(error => {
      if (error.path) {
        formattedErrors[error.path] = error.msg || error.message;
      } else if (error.field) {
        formattedErrors[error.field] = error.message;
      }
    });
  } else if (typeof errors === 'object') {
    Object.keys(errors).forEach(key => {
      formattedErrors[key] = Array.isArray(errors[key])
        ? errors[key][0]
        : errors[key];
    });
  }

  return formatError('Validation failed', 400, formattedErrors);
};

const formatAuthResponse = (user, token, additionalData = {}) =>
  createResponse(true, 'Authentication successful', {
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      ...additionalData,
    },
    token,
  });

const formatNotFoundResponse = (resource = 'Resource') =>
  createResponse(false, `${resource} not found`, null, { statusCode: 404 });

const formatUnauthorizedResponse = (message = 'Unauthorized') =>
  createResponse(false, message, null, { statusCode: 401 });

const formatForbiddenResponse = (message = 'Access forbidden') =>
  createResponse(false, message, null, { statusCode: 403 });

const formatValidationResponse = (errors) => {
  const formattedErrors = {};

  if (Array.isArray(errors)) {
    errors.forEach(error => {
      if (error.path) {
        formattedErrors[error.path] = error.msg || error.message;
      } else if (error.field) {
        formattedErrors[error.field] = error.message;
      }
    });
  } else if (typeof errors === 'object') {
    Object.keys(errors).forEach(key => {
      formattedErrors[key] = Array.isArray(errors[key])
        ? errors[key][0]
        : errors[key];
    });
  }

  return createResponse(false, 'Validation failed', null, { 
    statusCode: 400,
    errors: formattedErrors 
  });
};

const formatCreatedResponse = (data, message = 'Resource created successfully') =>
  createResponse(true, message, data, { statusCode: 201 });

const formatUpdatedResponse = (data, message = 'Resource updated successfully') =>
  createResponse(true, message, data);

const formatDeletedResponse = (data, message = 'Resource deleted successfully') =>
  createResponse(true, message, data);

const formatRecommendationResponse = (recommendation, mlData = null) =>
  createResponse(true, 'Recommendation generated successfully', {
    id: recommendation._id,
    symptoms: recommendation.symptoms,
    recommendations: recommendation.recommendations,
    confidence: recommendation.getAverageConfidence(),
    mlModel: recommendation.mlModel,
    createdAt: recommendation.createdAt,
    ...(mlData && { mlData }),
  });

const formatBlogResponse = (blog, includeContent = true) =>
  createResponse(true, 'Blog post retrieved successfully', {
    id: blog._id,
    title: blog.title,
    slug: blog.slug,
    excerpt: blog.excerpt,
    author: blog.author,
    category: blog.category,
    tags: blog.tags,
    featuredImage: blog.featuredImage,
    readingTime: blog.readingTime,
    publishedAt: blog.publishedAt,
    featured: blog.featured,
    pinned: blog.pinned,
    ...(includeContent && { content: blog.content }),
  });

const formatCommentResponse = (comment, includeReplies = true) =>
  createResponse(true, 'Comment retrieved successfully', {
    id: comment._id,
    content: comment.content,
    author: comment.author,
    createdAt: comment.createdAt,
    isEdited: comment.isEdited,
    editedAt: comment.editedAt,
    likeCount: comment.likeCount,
    ...(includeReplies && { replies: comment.replies }),
  });

const formatLocationResponse = (location, includeHerbs = true) =>
  createResponse(true, 'Location retrieved successfully', {
    id: location._id,
    name: location.name,
    type: location.type,
    location: location.location,
    derivedLocation: location.derivedLocation,
    rating: location.rating,
    verified: location.verified,
    images: location.images,
    description: location.description,
    ...(includeHerbs && { herbs: location.herbs }),
  });

const formatChatResponse = (conversation, includeMessages = false) =>
  createResponse(true, 'Chat conversation retrieved successfully', {
    id: conversation._id,
    title: conversation.title,
    session: conversation.session,
    feedback: conversation.feedback,
    analytics: conversation.analytics,
    ...(includeMessages && { messages: conversation.messages }),
  });

const formatAnalyticsResponse = (data, period, type) =>
  createResponse(true, 'Analytics data retrieved successfully', {
    type,
    period,
    metrics: data,
  });

const formatFileUploadResponse = (fileData) =>
  createResponse(true, 'File uploaded successfully', {
    filename: fileData.filename,
    originalName: fileData.originalname,
    size: fileData.size,
    mimetype: fileData.mimetype,
    url: fileData.url,
    uploadedAt: new Date().toISOString(),
  });

const formatHealthResponse = (status, services = {}) =>
  createResponse(true, 'Health check completed', {
    status,
    services,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });

const formatSearchResponse = (results, query, total, page = 1, limit = 10) =>
  createResponse(true, 'Search completed successfully', {
    query,
    results,
    total,
    page,
    limit,
  });

const formatBulkResponse = (results, operation) => {
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;

  return createResponse(true, `${operation} completed`, {
    results,
    summary: {
      total: results.length,
      successful,
      failed,
      successRate: ((successful / results.length) * 100).toFixed(2) + '%',
    },
  });
};

module.exports = {
  // Base factory (new)
  createResponse,
  // Existing exports (backwards compatible)
  formatSuccess,
  formatError,
  formatPaginatedResponse,
  formatValidationErrors,
  // New response helpers
  formatAuthResponse,
  formatNotFoundResponse,
  formatUnauthorizedResponse,
  formatForbiddenResponse,
  formatValidationResponse,
  formatCreatedResponse,
  formatUpdatedResponse,
  formatDeletedResponse,
  formatRecommendationResponse,
  formatBlogResponse,
  formatCommentResponse,
  formatLocationResponse,
  formatChatResponse,
  formatAnalyticsResponse,
  formatFileUploadResponse,
  formatHealthResponse,
  formatSearchResponse,
  formatBulkResponse,
};
