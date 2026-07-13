const express = require('express');
const crypto = require('crypto');

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const SIGNATURE_HEADER = 'x-webhook-signature';
const EVENT_ID_HEADER = 'x-webhook-event-id';

// In-memory store for processed event IDs (use Redis/DB in production)
const processedEvents = new Set();

// Capture the raw body buffer for signature verification
app.use(
  '/webhook',
  express.raw({ type: '*/*', limit: '1mb' })
);

// Timing-safe comparison of two hex signatures
function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// Verify the HMAC-SHA256 signature on the raw request body
function verifySignature(req) {
  const provided = req.get(SIGNATURE_HEADER);
  if (!provided || typeof provided !== 'string') {
    return false;
  }

  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body || '', 'utf8');

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Strip optional "sha256=" prefix if present
  const normalized = provided.startsWith('sha256=')
    ? provided.slice('sha256='.length)
    : provided;

  return safeCompare(normalized, expected);
}

// Idempotent event processing
async function processEvent(event) {
  // ... business logic here ...
  // This function should be safe to call but is guarded by idempotency check.
  return;
}

app.post('/webhook', async (req, res) => {
  // 1. Validate signature before any processing
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Invalid or missing signature' });
  }

  // 2. Parse the JSON payload now that it is trusted
  let event;
  try {
    const text = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : String(req.body || '');
    event = JSON.parse(text);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // 3. Determine the event ID (header takes precedence, fallback to body)
  const eventId =
    req.get(EVENT_ID_HEADER) || (event && (event.id || event.event_id));

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  // 4. Idempotency: skip already-processed events
  if (processedEvents.has(eventId)) {
    return res.status(200).json({ status: 'duplicate', eventId });
  }

  // 5. Mark as processed and handle the event
  try {
    processedEvents.add(eventId);
    await processEvent(event);
    return res.status(200).json({ status: 'processed', eventId });
  } catch (err) {
    // Roll back idempotency marker so the event can be retried
    processedEvents.delete(eventId);
    return res.status(500).json({ error: 'Event processing failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});

module.exports = app;