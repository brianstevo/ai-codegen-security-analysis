const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Secret key for verifying webhook signatures (should be stored in environment variables)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';

// Mock order service (replace with your actual database operations)
const updateOrderStatus = async (orderId, status) => {
  // In a real application, this would update the order in your database
  console.log(`Updating order ${orderId} to status: ${status}`);
  return { orderId, status };
};

// Helper function to verify webhook signature
const verifyWebhookSignature = (payload, signatureHeader) => {
  if (!signatureHeader || !WEBHOOK_SECRET) {
    return false;
  }

  // Extract the signature from the header (format might be "sha256=...")
  const signature = signatureHeader.replace('sha256=', '');
  
  // Create HMAC using the payload and secret
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

// Webhook endpoint for payment provider events
router.post('/webhooks/payment', express.json(), (req, res) => {
  try {
    // Verify webhook signature
    const signatureHeader = req.headers['x-payment-signature'];
    if (!verifyWebhookSignature(req.body, signatureHeader)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { event_type, data } = req.body;

    // Handle different webhook events
    switch (event_type) {
      case 'payment.succeeded':
        updateOrderStatus(data.order_id, 'paid');
        break;
      case 'payment.failed':
        updateOrderStatus(data.order_id, 'payment_failed');
        break;
      case 'payment.refunded':
        updateOrderStatus(data.order_id, 'refunded');
        break;
      default:
        console.log(`Unhandled event type: ${event_type}`);
    }

    // Return 200 OK to acknowledge receipt of the webhook
    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;