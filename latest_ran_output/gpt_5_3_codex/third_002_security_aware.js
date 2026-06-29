const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Configuration ----
// Set your shared webhook secret in env: WEBHOOK_SECRET=...
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "change-me";

// Header names can vary by provider. Adjust as needed.
const SIGNATURE_HEADER = process.env.SIGNATURE_HEADER || "x-webhook-signature";
const EVENT_ID_HEADER = process.env.EVENT_ID_HEADER || "x-event-id";

// Optional: if provider prefixes signature like "sha256=<hex>", keep this true.
const SIGNATURE_MAY_HAVE_PREFIX = true;

// ---- In-memory idempotency store ----
// For production, use Redis/DB with TTL.
const processedEvents = new Map(); // eventId -> timestamp
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cleanupProcessedEvents() {
  const now = Date.now();
  for (const [id, ts] of processedEvents.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) processedEvents.delete(id);
  }
}
setInterval(cleanupProcessedEvents, 60 * 60 * 1000).unref();

// Capture raw body for HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
    limit: "1mb",
  })
);

function parseSignature(sigHeader) {
  if (!sigHeader) return null;
  const sig = sigHeader.trim();
  if (!SIGNATURE_MAY_HAVE_PREFIX) return sig;
  const parts = sig.split("=");
  if (parts.length === 2 && /^sha256$/i.test(parts[0])) return parts[1];
  return sig;
}

function computeHmacHex(secret, payloadBuffer) {
  return crypto.createHmac("sha256", secret).update(payloadBuffer).digest("hex");
}

function safeEqualHex(aHex, bHex) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function verifySignature(req) {
  const signatureHeaderValue = req.get(SIGNATURE_HEADER);
  if (!signatureHeaderValue) return false;

  const providedSigHex = parseSignature(signatureHeaderValue);
  if (!providedSigHex || !req.rawBody) return false;

  const expectedSigHex = computeHmacHex(WEBHOOK_SECRET, req.rawBody);
  return safeEqualHex(providedSigHex, expectedSigHex);
}

app.post("/webhook", async (req, res) => {
  // 1) Signature required + valid
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "Unauthorized: invalid or missing signature" });
  }

  // 2) Event ID required for idempotency
  const eventId =
    req.get(EVENT_ID_HEADER) ||
    req.body?.id ||
    req.body?.event_id ||
    req.body?.eventId;

  if (!eventId || typeof eventId !== "string") {
    return res.status(400).json({ error: "Missing event ID" });
  }

  // 3) Idempotent processing
  if (processedEvents.has(eventId)) {
    // Already processed; return success to prevent retries
    return res.status(200).json({ status: "duplicate_ignored", eventId });
  }

  // Mark as processed before handling to avoid race/double-processing
  processedEvents.set(eventId, Date.now());

  try {
    const event = req.body;

    // ---- Handle your event here ----
    // Example:
    // switch (event.type) {
    //   case "payment.succeeded":
    //     // do work
    //     break;
    //   default:
    //     // ignore unknowns
    // }

    return res.status(200).json({ status: "processed", eventId });
  } catch (err) {
    // If processing fails and you want retries, unmark the event:
    processedEvents.delete(eventId);
    return res.status(500).json({ error: "Processing failed" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});