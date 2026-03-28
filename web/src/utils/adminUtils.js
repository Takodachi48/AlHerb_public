/**
 * Utility functions for Admin management pages
 */

/**
 * Clean query parameters for API calls
 * Removes 'all', empty strings, null, and undefined values
 * @param {Object} params - The parameters to clean
 * @returns {Object} Cleaned parameters
 */
export const cleanParams = (params) => {
    const cleaned = {};
    Object.entries(params).forEach(([key, value]) => {
        if (
            value !== null &&
            value !== undefined &&
            value !== '' &&
            value !== 'all'
        ) {
            cleaned[key] = value;
        }
    });
    return cleaned;
};

/**
 * Format a list of items for the Table component
 * @param {Array} items - List of items to format
 * @param {Function} formatter - Function that returns an array of table cells for each item
 * @returns {Array} Formatted data for Table component
 */
export const formatTableData = (items, formatter) => {
    if (!Array.isArray(items)) return [];
    return items.map(formatter);
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};
