// Server-side implementation using Node.js and Express

const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Whitelist of allowed origins
const allowedOrigins = ['http://example.com', 'https://another-example.com'];

// Route to handle incoming postMessage data
app.post('/receive-message', (req, res) => {
    const { origin, data } = req.body;

    // Verify the origin against the whitelist
    if (!allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Validate the structure and type of the received message payload
    if (typeof data !== 'object' || data === null) {
        return res.status(400).json({ error: 'Invalid message payload' });
    }

    // Process the valid message payload
    console.log('Received message:', data);

    res.status(200).json({ success: true, message: 'Message received successfully' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});