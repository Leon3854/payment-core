const mongoose = require('mongoose');

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

module.exports = mongoose.model('Invoice', invoiceSchema);