// webhook-server.js
const express = require('express');
const crypto = require('crypto');

// Configuration (replace with your actual secret)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret';

// Header names – adjust if your provider uses different ones
const SIGNATURE_HEADER = 'x-hub-signature-256'; // e.g., "sha256=..."
const EVENT_ID_HEADER = 'x-event-id'; // optional, fallback to payload.id

// In‑memory store for processed event IDs (use a persistent store in production)
const processedEventIds = new Set();

const app = express();

// Capture raw body for HMAC verification
app.use(express.raw({ type: '*/*', limit: '10mb' }));

/**
 * Middleware: verify HMAC‑SHA256 signature.
 */
function verifySignature(req, res, next) {
  const signatureHeader = req.headers[SIGNATURE_HEADER];
  if (!signatureHeader) {
    return res.status(401).send('Missing signature header');
  }

  // Expected format: "sha256=abcdef..."
  const [algo, receivedSig] = signatureHeader.split('=');
  if (algo !== 'sha256' || !receivedSig) {
    return res.status(401).send('Invalid signature format');
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(req.body);
  const expectedSig = hmac.digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const receivedBuf = Buffer.from(receivedSig, 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    return res.status(401).send('Invalid signature');
  }

  next();
}

/**
 * Main webhook endpoint.
 */
app.post('/webhook', verifySignature, (req, res) => {
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch (e) {
    return res.status(400).send('Invalid JSON');
  }

  // Determine event ID – prefer header, fallback to payload.id
  const eventId =
    req.headers[EVENT_ID_HEADER] ||
    (payload && typeof payload.id === 'string' ? payload.id : null);

  if (!eventId) {
    return res.status(400).send('Missing event identifier');
  }

  // Idempotency check
  if (processedEventIds.has(eventId)) {
    // Already processed – acknowledge without re‑handling
    return res.status(200).json({ status: 'duplicate', eventId });
  }

  // Mark as processed *before* handling to avoid race conditions
  processedEventIds.add(eventId);

  // ----- Your business logic here -----
  handleEvent(payload)
    .then(() => {
      res.status(200).json({ status: 'processed', eventId });
    })
    .catch(err => {
      // On error, optionally remove from set to allow retry
      processedEventIds.delete(eventId);
      console.error('Error handling webhook:', err);
      res.status(500).send('Internal Server Error');
    });
});

/**
 * Example async handler – replace with real implementation.
 */
async function handleEvent(event) {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('Handled event:', event);
}

// Export the app (useful for testing)
module.exports = app;

// If run directly, start listening
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Webhook receiver listening on port ${PORT}`);
  });
}