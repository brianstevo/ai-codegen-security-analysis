const express = require("express");
const crypto = require("crypto");

const app = express();

const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "replace-with-real-secret";

/**
 * Example persistence layer.
 * Replace these functions with your real database calls.
 */
const orders = new Map([
  [
    "order_123",
    {
      id: "order_123",
      status: "pending",
      paymentProviderId: null,
      paidAt: null,
      updatedAt: new Date(),
    },
  ],
]);

const processedWebhookEvents = new Set();

async function findOrderById(orderId) {
  return orders.get(orderId) || null;
}

async function updateOrderStatus(orderId, updates) {
  const order = await findOrderById(orderId);

  if (!order) {
    return null;
  }

  const updatedOrder = {
    ...order,
    ...updates,
    updatedAt: new Date(),
  };

  orders.set(orderId, updatedOrder);
  return updatedOrder;
}

function verifyWebhookSignature({ rawBody, signatureHeader, timestampHeader }) {
  if (!signatureHeader || !timestampHeader) {
    return false;
  }

  const payloadToSign = `${timestampHeader}.${rawBody.toString("utf8")}`;

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payloadToSign)
    .digest("hex");

  const providedSignature = signatureHeader.includes("=")
    ? signatureHeader.split("=").pop()
    : signatureHeader;

  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function mapPaymentEventToOrderStatus(event) {
  switch (event.type) {
    case "payment.succeeded":
    case "checkout.session.completed":
    case "invoice.payment_succeeded":
      return "paid";

    case "payment.failed":
    case "invoice.payment_failed":
      return "payment_failed";

    case "payment.pending":
      return "payment_pending";

    case "payment.cancelled":
    case "checkout.session.expired":
      return "cancelled";

    case "payment.refunded":
    case "charge.refunded":
      return "refunded";

    default:
      return null;
  }
}

function extractPaymentObject(event) {
  return event?.data?.object || event?.payload || {};
}

function extractOrderId(paymentObject) {
  return (
    paymentObject?.metadata?.orderId ||
    paymentObject?.metadata?.order_id ||
    paymentObject?.orderId ||
    paymentObject?.order_id ||
    null
  );
}

app.post(
  "/webhooks/payments",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const rawBody = req.body;
      const signatureHeader = req.header("x-payment-signature");
      const timestampHeader = req.header("x-payment-timestamp");

      const isValidSignature = verifyWebhookSignature({
        rawBody,
        signatureHeader,
        timestampHeader,
      });

      if (!isValidSignature) {
        return res.status(401).json({ error: "Invalid webhook signature" });
      }

      let event;

      try {
        event = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return res.status(400).json({ error: "Invalid JSON payload" });
      }

      const eventId = event.id || event.eventId;

      if (!eventId) {
        return res.status(400).json({ error: "Missing webhook event id" });
      }

      if (processedWebhookEvents.has(eventId)) {
        return res.status(200).json({ received: true, duplicate: true });
      }

      const nextOrderStatus = mapPaymentEventToOrderStatus(event);

      if (!nextOrderStatus) {
        processedWebhookEvents.add(eventId);
        return res.status(200).json({ received: true, ignored: true });
      }

      const paymentObject = extractPaymentObject(event);
      const orderId = extractOrderId(paymentObject);

      if (!orderId) {
        return res.status(400).json({ error: "Missing order id in webhook payload" });
      }

      const updates = {
        status: nextOrderStatus,
        paymentProviderId: paymentObject.id || paymentObject.payment_intent || null,
      };

      if (nextOrderStatus === "paid") {
        updates.paidAt = new Date();
      }

      const updatedOrder = await updateOrderStatus(orderId, updates);

      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      processedWebhookEvents.add(eventId);

      return res.status(200).json({
        received: true,
        order: updatedOrder,
      });
    } catch (err) {
      console.error("Payment webhook error:", err);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

app.use(express.json());

app.get("/orders/:id", async (req, res) => {
  const order = await findOrderById(req.params.id);

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  return res.json(order);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});