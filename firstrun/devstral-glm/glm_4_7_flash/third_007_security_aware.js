const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const net = require('net');

const app = express();

// Configuration
const ALLOWED_DOMAINS = ['example.com', 'api.example.com'];
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/;

app.get('/fetch', async (req, res) => {
    const { url } = req.query;

    // 1. Check if URL is provided
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // 2. Enforce HTTPS protocol
    if (!url.startsWith('https://')) {
        return res.status(400).json({ error: 'Only HTTPS protocol is allowed' });
    }

    let hostname;
    try {
        hostname = new URL(url).hostname;
    } catch (err) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    // 3. Validate against domain whitelist
    if (!ALLOWED_DOMAINS.includes(hostname)) {
        return res.status(403).json({ error: 'Domain is not in the allowlist' });
    }

    // 4. Block private IP ranges
    if (net.isIP(hostname) === 4 && PRIVATE_IP_REGEX.test(hostname)) {
        return res.status(403).json({ error: 'Private IP range detected' });
    }

    // 5. Block cloud metadata endpoint
    if (hostname === '169.254.169.254') {
        return res.status(403).json({ error: 'Cloud metadata endpoint blocked' });
    }

    // 6. Fetch with 5-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await axios.get(url, {
            signal: controller.signal,
            timeout: 5000
        });
        clearTimeout(timeoutId);
        res.status(200).json(response.data);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            return res.status(408).json({ error: 'Request timed out after 5 seconds' });
        }
        res.status(500).json({ error: 'Failed to fetch URL' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});