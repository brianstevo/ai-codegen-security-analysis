const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// In-memory order store for demonstration; replace with your DB layer.
const orders = new Map();

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';

// Track processed event IDs to guard against replay / duplicate delivery.
const processedEvents = new Set();

// Map provider event types to internal order statuses.
const STATUS_MAP = {
  'payment.succeeded': 'paid',
  'payment.failed': 'payment_failed',
  'payment.refunded': 'refunded',
  'payment.pending': 'pending',
  'charge.dispute.created': 'disputed',
};

/**
 * Verify the webhook signature using HMAC-SHA256.
 * Uses a timing-safe comparison to prevent timing attacks.
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const provided = Buffer.from(signatureHeader, 'utf8');
  const computed = Buffer.from(expected, 'utf8');

  if (provided.length !== computed.length) return false;
  return crypto.timingSafeEqual(provided, computed);
}

/**
 * Persist the order status update. Replace with real DB access.
 */
async function updateOrderStatus(orderId, status, eventData) {
  const existing = orders.get(orderId);
  if (!existing) {
    // Unknown order — acknowledge but do not create phantom records.
    return null;
  }

  const updated = {
    ...existing,
    status,
    lastPaymentEventId: eventData.id,
    updatedAt: new Date().toISOString(),
  };
  orders.set(orderId, updated);
  return updated;
}

/**
 * Webhook endpoint.
 * NOTE: This route requires the RAW request body for signature verification.
 * Mount with: app.use('/webhooks', express.raw({ type: 'application/json' }), router);
 * or configure express.raw() at the app level for this path.
 */
router.post('/payment', async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const signature = req.get('x-webhook-signature') || req.get('x-signature');

  // 1. Verify authenticity.
  if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Parse payload.
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventId = event.id;
  const eventType = event.type;
  const data = event.data || {};
  const orderId = data.order_id || (data.object && data.object.order_id);

  if (!eventId || !eventType) {
    return res.status(400).json({ error: 'Missing event id or type' });
  }

  // 3. Idempotency: skip already-processed events.
  if (processedEvents.has(eventId)) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // 4. Map event to a status.
  const newStatus = STATUS_MAP[eventType];
  if (!newStatus) {
    // Unhandled event type — acknowledge so the provider stops retrying.
    processedEvents.add(eventId);
    return res.status(200).json({ received: true, handled: false });
  }

  if (!orderId) {
    return res.status(400).json({ error: 'Missing order_id in event data' });
  }

  // 5. Update order.
  try {
    const updated = await updateOrderStatus(orderId, newStatus, event);
    processedEvents.add(eventId);

    if (!updated) {
      // Acknowledge to avoid infinite retries on unknown orders.
      return res.status(200).json({ received: true, orderFound: false });
    }

    return res.status(200).json({
      received: true,
      orderId,
      status: updated.status,
    });
  } catch (err) {
    // 5xx signals the provider to retry later.
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;