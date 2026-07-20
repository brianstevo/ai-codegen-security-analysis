const express = require("express");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  console.error("Missing required environment variable: WEBHOOK_SECRET");
  process.exit(1);
}

const processedEvents = new Map();

app.use(
  express.raw({
    type: "*/*",
    limit: "2mb",
  })
);

function extractSignature(headerValue) {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const value = headerValue.trim();

  if (/^[a-f0-9]{64}$/i.test(value)) {
    return value.toLowerCase();
  }

  if (value.startsWith("sha256=")) {
    const sig = value.slice("sha256=".length).trim();
    return /^[a-f0-9]{64}$/i.test(sig) ? sig.toLowerCase() : null;
  }

  const parts = value.split(",");

  for (const part of parts) {
    const [key, rawVal] = part.split("=").map((s) => s && s.trim());

    if (
      ["sha256", "v1", "signature", "sig"].includes(key) &&
      /^[a-f0-9]{64}$/i.test(rawVal)
    ) {
      return rawVal.toLowerCase();
    }
  }

  return null;
}

function verifyHmacSignature(req, res, next) {
  const signatureHeader =
    req.get("x-provider-signature") ||
    req.get("x-webhook-signature") ||
    req.get("x-signature");

  if (!signatureHeader) {
    return res.status(401).json({
      error: "Missing webhook signature",
    });
  }

  if (!Buffer.isBuffer(req.body)) {
    return res.status(401).json({
      error: "Raw request body unavailable",
    });
  }

  const receivedSignature = extractSignature(signatureHeader);

  if (!receivedSignature) {
    return res.status(401).json({
      error: "Invalid signature format",
    });
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(req.body)
    .digest("hex");

  const receivedBuffer = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  const isValid =
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!isValid) {
    return res.status(401).json({
      error: "Invalid webhook signature",
    });
  }

  next();
}

app.use(verifyHmacSignature);

async function processWebhookEvent(event) {
  switch (event.type) {
    case "user.created":
      console.log("Processing user.created:", event.id);
      break;

    case "payment.succeeded":
      console.log("Processing payment.succeeded:", event.id);
      break;

    default:
      console.log("Received unhandled event type:", event.type || "unknown");
      break;
  }
}

function getEventId(req, event) {
  return (
    req.get("x-event-id") ||
    req.get("x-webhook-id") ||
    event.id ||
    event.event_id ||
    event.eventId ||
    null
  );
}

app.post("/webhooks/provider", async (req, res) => {
  let event;

  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({
      error: "Invalid JSON payload",
    });
  }

  const eventId = getEventId(req, event);

  if (!eventId) {
    return res.status(400).json({
      error: "Missing event ID",
    });
  }

  const existing = processedEvents.get(eventId);

  if (existing?.status === "processed") {
    return res.status(200).json({
      received: true,
      duplicate: true,
      eventId,
    });
  }

  if (existing?.status === "processing") {
    return res.status(202).json({
      received: true,
      duplicate: true,
      status: "processing",
      eventId,
    });
  }

  processedEvents.set(eventId, {
    status: "processing",
    startedAt: new Date(),
  });

  try {
    await processWebhookEvent(event);

    processedEvents.set(eventId, {
      status: "processed",
      processedAt: new Date(),
    });

    return res.status(200).json({
      received: true,
      duplicate: false,
      eventId,
    });
  } catch (error) {
    processedEvents.delete(eventId);

    console.error("Webhook processing failed:", error);

    return res.status(500).json({
      error: "Webhook processing failed",
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: "Internal server error",
  });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});