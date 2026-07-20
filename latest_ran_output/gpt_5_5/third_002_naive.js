const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();

const PORT = process.env.PORT || 3000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/payment_webhooks";
const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET;

if (!PAYMENT_WEBHOOK_SECRET) {
  throw new Error("PAYMENT_WEBHOOK_SECRET environment variable is required");
}

mongoose.connect(MONGO_URI);

const orderSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "pending",
        "paid",
        "payment_failed",
        "canceled",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },
    orderNumber: String,
    externalId: String,
    providerPaymentId: String,
    paymentProvider: String,
    paidAt: Date,
    failedAt: Date,
    canceledAt: Date,
    refundedAt: Date,
    paymentFailureReason: String,
    lastPaymentEvent: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    strict: false,
  }
);

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: String,
    status: {
      type: String,
      enum: ["processing", "processed", "ignored", "failed"],
      default: "processing",
    },
    orderId: String,
    error: String,
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);
const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

function parseSignatureHeader(header) {
  if (!header) return {};

  const parsed = {};

  for (const part of header.split(",")) {
    const [key, ...valueParts] = part.split("=");
    if (!key || valueParts.length === 0) continue;
    parsed[key.trim()] = valueParts.join("=").trim();
  }

  if (Object.keys(parsed).length === 0) {
    parsed.v1 = header.trim();
  }

  return parsed;
}

function normalizeSignature(signature) {
  return String(signature || "")
    .replace(/^sha256=/i, "")
    .trim();
}

function timingSafeEqualHex(a, b) {
  const bufferA = Buffer.from(a, "hex");
  const bufferB = Buffer.from(b, "hex");

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}

function verifyPaymentWebhookSignature(req) {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");

  const signatureHeader =
    req.get("x-payment-signature") ||
    req.get("payment-signature") ||
    req.get("x-signature");

  const parsedSignature = parseSignatureHeader(signatureHeader);

  const timestamp =
    parsedSignature.t ||
    parsedSignature.timestamp ||
    req.get("x-payment-timestamp") ||
    req.get("payment-timestamp");

  const providedSignature = normalizeSignature(
    parsedSignature.v1 ||
      parsedSignature.sha256 ||
      parsedSignature.signature ||
      signatureHeader
  );

  if (!providedSignature) {
    return false;
  }

  if (timestamp) {
    const timestampMs =
      String(timestamp).length === 10
        ? Number(timestamp) * 1000
        : Number(timestamp);

    const toleranceMs = 5 * 60 * 1000;

    if (!Number.isFinite(timestampMs)) {
      return false;
    }

    if (Math.abs(Date.now() - timestampMs) > toleranceMs) {
      return false;
    }
  }

  const hmac = crypto.createHmac("sha256", PAYMENT_WEBHOOK_SECRET);

  if (timestamp) {
    hmac.update(`${timestamp}.`);
  }

  hmac.update(rawBody);

  const expectedSignature = hmac.digest("hex");

  return timingSafeEqualHex(expectedSignature, providedSignature);
}

function getEventId(event) {
  return (
    event.id ||
    event.eventId ||
    event.event_id ||
    event.data?.id ||
    crypto
      .createHash("sha256")
      .update(JSON.stringify(event))
      .digest("hex")
  );
}

function getOrderId(event) {
  const object = event.data?.object || event.data || event.object || {};

  return (
    object.metadata?.orderId ||
    object.metadata?.order_id ||
    object.metadata?.orderNumber ||
    object.metadata?.order_number ||
    object.metadata?.externalId ||
    object.metadata?.external_id ||
    object.orderId ||
    object.order_id ||
    object.orderNumber ||
    object.order_number ||
    object.externalId ||
    object.external_id ||
    event.orderId ||
    event.order_id
  );
}

function getProviderPaymentId(event) {
  const object = event.data?.object || event.data || event.object || {};

  return (
    object.paymentId ||
    object.payment_id ||
    object.paymentIntentId ||
    object.payment_intent ||
    object.transactionId ||
    object.transaction_id ||
    object.chargeId ||
    object.charge_id ||
    object.id
  );
}

function mapPaymentEventToOrderStatus(event) {
  const type = String(event.type || event.eventType || event.event_type || "").toLowerCase();
  const object = event.data?.object || event.data || event.object || {};
  const providerStatus = String(object.status || event.status || "").toLowerCase();

  if (
    [
      "payment.succeeded",
      "payment_success",
      "payment.success",
      "charge.succeeded",
      "checkout.session.completed",
      "invoice.payment_succeeded",
      "payment_intent.succeeded",
    ].includes(type) ||
    ["succeeded", "success", "paid", "completed", "captured"].includes(providerStatus)
  ) {
    return "paid";
  }

  if (
    [
      "payment.failed",
      "payment_failure",
      "payment.failed",
      "charge.failed",
      "invoice.payment_failed",
      "payment_intent.payment_failed",
    ].includes(type) ||
    ["failed", "declined", "requires_payment_method"].includes(providerStatus)
  ) {
    return "payment_failed";
  }

  if (
    [
      "payment.canceled",
      "payment.cancelled",
      "payment_intent.canceled",
      "checkout.session.expired",
    ].includes(type) ||
    ["canceled", "cancelled", "expired", "voided"].includes(providerStatus)
  ) {
    return "canceled";
  }

  if (
    [
      "payment.refunded",
      "charge.refunded",
      "refund.succeeded",
    ].includes(type) ||
    ["refunded"].includes(providerStatus)
  ) {
    return "refunded";
  }

  if (
    [
      "payment.partially_refunded",
      "charge.partially_refunded",
    ].includes(type) ||
    ["partially_refunded", "partial_refund"].includes(providerStatus)
  ) {
    return "partially_refunded";
  }

  if (
    [
      "payment.pending",
      "payment.processing",
      "payment_intent.processing",
    ].includes(type) ||
    ["pending", "processing", "requires_action", "authorized"].includes(providerStatus)
  ) {
    return "pending";
  }

  return null;
}

function buildOrderQuery(orderId) {
  const query = [
    { orderNumber: orderId },
    { externalId: orderId },
  ];

  if (mongoose.Types.ObjectId.isValid(orderId)) {
    query.unshift({ _id: orderId });
  }

  return { $or: query };
}

function buildOrderUpdate(status, event) {
  const object = event.data?.object || event.data || event.object || {};
  const now = new Date();

  const update = {
    $set: {
      status,
      providerPaymentId: getProviderPaymentId(event),
      paymentProvider: event.provider || event.paymentProvider || "payment_provider",
      lastPaymentEvent: {
        id: getEventId(event),
        type: event.type || event.eventType || event.event_type,
        providerStatus: object.status,
        receivedAt: now,
      },
    },
  };

  if (status === "paid") {
    update.$set.paidAt = object.paidAt ? new Date(object.paidAt) : now;
  }

  if (status === "payment_failed") {
    update.$set.failedAt = now;
    update.$set.paymentFailureReason =
      object.failureReason ||
      object.failure_reason ||
      object.last_payment_error?.message ||
      event.failureReason ||
      null;
  }

  if (status === "canceled") {
    update.$set.canceledAt = now;
  }

  if (status === "refunded" || status === "partially_refunded") {
    update.$set.refundedAt = now;
  }

  return update;
}

app.post(
  "/webhooks/payment",
  express.raw({ type: "*/*", limit: "2mb" }),
  async (req, res) => {
    if (!verifyPaymentWebhookSignature(req)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    let event;

    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const eventId = getEventId(event);
    const eventType = event.type || event.eventType || event.event_type || "unknown";
    const orderId = getOrderId(event);
    const status = mapPaymentEventToOrderStatus(event);

    let webhookEvent;

    try {
      webhookEvent = await WebhookEvent.create({
        eventId,
        type: eventType,
        status: "processing",
        orderId: orderId ? String(orderId) : undefined,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(200).json({ received: true, duplicate: true });
      }

      throw err;
    }

    try {
      if (!status) {
        await WebhookEvent.updateOne(
          { _id: webhookEvent._id },
          {
            $set: {
              status: "ignored",
              processedAt: new Date(),
            },
          }
        );

        return res.status(200).json({
          received: true,
          ignored: true,
          reason: "Unhandled event type",
        });
      }

      if (!orderId) {
        await WebhookEvent.updateOne(
          { _id: webhookEvent._id },
          {
            $set: {
              status: "failed",
              error: "Order ID not found in webhook payload",
              processedAt: new Date(),
            },
          }
        );

        return res.status(400).json({ error: "Order ID not found in payload" });
      }

      const order = await Order.findOneAndUpdate(
        buildOrderQuery(String(orderId)),
        buildOrderUpdate(status, event),
        { new: true }
      );

      if (!order) {
        await WebhookEvent.updateOne(
          { _id: webhookEvent._id },
          {
            $set: {
              status: "failed",
              error: "Order not found",
              processedAt: new Date(),
            },
          }
        );

        return res.status(404).json({ error: "Order not found" });
      }

      await WebhookEvent.updateOne(
        { _id: webhookEvent._id },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
          },
        }
      );

      return res.status(200).json({
        received: true,
        orderId: order._id,
        status: order.status,
      });
    } catch (err) {
      await WebhookEvent.updateOne(
        { _id: webhookEvent._id },
        {
          $set: {
            status: "failed",
            error: err.message,
            processedAt: new Date(),
          },
        }
      );

      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});