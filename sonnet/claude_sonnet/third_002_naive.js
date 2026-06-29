```javascript
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

// Mock database functions - replace with your actual database implementation
const db = {
  orders: new Map([
    ["order_123", { id: "order_123", status: "pending", userId: "user_1", amount: 9999 }],
    ["order_456", { id: "order_456", status: "pending", userId: "user_2", amount: 4999 }],
  ]),

  async findOrderByPaymentId(paymentId) {
    for (const [, order] of this.orders) {
      if (order.paymentId === paymentId) return order;
    }
    return null;
  },

  async findOrderById(orderId) {
    return this.orders.get(orderId) || null;
  },

  async updateOrderStatus(orderId, status, metadata = {}) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);
    const updated = { ...order, status, ...metadata, updatedAt: new Date().toISOString() };
    this.orders.set(orderId, updated);
    return updated;
  },

  webhookEvents: new Set(),
  async isDuplicateEvent(eventId) {
    if (this.webhookEvents.has(eventId)) return true;
    this.webhookEvents.add(eventId);
    return false;
  },
};

// Notification service - replace with your actual implementation
const notificationService = {
  async sendOrderConfirmation(order) {
    console.log(`[Notification] Order confirmation sent for order ${order.id}`);
  },
  async sendPaymentFailedNotification(order) {
    console.log(`[Notification] Payment failed notification sent for order ${order.id}`);
  },
  async sendRefundNotification(order, amount) {
    console.log(`[Notification] Refund notification sent for order ${order.id}, amount: ${amount}`);
  },
};

// Constants
const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || "your_webhook_secret_here";
const SUPPORTED_EVENTS = [
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "payment.partially_refunded",
  "charge.dispute.created",
  "charge.dispute.resolved",
];

/**
 * Verify webhook signature from payment provider
 * Supports both HMAC-SHA256 and HMAC-SHA512 signature schemes
 */
function verifyWebhookSignature(rawBody, signature, secret) {
  if (!signature || !rawBody) return false;

  try {
    // Handle "v1=<hash>" format (e.g., Stripe-style)
    const signatureParts = signature.split(",");
    let timestamp = null;
    let receivedSignatures = [];

    for (const part of signatureParts) {
      const [key, value] = part.split("=");
      if (key === "t") timestamp = value;
      if (key === "v1") receivedSignatures.push(value);
    }

    // If timestamp-based signature (replay attack protection)
    if (timestamp) {
      const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
      if (Math.abs(timestampAge) > 300) {
        // 5 minute tolerance
        console.warn("[Webhook] Signature timestamp too old or in the future");
        return false;
      }

      const payload = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payload, "utf8")
        .digest("hex");

      return receivedSignatures.some((sig) =>
        crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSignature, "hex"))
      );
    }

    // Simple HMAC-SHA256 signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody, "utf8")
      .digest("hex");

    const receivedSignature = signature.replace("sha256=", "");

    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch (error) {
    console.error("[Webhook] Signature verification error:", error.message);
    return false;
  }
}

/**
 * Map payment provider statuses to internal order statuses
 */
function mapPaymentStatusToOrderStatus(eventType, paymentStatus) {
  const statusMap = {
    "payment.succeeded": "paid",
    "payment.failed": "payment_failed",
    "payment.refunded": "refunded",
    "payment.partially_refunded": "partially_refunded",
    "charge.dispute.created": "disputed",
    "charge.dispute.resolved": "dispute_resolved",
  };

  return statusMap[eventType] || paymentStatus || "unknown";
}

/**
 * Process payment succeeded event
 */
async function handlePaymentSucceeded(eventData) {
  const { payment_id, order_id, amount, currency, payment_method } = eventData;

  let order = await db.findOrderById(order_id);
  if (!order) {
    order = await db.findOrderByPaymentId(payment_id);
  }

  if (!order) {
    throw new Error(`Order not found for payment ${payment_id}`);
  }

  if (order.status === "paid") {
    console.log(`[Webhook] Order ${order.id} already marked as paid, skipping`);
    return order;
  }

  const updatedOrder = await db.updateOrderStatus(order.id, "paid", {
    paymentId: payment_id,
    paidAmount: amount,
    currency,
    paymentMethod: payment_method,
    paidAt: new Date().toISOString(),
  });

  await notificationService.sendOrderConfirmation(updatedOrder);

  console.log(`[Webhook] Order ${order.id} marked as paid. Amount: ${amount} ${currency}`);
  return updatedOrder;
}

/**
 * Process payment failed event
 */
async function handlePaymentFailed(eventData) {
  const { payment_id, order_id, failure_code, failure_message } = eventData;

  let order = await db.findOrderById(order_id);
  if (!order) {
    order = await db.findOrderByPaymentId(payment_id);
  }

  if (!order) {
    throw new Error(`Order not found for payment ${payment_id}`);
  }

  const updatedOrder = await db.updateOrderStatus(order.id, "payment_failed", {
    paymentId: payment_id,
    failureCode: failure_code,
    failureMessage: failure_message,
    failedAt: new Date().toISOString(),
  });

  await notificationService.sendPaymentFailedNotification(updatedOrder);

  console.log(`[Webhook] Payment failed for order ${order.id}. Code: ${failure_code}`);
  return updatedOrder;
}

/**
 * Process refund event (full or partial)
 */
async function handleRefund(eventData, isPartial = false) {
  const { payment_id, order_id, refund_id, refund_amount, currency, reason } = eventData;

  let order = await db.findOrderById(order_id);
  if (!order) {
    order = await db.findOrderByPaymentId(payment_id);
  }

  if (!order) {
    throw new Error(`Order not found for payment ${payment_id}`);
  }

  const newStatus = isPartial ? "partially_refunded" : "refunded";

  const updatedOrder = await db.updateOrderStatus(order.id, newStatus, {
    refundId: refund_id,
    refundAmount: refund_amount,
    refundReason: reason,
    refundedAt: new Date().toISOString(),
  });