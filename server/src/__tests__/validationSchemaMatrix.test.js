const {
  createInquirySchema,
} = require('../schemas/inquirySchemas');
const {
  listLocationsQuerySchema,
  nearbyLocationsQuerySchema,
} = require('../schemas/locationSchemas');
const {
  compareHerbsQuerySchema,
  recommendHerbsBodySchema,
  herbStatusBodySchema,
} = require('../schemas/herbSchemas');
const {
  createPhytochemicalBodySchema,
  saveAssignmentBodySchema,
} = require('../schemas/phytochemicalAdminSchemas');
const {
  preferencesBodySchema,
} = require('../schemas/userSchemas');

const expectValid = (schema, value) => {
  const { error } = schema.validate(value, { abortEarly: false });
  expect(error).toBeUndefined();
};

const expectInvalid = (schema, value) => {
  const { error } = schema.validate(value, { abortEarly: false });
  expect(error).toBeDefined();
};

describe('Validation Schema Matrix', () => {
  test.each([
    ['inquiry valid email', createInquirySchema, {
      name: 'Jane Doe',
      contactType: 'email',
      contactValue: 'jane@example.com',
      message: 'Hello, this is a valid inquiry.',
    }, true],
    ['inquiry invalid contact type', createInquirySchema, {
      name: 'Jane Doe',
      contactType: 'fax',
      contactValue: '123',
      message: 'Invalid contact type.',
    }, false],
    ['inquiry message too long', createInquirySchema, {
      name: 'Jane Doe',
      contactType: 'phone',
      contactValue: '+12345678901',
      message: 'x'.repeat(1001),
    }, false],
    ['location list valid bounds', listLocationsQuerySchema, {
      page: 1,
      limit: 50,
      minLat: 10,
      maxLat: 15,
      minLng: 120,
      maxLng: 122,
    }, true],
    ['location list partial bounds rejected', listLocationsQuerySchema, {
      minLat: 10,
      maxLat: 15,
      minLng: 120,
    }, false],
    ['nearby valid radius max', nearbyLocationsQuerySchema, {
      lat: 14.5,
      lng: 121.0,
      radius: 500,
      limit: 100,
    }, true],
    ['nearby invalid radius over max', nearbyLocationsQuerySchema, {
      lat: 14.5,
      lng: 121.0,
      radius: 501,
    }, false],
    ['compare herbs valid enum', compareHerbsQuerySchema, {
      herb1: 'ginger',
      herb2: 'turmeric',
      ageGroup: 'adult',
    }, true],
    ['compare herbs invalid enum', compareHerbsQuerySchema, {
      herb1: 'ginger',
      herb2: 'turmeric',
      ageGroup: 'teen',
    }, false],
    ['recommend valid minimum topN', recommendHerbsBodySchema, {
      symptoms: ['headache'],
      topN: 1,
    }, true],
    ['recommend invalid topN zero', recommendHerbsBodySchema, {
      symptoms: ['headache'],
      topN: 0,
    }, false],
    ['herb status valid boolean path', herbStatusBodySchema, {
      isActive: true,
    }, true],
    ['herb status empty rejected', herbStatusBodySchema, {}, false],
    ['phytochemical create valid', createPhytochemicalBodySchema, {
      name: 'Quercetin',
      category: 'flavonoids',
      description: '',
      effects: ['antioxidant'],
    }, true],
    ['phytochemical create invalid category', createPhytochemicalBodySchema, {
      name: 'Quercetin',
      category: 'invalid',
    }, false],
    ['assignment valid minimum fields', saveAssignmentBodySchema, {
      phytochemicalId: '507f1f77bcf86cd799439011',
      herbId: 'herb_1',
      herbPart: 'leaf',
      concentrationValue: 0,
      concentrationUnit: 'mg/g',
    }, true],
    ['assignment invalid negative concentration', saveAssignmentBodySchema, {
      phytochemicalId: '507f1f77bcf86cd799439011',
      herbId: 'herb_1',
      herbPart: 'leaf',
      concentrationValue: -1,
      concentrationUnit: 'mg/g',
    }, false],
    ['preferences valid dark mode', preferencesBodySchema, {
      preferences: { darkMode: 'dark' },
    }, true],
    ['preferences invalid dark mode', preferencesBodySchema, {
      preferences: { darkMode: 'night' },
    }, false],
  ])('%s', (name, schema, payload, shouldBeValid) => {
    if (shouldBeValid) {
      expectValid(schema, payload);
    } else {
      expectInvalid(schema, payload);
    }
  });
});

