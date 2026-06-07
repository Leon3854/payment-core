const { v4: uuidv4 } = require('uuid');
const Invoice = require('../models/Invoice');
const { getMerchantConfig } = require('../config/merchants');
const { toCents, toCurrency } = require('../utils/currency');

/**
 * @typedef {Object} CreateInvoiceInput
 * @property {number} amount - Сумма инвойса (в исходной валюте, например, в рублях).
 * @property {string} [currency='RUB'] - Валюта инвойса. По умолчанию: 'RUB'.
 * @property {string} merchantId - Уникальный идентификатор мерчанта.
 */

/**
 * @typedef {Object} InvoiceResponse
 * @property {string} invoiceId - Уникальный идентификатор созданного инвойса.
 * @property {string} merchantId - Идентификатор мерчанта.
 * @property {number} amount - Сумма инвойса, сконвертированная обратно в стандартный формат валюты (например, рубли).
 * @property {string} currency - Валюта операции.
 * @property {number} fee - Размер комиссии в стандартном формате валюты.
 * @property {number} amountToReceive - Чистая сумма к получению мерчантом в стандартном формате валюты.
 * @property {'pending' | 'paid' | 'failed'} status - Текущий статус инвойса.
 * @property {Date} [paidAt] - Дата и время оплаты (присутствует только в getInvoice, если оплачен).
 * @property {Date} [createdAt] - Дата создания инвойса (присутствует только в getInvoice).
 * @property {Date} [updatedAt] - Дата последнего обновления инвойса (присутствует только в getInvoice).
 */

/**
 * Сервис для управления бизнес-логикой выставления и получения счетов (инвойсов).
 */
class InvoiceService {
	/**
   * Создает новый инвойс в базе данных с автоматическим расчетом комиссии мерчанта.
   * 
   * @param {CreateInvoiceInput} input - Данные для создания инвойса.
   * @returns {Promise<InvoiceResponse>} Объект с данными созданного инвойса, отформатированный для ответа API.
   * @throws {Error} Ошибка, если конфигурация мерчанта не найдена в системе.
   */
  async createInvoice({ amount, currency = 'RUB', merchantId }) {
    // Получаем настройки мерчанта
    const merchant = getMerchantConfig(merchantId);
    
    // Конвертируем в копейки для точных расчётов
    const amountCents = toCents(amount);
    
    // Рассчитываем комиссию
    const feeCents = Math.round(amountCents * merchant.feePercent);
    
    // Сумма к зачислению
    const amountToReceiveCents = amountCents - feeCents;
    
    // Создаём счёт
    const invoice = new Invoice({
      invoiceId: uuidv4(),
      merchantId,
      amount: amountCents,
      currency,
      fee: feeCents,
      amountToReceive: amountToReceiveCents,
      status: 'pending'
    });
    
    await invoice.save();
    
    return {
      invoiceId: invoice.invoiceId,
      merchantId: invoice.merchantId,
      amount: toCurrency(invoice.amount),
      currency: invoice.currency,
      fee: toCurrency(invoice.fee),
      amountToReceive: toCurrency(invoice.amountToReceive),
      status: invoice.status
    };
  }
  
	/**
   * Находит существующий инвойс по его уникальному текстовому идентификатору (UUID).
   * 
   * @param {string} invoiceId - Уникальный идентификатор инвойса.
   * @returns {Promise<InvoiceResponse|null>} Объект инвойса или null, если инвойс не найден.
   */
  async getInvoice(invoiceId) {
    const invoice = await Invoice.findOne({ invoiceId });
    if (!invoice) return null;
    
    return {
      invoiceId: invoice.invoiceId,
      merchantId: invoice.merchantId,
      amount: toCurrency(invoice.amount),
      currency: invoice.currency,
      fee: toCurrency(invoice.fee),
      amountToReceive: toCurrency(invoice.amountToReceive),
      status: invoice.status,
      paidAt: invoice.paidAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    };
  }
}

/**
 * Экспортируемый синглтон-экземпляр сервиса InvoiceService.
 * @type {InvoiceService}
 */
module.exports = new InvoiceService();