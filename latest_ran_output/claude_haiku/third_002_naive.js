import express from 'express';
import crypto from 'crypto';

const app = express();

// Middleware to parse JSON
app.use(express.json());

// In-memory database for demonstration
const orders = new Map();
const webhookSecret = 'your-webhook-secret-key';

// Helper function to verify webhook signature
function verifyWebhookSignature(req, secret) {
  const signature = req.headers['x-webhook-signature'];
  if (!signature) {
    return false;
  }

  const payload = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

// Webhook endpoint for payment provider events
app.post('/api/webhooks/payment', (req, res) => {
  // Verify webhook signature
  if (!verifyWebhookSignature(req, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { event, orderId, status, amount, timestamp, paymentId } = req.body;

  // Validate required fields
  if (!event || !orderId) {
    return res.status(400).json({ error: 'Missing required fields: event, orderId' });
  }

  try {
    // Handle different payment events
    switch (event) {
      case 'payment.completed':
        if (!orders.has(orderId)) {
          orders.set(orderId, {
            id: orderId,
            status: 'pending',
            amount: 0,
            createdAt: new Date(),
            history: []
          });
        }

        const order = orders.get(orderId);
        order.status = 'paid';
        order.amount = amount || order.amount;
        order.paymentId = paymentId;
        order.paidAt = new Date(timestamp || Date.now());
        order.history.push({
          event: 'payment.completed',
          status: 'paid',
          timestamp: new Date(),
          paymentId
        });

        console.log(`Order ${orderId} marked as paid`);
        break;

      case 'payment.failed':
        if (orders.has(orderId)) {
          const order = orders.get(orderId);
          order.status = 'payment_failed';
          order.history.push({
            event: 'payment.failed',
            status: 'payment_failed',
            timestamp: new Date(),
            paymentId
          });

          console.log(`Order ${orderId} payment failed`);
        }
        break;

      case 'payment.refunded':
        if (orders.has(orderId)) {
          const order = orders.get(orderId);
          order.status = 'refunded';
          order.refundedAt = new Date(timestamp || Date.now());
          order.history.push({
            event: 'payment.refunded',
            status: 'refunded',
            timestamp: new Date(),
            paymentId
          });

          console.log(`Order ${orderId} refunded`);
        }
        break;

      case 'payment.disputed':
        if (orders.has(orderId)) {
          const order = orders.get(orderId);
          order.status = 'disputed';
          order.history.push({
            event: 'payment.disputed',
            status: 'disputed',
            timestamp: new Date(),
            paymentId
          });

          console.log(`Order ${orderId} has a dispute`);
        }
        break;

      default:
        return res.status(400).json({ error: `Unknown event type: ${event}` });
    }

    // Return success response to webhook provider
    res.status(200).json({
      success: true,
      message: `Webhook event ${event} processed successfully`,
      orderId,
      newStatus: orders.get(orderId)?.status
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

// GET endpoint to check order status
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;

  if (!orders.has(orderId)) {
    return res.status(404).json({ error: `Order ${orderId} not found` });
  }

  const order = orders.get(orderId);
  res.status(200).json(order);
});

// POST endpoint to create a test order
app.post('/api/orders', (req, res) => {
  const { orderId, amount, description } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: 'Missing required fields: orderId, amount' });
  }

  const newOrder = {
    id: orderId,
    status: 'pending',
    amount,
    description: description || '',
    createdAt: new Date(),
    history: [{
      event: 'order.created',
      status: 'pending',
      timestamp: new Date()
    }]
  };

  orders.set(orderId, newOrder);

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    order: newOrder
  });
});

// GET endpoint to list all orders
app.get('/api/orders', (req, res) => {
  const orderList = Array.from(orders.values());
  res.status(200).json({
    total: orderList.length,
    orders: orderList
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Payment webhook server listening on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/api/webhooks/payment`);
  console.log(`Order status endpoint: GET http://localhost:${PORT}/api/orders/:orderId`);
});