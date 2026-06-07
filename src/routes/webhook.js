const express = require('express');
const router = express.Router();

/**
 * @typedef {Object} WebhookResult
 * @property {boolean} success - Статус успешности обработки вебхука.
 * @property {string} [message] - Дополнительное сообщение о результате обработки.
 */

/**
 * @typedef {Object} WebhookService
 * @property {function(Object, Object): Promise<WebhookResult>} processWebhook - Метод обработки входящего вебхука.
 */

/**
 * Инициализирует роутер для обработки входящих вебхуков от платежной системы.
 * 
 * @param {WebhookService} webhookService - Сервис для обработки бизнес-логики вебхуков.
 * @returns {import('express').Router} Сконфигурированный роутер Express.
 */
module.exports = (webhookService) => {
	/**
   * @route POST /webhook
   * @group Webhooks - Обработка уведомлений
   * @summary Прием и обработка входящего вебхука (колбэка)
   * @param {Object} req - Объект запроса Express.
   * @param {Object} req.body - Тело уведомления (данные платежа, статуса и т.д.).
   * @param {Object} req.headers - Заголовки запроса (обычно нужны для проверки подписи/безопасности).
   * @param {Object} res - Объект ответа Express.
   * @returns {Promise<void>}
   * 
   * @throws {Object} [error.status] - Динамический HTTP-статус ошибки, выброшенный сервисом (например, 400 или 401).
   * @throws {Object} 500 - Внутренняя ошибка сервера, если в сервисе произошел непредвиденный сбой.
   */
  router.post('/', async (req, res) => {
    try {
      const result = await webhookService.processWebhook(
        req.body,
        req.headers
      );
      
      res.json(result);
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  return router;
};