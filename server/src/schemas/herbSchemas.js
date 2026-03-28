const Joi = require('joi');

const herbIdParamSchema = Joi.object({
  id: Joi.string().trim().min(1).max(160).required(),
});

const paginationQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const listHerbsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().allow('').max(120),
  category: Joi.string().trim().allow('').max(80),
  gender: Joi.string().valid('all', 'male', 'female').default('all'),
  safety: Joi.string().valid('all', 'safe', 'caution', 'avoid', 'unknown').default('all'),
  status: Joi.string().valid('active', 'inactive', 'pending').default('active'),
});

const searchHerbsQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required(),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  category: Joi.string().trim().allow('').max(80),
});

const compareHerbsQuerySchema = Joi.object({
  herb1: Joi.string().trim().min(1).max(160).required(),
  herb2: Joi.string().trim().min(1).max(160).required(),
  symptom: Joi.string().trim().allow('').max(100).default(''),
  ageGroup: Joi.string().valid('child', 'adult', 'elderly').default('adult'),
  includeSafety: Joi.boolean().default(false),
});

const recommendHerbsBodySchema = Joi.object({
  symptoms: Joi.array().items(Joi.string().trim().min(1).max(100)).min(1).max(30).required(),
  userProfile: Joi.object({
    age: Joi.number().integer().min(0).max(150),
    gender: Joi.string().valid('male', 'female'),
    severity: Joi.string().trim().max(40),
    conditions: Joi.array().items(Joi.string().trim().max(100)).max(100),
    medications: Joi.array().items(Joi.string().trim().max(100)).max(100),
    allergies: Joi.array().items(Joi.string().trim().max(100)).max(100),
    isPregnant: Joi.boolean(),
    isBreastfeeding: Joi.boolean(),
  }).default({}),
  topN: Joi.number().integer().min(1).max(50).default(10),
  candidateCap: Joi.number().integer().min(1).max(200),
  recordRecommendation: Joi.boolean().default(true),
});

const assessSafetyBodySchema = Joi.object({
  userProfile: Joi.object({
    age: Joi.number().integer().min(0).max(150),
    gender: Joi.string().valid('male', 'female'),
    conditions: Joi.array().items(Joi.string().trim().max(100)).max(100),
    medications: Joi.array().items(Joi.string().trim().max(100)).max(100),
    allergies: Joi.array().items(Joi.string().trim().max(100)).max(100),
    isPregnant: Joi.boolean(),
    isBreastfeeding: Joi.boolean(),
  }).default({}),
});

const interactionsBodySchema = Joi.object({
  type: Joi.string().valid('drug-herb', 'herb-herb', 'food-herb').optional(),
  minSeverity: Joi.string().valid('minor', 'moderate', 'major', 'contraindicated').optional(),
  medications: Joi.array().items(Joi.string().trim().max(100)).max(100).default([]),
});

const contraindicationsBodySchema = Joi.object({
  conditions: Joi.array().items(Joi.string().trim().max(100)).max(100).default([]),
});

const safetyCombinationBodySchema = Joi.object({
  herbIds: Joi.array().items(Joi.string().trim().min(1).max(160)).min(2).max(20).required(),
});

const herbStatusBodySchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'pending'),
  isActive: Joi.boolean(),
}).or('status', 'isActive');

const bulkHerbStatusBodySchema = Joi.object({
  ids: Joi.array().items(Joi.string().trim().min(1).max(160)).min(1).max(500).required(),
  status: Joi.string().valid('active', 'inactive', 'pending'),
  isActive: Joi.boolean(),
}).or('status', 'isActive');

// Kept permissive for legacy multipart payload shapes while still enforcing required identity.
const createHerbBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  scientificName: Joi.string().trim().min(1).max(200).required(),
  slug: Joi.string().trim().allow('').max(200),
}).unknown(true);

const updateHerbBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  scientificName: Joi.string().trim().min(1).max(200),
  slug: Joi.string().trim().allow('').max(200),
  isActive: Joi.boolean(),
  isFeatured: Joi.boolean(),
}).min(1).unknown(true);

const symptomParamSchema = Joi.object({
  symptom: Joi.string().trim().min(1).max(120).required(),
});

const categoryParamSchema = Joi.object({
  category: Joi.string().trim().min(1).max(80).required(),
});

module.exports = {
  herbIdParamSchema,
  paginationQuerySchema,
  listHerbsQuerySchema,
  searchHerbsQuerySchema,
  compareHerbsQuerySchema,
  recommendHerbsBodySchema,
  assessSafetyBodySchema,
  interactionsBodySchema,
  contraindicationsBodySchema,
  safetyCombinationBodySchema,
  herbStatusBodySchema,
  bulkHerbStatusBodySchema,
  createHerbBodySchema,
  updateHerbBodySchema,
  symptomParamSchema,
  categoryParamSchema,
};
