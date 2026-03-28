const Joi = require('joi');

const LOCATION_TYPES = ['market', 'foraging', 'shop', 'pharmacy', 'clinic'];
const objectIdSchema = Joi.string().trim().pattern(/^[0-9a-fA-F]{24}$/);

const locationCoordinatesSchema = Joi.array()
  .length(2)
  .ordered(
    Joi.number().min(116).max(127).required(),
    Joi.number().min(4).max(21).required()
  )
  .required();

const herbRefSchema = Joi.object({
  herbId: Joi.string().trim().min(1).max(128).required(),
  notes: Joi.string().trim().allow('').max(500),
  lastUpdated: Joi.date().iso(),
});

const imageSchema = Joi.object({
  url: Joi.string().trim().uri().max(2000).required(),
  caption: Joi.string().trim().allow('').max(300),
  isPrimary: Joi.boolean(),
});

const locationIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

const listLocationsQuerySchema = Joi.object({
  type: Joi.string().valid('all', ...LOCATION_TYPES).allow(''),
  search: Joi.string().trim().allow('').max(120),
  herb: Joi.string().trim().allow('').max(128),
  compact: Joi.boolean(),
  isActive: Joi.boolean(),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  skip: Joi.number().integer().min(0).max(1000000),
  minLat: Joi.number().min(-90).max(90),
  maxLat: Joi.number().min(-90).max(90),
  minLng: Joi.number().min(-180).max(180),
  maxLng: Joi.number().min(-180).max(180),
}).with('minLat', 'maxLat')
  .with('maxLat', 'minLat')
  .with('minLng', 'maxLng')
  .with('maxLng', 'minLng');

const nearbyLocationsQuerySchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(0.1).max(500).default(25),
  type: Joi.string().valid('all', ...LOCATION_TYPES).allow(''),
  herb: Joi.string().trim().allow('').max(128),
  compact: Joi.boolean(),
  limit: Joi.number().integer().min(1).max(100).default(30),
  search: Joi.string().trim().allow('').max(120),
});

const clustersQuerySchema = Joi.object({
  swLat: Joi.number().min(-90).max(90).required(),
  swLng: Joi.number().min(-180).max(180).required(),
  neLat: Joi.number().min(-90).max(90).required(),
  neLng: Joi.number().min(-180).max(180).required(),
  zoom: Joi.number().integer().min(1).max(20).default(10),
  type: Joi.string().valid('all', ...LOCATION_TYPES).allow(''),
  herb: Joi.string().trim().allow('').max(128),
  compact: Joi.boolean(),
  search: Joi.string().trim().allow('').max(120),
});

const locationReviewsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

const createLocationReviewBodySchema = Joi.object({
  comment: Joi.string().trim().min(1).max(1000).required(),
  wouldReturn: Joi.boolean().default(true),
  caption: Joi.string().trim().allow('').max(300),
});

const createLocationBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().valid(...LOCATION_TYPES).required(),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: locationCoordinatesSchema,
  }).required(),
  herbs: Joi.array().items(herbRefSchema).max(200).default([]),
  description: Joi.string().trim().allow('').max(1000).default(''),
  images: Joi.array().items(imageSchema).max(30).default([]),
  verified: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  createdBy: objectIdSchema.optional(),
});

const updateLocationBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(200),
  type: Joi.string().valid(...LOCATION_TYPES),
  location: Joi.object({
    type: Joi.string().valid('Point').default('Point'),
    coordinates: locationCoordinatesSchema,
  }),
  herbs: Joi.array().items(herbRefSchema).max(200),
  description: Joi.string().trim().allow('').max(1000),
  images: Joi.array().items(imageSchema).max(30),
  verified: Joi.boolean(),
  isActive: Joi.boolean(),
}).min(1);

module.exports = {
  locationIdParamSchema,
  listLocationsQuerySchema,
  nearbyLocationsQuerySchema,
  clustersQuerySchema,
  locationReviewsQuerySchema,
  createLocationReviewBodySchema,
  createLocationBodySchema,
  updateLocationBodySchema,
};
