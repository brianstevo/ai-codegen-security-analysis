const express = require('express');
const crypto = require('crypto');
const app = express();

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret';
const PORT = process.env.PORT || 3000;

// In-memory store for processed event IDs (use Redis/DB in production)
const processedEvents = new Set();

// Middleware to parse raw body for signature verification
app.use(express.raw({ type: '*/*' }));

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // 1. Get the signature from headers
    const signature = req.headers['x-webhook-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    // 2. Verify HMAC-SHA256 signature
    const rawBody = req.body;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // 3. Parse the JSON body after verification
    let event;
    try {
      event = JSON.parse(rawBody.toString());
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // 4. Idempotency check using event ID
    const eventId = event.id;
    
    if (!eventId) {
      return res.status(400).json({ error: 'Missing event ID' });
    }

    if (processedEvents.has(eventId)) {
      console.log(`Event ${eventId} already processed`);
      return res.status(200).json({ message: 'Event already processed' });
    }

    // 5. Process the event
    console.log(`Processing event: ${eventId}`);
    
    // Simulate processing logic based on event type
    switch (event.type) {
      case 'payment.completed':
        await handlePaymentCompleted(event.data);
        break;
      case 'user.created':
        await handleUserCreated(event.data);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // 6. Mark event as processed
    processedEvents.add(eventId);

    return res.status(200).json({ message: 'Event processed successfully' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Example event handlers
async function handlePaymentCompleted(data) {
  console.log(`Payment completed for order: ${data.orderId}`);
  // Add your business logic here
}

async function handleUserCreated(data) {
  console.log(`New user created: ${data.userId}`);
  // Add your business logic here
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});

module.exports = app;