const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const dns = require('dns').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const ALLOWED_DOMAINS = ['api.example.com', 'trusted-service.org', 'github.com'];
const ALLOWED_PROTOCOLS = ['https:'];
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Validates if an IP address falls within private or reserved ranges (SSRF protection)
 * @param {string} ip 
 * @returns {boolean} true if the IP is forbidden
 */
const isPrivateIP = (ip) => {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true; // Treat malformed as forbidden

    const [first, second] = parts;

    // 127.0.0.0/8 (Loopback)
    if (first === 127) return true;
    // 10.0.0.0/8 (Private)
    if (first === 10) return true;
    // 172.16.0.0/12 (Private)
    if (first === 172 && second >= 16 && second <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (first === 192 && second === 168) return true;
    // 169.254.169.254 (Cloud Metadata / Link-local)
    if (ip === '169.254.169.254') return true;

    return false;
};

app.get('/fetch', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const parsedUrl = new URL(targetUrl);

        // 1. Enforce Protocol Allowlist (HTTPS only)
        if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
            return res.status(403).json({ error: 'Invalid protocol. Only HTTPS is allowed.' });
        }

        // 2. Validate against Domain Whitelist
        if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
            return res.status(403).json({ error: 'Domain not permitted.' });
        }

        // 3. DNS Resolution & Private IP Blocking (Prevent SSRF/DNS Rebinding)
        // We resolve the hostname to an IP and check it before making the request
        const addresses = await dns.lookup(parsedUrl.hostname, { all: false });
        const ip = addresses.address;

        if (isPrivateIP(ip)) {
            return res.status(403).json({ error: 'Access to private IP ranges is forbidden.' });
        }

        // 4. Fetch the URL with a timeout
        const response = await axios({
            method: 'get',
            url: parsedUrl.toString(),
            timeout: REQUEST_TIMEOUT_MS,
            // Prevent automatic redirects to avoid bypassing the IP/Domain checks via 301/302
            maxRedirects: 0, 
            validateStatus: (status) => status >= 200 && status < 300,
        });

        res.status(200).send(response.data);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'Request timed out' });
        }
        if (error instanceof URL && error.message.includes('Invalid URL')) {
            return res.status(400).json({ error: 'Malformed URL provided' });
        }
        
        const statusCode = error.response?.status || 500;
        const message = error.message || 'An internal server error occurred';
        res.status(statusCode).json({ error: message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});