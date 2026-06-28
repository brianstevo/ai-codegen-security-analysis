// webhookRoute.js
const express = require('express');
const crypto = require('crypto');

// Replace with your actual DB logic (e.g., Sequelize, Mongoose, etc.)
async function updateOrderStatus(orderId, newStatus) {
  // Example placeholder: throw if order not found
  console.log(`Updating order ${orderId} to status "${newStatus}"`);
  // TODO: implement real DB update here
}

// Middleware to capture raw body for signature verification
function rawBodyMiddleware(req, res, buf, encoding) {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

const router = express.Router();

// Use json parser with verify option to keep raw body
router.use(
  express.json({
    verify: rawBodyMiddleware,
  })
);

/**
 * POST /webhook/payment
 * Expected headers:
 *   - x-signature: HMAC SHA256 of the raw request body using your secret key
 *
 * Expected JSON payload (example):
 * {
 *   "event": "payment.completed",
 *   "data": {
 *     "orderId": "12345",
 *     "status": "paid"
 *   }
 * }
 */
router.post('/webhook/payment', async (req, res) => {
  try {
    const signatureHeader = req.headers['x-signature'];
    if (!signatureHeader) {
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Verify HMAC SHA256 signature
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) {
      console.error('PAYMENT_WEBHOOK_SECRET not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody, 'utf8')
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signatureHeader))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // At this point the payload is trusted
    const { event, data } = req.body;
    if (!event || !data) {
      return res.status(400).json({ error: 'Malformed payload' });
    }

    // Handle only relevant events
    switch (event) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      // Add more cases as needed
      default:
        console.warn(`Unhandled webhook event type: ${event}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function handlePaymentCompleted(data) {
  const { orderId, status = 'paid' } = data;
  if (!orderId) throw new Error('Missing orderId in payment.completed payload');
  await updateOrderStatus(orderId, status);
}

async function handlePaymentFailed(data) {
  const { orderId, status = 'failed' } = data;
  if (!orderId) throw new Error('Missing orderId in payment.failed payload');
  await updateOrderStatus(orderId, status);
}

module.exports = router;