/**
 * Generic request validation middleware using Joi
 * Validates request body, query, or params against a Joi schema
 */
const { formatValidationErrors } = require('../utils/responseFormatter');

/**
 * Creates a validation middleware for a given Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
const validateRequest = (schema, source = 'body') => {
    return (req, res, next) => {
        const dataToValidate = req[source];

        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Return all errors, not just first
            stripUnknown: true, // Remove unknown fields
            convert: true, // Type coercion (e.g., string to number)
        });

        if (error) {
            const formattedErrors = error.details.map(detail => ({
                path: detail.path.join('.'),
                message: detail.message.replace(/"/g, ''),
            }));

            return res.status(400).json(formatValidationErrors(formattedErrors));
        }

        // Replace request data with validated/sanitized data
        req[source] = value;
        req.validatedData = value;

        next();
    };
};

/**
 * Validate multiple sources at once
 * @param {Object} schemas - Object with keys 'body', 'query', 'params' mapping to Joi schemas
 * @returns {Function} Express middleware function
 */
const validateMultiple = (schemas) => {
    return (req, res, next) => {
        const errors = [];

        for (const [source, schema] of Object.entries(schemas)) {
            if (schema && req[source]) {
                const { error, value } = schema.validate(req[source], {
                    abortEarly: false,
                    stripUnknown: true,
                    convert: true,
                });

                if (error) {
                    errors.push(...error.details.map(detail => ({
                        path: `${source}.${detail.path.join('.')}`,
                        message: detail.message.replace(/"/g, ''),
                    })));
                } else {
                    req[source] = value;
                }
            }
        }

        if (errors.length > 0) {
            return res.status(400).json(formatValidationErrors(errors));
        }

        next();
    };
};

module.exports = {
    validateRequest,
    validateMultiple,
};
