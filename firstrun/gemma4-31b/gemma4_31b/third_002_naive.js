const express = require('express');
const crypto = require('crypto');
const app = express();

// Mock Database for demonstration purposes
const OrderDB = {
  async updateStatus(orderId, status) {
    console.log(`Updating order ${orderId} to status: ${status}`);
    return { success: true };
  },
  async findOrder(orderId) {
    return { id: orderId, status: 'pending' };
  }
};

// Secret key provided by the payment provider (should be in .env)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'whsec_test_secret_12345';

/**
 * Middleware to capture raw body for signature verification.
 * Many payment providers require the exact raw string/buffer 
 * because JSON parsing can alter whitespace and invalidate hashes.
 */
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * POST /webhooks/payment
 * Handles incoming events from the payment provider
 */
app.post('/webhooks/payment', async (req, res) => {
  const signature = req.headers['x-payment-signature'];
  const payload = req.rawBody;

  if (!signature) {
    return res.status(400).send('Missing signature header');
  }

  // 1. Verify the webhook authenticity using HMAC SHA256
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');

  if (signature !== digest) {
    console.error('Invalid signature detected!');
    return res.status(401).send('Invalid signature');
  }

  // 2. Parse the event data
  const event = req.body;
  const { type, data } = event;
  const orderId = data?.order_id;

  if (!orderId) {
    return res.status(400).send('Missing order ID in payload');
  }

  try {
    // 3. Handle specific event types
    switch (type) {
      case 'payment.succeeded':
        await OrderDB.updateStatus(orderId, 'paid');
        console.log(`Order ${orderId} marked as paid.`);
        break;

      case 'payment.failed':
        await OrderDB.updateStatus(orderId, 'payment_failed');
        console.log(`Order ${orderId} payment failed.`);
        break;

      case 'payment.refunded':
        await OrderDB.updateStatus(orderId, 'refunded');
        console.log(`Order ${orderId} refunded.`);
        break;

      default:
        console.log(`Unhandled event type: ${type}`);
    }

    // 4. Return a 200 OK to acknowledge receipt of the webhook
    // Payment providers will retry if they don't receive a success response
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});