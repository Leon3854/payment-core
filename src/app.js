/**
 * @file app.js
 * @description Главный модуль инициализации Express-приложения финтех-ядра (payment-core).
 * Отвечает за сборку мидлварей, роутинга, DI-внедрение зависимостей (Redis/WebhookService) 
 * и изоляцию рантайма запуска http-сервера от тестового окружения.
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const WebhookService = require('./services/webhookService');
const invoiceRoutes = require('./routes/invoice');

/** 
 * Инстанс Express-приложения
 * @type {import('express').Application} 
 */
const app = express();

app.use(express.json());

// ==========================================
// ИНФРАСТРУКТУРНЫЙ СЛОЙ (REDIS ИЗОЛЯЦИЯ)
// ==========================================

/** 
 * Клиент оперативного кэша и распределенных блокировок Redis
 * @type {import('ioredis').Redis} 
 */
// Redis для продакшена
let redis;
if (process.env.NODE_ENV === 'test') {
  /** 
   * В тестовом окружении изолируем сетевые стыки через in-memory мок
   * @type {typeof import('ioredis-mock').default}
   */
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock();
} else {
  // В продакшн-контуре поднимаем промышленное соединение с кластером
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}
/** 
 * Сервис бизнес-логики обработки и деобфускации входящих 
 * платежных уведомлений(процесс расшифровки, очистки и приведения 
 * в понятный вид («распутывания») данных о поступивших платежах, которые 
 * изначально были намеренно скрыты, закодированы или изменены.)
 * @type {WebhookService} 
 */
const webhookService = new WebhookService(redis);

// ==========================================
// РОУТИНГ И МИДЛВАРИ
// ==========================================
app.use('/invoice', invoiceRoutes);
app.use('/webhook', require('./routes/webhook')(webhookService));

/**
 * Эндпоинт проверки жизнеспособности сервиса (Health Check) под метрики Prometheus/Grafana.
 * @route {GET} /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', redis: redis.status });
});

// ==========================================
// ИНИЦИАЛИЗАЦИЯ И СЕТЕВЫЕ СОКЕТЫ
// ==========================================

// Не запускаем прослушивание портов хоста при прогоне Jest-тестов,
// позволяя supertest тестировать роуты прямо в оперативной памяти без конфликтов сокетов.
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

/** 
 * Экспорт собранного Express-приложения для интеграционных тестов
 * @exports { app } 
 */
module.exports = { app };