const express = require('express');
const crypto = require('crypto');

const app = express();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me';
const PORT = process.env.PORT || 3000;

// In-memory idempotency store for processed event IDs.
// In production, use Redis/DB with TTL and atomic insert semantics.
const processedEvents = new Map();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function pruneProcessedEvents() {
  const now = Date.now();
  for (const [eventId, ts] of processedEvents.entries()) {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      processedEvents.delete(eventId);
    }
  }
}

function getSignatureFromHeader(req) {
  const header = req.get('X-Signature') || req.get('x-signature');
  if (!header) return null;

  // Accept either:
  // 1) hex digest directly
  // 2) sha256=hex digest
  const match = header.match(/^(?:sha256=)?([a-fA-F0-9]{64})$/);
  return match ? match[1].toLowerCase() : null;
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Capture raw body for HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.post('/webhook', (req, res) => {
  const signature = getSignatureFromHeader(req);
  if (!signature || !req.rawBody) {
    return res.status(401).json({ error: 'Missing or invalid signature' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  if (!timingSafeEqualHex(signature, expectedSignature)) {
    return res.status(401).json({ error: 'Missing or invalid signature' });
  }

  const event = req.body;
  const eventId = event && (event.id || event.eventId || event.event_id);

  if (!eventId || typeof eventId !== 'string') {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  pruneProcessedEvents();

  if (processedEvents.has(eventId)) {
    return res.status(200).json({ ok: true, idempotent: true });
  }

  // Mark as processed before doing work to reduce duplicate processing.
  // In production, use a transactional persistent store.
  processedEvents.set(eventId, Date.now());

  try {
    // Process the event here.
    // Example:
    // switch (event.type) { ... }

    console.log('Processing event:', {
      id: eventId,
      type: event.type,
      payload: event,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // If processing fails, you may choose to delete the eventId to allow retry.
    processedEvents.delete(eventId);
    console.error('Webhook processing error:', err);
    return res.status(500).json({ error: 'Processing failed' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});