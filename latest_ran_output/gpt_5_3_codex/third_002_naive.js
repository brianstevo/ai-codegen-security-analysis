const express = require("express");
const crypto = require("crypto");

const router = express.Router();

// Ensure your app uses raw body for this route so signature verification works.
// Example in app.js/server.js:
// app.use("/webhooks/payment", express.raw({ type: "application/json" }), paymentWebhookRouter);

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "replace_me_with_real_secret";

// Mock persistence layer (replace with real DB calls)
const ordersStore = new Map();
/*
ordersStore example:
ordersStore.set("order_123", {
  id: "order_123",
  paymentIntentId: "pi_abc",
  status: "pending",
  updatedAt: new Date().toISOString()
});
*/

async function findOrderByPaymentRef(paymentRef) {
  for (const [, order] of ordersStore) {
    if (order.paymentIntentId === paymentRef || order.id === paymentRef) return order;
  }
  return null;
}

async function updateOrderStatus(orderId, status, extra = {}) {
  const existing = ordersStore.get(orderId);
  if (!existing) return null;
  const updated = {
    ...existing,
    ...extra,
    status,
    updatedAt: new Date().toISOString(),
  };
  ordersStore.set(orderId, updated);
  return updated;
}

function safeCompare(a, b) {
  const aBuf = Buffer.from(a || "", "utf8");
  const bBuf = Buffer.from(b || "", "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  // Example scheme: provider sends header "x-provider-signature" with hex HMAC SHA256
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return safeCompare(expected, signatureHeader);
}

router.post("/", async (req, res) => {
  try {
    const signature = req.header("x-provider-signature");
    if (!signature) {
      return res.status(400).json({ error: "Missing webhook signature" });
    }

    const rawBody = req.body; // Buffer when express.raw() is used
    if (!Buffer.isBuffer(rawBody)) {
      return res.status(400).json({
        error:
          "Invalid body parser. Use express.raw({ type: 'application/json' }) for this route.",
      });
    }

    const isValid = verifyWebhookSignature(rawBody, signature, PAYMENT_WEBHOOK_SECRET);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    let event;
    try {
      event = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    // Generic webhook payload expectation:
    // {
    //   "id": "evt_123",
    //   "type": "payment.succeeded" | "payment.failed" | "payment.refunded" | ...,
    //   "data": {
    //     "paymentId": "pi_abc",
    //     "orderId": "order_123",
    //     "amount": 1000,
    //     "currency": "USD",
    //     "failureReason": "..."
    //   }
    // }

    const eventType = event?.type;
    const data = event?.data || {};
    const paymentRef = data.orderId || data.paymentId;

    if (!eventType || !paymentRef) {
      return res.status(400).json({ error: "Missing required event fields" });
    }

    const order = await findOrderByPaymentRef(paymentRef);
    if (!order) {
      // Acknowledge to prevent endless retries for unknown orders
      return res.status(200).json({ received: true, ignored: "Order not found" });
    }

    let nextStatus = null;
    const meta = {
      lastWebhookEventId: event.id || null,
      lastWebhookType: eventType,
      lastWebhookAt: new Date().toISOString(),
    };

    switch (eventType) {
      case "payment.succeeded":
      case "checkout.completed":
        nextStatus = "paid";
        break;
      case "payment.failed":
        nextStatus = "payment_failed";
        meta.failureReason = data.failureReason || null;
        break;
      case "payment.refunded":
        nextStatus = "refunded";
        break;
      case "payment.cancelled":
        nextStatus = "cancelled";
        break;
      default:
        // Unhandled event types are acknowledged
        return res.status(200).json({ received: true, ignored: `Unhandled event: ${eventType}` });
    }

    const updated = await updateOrderStatus(order.id, nextStatus, meta);
    if (!updated) {
      return res.status(500).json({ error: "Failed to update order" });
    }

    return res.status(200).json({
      received: true,
      orderId: updated.id,
      status: updated.status,
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;