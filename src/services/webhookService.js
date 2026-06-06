const crypto = require('crypto');
const Invoice = require('../models/Invoice');

class WebhookService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.secretKey = process.env.SECRET_KEY;
    this.windowMs = (parseInt(process.env.WEBHOOK_WINDOW_MINUTES) || 5) * 60 * 1000;
  }
  
  verifySignature(payload, signature) {
    if (!signature) return false;
    
    const body = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(body)
      .digest('hex');
    
    // Используем timingSafeEqual для защиты от timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }
  
  verifyTimestamp(timestamp) {
    if (!timestamp) return false;
    
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    
    // Проверяем, что запрос не старше windowMs
    return Math.abs(now - requestTime) <= this.windowMs;
  }
  
  async verifyNonce(nonce) {
    if (!nonce) return false;
    
    // Проверяем, использовался ли nonce ранее
    const exists = await this.redis.get(`nonce:${nonce}`);
    if (exists) return false;
    
    // Сохраняем nonce с TTL = 1 час
    await this.redis.set(`nonce:${nonce}`, '1', 'EX', 3600);
    return true;
  }
  
  async processWebhook(payload, headers) {
    const { invoiceId, status } = payload;
    
    // 1. Проверка подписи
    if (!this.verifySignature(payload, headers['x-signature'])) {
      throw { status: 401, message: 'Invalid signature' };
    }
    
    // 2. Проверка актуальности времени
    if (!this.verifyTimestamp(headers['x-timestamp'])) {
      throw { status: 400, message: 'Request expired or invalid timestamp' };
    }
    
    // 3. Проверка уникальности nonce
    if (!(await this.verifyNonce(headers['x-nonce']))) {
      throw { status: 409, message: 'Nonce already used' };
    }
    
    // 4. Валидация статуса
    if (!['paid', 'failed'].includes(status)) {
      throw { status: 400, message: 'Invalid status' };
    }
    
    // 5. Атомарное обновление (защита от race condition)
    const result = await Invoice.findOneAndUpdate(
      {
        invoiceId: invoiceId,
        status: 'pending' // Обновляем ТОЛЬКО если статус pending
      },
      {
        status: status,
        ...(status === 'paid' ? { paidAt: new Date() } : {})
      },
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!result) {
      // Счёт уже обработан или не найден
      const existing = await Invoice.findOne({ invoiceId });
      if (!existing) {
        throw { status: 404, message: 'Invoice not found' };
      }
      // Возвращаем существующий (идемпотентность)
      return { message: 'Already processed', status: existing.status };
    }
    
    return {
      message: 'Webhook processed successfully',
      invoiceId: result.invoiceId,
      status: result.status
    };
  }
}

module.exports = WebhookService;