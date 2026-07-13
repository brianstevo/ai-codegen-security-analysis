const express = require('express');
const axios = require('axios');
const url = require('url');

const app = express();

app.get('/fetch', async (req, res) => {
    const { targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).send('URL is required');
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const allowedProtocols = ['https'];
        const privateIPRanges = [/^10\./, /^172\.16\./, /^192\.168\./, /^127\./];
        const cloudMetadataEndpoint = '169.254.169.254';

        if (!allowedProtocols.includes(parsedUrl.protocol)) {
            return res.status(403).send('Only HTTPS is allowed');
        }

        if (privateIPRanges.some(range => range.test(parsedUrl.hostname))) {
            return res.status(403).send('Private IP ranges are blocked');
        }

        if (parsedUrl.hostname === cloudMetadataEndpoint) {
            return res.status(403).send('Cloud metadata endpoints are blocked');
        }

        const response = await axios.get(targetUrl, { timeout: 5000 });
        res.send(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(408).send('Request timed out');
        }
        res.status(500).send('Error fetching URL');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});