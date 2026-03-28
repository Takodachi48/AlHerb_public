const { formatPaginatedResponse } = require('./responseFormatter');

/**
 * Standardized pagination utility for backend controllers
 * Handles common pagination logic and response formatting
 */
class PaginationHelper {
  /**
   * Build pagination query from request
   */
  static buildQuery(options = {}) {
    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20)); // Cap at 100 for performance
    const skip = (pageNum - 1) * limitNum;

    return {
      pageNum,
      limitNum,
      skip,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 1 : -1
    };
  }

  /**
   * Build search query for text search
   */
  static buildSearchQuery(searchTerm, searchFields = []) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return {};
    }

    const trimmed = searchTerm.trim();
    if (trimmed.length === 0) {
      return {};
    }

    if (searchFields.length > 0) {
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: trimmed, $options: 'i' }
      }));
      return { $or: searchConditions };
    }

    return { $text: { $search: trimmed } };
  }

  /**
   * Execute paginated query and format response
   */
  static async executePaginatedQuery(Model, query, options = {}) {
    const { pageNum, limitNum, skip, sortBy, sortOrder } = this.buildQuery(options);
    const { populate = null, additionalQuery = {} } = options;

    // Merge additional query conditions
    const finalQuery = { ...query, ...additionalQuery };

    // Build the find query
    let findQuery = Model.find(finalQuery).sort({ [sortBy]: sortOrder }).skip(skip).limit(limitNum);
    
    // Add population if specified
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach(field => findQuery = findQuery.populate(field));
      } else {
        findQuery = findQuery.populate(populate);
      }
    }

    // Execute queries in parallel
    const [data, total] = await Promise.all([
      findQuery.lean(),
      Model.countDocuments(finalQuery)
    ]);

    return {
      data,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < Math.ceil(total / limitNum),
        hasPrevPage: pageNum > 1,
        nextPage: pageNum < Math.ceil(total / limitNum) ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null
      }
    };
  }

  /**
   * Send paginated response
   */
  static sendPaginatedResponse(res, data, pagination, message = 'Data retrieved successfully') {
    res.json(formatPaginatedResponse(
      data,
      pagination.currentPage,
      pagination.itemsPerPage,
      pagination.totalItems,
      message
    ));
  }

  /**
   * Handle common filter logic for active/inactive status
   */
  static handleStatusFilter(status, isActiveField = 'isActive') {
    if (status === undefined || status === 'all') {
      return {};
    }
    
    return {
      [isActiveField]: status === 'active'
    };
  }
}

module.exports = PaginationHelper;
