const express = require('express');
const router = express.Router();
const crypto = require('crypto');
// Assuming you have a Mongoose model or database client for Orders
const Order = require('../models/Order');

// In production, this should be an environment variable
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

router.post('/payment-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Server misconfiguration: WEBHOOK_SECRET missing' });
  }

  try {
    // 1. Verify Webhook Signature
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = hmac.update(req.body).digest('hex');

    if (signature !== digest) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(req.body.toString());

    // 2. Handle Specific Events
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.order_id;

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          status: 'paid',
          paymentId: paymentIntent.id,
          updatedAt: new Date(),
        });
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const orderId = paymentIntent.metadata.order_id;

      if (orderId) {
        await Order.findByIdAndUpdate(orderId, {
          status: 'failed',
          paymentError: paymentIntent.last_payment_error?.message,
          updatedAt: new Date(),
        });
      }
    }

    // 3. Respond to Provider
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;