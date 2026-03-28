/**
 * Response utility functions - DEPRECATED
 * This file is kept for backwards compatibility.
 * Use responseFormatter.js for new code.
 */

// Re-export from responseFormatter for backwards compatibility
const {
  formatSuccess,
  formatError,
  formatPaginatedResponse
} = require('./responseFormatter');

module.exports = {
  formatSuccess,
  formatError,
  formatPaginatedResponse
};
