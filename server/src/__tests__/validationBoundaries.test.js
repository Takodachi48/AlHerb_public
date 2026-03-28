jest.mock('../middleware/auth', () => ({
  verifyToken: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011', uid: 'test-uid', role: 'admin' };
    next();
  },
  authenticateToken: (req, res, next) => {
    req.user = { _id: '507f1f77bcf86cd799439011', uid: 'test-uid', role: 'admin' };
    next();
  },
  optionalAuth: (req, res, next) => next(),
  adminMiddleware: (req, res, next) => next(),
}));

const request = require('supertest');
const app = require('../index');

describe('Validation Boundary Coverage', () => {
  it('rejects inquiry message over max length', async () => {
    const response = await request(app)
      .post('/api/inquiries')
      .send({
        name: 'Valid Name',
        contactType: 'email',
        contactValue: 'valid@example.com',
        message: 'x'.repeat(1001),
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects nearby locations with radius out of range', async () => {
    const response = await request(app)
      .get('/api/locations/nearby?lat=14.5&lng=121.0&radius=9999');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects herb comparison with invalid ageGroup enum', async () => {
    const response = await request(app)
      .get('/api/herbs/compare?herb1=a&herb2=b&ageGroup=teen');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects recommendation request with topN below minimum', async () => {
    const response = await request(app)
      .post('/api/herbs/recommend')
      .send({
        symptoms: ['headache'],
        topN: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects phytochemical create with invalid category enum', async () => {
    const response = await request(app)
      .post('/api/admin/phytochemicals')
      .send({
        name: 'Test Compound',
        category: 'invalid_category',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects user preferences with invalid darkMode enum', async () => {
    const response = await request(app)
      .put('/api/users/preferences')
      .send({
        preferences: {
          darkMode: 'night',
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
});

