const express = require('express');
const crypto = require('crypto');
const app = express();

// Middleware to parse raw body for signature verification
app.use(express.raw({ type: 'application/json' }));

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret';
const PORT = process.env.PORT || 3000;

// Mock database function to update order status
const updateOrderStatus = async (orderId, status) => {
  console.log(`[DB] Updating order ${orderId} to status: ${status}`);
  // In a real application, this would involve a database query (e.g., SQL or MongoDB)
  return true;
};

app.post('/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'] || req.headers['x-signature'];
  const payload = req.body;

  if (!signature) {
    return res.status(400).send('No signature found in headers');
  }

  try {
    // Verify the webhook signature using HMAC
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).send('Invalid signature');
    }

    // Parse the event payload
    const event = JSON.parse(payload.toString());

    // Handle the specific event type
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'checkout.session.completed':
        // Extract order ID from metadata or object ID
        const orderId = event.data.object.metadata?.order_id || event.data.object.id;
        const status = event.data.object.status || 'paid';
        await updateOrderStatus(orderId, status);
        break;

      case 'payment_intent.payment_failed':
        const failedOrderId = event.data.object.metadata?.order_id || event.data.object.id;
        await updateOrderStatus(failedOrderId, 'failed');
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

module.exports = app;