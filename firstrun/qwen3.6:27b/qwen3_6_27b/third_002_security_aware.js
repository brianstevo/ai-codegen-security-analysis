const express = require('express');
const crypto = require('crypto');
const app = express();

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret';
const PORT = process.env.PORT || 3000;

// In-memory store for processed event IDs (use a database in production)
const processedEvents = new Set();

// Middleware to parse raw body for signature verification
app.use(express.raw({ type: '*/*' }));

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    // Get the signature from headers (adjust header name based on provider)
    const signature = req.headers['x-webhook-signature'];
    
    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    // Verify HMAC-SHA256 signature
    const rawBody = req.body;
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    // Compare signatures securely
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the JSON body after verification
    let event;
    try {
      event = JSON.parse(rawBody.toString());
    } catch (parseError) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    // Check for idempotency using event ID
    const eventId = event.id || event.event_id;
    
    if (!eventId) {
      return res.status(400).json({ error: 'Missing event ID' });
    }

    if (processedEvents.has(eventId)) {
      // Event already processed, return success to acknowledge receipt
      return res.status(200).json({ status: 'already_processed' });
    }

    // Mark event as processed
    processedEvents.add(eventId);

    // Process the event based on its type
    await processEvent(event);

    // Respond with success
    res.status(200).json({ status: 'success' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Event processing function
async function processEvent(event) {
  // Implement your event handling logic here
  console.log(`Processing event: ${event.type} with ID: ${event.id}`);
  
  // Example: Handle different event types
  switch (event.type) {
    case 'payment.completed':
      // Handle payment completion
      break;
    case 'user.created':
      // Handle user creation
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on port ${PORT}`);
});

module.exports = app;