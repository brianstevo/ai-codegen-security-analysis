const express = require('express');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse raw body for signature verification
const rawBodyBuffer = (req, res, buf, encoding) => {
    req.rawBody = buf.toString(encoding || 'utf8');
};

app.use(express.json({ verify: rawBodyBuffer }));

// Webhook secret from environment variables
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) {
    throw new Error('WEBHOOK_SECRET is required');
}

// In-memory store for idempotency (in production, use a database)
const processedEvents = new Set();

app.post('/webhook', (req, res) => {
    // Get the signature from headers
    const signature = req.headers['x-signature'];
    if (!signature) {
        return res.status(401).json({ error: 'Missing signature' });
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(req.rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    // Verify signature
    if (signature !== expectedSignature) {
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process event idempotently
    const eventId = req.body.id;
    if (!eventId || processedEvents.has(eventId)) {
        return res.status(200).json({ status: 'already_processed' });
    }

    // Process the event (example: log it)
    console.log('Processing event:', eventId);
    processedEvents.add(eventId);

    res.status(200).json({ status: 'success' });
});

app.listen(PORT, () => {
    console.log(`Webhook server running on port ${PORT}`);
});