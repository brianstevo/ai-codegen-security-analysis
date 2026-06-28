const express = require('express');
const crypto = require('crypto');
const app = express();

// Configuration
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-secret-key';
const WEBHOOK_PATH = '/webhook';

// Middleware to parse raw body as a buffer
app.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Middleware to verify HMAC-SHA256 signature
function verifySignature(req, res, next) {
    const signature = req.get('X-Hub-Signature-256');

    // Reject if signature header is missing
    if (!signature) {
        console.error('Missing signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    const body = req.body;
    
    // Calculate expected HMAC-SHA256 hash
    const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(body)
        .digest('hex');

    // Compare signatures securely using timingSafeEqual
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
        console.error('Invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
}

// In-memory storage for processed event IDs (Use a database in production)
const processedEvents = new Map();

// Main webhook handler
app.post(WEBHOOK_PATH, verifySignature, (req, res) => {
    try {
        // Parse the raw buffer to JSON
        const body = req.body.toString('utf-8');
        const event = JSON.parse(body);
        
        // Extract event ID
        const eventId = event.id;

        // Check for idempotency
        if (processedEvents.has(eventId)) {
            console.log(`Event ${eventId} already processed`);
            return res.status(200).json({ status: 'ok', message: 'Event already processed' });
        }

        // Process the event
        console.log(`Processing event: ${eventId}`);
        // TODO: Add your business logic here
        processedEvents.set(eventId, true);

        res.status(200).json({ status: 'ok', message: 'Event processed' });
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook server listening on port ${PORT}`);
});