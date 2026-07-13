const express = require('express');
const crypto = require('crypto');

const app = express();

// Configuration - replace with your actual secret key from the webhook provider
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';

// In-memory store for processed event IDs (in production, use a database)
const processedEventIds = new Set();
const MAX_PROCESSED_EVENTS = 10000; // Limit to prevent memory issues

// Middleware to parse raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

/**
 * Validates HMAC-SHA256 signature from webhook provider
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature header value
 * @returns {boolean} - True if signature is valid, false otherwise
 */
function validateSignature(payload, signature) {
  if (!payload || !signature) {
    return false;
  }

  // Expected format: "sha256=..." (common for many providers)
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) {
    return false;
  }

  const providedSignature = signature.substring(expectedPrefix.length);
  
  // Calculate HMAC-SHA256
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
                     .update(payload, 'utf8')
                     .digest('hex');
  
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(providedSignature)
  );
}

/**
 * Middleware to validate webhook signature and process idempotently
 */
function webhookMiddleware(req, res, next) {
  // Get the raw body (already stored by express.json() verify function)
  const payload = req.rawBody;
  
  // Get signature from header - adjust header name based on provider (e.g., 'x-signature', 'X-Webhook-Signature')
  const signature = req.headers['x-hub-signature-256'] || 
                   req.headers['x-signature-sha256'] ||
                   req.headers['x-signature'];
  
  // Validate signature
  if (!validateSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse body to get event ID for idempotency check
  try {
    const body = typeof payload === 'string' ? JSON.parse(payload) : payload;
    
    if (!body.id) {
      return res.status(400).json({ error: 'Missing event ID' });
    }
    
    // Check idempotency
    if (processedEventIds.has(body.id)) {
      console.log(`Duplicate event ignored: ${body.id}`);
      return res.status(200).json({ status: 'duplicate', eventId: body.id });
    }
    
    // Add to processed set and enforce size limit
    if (processedEventIds.size >= MAX_PROCESSED_EVENTS) {
      // Remove oldest entries (in a real system, use TTL or database)
      const first = processedEventIds.values().next().value;
      processedEventIds.delete(first);
    }
    processedEventIds.add(body.id);
    
    // Store body for next middleware to access
    req.eventBody = body;
    next();
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
}

// Apply middleware to webhook endpoint
app.post('/webhook', webhookMiddleware, (req, res) => {
  const event = req.eventBody;
  
  // Process the event based on type and data
  try {
    console.log(`Processing event ${event.id} of type: ${event.type}`);
    
    // Example processing logic - replace with your actual business logic
    switch (event.type) {
      case 'payment.success':
        // Handle successful payment
        break;
      case 'user.created':
        // Handle new user creation
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.status(200).json({ status: 'success', eventId: event.id });
  } catch (error) {
    console.error('Error processing event:', error);
    // Return 5xx to allow webhook provider to retry
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', processedEventsCount: processedEventIds.size });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook receiver running on port ${PORT}`);
});