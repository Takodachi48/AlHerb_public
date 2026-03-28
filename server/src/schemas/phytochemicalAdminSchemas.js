const Joi = require('joi');

const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/);

const CATEGORY_VALUES = [
  'alkaloids',
  'flavonoids',
  'terpenoids',
  'phenolic_compounds',
  'glycosides',
  'essential_oils',
  'tannins',
  'saponins',
  'other',
];

const PART_VALUES = ['leaf', 'root', 'flower', 'bark', 'whole_plant'];
const UNIT_VALUES = ['%', 'mg/g', 'mg/kg', 'ppm', 'ug/g'];
const ASSIGNMENT_STATUS_VALUES = ['active', 'superseded', 'archived'];

const phytochemicalIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

const listPhytochemicalsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  category: Joi.string().valid('all', ...CATEGORY_VALUES).default('all'),
  search: Joi.string().trim().allow('').max(120).default(''),
  sort: Joi.string().valid('name_asc', 'assigned_herbs_desc', 'updated_desc').default('name_asc'),
  status: Joi.string().valid('all', 'active', 'archived').default('all'),
});

const phytochemicalDetailQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
  herbSearch: Joi.string().trim().allow('').max(120).default(''),
  herbPart: Joi.string().valid('all', ...PART_VALUES).default('all'),
  unit: Joi.string().valid('all', ...UNIT_VALUES).default('all'),
  assignmentStatus: Joi.string().valid('all', ...ASSIGNMENT_STATUS_VALUES).default('all'),
});

const createPhytochemicalBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  category: Joi.string().valid(...CATEGORY_VALUES).required(),
  description: Joi.string().trim().allow('').max(4000).default(''),
  effects: Joi.array().items(Joi.string().trim().min(1).max(120)).max(100).default([]),
});

const updatePhytochemicalBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120),
  category: Joi.string().valid(...CATEGORY_VALUES),
  description: Joi.string().trim().allow('').max(4000),
  effects: Joi.array().items(Joi.string().trim().min(1).max(120)).max(100),
}).min(1);

const listPhytochemicalHerbsQuerySchema = Joi.object({
  q: Joi.string().trim().allow('').max(120).default(''),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

const saveAssignmentBodySchema = Joi.object({
  assignmentId: objectIdSchema.allow(null, ''),
  phytochemicalId: objectIdSchema.required(),
  herbId: Joi.string().trim().min(1).max(128).required(),
  herbPart: Joi.string().valid(...PART_VALUES).required(),
  concentrationValue: Joi.number().min(0).required(),
  concentrationUnit: Joi.string().valid(...UNIT_VALUES).required(),
  sourceReference: Joi.string().trim().allow('').max(500).default(''),
  extractionType: Joi.string().trim().allow('').max(120).default(''),
  confidenceLevel: Joi.string().valid('low', 'medium', 'high').default('medium'),
  notes: Joi.string().trim().allow('').max(2000).default(''),
  status: Joi.string().valid(...ASSIGNMENT_STATUS_VALUES).default('active'),
  revisionNote: Joi.string().trim().allow('').max(500).default(''),
});

module.exports = {
  phytochemicalIdParamSchema,
  listPhytochemicalsQuerySchema,
  phytochemicalDetailQuerySchema,
  createPhytochemicalBodySchema,
  updatePhytochemicalBodySchema,
  listPhytochemicalHerbsQuerySchema,
  saveAssignmentBodySchema,
};

