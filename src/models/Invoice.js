const mongoose = require('mongoose');

/**
 * @typedef {Object} IInvoice
 * @property {string} invoiceId - Уникальный идентификатор инвойса.
 * @property {string} merchantId - Идентификатор мерчанта (продавца).
 * @property {number} amount - Сумма инвойса в копейках.
 * @property {string} currency - Валюта операции (например, 'RUB'). По умолчанию: 'RUB'.
 * @property {number} fee - Комиссия в копейках.
 * @property {number} amountToReceive - Сумма к получению в копейках (после вычета комиссии).
 * @property {'pending' | 'paid' | 'failed'} status - Текущий статус инвойса. По умолчанию: 'pending'.
 * @property {Date} [paidAt] - Дата и время успешной оплаты.
 * @property {Date} createdAt - Дата создания документа (добавляется автоматически через timestamps).
 * @property {Date} updatedAt - Дата последнего обновления документа (добавляется автоматически через timestamps).
 */


/**
 * Схема инвойса для базы данных MongoDB.
 * @type {mongoose.Schema<IInvoice>}
 */
const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    required: true,
    unique: true
  },
  merchantId: {
    type: String,
    required: true
  },
  amount: {
    type: Number, // в копейках
    required: true
  },
  currency: {
    type: String,
    required: true,
    default: 'RUB'
  },
  fee: {
    type: Number, // в копейках
    required: true
  },
  amountToReceive: {
    type: Number, // в копейках
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'pending'
  },
  paidAt: Date
}, {
  timestamps: true
});

/**
 * Mongoose модель для работы с коллекцией инвойсов.
 * @type {mongoose.Model<IInvoice>}
 */
const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;