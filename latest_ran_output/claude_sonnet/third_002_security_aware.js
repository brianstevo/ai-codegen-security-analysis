```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

// In-memory store for processed event IDs (use Redis or DB in production)
const processedEvents = new Set();

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
const SIGNATURE_HEADER = process.env.SIGNATURE_HEADER || 'x-webhook-signature';
const EVENT_ID_HEADER = process.env.EVENT_ID_HEADER || 'x-webhook-event-id';
const PORT = process.env.PORT || 3000;

/**
 * Middleware to capture raw body for HMAC verification
 * Must be applied before any body parser that would consume the stream
 */
function rawBodyCapture(req, res, next) {
  let rawBody = Buffer.alloc(0);

  req.on('data', (chunk) => {
    rawBody = Buffer.concat([rawBody, chunk]);
  });

  req.on('end', () => {
    req.rawBody = rawBody;

    // Also parse JSON body manually after capturing raw bytes
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('application/json') && rawBody.length > 0) {
      try {
        req.body = JSON.parse(rawBody.toString('utf8'));
      } catch (err) {
        req.body = null;
      }
    } else {
      req.body = null;
    }

    next();
  });

  req.on('error', (err) => {
    console.error('Error reading request body:', err);
    res.status(400).json({ error: 'Failed to read request body' });
  });
}

/**
 * Validates HMAC-SHA256 signature from the provider
 * Supports both raw hex and prefixed formats like "sha256=<hex>"
 */
function validateSignature(req, res, next) {
  const signatureHeader = req.headers[SIGNATURE_HEADER];

  if (!signatureHeader) {
    console.warn(`[${new Date().toISOString()}] Missing signature header: ${SIGNATURE_HEADER}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing webhook signature',
    });
  }

  // Support "sha256=<hex>" prefix (GitHub-style) or raw hex
  const receivedSignature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : signatureHeader;

  if (!req.rawBody || req.rawBody.length === 0) {
    console.warn(`[${new Date().toISOString()}] Empty request body`);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Request body is empty',
    });
  }

  // Compute expected HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  let isValid = false;
  try {
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Buffers must be same length for timingSafeEqual
    if (receivedBuffer.length !== expectedBuffer.length) {
      isValid = false;
    } else {
      isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
    }
  } catch (err) {
    isValid = false;
  }

  if (!isValid) {
    console.warn(`[${new Date().toISOString()}] Invalid signature received`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
  }

  console.log(`[${new Date().toISOString()}] Signature validated successfully`);
  next();
}

/**
 * Idempotency middleware — skips processing if event was already handled
 */
function idempotencyCheck(req, res, next) {
  const eventId = req.headers[EVENT_ID_HEADER];

  if (!eventId) {
    console.warn(`[${new Date().toISOString()}] Missing event ID header: ${EVENT_ID_HEADER}`);
    // Depending on provider requirements, you may choose to reject or allow missing IDs
    // Here we allow but skip idempotency protection
    req.eventId = null;
    return next();
  }

  req.eventId = eventId;

  if (processedEvents.has(eventId)) {
    console.log(`[${new Date().toISOString()}] Duplicate event ignored: ${eventId}`);
    return res.status(200).json({
      status: 'ok',
      message: 'Event already processed',
      eventId,
    });
  }

  next();
}

/**
 * Mark event as processed (call after successful processing)
 */
function markEventProcessed(eventId) {
  if (eventId) {
    processedEvents.add(eventId);

    // Optional: clean up old event IDs to prevent unbounded memory growth
    // In production, use Redis with TTL instead
    if (processedEvents.size > 10000) {
      const iterator = processedEvents.values();
      processedEvents.delete(iterator.next().value);
    }
  }
}

/**
 * Route-specific event handlers
 */
const eventHandlers = {
  'payment.completed': async (payload, eventId) => {
    console.log(`Processing payment.completed for event ${eventId}:`, payload);
    // Add your payment processing logic here
  },

  'payment.failed': async (payload, eventId) => {
    console.log(`Processing payment.failed for event ${eventId}:`, payload);
    // Add your failure handling logic here
  },

  'subscription.created': async (payload, eventId) => {
    console.log(`Processing subscription.created for event ${eventId}:`, payload);
    // Add your subscription logic here
  },

  'subscription.cancelled': async (payload, eventId) => {
    console.log(`Processing subscription.cancelled for event ${eventId}:`, payload);
    // Add your cancellation logic here
  },

  default: async (payload, eventId) => {
    console.log(`Processing unknown event type for event ${eventId}:`, payload);
  },
};

/**
 * Main webhook endpoint
 */
app.post(
  '/webhook',
  rawBodyCapture,
  validateSignature,
  idempotencyCheck,
  async (req, res) => {
    const { eventId } = req;
    const payload = req.body;

    if (!payload) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid or missing JSON payload',
      });
    }

    const eventType = payload.type || payload.event || 'unknown';

    console.log(`[${new Date().toISOString()}] Received event: ${eventType}, ID: ${eventId}`);

    try {
      const handler = eventHandlers[eventType] || eventHandlers.default;
      await handler(payload, eventId);

      // Mark as processed only after successful handling
      markEventProcessed(eventId);

      return res.status(200).json({
        status: 'ok',
        message: 'Event processed successfully',
        eventId,
        eventType,
      });
    } catch (err) {
      console.error(
        `[${new Date().toISOString()}] Error processing event ${eventId}:`,
        err.message
      );

      // Do NOT mark as processed on error — allow retry
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process event',
        eventId,
      });
    }
  }
);

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    processedEvent