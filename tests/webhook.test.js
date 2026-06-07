const crypto = require('crypto');
const mongoose = require('mongoose');

// Мокаем Redis до импорта приложения
jest.mock('ioredis', () => require('ioredis-mock'));

// Используем локальную MongoDB
const TEST_DB_URI = 'mongodb://localhost:27017/payment-test';

let app;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.SECRET_KEY = 'my-secret-key-for-hmac';
  process.env.WEBHOOK_WINDOW_MINUTES = '5';
  process.env.MONGODB_URI = TEST_DB_URI;
  
  try {
    await mongoose.connect(TEST_DB_URI);
    console.log('Connected to test MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
  
  // Импортируем приложение ПОСЛЕ установки переменных окружения
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

const createSignatureHeaders = (payload) => {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', 'my-secret-key-for-hmac')
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
    'x-nonce': nonce
  };
};

describe('POST /webhook', () => {
  it('should process payment webhook successfully', async () => {
    const invoice = await request(app)
      .post('/invoice')
      .send({ amount: 100, merchantId: 'merchant_001' });
    
    const invoiceId = invoice.body.invoiceId;
    const payload = { invoiceId, status: 'paid' };
    const headers = createSignatureHeaders(payload);
    
    const response = await request(app)
      .post('/webhook')
      .set(headers)
      .send(payload);
    
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('paid');
    
    const check = await request(app).get(`/invoice/${invoiceId}`);
    expect(check.body.status).toBe('paid');
    expect(check.body.paidAt).toBeDefined();
  });
  
  it('should be idempotent - process payment only once', async () => {
    const invoice = await request(app)
      .post('/invoice')
      .send({ amount: 200, merchantId: 'merchant_001' });
    
    const invoiceId = invoice.body.invoiceId;
    const payload = { invoiceId, status: 'paid' };
    
    const headers1 = createSignatureHeaders(payload);
    const headers2 = createSignatureHeaders(payload);
    
    await request(app).post('/webhook').set(headers1).send(payload);
    const response2 = await request(app).post('/webhook').set(headers2).send(payload);
    
    expect(response2.body.message).toBe('Already processed');
    
    const check = await request(app).get(`/invoice/${invoiceId}`);
    expect(check.body.status).toBe('paid');
  });

	it('should handle concurrent webhooks without double processing', async () => {
    const invoice = await request(app)
      .post('/invoice')
      .send({ amount: 300, merchantId: 'merchant_001' });
    
    const payload = { invoiceId: invoice.body.invoiceId, status: 'paid' };
    
    // Два webhook летят одновременно
    const [res1, res2] = await Promise.all([
      request(app).post('/webhook').set(createSignatureHeaders(payload)).send(payload),
      request(app).post('/webhook').set(createSignatureHeaders(payload)).send(payload)
    ]);
    
    // Один обработан, второй — already processed
    const messages = [res1.body.message, res2.body.message];
    expect(messages).toContain('Already processed');
    expect(messages).toContain('Webhook processed successfully');
    
    // Статус paid, оплата зачислена ровно один раз
    const check = await request(app).get(`/invoice/${invoice.body.invoiceId}`);
    expect(check.body.status).toBe('paid');
  });
  
  it('should reject webhook with invalid signature', async () => {
    const payload = { invoiceId: 'test-123', status: 'paid' };
    
    const response = await request(app)
      .post('/webhook')
      .set({
        'x-signature': 'wrong-signature',
        'x-timestamp': Date.now().toString(),
        'x-nonce': 'test-nonce'
      })
      .send(payload);
    
    expect(response.status).toBe(401);
  });
  
  it('should reject old webhook requests', async () => {
    const payload = { invoiceId: 'test-123', status: 'paid' };
    const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString();
    
    const signature = crypto
      .createHmac('sha256', 'my-secret-key-for-hmac')
      .update(JSON.stringify(payload))
      .digest('hex');
    
    const response = await request(app)
      .post('/webhook')
      .set({
        'x-signature': signature,
        'x-timestamp': oldTimestamp,
        'x-nonce': 'test-nonce'
      })
      .send(payload);
    
    expect(response.status).toBe(400);
  });
  
  it('should reject duplicate nonce', async () => {
    const payload = { invoiceId: 'test-123', status: 'paid' };
    const headers = createSignatureHeaders(payload);
    
    await request(app).post('/webhook').set(headers).send(payload);
    const response = await request(app).post('/webhook').set(headers).send(payload);
    
    expect(response.status).toBe(409);
  });
});