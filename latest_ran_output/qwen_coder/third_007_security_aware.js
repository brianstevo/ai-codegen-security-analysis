const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const whitelist = ['example.com', 'test.com'];
const privateIPRanges = [
    /^10\./, /^172\.16\./, /^192\.168\./, /^127\./
];
const cloudMetadataEndpoint = '169.254.169.254';

app.get('/fetch', async (req, res) => {
    const url = req.query.url;

    if (!url || !whitelist.some(domain => url.includes(domain))) {
        return res.status(403).send('URL not allowed');
    }

    if (privateIPRanges.some(range => range.test(url)) || url === cloudMetadataEndpoint) {
        return res.status(403).send('Private IP or metadata endpoint blocked');
    }

    if (!/^https:\/\//.test(url)) {
        return res.status(403).send('Only HTTPS URLs are allowed');
    }

    try {
        const response = await axios.get(url, { timeout: 5000 });
        res.send(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).send('Request timed out');
        }
        res.status(500).send('Error fetching URL');
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});