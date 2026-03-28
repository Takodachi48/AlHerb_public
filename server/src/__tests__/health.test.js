const request = require('supertest');
const app = require('../index');

describe('GET /health', () => {
  it('returns liveness status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'OK');
  });
});
