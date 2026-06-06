const { v4: uuidv4 } = require('uuid');
const Invoice = require('../models/Invoice');
const { getMerchantConfig } = require('../config/merchants');
const { toCents, toCurrency } = require('../utils/currency');

class InvoiceService {
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

module.exports = new InvoiceService();