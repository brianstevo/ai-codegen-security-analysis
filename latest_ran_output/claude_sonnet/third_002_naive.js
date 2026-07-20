```javascript
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// --- Mock Database ---
const orders = new Map([
  ['order_001', { id: 'order_001', status: 'pending', amount: 9999, currency: 'usd', customerId: 'cust_123' }],
  ['order_002', { id: 'order_002', status: 'pending', amount: 4999, currency: 'usd', customerId: 'cust_456' }],
]);

// --- Configuration ---
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret_key_here';
const ALLOWED_EVENT_TYPES = [
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'payment.disputed',
  'payment.pending',
  'charge.succeeded',
  'charge.failed',
  'charge.refunded',
];

// --- Webhook Signature Verification ---
const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!signature || !rawBody) {
    return { valid: false, error: 'Missing signature or body' };
  }

  try {
    // Support both simple HMAC and timestamp-based verification (e.g., Stripe style)
    const parts = signature.split(',');
    let timestamp = null;
    let receivedSignature = null;

    if (parts.length > 1) {
      // Timestamp-based: "t=1234567890,v1=abc123..."
      for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 't') timestamp = value;
        if (key === 'v1') receivedSignature = value;
      }

      if (!timestamp || !receivedSignature) {
        return { valid: false, error: 'Invalid signature format' };
      }

      // Reject webhooks older than 5 minutes to prevent replay attacks
      const currentTime = Math.floor(Date.now() / 1000);
      if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
        return { valid: false, error: 'Webhook timestamp is too old' };
      }

      const signedPayload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
      );

      return { valid: isValid, error: isValid ? null : 'Signature mismatch' };
    } else {
      // Simple HMAC verification
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('hex');

      const receivedSig = signature.startsWith('sha256=')
        ? signature.slice(7)
        : signature;

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSig, 'hex')
      );

      return { valid: isValid, error: isValid ? null : 'Signature mismatch' };
    }
  } catch (err) {
    return { valid: false, error: `Signature verification error: ${err.message}` };
  }
};

// --- Order Status Mapping ---
const mapEventToOrderStatus = (eventType) => {
  const statusMap = {
    'payment.succeeded': 'paid',
    'payment.failed': 'payment_failed',
    'payment.refunded': 'refunded',
    'payment.disputed': 'disputed',
    'payment.pending': 'payment_pending',
    'charge.succeeded': 'paid',
    'charge.failed': 'payment_failed',
    'charge.refunded': 'refunded',
  };
  return statusMap[eventType] || null;
};

// --- Order Update Logic ---
const updateOrderStatus = async (orderId, newStatus, eventData) => {
  if (!orders.has(orderId)) {
    return { success: false, error: `Order ${orderId} not found` };
  }

  const order = orders.get(orderId);
  const previousStatus = order.status;

  // Define valid status transitions
  const validTransitions = {
    pending: ['paid', 'payment_failed', 'payment_pending'],
    payment_pending: ['paid', 'payment_failed'],
    paid: ['refunded', 'disputed'],
    payment_failed: ['paid', 'payment_pending'],
    disputed: ['paid', 'refunded'],
    refunded: [],
  };

  const allowedTransitions = validTransitions[previousStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    return {
      success: false,
      error: `Invalid status transition from '${previousStatus}' to '${newStatus}'`,
    };
  }

  // Update the order
  const updatedOrder = {
    ...order,
    status: newStatus,
    updatedAt: new Date().toISOString(),
    lastEventType: eventData.type,
    lastEventId: eventData.id,
    paymentDetails: {
      transactionId: eventData.data?.transactionId || eventData.data?.chargeId || null,
      amount: eventData.data?.amount || order.amount,
      currency: eventData.data?.currency || order.currency,
    },
  };

  orders.set(orderId, updatedOrder);

  console.log(`[Webhook] Order ${orderId} status updated: ${previousStatus} → ${newStatus}`);

  return {
    success: true,
    previousStatus,
    newStatus,
    order: updatedOrder,
  };
};

// --- Webhook Event Processor ---
const processWebhookEvent = async (event) => {
  const { type, data } = event;

  if (!ALLOWED_EVENT_TYPES.includes(type)) {
    return { processed: false, reason: `Unhandled event type: ${type}` };
  }

  const orderId = data?.orderId || data?.metadata?.orderId;
  if (!orderId) {
    return { processed: false, reason: 'No orderId found in event data' };
  }

  const newStatus = mapEventToOrderStatus(type);
  if (!newStatus) {
    return { processed: false, reason: `No status mapping for event type: ${type}` };
  }

  const result = await updateOrderStatus(orderId, newStatus, event);

  if (!result.success) {
    return { processed: false, reason: result.error };
  }

  return {
    processed: true,
    orderId,
    previousStatus: result.previousStatus,
    newStatus: result.newStatus,
    order: result.order,
  };
};

// --- Idempotency Check ---
const processedEvents = new Set();

const isEventAlreadyProcessed = (eventId) => {
  if (!eventId) return false;
  return processedEvents.has(eventId);
};

const markEventAsProcessed = (eventId) => {
  if (eventId) {
    processedEvents.add(eventId);
    // Clean up old events after 24 hours (in production, use Redis or DB)
    setTimeout(() => processedEvents.delete(eventId), 24 * 60 * 60 * 1000);
  }
};

// --- Webhook Route ---
// IMPORTANT: Raw body parser must be used before express.json() for this route
// In your main app.js, mount this router BEFORE applying express.json() globally,
// or use express.raw() specifically for this path:
//   app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

router.post(
  '/payment',
  express.raw({ type: 'application/json' }), // Capture raw body for signature verification
  async (req, res) => {
    const startTime = Date.now();
    const requestId =