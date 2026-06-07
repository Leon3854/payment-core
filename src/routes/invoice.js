const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoiceService');

/**
 * @route POST /invoice
 * @group Invoices - Операции с инвойсами
 * @summary Создание нового инвойса
 * @param {Object} req - Объект запроса Express.
 * @param {Object} req.body - Данные тела запроса.
 * @param {number} req.body.amount - Сумма инвойса в копейках (должна быть строго больше 0).
 * @param {string} [req.body.currency='RUB'] - Валюта инвойса.
 * @param {string} req.body.merchantId - Идентификатор мерчанта (продавца).
 * @param {Object} res - Объект ответа Express.
 * @returns {Promise<void>}
 * 
 * @throws {Object} 400 - Ошибка валидации: отсутствуют обязательные поля или сумма некорректна.
 * @throws {Object} 404 - Ошибка: мерчант с указанным идентификатором не найден.
 * @throws {Object} 500 - Внутренняя ошибка сервера.
 */
router.post('/', async (req, res) => {
  try {
    const { amount, currency, merchantId } = req.body;
    
    if (!amount || !merchantId) {
      return res.status(400).json({ error: 'amount and merchantId are required' });
    }
    
    if (amount <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }
    
    const invoice = await invoiceService.createInvoice({
      amount,
      currency,
      merchantId
    });
    
    res.status(201).json(invoice);
  } catch (error) {
    if (error.message === 'Merchant not found') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route GET /invoice/:id
 * @group Invoices - Операции с инвойсами
 * @summary Получение инвойса по его уникальному ID
 * @param {Object} req - Объект запроса Express.
 * @param {Object} req.params - Параметры пути (URL).
 * @param {string} req.params.id - Идентификатор инвойса (invoiceId).
 * @param {Object} res - Объект ответа Express.
 * @returns {Promise<void>}
 * 
 * @throws {Object} 404 - Ошибка: инвойс с указанным ID не найден в системе.
 * @throws {Object} 500 - Внутренняя ошибка сервера.
 */
router.get('/:id', async (req, res) => {
  try {
    const invoice = await invoiceService.getInvoice(req.params.id);
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Роутер Express для обработки HTTP-запросов, связанных с инвойсами.
 * @type {import('express').Router}
 */
module.exports = router;