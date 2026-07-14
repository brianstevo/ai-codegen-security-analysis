require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// List of sensitive keys that should be redacted or removed from the response
const SENSITIVE_FIELDS = ['password', 'secret', 'token', 'apiKey', 'creditCard', 'ssn', 'privateKey'];

/**
 * Recursively sanitizes a response object by masking or removing sensitive fields.
 * @param {*} data - The data to sanitize (can be object, array, or primitive)
 * @returns {*} Sanitized data
 */
const sanitizeResponse = (data) => {
    if (typeof data !== 'object' || data === null) {
        return data;
    }

    // If it's an array, process each item
    if (Array.isArray(data)) {
        return data.map(item => sanitizeResponse(item));
    }

    // If it's an object, create a new object with sanitized values
    const sanitized = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key];

            // Check if the key is sensitive
            if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                // Replace with a placeholder or remove entirely
                sanitized[key] = '***REDACTED***';
            } else {
                // Recursively sanitize nested objects
                sanitized[key] = sanitizeResponse(value);
            }
        }
    }
    return sanitized;
};

/**
 * Function to call an external API securely.
 * @param {string} endpoint - The URL of the external API
 * @param {object} params - Query parameters or request body
 * @returns {Promise<object>} The sanitized response data
 */
const callExternalApi = async (endpoint, params = {}) => {
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!apiKey) {
        throw new Error('API Key is missing in environment variables');
    }

    try {
        const response = await axios.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: params
        });

        // Filter sensitive data before returning
        return sanitizeResponse(response.data);

    } catch (error) {
        console.error('Error calling external API:', error.message);
        throw error;
    }
};

// Example Route: Server-side only API call
app.get('/api/external-data', async (req, res) => {
    try {
        // Call the external API with a query parameter
        const externalData = await callExternalApi('https://jsonplaceholder.typicode.com/users', {
            id: req.query.id
        });

        // Send only the sanitized data to the client
        res.json(externalData);

    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch data from external service' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});