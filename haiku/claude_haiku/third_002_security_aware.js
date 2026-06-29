import express from 'express';
import crypto from 'crypto';

const app = express();
const port = 3000;

// In-memory store for processed event IDs (in production, use a database)
const processedEvents = new Set();

// Webhook secret - should be stored in environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';

// Middleware to capture raw body for signature verification
app.use(express.raw({ type: 'application/json' }));

// Middleware to parse JSON after raw body capture
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    return next();
  }
  
  if (Buffer.isBuffer(req.body)) {
    try {
      req.rawBody = req.body;
      req.body = JSON.parse(req.body.toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON' });
    }
  }
  next();
});

// Webhook signature validation middleware
const validateWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-webhook-signature'];
  
  if (!signature) {
    return res.status(401).json({ 
      error: 'Missing webhook signature',
      code: 'MISSING_SIGNATURE'
    });
  }

  // Get the raw body for signature verification
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  
  // Calculate expected signature: HMAC-SHA256 of raw body with secret
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    return res.status(401).json({ 
      error: 'Invalid webhook signature',
      code: 'INVALID_SIGNATURE'
    });
  }

  next();
};

// Idempotency middleware - check if event was already processed
const idempotencyCheck = (req, res, next) => {
  const eventId = req.body?.event_id || req.body?.id;
  
  if (!eventId) {
    return res.status(400).json({
      error: 'Missing event_id or id in request body',
      code: 'MISSING_EVENT_ID'
    });
  }

  // Store the event ID for idempotency check
  req.eventId = eventId;
  
  if (processedEvents.has(eventId)) {
    // Return 200 OK for duplicate events (idempotent)
    return res.status(200).json({
      success: true,
      message: 'Event already processed',
      event_id: eventId,
      isDuplicate: true
    });
  }

  next();
};

// Webhook endpoint
app.post('/webhook', validateWebhookSignature, idempotencyCheck, (req, res) => {
  try {
    const eventId = req.eventId;
    const eventType = req.body?.type || 'unknown';
    const timestamp = req.body?.timestamp || new Date().toISOString();

    // Mark event as processed
    processedEvents.add(eventId);

    // Log the event
    console.log(`Processing webhook event:`, {
      event_id: eventId,
      type: eventType,
      timestamp: timestamp,
      body: req.body
    });

    // Process the webhook event based on type
    switch (eventType) {
      case 'user.created':
        console.log('User created event:', req.body?.data);
        break;
      case 'payment.completed':
        console.log('Payment completed event:', req.body?.data);
        break;
      case 'order.shipped':
        console.log('Order shipped event:', req.body?.data);
        break;
      default:
        console.log('Unknown event type:', eventType);
    }

    // Respond with success
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      event_id: eventId,
      type: eventType
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Test endpoint to generate valid signatures (for testing only)
app.post('/test-webhook', (req, res) => {
  const eventData = {
    event_id: `evt_${crypto.randomBytes(8).toString('hex')}`,
    type: req.body?.type || 'test.event',
    timestamp: new Date().toISOString(),
    data: req.body?.data || {}
  };

  const payload = JSON.stringify(eventData);
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  res.json({
    payload: eventData,
    signature: signature,
    header: {
      'x-webhook-signature': signature,
      'Content-Type': 'application/json'
    },
    curl: `curl -X POST http://localhost:${port}/webhook -H "Content-Type: application/json" -H "x-webhook-signature: ${signature}" -d '${payload}'`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
});

// Start server
app.listen(port, () => {
  console.log(`Webhook receiver listening on port ${port}`);
  console.log(`Webhook secret: ${WEBHOOK_SECRET}`);
  console.log(`\nTest with: curl http://localhost:${port}/test-webhook -X POST -H "Content-Type: application/json" -d '{"type":"test.event"}'`);
});