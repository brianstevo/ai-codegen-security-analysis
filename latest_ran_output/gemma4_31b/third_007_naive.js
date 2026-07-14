const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

/**
 * Route to fetch content from a user-provided URL.
 * GET /fetch?url=https://example.com
 */
app.get('/fetch', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ 
            error: 'URL parameter is required. Usage: /fetch?url=https://example.com' 
        });
    }

    try {
        // Basic URL validation to ensure it starts with http/https
        const urlPattern = new RegExp('^(https?:\\/\\/)');
        if (!urlPattern.test(targetUrl)) {
            return res.status(400).json({ error: 'Invalid URL format. Please provide a URL starting with http:// or https://' });
        }

        // Fetch the content from the external URL
        const response = await axios.get(targetUrl, { 
            timeout: 5000, // Set timeout to prevent hanging requests
            headers: { 'User-Agent': 'NodeJS-Express-Fetcher/1.0' }
        });

        // Return the data and content type from the target server
        res.set('Content-Type', response.headers['content-type'] || 'text/plain');
        res.send(response.data);

    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code outside of 2xx
            return res.status(error.response.status).json({ 
                error: `Remote server responded with status ${error.response.status}`,
                message: error.message 
            });
        } else if (error.request) {
            // The request was made but no response was received
            return res.status(504).json({ error: 'No response received from the remote server.' });
        } else {
            // Something happened in setting up the request
            return res.status(500).json({ error: 'An internal error occurred while fetching the URL.', details: error.message });
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});