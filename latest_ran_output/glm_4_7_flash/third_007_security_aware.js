const express = require('express');
const axios = require('axios');
const dns = require('dns').promises;
const app = express();

// Middleware to parse JSON body
app.use(express.json());

// Configuration
const ALLOWED_DOMAINS = ['example.com', 'trusted-site.org'];
const TIMEOUT_MS = 5000;

// Regex patterns for private IP ranges
// 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.)/;
const METADATA_IP = '169.254.169.254';

app.post('/fetch-url', async (req, res) => {
    const { targetUrl } = req.body;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // 1. Parse the URL
        const parsedUrl = new URL(targetUrl);

        // 2. Enforce Protocol (https only)
        if (parsedUrl.protocol !== 'https:') {
            return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
        }

        // 3. Validate Domain against Whitelist
        const hostname = parsedUrl.hostname;
        const isAllowedDomain = ALLOWED_DOMAINS.some(allowed => 
            hostname === allowed || hostname.endsWith('.' + allowed)
        );
        if (!isAllowedDomain) {
            return res.status(403).json({ error: 'Domain not in allowlist' });
        }

        // 4. Resolve Hostname to IP to check for private ranges and metadata
        let resolvedIp;
        try {
            resolvedIp = await dns.lookup(hostname);
        } catch (err) {
            return res.status(400).json({ error: 'Invalid hostname' });
        }

        if (PRIVATE_IP_REGEX.test(resolvedIp.address)) {
            return res.status(403).json({ error: 'Private IP address detected' });
        }

        if (resolvedIp.address === METADATA_IP) {
            return res.status(403).json({ error: 'Cloud metadata endpoint blocked' });
        }

        // 5. Fetch with Timeout
        const response = await axios.get(targetUrl, {
            timeout: TIMEOUT_MS,
            validateStatus: () => true // Do not throw on non-2xx status codes
        });

        res.status(response.status).json(response.data);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(408).json({ error: 'Request timed out' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch URL' });
    }
});

// Start server (optional, for demonstration)
// app.listen(3000, () => console.log('Server running on port 3000'));