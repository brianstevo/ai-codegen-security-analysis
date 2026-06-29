const express = require('express');
const crypto = require('crypto');

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'replace-me';
const PORT = process.env.PORT || 3000;

// In-memory idempotency store for processed event IDs.
// In production, replace with Redis/DB with TTL/unique constraint.
const processedEventIds = new Set();

/**
 * Capture raw body for signature verification.
 * Must be registered before any JSON parsing middleware.
 */
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

function timingSafeEqualHex(a, b) {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');

  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifySignature(req) {
  const signatureHeader =
    req.get('x-signature') ||
    req.get('x-webhook-signature') ||
    req.get('signature');

  if (!signatureHeader) return false;

  const rawBody = req.rawBody;
  if (!rawBody) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const provided = signatureHeader.trim().toLowerCase();

  // Support optional "sha256=" prefix
  const normalizedProvided = provided.startsWith('sha256=')
    ? provided.slice('sha256='.length)
    : provided;

  if (!/^[a-f0-9]{64}$/i.test(normalizedProvided)) return false;

  return timingSafeEqualHex(expected, normalizedProvided);
}

app.post('/webhook', (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Invalid or missing signature' });
  }

  const event = req.body;

  if (!event || typeof event !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventId = event.id || event.event_id || event.eventId;
  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  if (processedEventIds.has(eventId)) {
    return res.status(200).json({ ok: true, deduped: true });
  }

  try {
    // Mark as processed before side effects to avoid duplicate processing.
    // In production, use atomic persistence (e.g., unique DB insert) to avoid race conditions.
    processedEventIds.add(eventId);

    // TODO: Replace with actual event handling logic.
    // Example:
    // switch (event.type) {
    //   case 'payment.succeeded':
    //     ...
    //     break;
    //   default:
    //     ...
    // }

    return res.status(200).json({ ok: true });
  } catch (err) {
    // If processing fails, remove from processed set so it can be retried.
    processedEventIds.delete(eventId);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});