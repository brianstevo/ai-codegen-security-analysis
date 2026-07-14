const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order'); // Assuming you have an Order model

// Middleware to verify webhook signature (example using HMAC)
const verifyWebhookSignature = (req, res, next) => {
  const payload = req.body;
  const signature = req.headers['x-signature'];
  const secret = process.env.WEBHOOK_SECRET;

  if (!signature || !secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const calculatedSignature = `sha256=${hmac.digest('hex')}`;

  if (calculatedSignature !== signature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};

router.post('/webhook/payment', verifyWebhookSignature, async (req, res) => {
  try {
    const { orderId, status, amount } = req.body;

    // Find the order in your database
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update the order status based on the webhook event
    let updatedStatus;
    switch (status.toLowerCase()) {
      case 'paid':
        updatedStatus = 'completed';
        break;
      case 'failed':
        updatedStatus = 'failed';
        break;
      case 'refunded':
        updatedStatus = 'refunded';
        break;
      default:
        return res.status(400).json({ error: 'Invalid status' });
    }

    // Update the order in the database
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        status: updatedStatus,
        paymentAmount: amount,
        paymentDate: new Date()
      },
      { new: true }
    );

    res.status(200).json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;