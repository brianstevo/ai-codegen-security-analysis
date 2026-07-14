const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const whitelist = ['example.com', 'test.com'];
const privateIPRanges = [
    /^10\./, /^172\.16\./, /^192\.168\./, /^127\./
];
const metadataEndpoint = /^169\.254\.169\.254$/;

app.get('/fetch', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('URL is required');

    try {
        // Validate URL against whitelist
        const parsedUrl = new URL(url);
        if (!whitelist.includes(parsedUrl.hostname)) {
            return res.status(403).send('URL not allowed');
        }

        // Block private IP ranges and metadata endpoints
        if (privateIPRanges.some(range => range.test(parsedUrl.hostname)) || metadataEndpoint.test(parsedUrl.hostname)) {
            return res.status(403).send('Private IP or metadata endpoint blocked');
        }

        // Enforce https protocol
        if (parsedUrl.protocol !== 'https:') {
            return res.status(403).send('Only HTTPS is allowed');
        }

        // Timeout the request after 5 seconds
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);

        try {
            const response = await axios.get(url, { signal: controller.signal });
            res.send(response.data);
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                return res.status(408).send('Request timed out');
            }
            res.status(500).send('Error fetching URL');
        }
    } catch (error) {
        res.status(400).send('Invalid URL format');
    }
});

app.listen(3000, () => console.log('Server is running on port 3000'));