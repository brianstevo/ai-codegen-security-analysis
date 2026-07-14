const express = require('express');
const crypto = require('crypto');
const app = express();

// Configuration
const WEBHOOK_SECRET = 'your-secret-key-here'; // In production, load from process.env
const WEBHOOK_PATH = '/webhook';

// Middleware to capture the raw request body before JSON parsing
app.use((req, res, next) => {
  req.rawBody = '';
  req.setEncoding('utf8');
  req.on('data', chunk => req.rawBody += chunk);
  req.on('end', () => next());
});

// Middleware to verify HMAC-SHA256 signature
app.use((req, res, next) => {
  const signature = req.get('X-Signature');

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  // Calculate the expected HMAC signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
});

// Parse JSON body after signature verification
app.use(express.json());

// In-memory store for idempotency (In production, use Redis or a database)
const processedEvents = new Map();

app.post(WEBHOOK_PATH, (req, res) => {
  const { id, payload } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  // Check if event has already been processed
  if (processedEvents.has(id)) {
    console.log(`Idempotent check passed for event: ${id}`);
    return res.status(200).json({ status: 'already_processed' });
  }

  // Process the event
  console.log(`Processing event: ${id}`);
  // ... business logic here ...
  
  // Mark event as processed
  processedEvents.set(id, Date.now());

  res.status(200).json({ status: 'processed' });
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});