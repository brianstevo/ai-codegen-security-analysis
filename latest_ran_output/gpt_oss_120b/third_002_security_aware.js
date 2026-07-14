// webhook-server.js
const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = process.env.WEBHOOK_SECRET || 'replace_with_your_secret';

// Capture raw body for HMAC verification
function rawBodySaver(req, res, buf) {
  if (buf && buf.length) {
    req.rawBody = buf;
  }
}
app.use(express.json({ verify: rawBodySaver }));
app.use(express.urlencoded({ extended: true, verify: rawBodySaver }));

// In‑memory store for idempotency (replace with persistent storage in prod)
const processedEventIds = new Set();

// Middleware to validate HMAC‑SHA256 signature
function verifySignature(req, res, next) {
  const signatureHeader = req.headers['x-signature'] || req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  // Expected format: sha256=hexDigest (if using GitHub‑style header)
  const receivedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  if (!req.rawBody) {
    return res.status(400).json({ error: 'Unable to read raw request body' });
  }

  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(req.rawBody);
  const expectedSignature = hmac.digest('hex');

  // Timing‑safe comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(receivedSignature, 'utf8'),
    Buffer.from(expectedSignature, 'utf8')
  );

  if (!valid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Webhook endpoint
app.post('/webhook', verifySignature, (req, res) => {
  const event = req.body;
  const eventId = event.id || req.headers['x-event-id'];

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  // Idempotency check
  if (processedEventIds.has(eventId)) {
    return res.status(200).json({ status: 'duplicate', message: 'Event already processed' });
  }

  // ----- Begin custom event processing -----
  try {
    // Example placeholder: log the event
    console.log('Processing event:', event);
    // TODO: add your business logic here
  } catch (err) {
    console.error('Error processing event:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
  // ----- End custom event processing -----

  processedEventIds.add(eventId);
  res.status(200).json({ status: 'success', message: 'Event processed' });
});

// Global error handler (optional)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});