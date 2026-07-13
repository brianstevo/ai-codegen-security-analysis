const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Mock database/service layer for demonstration
const OrderService = {
  findById: async (orderId) => {
    // Simulate fetching order from DB
    return { id: orderId, status: 'pending', amount: 100.00 };
  },
  updateStatus: async (orderId, newStatus) => {
    // Simulate updating order in DB
    console.log(`Order ${orderId} updated to status: ${newStatus}`);
    return true;
  }
};

// Configuration for webhook signature verification
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret_key';

/**
 * POST /webhooks/payment-provider
 * Receives payment events and updates order status accordingly.
 */
router.post('/payment-provider', express.json({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const payload = req.body;

    // 1. Verify Webhook Signature to ensure authenticity
    if (!signature || !verifySignature(payload, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Extract relevant data from the payload
    const { event_type, order_id, status } = payload;

    if (!order_id || !event_type) {
      console.error('Missing required fields in webhook payload');
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // 3. Process the event based on type
    let newStatus = null;

    switch (event_type) {
      case 'payment.completed':
        newStatus = 'paid';
        break;
      case 'payment.failed':
        newStatus = 'failed';
        break;
      case 'payment.refunded':
        newStatus = 'refunded';
        break;
      default:
        console.log(`Unhandled event type: ${event_type}`);
        return res.status(200).json({ received: true });
    }

    // 4. Update the order status in the database
    if (newStatus) {
      await OrderService.updateStatus(order_id, newStatus);
    }

    // 5. Acknowledge receipt to the payment provider
    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Return 500 to indicate failure, prompting the provider to retry
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Helper function to verify the webhook signature.
 * Implementation depends on the specific payment provider's algorithm.
 * This example uses HMAC-SHA256.
 */
function verifySignature(payload, signature) {
  const payloadString = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payloadString).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

module.exports = router;