```javascript
import express from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// In-memory database for orders (replace with real DB in production)
const orders = new Map();

// Webhook secret for signature verification (in production, store securely)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test_secret_key';

// Sample order creation endpoint for testing
app.post('/api/orders', (req, res) => {
  const { amount, customer_email } = req.body;

  if (!amount || !customer_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const orderId = uuidv4();
  const order = {
    id: orderId,
    amount,
    customer_email,
    status: 'pending',
    created_at: new Date(),
    updated_at: new Date(),
  };

  orders.set(orderId, order);

  res.status(201).json({
    success: true,
    order,
  });
});

// Webhook endpoint to receive payment provider events
app.post('/webhooks/payment', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];
  const eventBody = JSON.stringify(req.body);

  // Verify webhook signature
  if (!verifyWebhookSignature(eventBody, signature, timestamp)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  // Log the webhook event
  console.log('Received webhook event:', {
    type: event.type,
    order_id: event.order_id,
    timestamp: new Date().toISOString(),
  });

  try {
    // Handle different payment events
    switch (event.type) {
      case 'payment.success':
        handlePaymentSuccess(event);
        break;
      case 'payment.failed':
        handlePaymentFailed(event);
        break;
      case 'payment.pending':
        handlePaymentPending(event);
        break;
      case 'payment.cancelled':
        handlePaymentCancelled(event);
        break;
      case 'payment.refunded':
        handlePaymentRefunded(event);
        break;
      default:
        console.warn(`Unknown event type: ${event.type}`);
        return res.status(400).json({ error: 'Unknown event type' });
    }

    // Acknowledge receipt of the webhook
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event_id: event.event_id,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal server error processing webhook',
    });
  }
});

// Helper function to verify webhook signature
function verifyWebhookSignature(body, signature, timestamp) {
  if (!signature || !timestamp) {
    return false;
  }

  // Prevent replay attacks by checking timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestamp, 10);

  if (Math.abs(currentTime - webhookTime) > 300) {
    console.error('Webhook timestamp too old');
    return false;
  }

  // Create expected signature
  const message = `${timestamp}.${body}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(message)
    .digest('hex');

  // Compare signatures (constant-time comparison to prevent timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Event handlers
function handlePaymentSuccess(event) {
  const { order_id, amount, transaction_id } = event;
  const order = orders.get(order_id);

  if (!order) {
    console.warn(`Order not found: ${order_id}`);
    return;
  }

  order.status = 'paid';
  order.transaction_id = transaction_id;
  order.paid_amount = amount;
  order.updated_at = new Date();

  console.log(`Order ${order_id} marked as paid`);

  // Trigger additional actions (send confirmation email, update inventory, etc.)
  triggerOrderConfirmation(order);
}

function handlePaymentFailed(event) {
  const { order_id, failure_reason } = event;
  const order = orders.get(order_id);

  if (!order) {
    console.warn(`Order not found: ${order_id}`);
    return;
  }

  order.status = 'payment_failed';
  order.failure_reason = failure_reason;
  order.updated_at = new Date();

  console.log(`Order ${order_id} payment failed: ${failure_reason}`);

  // Trigger failure notifications
  triggerPaymentFailureNotification(order);
}

function handlePaymentPending(event) {
  const { order_id } = event;
  const order = orders.get(order_id);

  if (!order) {
    console.warn(`Order not found: ${order_id}`);
    return;
  }

  order.status = 'payment_pending';
  order.updated_at = new Date();

  console.log(`Order ${order_id} payment pending`);
}

function handlePaymentCancelled(event) {
  const { order_id } = event;
  const order = orders.get(order_id);

  if (!order) {
    console.warn(`Order not found: ${order_id}`);
    return;
  }

  order.status = 'cancelled';
  order.updated_at = new Date();

  console.log(`Order ${order_id} cancelled`);
}

function handlePaymentRefunded(event) {
  const { order_id, refund_amount } = event;
  const order = orders.get(order_id);

  if (!order) {
    console.warn(`Order not found: ${order_id}`);
    return;
  }

  order.status = 'refunded';
  order.refund_amount = refund_amount;
  order.updated_at = new Date();

  console.log(`Order ${order_id} refunded: $${refund_amount}`);

  // Trigger refund notification
  triggerRefundNotification(order);
}

// Helper functions for triggering additional actions
function triggerOrderConfirmation(order) {
  // In production, this would send a confirmation email
  console.log(`Sending order confirmation to ${order.customer_email}`);
  // Example: await sendConfirmationEmail(order);
}

function triggerPaymentFailureNotification(order) {
  // In production, this would send a failure notification
  console.log(`Sending payment failure notification to ${order.customer_email}`);
  // Example: await sendFailureEmail(order);
}

function triggerRefundNotification(order) {
  // In production, this would send a refund notification
  console.log(`Sending refund notification to ${order.customer_email}`);
  // Example: await sendRefundEmail(order);
}

// Get order status endpoint for testing
app.get('/api/orders/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = orders.get(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(order);
});

// Endpoint to generate webhook signature for testing
app.post('/api/test-webhook', (req, res) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const eventBody = JSON.stringify(req.body);
  const message = `${timestamp}.${eventBody}`;

  const signature = crypto