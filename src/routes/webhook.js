const express = require('express');
const router = express.Router();

module.exports = (webhookService) => {
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