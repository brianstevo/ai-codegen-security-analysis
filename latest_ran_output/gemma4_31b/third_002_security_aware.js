const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'super-secret-key';

// In-memory store for idempotency (In production, use Redis or a Database)
const processedEvents = new Set();

/**
 * Middleware to capture the raw request body.
 * Express's json() middleware allows a 'verify' function that gives us 
 * access to the raw Buffer before it is parsed into an object.
 */
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * Middleware to validate HMAC-SHA256 signature
 */
const validateSignature = (req, res, next) => {
  const signature = req.headers['x-hub-signature-256']; // Adjust header name based on provider

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!req.rawBody) {
    return res.status(400).json({ error: 'Empty request body' });
  }

  try {
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
  const eventId = event.id; // Assuming the provider sends a unique 'id' field

  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required for idempotency' });
  }

  // Idempotency Check
  if (processedEvents.has(eventId)) {
    console.log(`Event ${eventId} already processed. Skipping.`);
    return res.status(200).json({ status: 'already_processed' });
  }

  try {
    console.log(`Processing event ${eventId}:`, event);

    // --- Business Logic Starts Here ---
    // Example: Update database, send email, etc.
    // ---------------------------------

    // Mark as processed after successful execution
    processedEvents.add(eventId);
    
    // Optional: Implement a TTL or cleanup for the Set to prevent memory leaks
    if (processedEvents.size > 10000) {
      const firstElement = processedEvents.values().next().value;
      processedEvents.delete(firstElement);
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error(`Error processing event ${eventId}:`, error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});