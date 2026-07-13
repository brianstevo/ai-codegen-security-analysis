const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// If you need raw body for signature verification, mount this route with express.raw({ type: 'application/json' })
// Example: app.post('/webhooks/payment', express.raw({ type: 'application/json' }), webhookHandler)

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'replace_me';

// Mock order store/service. Replace with your database logic.
const OrderService = {
  async findByPaymentIntentId(paymentIntentId) {
    // return await Order.findOne({ paymentIntentId });
    return null;
  },
  async updateStatus(orderId, status, meta = {}) {
    // return await Order.updateOne({ _id: orderId }, { $set: { status, ...meta } });
    return { orderId, status, meta };
  }
};

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  // Example HMAC SHA256 signature verification:
  // header format: "t=timestamp,v1=signature"
  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

router.post('/webhooks/payment', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const rawBody = req.body ? req.body.toString('utf8') : '';
    const signatureHeader = req.get('x-payment-signature');

    if (!verifySignature(rawBody, signatureHeader, WEBHOOK_SECRET)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }

    // Expected event shape example:
    // {
    //   id: "evt_123",
    //   type: "payment.succeeded",
    //   data: { object: { payment_intent_id: "pi_123", order_id: "ord_123" } }
    // }

    const eventType = event.type;
    const paymentObject = event?.data?.object || {};
    const paymentIntentId = paymentObject.payment_intent_id || paymentObject.id;
    const orderIdFromPayload = paymentObject.order_id;

    if (!eventType) {
      return res.status(400).json({ error: 'Missing event type' });
    }

    let newStatus = null;
    switch (eventType) {
      case 'payment.succeeded':
      case 'charge.succeeded':
        newStatus = 'paid';
        break;
      case 'payment.failed':
      case 'charge.failed':
        newStatus = 'payment_failed';
        break;
      case 'payment.refunded':
      case 'charge.refunded':
        newStatus = 'refunded';
        break;
      case 'payment.canceled':
      case 'charge.canceled':
        newStatus = 'canceled';
        break;
      default:
        // Acknowledge unhandled events to prevent retries
        return res.status(200).json({ received: true, ignored: true });
    }

    let order = null;
    if (orderIdFromPayload) {
      // Replace with your DB lookup by order ID
      order = { _id: orderIdFromPayload };
    } else if (paymentIntentId) {
      order = await OrderService.findByPaymentIntentId(paymentIntentId);
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await OrderService.updateStatus(order._id, newStatus, {
      paymentEventId: event.id,
      paymentEventType: eventType,
      paymentIntentId: paymentIntentId || null,
      updatedAt: new Date()
    });

    return res.status(200).json({ received: true, status: newStatus });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;