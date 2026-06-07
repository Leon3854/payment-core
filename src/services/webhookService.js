const crypto = require('crypto');
const Invoice = require('../models/Invoice');


/**
 * @typedef {Object} RedisClient
 * @property {function(string): Promise<string|null>} get - Получение значения по ключу из Redis.
 * @property {function(string, string, string, number): Promise<'OK'|null>} set - Сохранение значения в Redis с флагами (например, EX для TTL).
 */

/**
 * @typedef {Object} WebhookPayload
 * @property {string} invoiceId - Уникальный идентификатор инвойса.
 * @property {'paid' | 'failed' | string} status - Новый статус инвойса от платежной системы.
 */

/**
 * @typedef {Object} WebhookHeaders
 * @property {string} [x-signature] - Криптографическая HMAC-SHA256 подпись тела запроса.
 * @property {string} [x-timestamp] - Таймстамп времени отправки запроса (в миллисекундах).
 * @property {string} [x-nonce] - Уникальный одноразовый идентификатор запроса для защиты от повторов.
 */

/**
 * @typedef {Object} WebhookProcessResult
 * @property {string} message - Текстовое описание результата обработки запроса.
 * @property {string} [invoiceId] - Идентификатор обработанного инвойса.
 * @property {'pending' | 'paid' | 'failed'} status - Итоговый статус инвойса в базе данных.
 */

/**
 * Сервис для безопасной обработки входящих вебхуков от платежной системы.
 * Обеспечивает защиту от атак повторения (Replay), атак по времени (Timing attacks) и Race Condition.
 */
class WebhookService {
	/**
   * Создает экземпляр WebhookService.
   * 
   * @param {RedisClient} redisClient - Клиент Redis для работы с одноразовыми токенами (nonce).
   */
  constructor(redisClient) {
		/** @private */
    this.redis = redisClient;
		/** @private */
    this.secretKey = process.env.SECRET_KEY;
		/** @private */
    this.windowMs = (parseInt(process.env.WEBHOOK_WINDOW_MINUTES) || 5) * 60 * 1000;
  }
  /**
   * Проверяет криптографическую подпись тела запроса, используя алгоритм HMAC-SHA256.
   * Применяет безопасное сравнение строк для предотвращения атак по времени.
   * 
   * @param {WebhookPayload} payload - Тело входящего вебхука.
   * @param {string} [signature] - Строка подписи из заголовков запроса.
   * @returns {boolean} True, если подпись валидна, иначе false.
   */
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
  
	/**
   * Проверяет временное окно входящего запроса (защита от устаревших запросов).
   * 
   * @param {string} [timestamp] - Временная метка запроса из заголовков.
   * @returns {boolean} True, если запрос укладывается в допустимое временное окно, иначе false.
   */
  verifyTimestamp(timestamp) {
    if (!timestamp) return false;
    
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    
    // Проверяем, что запрос не старше windowMs
    return Math.abs(now - requestTime) <= this.windowMs;
  }
  
	/**
   * Проверяет уникальность одноразового идентификатора (nonce) через Redis для защиты от Replay-атак.
   * Сохраняет nonce в кэш с TTL 1 час, если он используется впервые.
   * 
   * @param {string} [nonce] - Одноразовый идентификатор из заголовков запроса.
   * @returns {Promise<boolean>} True, если nonce уникален и успешно сохранен, иначе false.
   */
  async verifyNonce(nonce) {
    if (!nonce) return false;
    
    // Проверяем, использовался ли nonce ранее
    const exists = await this.redis.get(`nonce:${nonce}`);
    if (exists) return false;
    
    // Сохраняем nonce с TTL = 1 час
    await this.redis.set(`nonce:${nonce}`, '1', 'EX', 3600);
    return true;
  }
  
	/**
   * Основной пайплайн обработки вебхука: валидация безопасности, проверка статуса и атомарное обновление инвойса.
   * Поддерживает идемпотентность ответов в случае повторных вызовов.
   * 
   * @param {WebhookPayload} payload - Данные тела запроса.
   * @param {WebhookHeaders} headers - Заголовки HTTP-запроса, содержащие метаданные безопасности.
   * @returns {Promise<WebhookProcessResult>} Результат обработки вебхука для ответа клиенту.
   * 
   * @throws {{status: 401, message: string}} При невалидной криптографической подписи.
   * @throws {{status: 400, message: string}} При истекшем времени запроса или неверном статусе платежа.
   * @throws {{status: 409, message: string}} При обнаружении повторного запроса с тем же nonce.
   * @throws {{status: 404, message: string}} Если инвойс, указанный в payload, не найден в базе данных.
   */
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