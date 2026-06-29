const express = require("express");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SIGNATURE_HEADER = process.env.SIGNATURE_HEADER || "x-provider-signature";

if (!WEBHOOK_SECRET) {
  throw new Error("WEBHOOK_SECRET environment variable is required");
}

const processedEvents = new Map();

function extractSignatureValues(signatureHeader) {
  if (!signatureHeader) return [];

  return signatureHeader
    .split(",")
    .map((part) => part.trim())
    .flatMap((part) => {
      const [key, value] = part.split("=");

      if (value && ["sha256", "v1", "signature", "sig"].includes(key.toLowerCase())) {
        return [value.trim()];
      }

      return [part.trim()];
    })
    .filter((value) => /^[a-fA-F0-9]{64}$/.test(value));
}

function timingSafeHexCompare(aHex, bHex) {
  const a = Buffer.from(aHex, "hex");
  const b = Buffer.from(bHex, "hex");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function verifyWebhookSignature(req, res, next) {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    return res.status(500).json({
      error: "Raw request body is required for signature verification",
    });
  }

  const signatureHeader = req.get(SIGNATURE_HEADER);

  if (!signatureHeader) {
    return res.status(401).json({
      error: "Missing webhook signature",
    });
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  const providedSignatures = extractSignatureValues(signatureHeader);

  const isValid = providedSignatures.some((signature) =>
    timingSafeHexCompare(signature, expectedSignature)
  );

  if (!isValid) {
    return res.status(401).json({
      error: "Invalid webhook signature",
    });
  }

  try {
    req.webhookEvent = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({
      error: "Invalid JSON payload",
    });
  }

  next();
}

function getEventId(event) {
  return event.id || event.event_id || event.eventId || event.data?.id;
}

async function processWebhookEvent(event) {
  switch (event.type) {
    case "example.created":
      console.log("Processing example.created:", event.id);
      break;

    case "example.updated":
      console.log("Processing example.updated:", event.id);
      break;

    default:
      console.log("Unhandled event type:", event.type || "unknown");
      break;
  }
}

app.post(
  "/webhook",
  express.raw({
    type: "*/*",
    limit: "2mb",
  }),
  verifyWebhookSignature,
  async (req, res) => {
    const event = req.webhookEvent;
    const eventId = getEventId(event);

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
      });
    }

    if (existing?.status === "processing") {
      try {
        await existing.promise;
        return res.status(200).json({
          received: true,
          duplicate: true,
        });
      } catch {
        return res.status(409).json({
          error: "Event is currently being processed; retry later",
        });
      }
    }

    const processingPromise = processWebhookEvent(event);

    processedEvents.set(eventId, {
      status: "processing",
      promise: processingPromise,
    });

    try {
      await processingPromise;

      processedEvents.set(eventId, {
        status: "processed",
        processedAt: new Date().toISOString(),
      });

      return res.status(200).json({
        received: true,
      });
    } catch (error) {
      processedEvents.delete(eventId);

      console.error("Webhook processing failed:", error);

      return res.status(500).json({
        error: "Webhook processing failed",
      });
    }
  }
);

app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
  });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});