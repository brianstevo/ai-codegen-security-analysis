const express = require('express');
const crypto = require('crypto');

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';
const SIGNATURE_HEADER = 'x-signature';
const EVENT_ID_HEADER = 'x-event-id';

// In-memory store for processed event IDs (use Redis/DB in production)
const processedEvents = new Set();

// Capture the raw body for signature verification
app.use(
  '/webhook',
  express.raw({ type: '*/*', limit: '1mb' })
);

/**
 * Timing-safe comparison of two signature strings.
 */
function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify the HMAC-SHA256 signature of the raw request body.
 */
function verifySignature(rawBody, signature) {
  if (!signature || typeof signature !== 'string') {
    return false;
  }

  // Support optional "sha256=" prefix
  const provided = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return safeCompare(provided, expected);
}

/**
 * Middleware to validate the HMAC signature on every incoming webhook request.
 */
function validateSignature(req, res, next) {
  const signature = req.get(SIGNATURE_HEADER);
  const rawBody = req.body; // Buffer, from express.raw

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return res.status(401).json({ error: 'Missing request body' });
  }

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * Process an individual event (replace with real business logic).
 */
async function processEvent(event) {
  // Perform side effects here (persist, enqueue, notify, etc.)
  console.log(`Processing event ${event.id} of type ${event.type || 'unknown'}`);
}

app.post('/webhook', validateSignature, async (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Determine the event ID from header or payload
  const eventId = req.get(EVENT_ID_HEADER) || payload.id || payload.event_id;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  // Idempotency check
  if (processedEvents.has(eventId)) {
    return res.status(200).json({ status: 'duplicate', eventId });
  }

  try {
    await processEvent({ id: eventId, ...payload });
    processedEvents.add(eventId);
  } catch (err) {
    console.error(`Failed to process event ${eventId}:`, err);
    return res.status(500).json({ error: 'Event processing failed' });
  }

  return res.status(200).json({ status: 'processed', eventId });
});

app.use((err, req, res, next) => {
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});

module.exports = app;