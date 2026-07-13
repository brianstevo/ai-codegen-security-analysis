const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order'); // Assuming you have an Order model

// Payment provider configuration (replace with your actual values)
const PAYMENT_PROVIDER_WEBHOOK_SECRET = 'your_webhook_secret';
const PAYMENT_PROVIDER_ID = 'your_payment_provider_id';

// Middleware to verify webhook signature
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-payment-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', PAYMENT_PROVIDER_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== `sha256=${expectedSignature}`) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};

// Webhook endpoint
router.post('/webhooks/payment', verifyWebhookSignature, async (req, res) => {
  try {
    const { event, data } = req.body;

    // Verify the payment provider ID matches your account
    if (data.provider_id !== PAYMENT_PROVIDER_ID) {
      return res.status(400).json({ error: 'Invalid payment provider' });
    }

    // Process different event types
    switch (event) {
      case 'payment.succeeded':
        await Order.findByIdAndUpdate(data.order_id, {
          status: 'paid',
          transaction_id: data.transaction_id,
          paid_at: new Date()
        });
        break;

      case 'payment.failed':
        await Order.findByIdAndUpdate(data.order_id, {
          status: 'failed',
          failure_reason: data.failure_reason
        });
        break;

      case 'payment.refunded':
        await Order.findByIdAndUpdate(data.order_id, {
          status: 'refunded',
          refunded_at: new Date()
        });
        break;

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;