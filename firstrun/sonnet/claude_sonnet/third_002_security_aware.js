```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

// In-memory store for processed event IDs (use Redis/DB in production)
const processedEvents = new Map();

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-here';
const SIGNATURE_HEADER = process.env.SIGNATURE_HEADER || 'x-webhook-signature';
const EVENT_ID_HEADER = process.env.EVENT_ID_HEADER || 'x-webhook-event-id';
const SIGNATURE_PREFIX = process.env.SIGNATURE_PREFIX || 'sha256=';
const PORT = process.env.PORT || 3000;

// Maximum age for event IDs in the idempotency store (24 hours)
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Computes the HMAC-SHA256 signature for the given payload and secret.
 * @param {Buffer} payload - Raw request body buffer
 * @param {string} secret - Webhook secret
 * @returns {string} - Hex digest signature
 */
function computeSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Performs a constant-time comparison to prevent timing attacks.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {boolean} - Whether the strings match
 */
function safeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Middleware to capture the raw request body for signature verification.
 * Must be used before any body parsing middleware.
 */
function rawBodyMiddleware(req, res, next) {
  let data = [];

  req.on('data', (chunk) => {
    data.push(chunk);
  });

  req.on('end', () => {
    req.rawBody = Buffer.concat(data);
    next();
  });

  req.on('error', (err) => {
    console.error('Error reading request body:', err);
    res.status(400).json({ error: 'Failed to read request body' });
  });
}

/**
 * Middleware to validate the HMAC-SHA256 signature from the webhook provider.
 */
function validateSignature(req, res, next) {
  const signatureHeader = req.headers[SIGNATURE_HEADER];

  if (!signatureHeader) {
    console.warn(`[Webhook] Missing signature header: ${SIGNATURE_HEADER}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing webhook signature header',
    });
  }

  // Strip prefix if present (e.g., "sha256=abc123" -> "abc123")
  const receivedSignature = signatureHeader.startsWith(SIGNATURE_PREFIX)
    ? signatureHeader.slice(SIGNATURE_PREFIX.length)
    : signatureHeader;

  if (!receivedSignature || receivedSignature.length === 0) {
    console.warn('[Webhook] Empty signature value');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature format',
    });
  }

  const computedSignature = computeSignature(req.rawBody, WEBHOOK_SECRET);

  if (!safeCompare(receivedSignature, computedSignature)) {
    console.warn('[Webhook] Signature mismatch - request rejected');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid webhook signature',
    });
  }

  console.log('[Webhook] Signature validated successfully');
  next();
}

/**
 * Middleware to validate and extract the event ID from the request headers.
 */
function validateEventId(req, res, next) {
  const eventId = req.headers[EVENT_ID_HEADER];

  if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
    console.warn('[Webhook] Missing or invalid event ID header');
    return res.status(400).json({
      error: 'Bad Request',
      message: `Missing or invalid ${EVENT_ID_HEADER} header`,
    });
  }

  req.eventId = eventId.trim();
  next();
}

/**
 * Middleware to handle idempotency by checking if an event has already been processed.
 */
function idempotencyCheck(req, res, next) {
  const { eventId } = req;
  const existingEvent = processedEvents.get(eventId);

  if (existingEvent) {
    console.log(`[Webhook] Duplicate event detected: ${eventId} - returning cached response`);
    return res.status(200).json({
      message: 'Event already processed',
      eventId,
      processedAt: existingEvent.processedAt,
      duplicate: true,
    });
  }

  next();
}

/**
 * Parses the raw body as JSON.
 */
function parseJsonBody(req, res, next) {
  try {
    req.body = req.rawBody.length > 0 ? JSON.parse(req.rawBody.toString('utf8')) : {};
    next();
  } catch (err) {
    console.error('[Webhook] Failed to parse JSON body:', err.message);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON body',
    });
  }
}

/**
 * Marks an event as processed in the idempotency store.
 * In production, store this in Redis or a database with TTL support.
 * @param {string} eventId - The event ID to mark as processed
 * @param {object} metadata - Additional metadata to store
 */
function markEventAsProcessed(eventId, metadata = {}) {
  const record = {
    processedAt: new Date().toISOString(),
    ...metadata,
  };

  processedEvents.set(eventId, record);

  // Automatically clean up old event IDs after TTL
  setTimeout(() => {
    processedEvents.delete(eventId);
    console.log(`[Webhook] Cleaned up event ID from idempotency store: ${eventId}`);
  }, EVENT_TTL_MS);
}

/**
 * Processes a webhook event based on its type.
 * @param {string} eventType - The type of event
 * @param {object} payload - The event payload
 * @returns {object} - Processing result
 */
async function processEvent(eventType, payload) {
  console.log(`[Webhook] Processing event type: ${eventType}`);

  switch (eventType) {
    case 'payment.completed':
      return handlePaymentCompleted(payload);

    case 'payment.failed':
      return handlePaymentFailed(payload);

    case 'user.created':
      return handleUserCreated(payload);

    case 'subscription.updated':
      return handleSubscriptionUpdated(payload);

    default:
      console.warn(`[Webhook] Unknown event type: ${eventType}`);
      return { handled: false, message: `Unhandled event type: ${eventType}` };
  }
}

// Event handlers
async function handlePaymentCompleted(payload) {
  console.log('[Webhook] Handling payment.completed:', payload);
  // TODO: Update order status, send confirmation email, etc.
  return { handled: true, action: 'payment_recorded' };
}

async function handlePaymentFailed(payload) {
  console.log('[Webhook] Handling payment.failed:', payload);
  // TODO: Notify user, retry logic, etc.
  return { handled: true, action: 'failure_recorded' };
}

async function handleUserCreated(payload) {
  console.log('[Webhook] Handling user.created:', payload);
  // TODO: Send welcome email, provision resources, etc.
  return { handled: true, action: 'user_provisioned' };
}