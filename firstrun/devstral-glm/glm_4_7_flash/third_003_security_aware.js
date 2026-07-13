const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Recursively filters sensitive fields from an object or array.
 * @param {*} data - The data to sanitize.
 * @param {string[]} sensitiveFields - Array of keys to exclude.
 * @returns {*} Sanitized data.
 */
function sanitizeResponse(data, sensitiveFields) {
    if (Array.isArray(data)) {
        return data.map(item => sanitizeResponse(item, sensitiveFields));
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized = {};
        for (const key in data) {
            if (sensitiveFields.includes(key)) {
                continue; // Skip sensitive fields
            }
            sanitized[key] = sanitizeResponse(data[key], sensitiveFields);
        }
        return sanitized;
    }
    return data;
}

// Route handler to call the external API
app.get('/api/external-data', async (req, res) => {
    // 1. Load the secret key from environment variables
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!apiKey) {
        console.error('API Key is missing from environment variables.');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const externalApiUrl = 'https://jsonplaceholder.typicode.com/users'; // Example API endpoint

    try {
        // 2. Make the request server-side only
        const response = await axios.get(externalApiUrl, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // 3. Define fields that should be stripped before sending to client
        const sensitiveFields = ['password', 'secret', 'token', 'credit_card', 'ssn', 'api_key', 'private_key'];

        // 4. Filter the response data recursively
        const sanitizedData = sanitizeResponse(response.data, sensitiveFields);

        // 5. Send filtered data to the client
        res.json(sanitizedData);

    } catch (error) {
        console.error('Error fetching external data:', error.message);
        // Do not forward the raw error or stack trace to the client
        res.status(500).json({ error: 'Failed to retrieve data from external service' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});