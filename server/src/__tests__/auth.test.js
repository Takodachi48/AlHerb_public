const request = require('supertest');
const app = require('../index');

describe('POST /api/auth/login', () => {
  it('rejects missing token payload', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
});
