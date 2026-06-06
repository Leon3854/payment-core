const mongoose = require('mongoose');

jest.mock('ioredis', () => require('ioredis-mock'));

const TEST_DB_URI = 'mongodb://localhost:27017/payment-test';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'my-secret-key-for-hmac';
  process.env.MONGODB_URI = TEST_DB_URI;
  
  await mongoose.connect(TEST_DB_URI);
  app = require('../src/app').app;
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany();
  }
});

const request = require('supertest');

describe('POST /invoice', () => {
  it('should create invoice with correct fee calculation', async () => {
    const response = await request(app)
      .post('/invoice')
      .send({
        amount: 100.00,
        currency: 'RUB',
        merchantId: 'merchant_001'
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      merchantId: 'merchant_001',
      amount: 100.00,
      currency: 'RUB',
      fee: 3.00,
      amountToReceive: 97.00,
      status: 'pending'
    });
    expect(response.body.invoiceId).toBeDefined();
  });
  
  it('should calculate different fees for different merchants', async () => {
    const response1 = await request(app)
      .post('/invoice')
      .send({ amount: 100, merchantId: 'merchant_001' });
    
    const response2 = await request(app)
      .post('/invoice')
      .send({ amount: 100, merchantId: 'merchant_002' });
    
    expect(response1.body.fee).toBe(3.00);
    expect(response2.body.fee).toBe(5.00);
  });
  
  it('should reject negative amounts', async () => {
    const response = await request(app)
      .post('/invoice')
      .send({ amount: -100, merchantId: 'merchant_001' });
    
    expect(response.status).toBe(400);
  });
  
  it('should handle fractional amounts correctly', async () => {
    const response = await request(app)
      .post('/invoice')
      .send({ amount: 99.99, merchantId: 'merchant_001' });
    
    expect(response.body.amount).toBe(99.99);
    expect(response.body.fee).toBe(3.00);
    expect(response.body.amountToReceive).toBe(96.99);
  });
});

describe('GET /invoice/:id', () => {
  it('should return invoice by ID', async () => {
    const create = await request(app)
      .post('/invoice')
      .send({ amount: 200, merchantId: 'merchant_001' });
    
    const response = await request(app)
      .get(`/invoice/${create.body.invoiceId}`);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('pending');
  });
});