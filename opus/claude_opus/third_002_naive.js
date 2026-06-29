const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// In-memory order store (replace with your database layer)
const orders = new Map();

// Secret shared with the payment provider for signature verification
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';

// Track processed event IDs to ensure idempotency (use a persistent store in production)
const processedEvents = new Set();

/**
 * Verify the webhook signature using HMAC-SHA256.
 * Uses a timing-safe comparison to prevent timing attacks.
 */
function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET || !signatureHeader) {
    return false;
  }

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(signatureHeader, 'utf8');

  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Map a payment provider event type to an internal order status.
 */
function mapEventToStatus(eventType) {
  const statusMap = {
    'payment.succeeded': 'paid',
    'payment.failed': 'payment_failed',
    'payment.refunded': 'refunded',
    'payment.disputed': 'disputed',
    'payment.canceled': 'canceled',
    'payment.pending': 'pending',
  };
  return statusMap[eventType] || null;
}

/**
 * Webhook endpoint.
 * NOTE: This route requires the raw request body for signature verification.
 * Register it BEFORE any global express.json() body parser, e.g.:
 *
 *   app.use('/webhooks/payment',
 *     express.raw({ type: 'application/json' }),
 *     paymentWebhookRouter);
 */
router.post('/', (req, res) => {
  try {
    // req.body is a Buffer when using express.raw()
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body));

    const signature = req.get('X-Webhook-Signature') || req.get('X-Signature');

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    const eventId = event.id;
    const eventType = event.type;
    const data = event.data || {};
    const orderId = data.orderId || (data.object && data.object.orderId);

    if (!eventId || !eventType || !orderId) {
      return res.status(400).json({ error: 'Missing required event fields' });
    }

    // Idempotency: acknowledge duplicates without reprocessing
    if (processedEvents.has(eventId)) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const newStatus = mapEventToStatus(eventType);
    if (!newStatus) {
      // Unknown but valid event — acknowledge to prevent retries
      processedEvents.add(eventId);
      return res.status(200).json({ received: true, ignored: true });
    }

    const order = orders.get(orderId);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Update the order status
    order.status = newStatus;
    order.updatedAt = new Date().toISOString();
    order.lastPaymentEvent = {
      id: eventId,
      type: eventType,
      processedAt: order.updatedAt,
    };
    orders.set(orderId, order);

    processedEvents.add(eventId);

    return res.status(200).json({
      received: true,
      orderId,
      status: newStatus,
    });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;