const express = require('express');
const crypto = require('crypto');

const app = express();

// Configuration - replace with your actual secret
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';

// In-memory store for processed event IDs (in production, use a database)
const processedEventIds = new Set();
const MAX_PROCESSED_EVENTS = 1000; // Limit to prevent memory issues

/**
 * Middleware to parse raw body for signature verification
 */
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

/**
 * Validate HMAC-SHA256 signature from request headers
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether the signature is valid
 */
function validateSignature(req) {
  const signatureHeader = req.headers['x-signature'];
  
  if (!signatureHeader || !req.rawBody) {
    return false;
  }

  // Extract signature (format typically "sha256=...")
  let signature = signatureHeader;
  if (signature.startsWith('sha256=')) {
    signature = signature.substring(7);
  } else if (signature.startsWith('SHA-256=')) {
    signature = signature.substring(8);
  }

  // Calculate expected signature
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const expectedSignature = hmac.digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Middleware to verify signature and process events idempotently
 */
app.use((req, res, next) => {
  // Skip validation for non-webhook routes (optional)
  if (req.path !== '/webhook') {
    return next();
  }

  // Validate signature
  if (!validateSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Extract event ID from request body
  const eventId = req.body?.id;
  
  if (!eventId) {
    return res.status(400).json({ error: 'Missing event ID' });
  }

  // Check for duplicate events (idempotency)
  if (processedEventIds.has(eventId)) {
    console.log(`Duplicate event ${eventId} - skipping processing`);
    return res.status(200).json({ status: 'duplicate', eventId });
  }

  // Add to processed set
  processedEventIds.add(eventId);
  
  // Clean up old events if needed (prevent memory issues)
  if (processedEventIds.size > MAX_PROCESSED_EVENTS) {
    const oldest = processedEventIds.values().next().value;
    processedEventIds.delete(oldest);
  }

  next();
});

/**
 * Webhook endpoint
 */
app.post('/webhook', (req, res) => {
  try {
    // Process the event here
    console.log('Processing webhook event:', req.body.id);
    
    // Your business logic goes here
    const eventType = req.body.type;
    const eventData = req.body.data;

    // Example processing based on event type
    switch (eventType) {
      case 'payment.success':
        // Handle successful payment
        break;
      case 'customer.created':
        // Handle new customer
        break;
      default:
        console.log(`Unknown event type: ${eventType}`);
    }

    res.status(200).json({ 
      status: 'success', 
      eventId: req.body.id,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      eventId: req.body?.id
    });
  }
});

// Error handling middleware for validation errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook receiver running on port ${PORT}`);
});