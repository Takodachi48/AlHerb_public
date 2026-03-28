const { formatSuccess, formatError } = require('./responseFormatter');

/**
 * Standardized metadata envelope utility for backend responses
 * Handles common response patterns and metadata formatting
 */
class MetadataHelper {
  /**
   * Create standard success response with metadata
   */
  static success(data, message = 'Success', metadata = {}) {
    return formatSuccess(data, message, metadata);
  }

  /**
   * Create error response with metadata
   */
  static error(message, statusCode = 500, error = null, metadata = {}) {
    return formatError(message, statusCode, error, metadata);
  }

  /**
   * Create stats response envelope
   */
  static stats(stats, entity = 'items') {
    return formatSuccess(stats, `${entity.charAt(0).toUpperCase() + entity.slice(1)} statistics retrieved successfully`);
  }

  /**
   * Create bulk operation response
   */
  static bulkOperation(results, operation = 'updated', entity = 'items') {
    const { matched, modified, upserted } = results;
    
    return formatSuccess({
      total_processed: matched || results.length,
      successful: modified || upserted || results.length,
      operation,
      entity
    }, `${entity.charAt(0).toUpperCase() + entity.slice(1)} ${operation} successfully`);
  }

  /**
   * Create validation error response
   */
  static validationError(errors, message = 'Validation failed') {
    return formatError(message, 400, {
      type: 'validation_error',
      details: errors
    });
  }

  /**
   * Create not found response
   */
  static notFound(entity = 'Resource') {
    return formatError(`${entity} not found`, 404);
  }

  /**
   * Create unauthorized response
   */
  static unauthorized(message = 'Unauthorized access') {
    return formatError(message, 401);
  }

  /**
   * Create forbidden response
   */
  static forbidden(message = 'Access forbidden') {
    return formatError(message, 403);
  }

  /**
   * Add common metadata to any response
   */
  static addCommonMetadata(response, additionalMetadata = {}) {
    return {
      ...response,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        ...additionalMetadata
      }
    };
  }
}

module.exports = MetadataHelper;
