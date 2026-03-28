const Joi = require('joi');

const objectIdParamSchema = Joi.object({
  id: Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/).required(),
});

const pagingQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

const uploadLabelBodySchema = Joi.object({
  label: Joi.string().trim().min(1).max(120).optional(),
});

const feedbackBodySchema = Joi.object({
  userCorrection: Joi.string().trim().allow('').max(200).optional(),
  isCorrect: Joi.boolean().optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
}).or('userCorrection', 'isCorrect', 'rating');

module.exports = {
  objectIdParamSchema,
  pagingQuerySchema,
  uploadLabelBodySchema,
  feedbackBodySchema,
};

