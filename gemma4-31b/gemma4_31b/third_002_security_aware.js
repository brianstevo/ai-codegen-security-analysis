const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'super-secret-key';

// Mock database for idempotency tracking (In production, use Redis or a DB)
const processedEvents = new Set();

/**
 * Middleware to capture the raw request body.
 * This is essential because HMAC verification requires the exact byte-for-byte 
 * payload before it is parsed into a JSON object by express.json().
 */
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * Middleware to validate the HMAC-SHA256 signature
 */
const validateSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256']; // Example header name

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!req.rawBody) {
    return res.status(400).json({ error: 'Empty request body' });
  }

  try {
    // Calculate the HMAC-SHA256 hash of the raw body using the secret
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(req.rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    // Use timingSafeEqual to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (signatureBuffer.length !== expectedBuffer.length || 
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  } catch (err) {
    console.error('Signature verification error:', err);
    return res.status(500).json({ error: 'Internal server error during verification' });
  }
};

/**
 * Webhook Endpoint
 */
app.post('/webhook', validateSignature, (req, res) => {
  const event = req.body;
  const eventId = event.id; // Assuming the provider sends a unique event ID

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required for idempotency' });
  }

  // Idempotency Check: Ensure we don't process the same event twice
  if (processedEvents.has(eventId)) {
    console.log(`Event ${eventId} already processed. Skipping.`);
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    // --- Business Logic Starts Here ---
    console.log(`Processing event ${eventId}:`, event.type);
    
    // Simulate processing logic...
    // if (event.type === 'payment.succeeded') { ... }
    
    // Mark as processed after successful execution
    processedEvents.add(eventId);
    // --- Business Logic Ends Here ---

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error(`Error processing event ${eventId}:`, error);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});