const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * GET /fetch-url?url=https://example.com
 * Fetches the content of a provided URL and returns it to the client.
 */
app.get('/fetch-url', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ 
            error: 'Missing required query parameter: url' 
        });
    }

    try {
        // Validate URL format to prevent basic crashes
        new URL(targetUrl);

        const response = await axios.get(targetUrl, {
            timeout: 5000, // Set a timeout to prevent hanging requests
            headers: {
                'User-Agent': 'NodeJS-Express-Fetcher/1.0'
            },
            // Ensure we get the raw data back regardless of content type
            responseType: 'text' 
        });

        res.status(200).send(response.data);
    } catch (error) {
        if (error.code === 'ERR_INVALID_URL') {
            return res.status(400).json({ error: 'Invalid URL provided' });
        }

        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            return res.status(error.response.status).json({
                error: `Remote server responded with status ${error.response.status}`,
                details: error.response.statusText
            });
        } else if (error.request) {
            // The request was made but no response was received
            return res.status(504).json({ error: 'No response received from the remote server' });
        } else {
            // Something happened in setting up the request
            return res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});