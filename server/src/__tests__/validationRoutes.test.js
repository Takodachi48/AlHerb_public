const request = require('supertest');
const app = require('../index');

describe('Validation Middleware Coverage', () => {
  it('rejects invalid inquiry payload', async () => {
    const response = await request(app)
      .post('/api/inquiries')
      .send({
        name: 'A',
        contactType: 'fax',
        contactValue: 'x',
        message: 'hi',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid nearby location query', async () => {
    const response = await request(app).get('/api/locations/nearby');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid herb search query', async () => {
    const response = await request(app).get('/api/herbs/search?q=a');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });

  it('rejects invalid recommendation payload', async () => {
    const response = await request(app)
      .post('/api/herbs/recommend')
      .send({ symptoms: [] });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
  });
});

