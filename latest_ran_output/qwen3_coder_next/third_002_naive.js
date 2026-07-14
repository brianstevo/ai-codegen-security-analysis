const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// Mock database for orders (in production, use a real database)
const orders = new Map();

// Webhook secret - in production, store this as an environment variable
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';

// Helper function to verify webhook signature
function verifyWebhookSignature(req) {
  const signature = req.headers['x-payment-signature'];
  if (!signature) return false;

  // Calculate expected signature using HMAC-SHA256
  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

// Webhook endpoint for payment provider events
router.post('/webhooks/payments', (req, res) => {
  try {
    // Verify webhook signature
    if (!verifyWebhookSignature(req)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event_type, order_id, status } = req.body;

    // Validate required fields
    if (!event_type || !order_id || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Map payment statuses to internal order statuses
    const statusMap = {
      'payment.succeeded': 'paid',
      'payment.failed': 'failed',
      'payment.refunded': 'refunded'
    };

    const newStatus = statusMap[status];
    
    if (!newStatus) {
      return res.status(400).json({ error: `Unsupported payment status: ${status}` });
    }

    // Update order in database
    const order = orders.get(order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    order.status = newStatus;
    
    // In a real application, you would save to the database here
    
    console.log(`Updated order ${order_id} status to ${newStatus}`);

    // Send success response
    res.status(200).json({ 
      message: 'Webhook processed successfully',
      orderId: order_id,
      newStatus: newStatus
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;