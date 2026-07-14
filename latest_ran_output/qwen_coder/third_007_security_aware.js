const express = require('express');
const axios = require('axios');
const url = require('url');

const app = express();
const whitelist = ['example.com', 'test.com'];
const privateIPRanges = [
    /^(10\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /^(172\.(1[6-9]|2\d|3[01])\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /^(192\.168\.){2}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /^127\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){2}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
];
const metadataIP = /^169\.254\.169\.254$/;

app.get('/fetch', async (req, res) => {
    const { url: requestedUrl } = req.query;
    if (!requestedUrl) return res.status(400).send('URL is required');

    try {
        const parsedUrl = new URL(requestedUrl);
        if (!whitelist.includes(parsedUrl.hostname)) return res.status(403).send('Domain not allowed');
        if (privateIPRanges.some(range => range.test(parsedUrl.hostname))) return res.status(403).send('Private IP address not allowed');
        if (metadataIP.test(parsedUrl.hostname)) return res.status(403).send('Cloud metadata endpoint not allowed');
        if (parsedUrl.protocol !== 'https:') return res.status(403).send('Only HTTPS protocol is allowed');

        const response = await axios.get(requestedUrl, { timeout: 5000 });
        res.send(response.data);
    } catch (error) {
        if (error.code === 'ECONNABORTED') return res.status(504).send('Request timed out');
        res.status(500).send('Error fetching URL');
    }
});

app.listen(3000, () => console.log('Server is running on port 3000'));