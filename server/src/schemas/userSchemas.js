const Joi = require('joi');

const profileUpdateBodySchema = Joi.object({
  email: Joi.string().trim().email().max(255),
  displayName: Joi.string().trim().min(2).max(80),
  photoURL: Joi.string().uri().allow(null, ''),
  dateOfBirth: Joi.date().iso(),
  gender: Joi.string().valid('male', 'female'),
  location: Joi.object({
    city: Joi.string().trim().max(100).allow(''),
    province: Joi.string().trim().max(100).allow(''),
    region: Joi.string().trim().max(100).allow(''),
    // Backward compatibility for older clients
    country: Joi.string().trim().max(100).allow(''),
    address: Joi.string().trim().max(200).allow(''),
  }),
  preferences: Joi.object({
    darkMode: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid('light', 'dark', 'auto')
    ),
  }),
}).min(1);

const preferencesBodySchema = Joi.object({
  preferences: Joi.object({
    notifications: Joi.object({
      email: Joi.boolean(),
      push: Joi.boolean(),
      system: Joi.boolean(),
      blog: Joi.boolean(),
    }),
    language: Joi.string().trim().min(1).max(20),
    theme: Joi.string().valid('theme1', 'theme2', 'theme8'),
    darkMode: Joi.string().valid('light', 'dark', 'auto'),
    chatbot: Joi.object({
      enabled: Joi.boolean(),
    }),
  }).required(),
});

const medicalInfoBodySchema = Joi.object({
  medicalInfo: Joi.object({
    allergies: Joi.array().items(Joi.string().trim().max(100)).max(200).default([]),
    medications: Joi.array().items(Joi.string().trim().max(100)).max(200).default([]),
    conditions: Joi.array().items(Joi.string().trim().max(100)).max(200).default([]),
  }).required(),
});

const recommendationHistoryQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  rankingSource: Joi.string().trim().allow('').max(100).default(''),
  blocked: Joi.string().trim().allow('').max(20).default(''),
  dateFrom: Joi.string().trim().allow('').max(40).default(''),
  dateTo: Joi.string().trim().allow('').max(40).default(''),
});

const changePasswordBodySchema = Joi.object({
  currentPassword: Joi.string().min(1).max(128).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});

const herbIdBodySchema = Joi.object({
  herbId: Joi.string().trim().min(1).max(160).required(),
});

const herbIdParamSchema = Joi.object({
  herbId: Joi.string().trim().min(1).max(160).required(),
});

const savedRecommendationBodySchema = Joi.object({
  recommendationId: Joi.string().trim().min(1).max(160),
  herbId: Joi.string().trim().min(1).max(160),
}).or('recommendationId', 'herbId').unknown(true);

const recommendationIdParamSchema = Joi.object({
  recommendationId: Joi.string().trim().min(1).max(160).required(),
});

module.exports = {
  profileUpdateBodySchema,
  preferencesBodySchema,
  medicalInfoBodySchema,
  recommendationHistoryQuerySchema,
  changePasswordBodySchema,
  herbIdBodySchema,
  herbIdParamSchema,
  savedRecommendationBodySchema,
  recommendationIdParamSchema,
};
