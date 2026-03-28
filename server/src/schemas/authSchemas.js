/**
 * Validation schemas for authentication endpoints
 */
const Joi = require('joi');

// Common patterns
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Login schema
const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
    password: Joi.string()
        .min(6)
        .required()
        .messages({
            'string.min': 'Password must be at least 6 characters',
            'any.required': 'Password is required',
        }),
    rememberMe: Joi.boolean().default(false),
});

// Registration schema
const registerSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
    password: Joi.string()
        .min(8)
        .pattern(passwordPattern)
        .required()
        .messages({
            'string.min': 'Password must be at least 8 characters',
            'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
            'any.required': 'Password is required',
        }),
    displayName: Joi.string()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Display name must be at least 2 characters',
            'string.max': 'Display name cannot exceed 50 characters',
        }),
});

// Profile update schema
const profileUpdateSchema = Joi.object({
    displayName: Joi.string().min(2).max(50),
    photoURL: Joi.string().uri().allow(null, ''),
    dateOfBirth: Joi.date().max('now').allow(null),
    gender: Joi.string().valid('male', 'female').allow(null),
    location: Joi.object({
        city: Joi.string().max(100),
        country: Joi.string().max(100),
    }),
    preferences: Joi.object({
        notifications: Joi.boolean(),
        newsletter: Joi.boolean(),
        theme: Joi.string().valid('light', 'dark', 'system'),
        language: Joi.string().valid('en', 'fil'),
    }),
    medicalInfo: Joi.object({
        allergies: Joi.array().items(Joi.string()),
        conditions: Joi.array().items(Joi.string()),
        medications: Joi.array().items(Joi.string()),
    }),
}).min(1); // At least one field required

// Password reset schema
const passwordResetSchema = Joi.object({
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required',
        }),
});

// Token refresh schema
const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

module.exports = {
    loginSchema,
    registerSchema,
    profileUpdateSchema,
    passwordResetSchema,
    refreshTokenSchema,
};
