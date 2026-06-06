const express = require('express');
const router = express.Router();
const invoiceService = require('../services/invoiceService');

// POST /invoice
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

// GET /invoice/:id
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

module.exports = router;