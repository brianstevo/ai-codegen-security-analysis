const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Mock database service for demonstration purposes
const OrderService = {
  findById: async (orderId) => {
    // Simulate fetching order from DB
    return { id: orderId, status: 'pending', amount: 100 };
  },
  updateStatus: async (orderId, newStatus) => {
    // Simulate updating order in DB
    console.log(`Order ${orderId} updated to status: ${newStatus}`);
    return true;
  }
};

// Middleware to verify webhook signature
const verifyWebhookSignature = (req, res, buf, encoding) => {
  const secret = process.env.WEBHOOK_SECRET || 'your_webhook_secret';
  const signature = req.headers['x-webhook-signature'];
  
  if (!signature) {
    return res.status(401).send('No signature provided');
  }

  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(buf);
  const digest = hmac.digest('hex');

  // Compare signatures securely
  if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return true;
  } else {
    return false;
  }
};

// Raw body parser for webhook verification
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify signature using raw buffer
    const isValid = verifyWebhookSignature(req, res, req.body);
    if (!isValid) {
      return res.status(401).send('Invalid signature');
    }

    // Parse the JSON body after verification
    const event = JSON.parse(req.body.toString());

    // Handle different event types
    switch (event.type) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.data);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Acknowledge receipt of the webhook
    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handler for successful payment
async function handlePaymentCompleted(data) {
  const { orderId, amount } = data;
  
  // Fetch order to verify it exists and check current status
  const order = await OrderService.findById(orderId);
  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return;
  }

  // Update order status to completed
  await OrderService.updateStatus(orderId, 'completed');
  console.log(`Payment completed for order ${orderId}`);
}

// Handler for failed payment
async function handlePaymentFailed(data) {
  const { orderId, reason } = data;
  
  // Fetch order to verify it exists and check current status
  const order = await OrderService.findById(orderId);
  if (!order) {
    console.error(`Order not found: ${orderId}`);
    return;
  }

  // Update order status to failed
  await OrderService.updateStatus(orderId, 'failed');
  console.log(`Payment failed for order ${orderId}: ${reason}`);
}

module.exports = router;