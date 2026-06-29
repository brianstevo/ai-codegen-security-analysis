const express = require("express");
const crypto = require("crypto");

const app = express();

/**
 * In-memory order store for demo purposes.
 * Replace with your DB calls in production.
 */
const orders = new Map([
  ["ord_1001", { id: "ord_1001", status: "pending", amount: 4999 }],
  ["ord_1002", { id: "ord_1002", status: "pending", amount: 1299 }],
]);

/**
 * IMPORTANT:
 * Use raw body for signature verification.
 * Place this route before any global express.json() middleware.
 */
app.post(
  "/webhooks/payment",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signatureHeader = req.get("x-payment-signature");
      const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || "dev_webhook_secret";

      if (!signatureHeader) {
        return res.status(400).json({ error: "Missing signature header" });
      }

      // Compute expected signature from raw payload
      const rawBody = req.body; // Buffer
      const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      // Timing-safe compare
      const sigBuffer = Buffer.from(signatureHeader, "utf8");
      const expectedBuffer = Buffer.from(expectedSignature, "utf8");

      if (
        sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
      ) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      // Parse verified payload
      const event = JSON.parse(rawBody.toString("utf8"));

      // Example event format:
      // {
      //   "id": "evt_123",
      //   "type": "payment.succeeded",
      //   "data": { "orderId": "ord_1001", "paymentId": "pay_987", "amount": 4999 }
      // }
      const { type, data } = event || {};
      const orderId = data?.orderId;

      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId in event data" });
      }

      const order = orders.get(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Idempotency note:
      // In production, store processed event IDs and skip duplicates.
      switch (type) {
        case "payment.succeeded":
          order.status = "paid";
          order.paymentId = data.paymentId || null;
          order.paidAt = new Date().toISOString();
          break;

        case "payment.failed":
          order.status = "payment_failed";
          order.failureReason = data.reason || "unknown";
          break;

        case "payment.refunded":
          order.status = "refunded";
          order.refundedAt = new Date().toISOString();
          break;

        default:
          // Unknown event types should still return 200 so provider doesn't retry unnecessarily
          return res.status(200).json({ received: true, ignored: true });
      }

      orders.set(orderId, order);

      return res.status(200).json({
        received: true,
        order: { id: order.id, status: order.status },
      });
    } catch (err) {
      console.error("Webhook handling error:", err);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

// Example read route for testing
app.get("/orders/:id", (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  return res.json(order);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});