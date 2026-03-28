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

describe('Protected Route Validation Coverage', () => {
  it('rejects invalid user profile payload', async () => {
    const response = await request(app)
      .put('/api/users/profile')
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid herb status payload', async () => {
    const response = await request(app)
      .patch('/api/herbs/herb_test/status')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid phytochemical assignment payload', async () => {
    const response = await request(app)
      .post('/api/admin/phytochemical-assignments')
      .send({
        phytochemicalId: '507f1f77bcf86cd799439011',
        herbId: '',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid image identification id param', async () => {
    const response = await request(app)
      .get('/api/images/plant-identification/not-object-id');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
});

