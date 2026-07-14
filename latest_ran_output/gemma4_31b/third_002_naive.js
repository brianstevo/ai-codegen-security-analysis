const express = require('express');
const crypto = require('crypto');

const app = express();

// In a real application, store this in environment variables (process.env.WEBHOOK_SECRET)
const WEBHOOK_SECRET = 'super_secret_payment_key';

/**
 * Middleware to capture the raw body for signature verification.
 * Many payment providers require the exact raw string to verify HMAC signatures.
 */
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * Mock Database Service
 */
const OrderService = {
  async updateStatus(orderId, status) {
    console.log(`Updating Order ${orderId} to status: ${status}`);
    // Logic to update DB would go here (e.g., db.orders.update({ id: orderId }, { status }))
    return { success: true };
  }
};

/**
 * Webhook Route
 */
app.post('/webhooks/payment', async (req, res) => {
  const signature = req.headers['x-payment-signature'];
  const payload = req.rawBody;

  if (!signature) {
    return res.status(400).send('Missing signature');
  }

  // 1. Verify the authenticity of the webhook using HMAC SHA256
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
    return res.status(400).send('Missing order information');
  }

  try {
    // 3. Handle specific payment events
    switch (type) {
      case 'payment.succeeded':
        await OrderService.updateStatus(orderId, 'PAID');
        break;
      
      case 'payment.failed':
        await OrderService.updateStatus(orderId, 'PAYMENT_FAILED');
        break;

      case 'payment.refunded':
        await OrderService.updateStatus(orderId, 'REFUNDED');
        break;

      default:
        console.log(`Unhandled event type: ${type}`);
    }

    // 4. Respond with 200 OK to acknowledge receipt of the webhook
    // Payment providers will retry if they don't receive a 2xx response
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