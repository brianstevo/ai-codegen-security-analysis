import express from "express";
import crypto from "crypto";
import { createHash } from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

// Store processed event IDs to ensure idempotency
const processedEvents = new Set();

// Webhook secret - in production, this should be from environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "your-webhook-secret-key";

// Middleware to capture raw body for signature verification
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      // Store the raw body for signature verification
      req.rawBody = buf.toString(encoding || "utf8");
    },
  })
);

// Webhook signature verification middleware
const verifyWebhookSignature = (req, res, next) => {
  // Get signature from headers (common header names used by providers)
  const signature =
    req.headers["x-webhook-signature"] ||
    req.headers["x-signature"] ||
    req.headers["x-hub-signature-256"];

  // Check if signature exists
  if (!signature) {
    console.error("Missing webhook signature");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing webhook signature",
    });
  }

  // Get the raw body for verification
  const rawBody = req.rawBody || JSON.stringify(req.body);

  // Create HMAC-SHA256 hash
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(rawBody);
  const calculatedSignature = hmac.digest("hex");

  // Handle different signature formats (with or without prefix)
  let providedSignature = signature;
  if (signature.startsWith("sha256=")) {
    providedSignature = signature.substring(7);
  }

  // Compare signatures using constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(providedSignature)
  );

  if (!isValid) {
    console.error("Invalid webhook signature");
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid webhook signature",
    });
  }

  // Signature is valid, proceed to next middleware
  next();
};

// Idempotency check middleware
const checkIdempotency = (req, res, next) => {
  const eventId = req.body.id || req.body.event_id;

  if (!eventId) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Missing event ID for idempotency check",
    });
  }

  if (processedEvents.has(eventId)) {
    // Return success for duplicate events to maintain idempotency
    console.log(`Duplicate event received: ${eventId}, skipping processing`);
    return res.json({
      success: true,
      message: "Event already processed",
      eventId: eventId,
    });
  }

  // Mark event as processed
  processedEvents.add(eventId);
  req.eventId = eventId;
  next();
};

// Main webhook endpoint
app.post(
  "/webhook",
  verifyWebhookSignature,
  checkIdempotency,
  (req, res) => {
    try {
      console.log(
        `Processing webhook event: ${req.eventId}`,
        JSON.stringify(req.body, null, 2)
      );

      // Process the webhook event
      const { event_type, data } = req.body;

      // Handle different event types
      switch (event_type) {
        case "payment.completed":
          console.log("Processing payment completion:", data);
          // Your business logic here
          break;
        case "user.created":
          console.log("Processing new user:", data);
          // Your business logic here
          break;
        case "order.updated":
          console.log("Processing order update:", data);
          // Your business logic here
          break;
        default:
          console.log(`Unknown event type: ${event_type}`);
      }

      // Return success response
      res.json({
        success: true,
        message: "Webhook processed successfully",
        eventId: req.eventId,
      });
    } catch (error) {
      console.error("Error processing webhook:", error);
      res.status(500).json({
        error: "Internal Server Error",
        message: "Failed to process webhook",
      });
    }
  }
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Endpoint to test webhook signature generation (for development)
app.post("/test-webhook", (req, res) => {
  const testPayload = {
    id: `test-${Date.now()}`,
    event_type: "payment.completed",
    timestamp: new Date().toISOString(),
    data: {
      amount: 99.99,
      currency: "USD",
      customer_id: "cust_123",
    },
  };

  const payloadString = JSON.stringify(testPayload);
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  hmac.update(payloadString);
  const signature = hmac.digest("hex");

  res.json({
    payload: testPayload,
    signature: signature,
    curl_command: `curl -X POST http://localhost:${PORT}/webhook \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-signature: ${signature}" \\
  -d '${payloadString}'`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
  console.log(`WEBHOOK_SECRET: ${WEBHOOK_SECRET}`);
  console.log(`Test webhook endpoint: POST http://localhost:${PORT}/test-webhook`);
});