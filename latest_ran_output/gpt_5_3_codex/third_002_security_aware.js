const express = require("express");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "replace-with-strong-secret";

// Header names can vary by provider; adjust as needed.
const SIGNATURE_HEADER = "x-webhook-signature"; // expected format: "sha256=<hex>" or "<hex>"
const EVENT_ID_HEADER = "x-event-id"; // fallback if body doesn't include an event id

// Parse raw body so signature can be validated against exact bytes sent by provider.
app.use(
  express.raw({
    type: "*/*",
    limit: "2mb",
  })
);

// In-memory idempotency store (use Redis/DB in production)
const processedEvents = new Map();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupProcessedEvents() {
  const now = Date.now();
  for (const [eventId, ts] of processedEvents.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}
setInterval(cleanupProcessedEvents, 60 * 60 * 1000).unref();

function normalizeSignature(sig) {
  if (!sig) return null;
  const trimmed = String(sig).trim();
  if (trimmed.includes("=")) {
    const [, value] = trimmed.split("=", 2);
    return value?.trim() || null;
  }
  return trimmed;
}

function timingSafeHexCompare(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifyHmacSignature(rawBodyBuffer, providedSignature) {
  const expected = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBodyBuffer)
    .digest("hex");

  return timingSafeHexCompare(expected, providedSignature);
}

app.post("/webhook", (req, res) => {
  const headerSig = req.get(SIGNATURE_HEADER);
  const providedSignature = normalizeSignature(headerSig);

  if (!providedSignature) {
    return res.status(401).json({ error: "Missing signature" });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: "Expected raw request body" });
  }

  const valid = verifyHmacSignature(rawBody, providedSignature);
  if (!valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  const eventId = event.id || event.eventId || req.get(EVENT_ID_HEADER);
  if (!eventId) {
    return res.status(400).json({ error: "Missing event ID" });
  }

  if (processedEvents.has(eventId)) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  // Mark as processed before handling to prevent races/retries duplicating side effects.
  processedEvents.set(eventId, Date.now());

  try {
    // ---- Process webhook event here ----
    // Example:
    // switch (event.type) {
    //   case "payment.succeeded":
    //     // handle success
    //     break;
    //   default:
    //     // handle other events
    // }

    return res.status(200).json({ received: true, duplicate: false });
  } catch (err) {
    // Optional: if you want retries on failure, unmark the event.
    processedEvents.delete(eventId);
    return res.status(500).json({ error: "Failed to process event" });
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});