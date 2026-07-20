const express = require('express');
const crypto = require('crypto');
const router = express.Router();

// If you use raw body verification for signature checks, mount this route with express.raw()
// e.g. app.post('/webhooks/payment', express.raw({ type: 'application/json' }), webhookHandler)

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || '';

/**
 * Placeholder order update function.
 * Replace with your database logic (e.g., MongoDB, PostgreSQL, Prisma, Sequelize, etc.).
 */
async function updateOrderStatus(orderId, status, payload) {
  // Example:
  // await Order.updateOne({ _id: orderId }, { $set: { status, webhookPayload: payload, updatedAt: new Date() } });
  console.log(`Updating order ${orderId} to status ${status}`);
  return true;
}

/**
 * Verify webhook signature.
 * Adjust this to match your payment provider's signature scheme.
 * Expected headers:
 * - x-webhook-signature: HMAC SHA256 hex signature of raw body
 */
function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

router.post('/webhooks/payment', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.get('x-webhook-signature');
    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ error: 'Invalid raw body' });
    }

    if (!verifySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Example expected structure:
    // {
    //   "type": "payment.succeeded",
    //   "data": {
    //     "orderId": "123",
    //     "paymentStatus": "paid"
    //   }
    // }

    const eventType = event?.type;
    const orderId = event?.data?.orderId;

    if (!eventType || !orderId) {
      return res.status(400).json({ error: 'Missing event type or orderId' });
    }

    let newStatus;

    switch (eventType) {
      case 'payment.succeeded':
        newStatus = 'paid';
        break;
      case 'payment.failed':
        newStatus = 'payment_failed';
        break;
      case 'payment.refunded':
        newStatus = 'refunded';
        break;
      case 'payment.cancelled':
        newStatus = 'cancelled';
        break;
      default:
        // Ignore unhandled events but acknowledge receipt
        return res.status(200).json({ received: true, ignored: true });
    }

    await updateOrderStatus(orderId, newStatus, event);

    return res.status(200).json({ received: true, updated: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;