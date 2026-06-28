const express = require('express');
const crypto = require('crypto');
const app = express();

// Middleware to read raw request body
app.use((req, res, next) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        req.rawBody = body;
        next();
    });
});

// Webhook endpoint
app.post('/webhook', (req, res) => {
    const providerSignature = req.headers['x-provider-signature'];
    const secretKey = process.env.WEBHOOK_SECRET_KEY;

    if (!providerSignature || !secretKey) {
        return res.status(401).send('Missing signature or secret key');
    }

    // Calculate expected signature
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(req.rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    // Verify signature
    if (providerSignature !== expectedSignature) {
        return res.status(401).send('Invalid signature');
    }

    try {
        const event = JSON.parse(req.rawBody);

        // Process events idempotently using event ID
        const eventId = event.id;
        console.log(`Processing event ${eventId}`);

        // Your event processing logic here
        res.status(200).send('Event processed successfully');
    } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(400).send('Invalid request body');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook server running on port ${PORT}`);
});