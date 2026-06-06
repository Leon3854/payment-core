require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const WebhookService = require('./services/webhookService');
const invoiceRoutes = require('./routes/invoice');

const app = express();

app.use(express.json());

// Redis для продакшена
let redis;
if (process.env.NODE_ENV === 'test') {
  // В тестах используем мок
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock();
} else {
  // В продакшене реальный Redis
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}

const webhookService = new WebhookService(redis);

// Маршруты
app.use('/invoice', invoiceRoutes);
app.use('/webhook', require('./routes/webhook')(webhookService));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', redis: redis.status });
});

// Не запускаем сервер при тестах
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payment-service';
  
  mongoose.connect(MONGODB_URI)
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    });
}

module.exports = { app };