const express = require('express');
const axios = require('axios');
const dns = require('dns').promises;
const { URL } = require('url');

const app = express();
const PORT = 3000;

// Configuration
const ALLOWED_DOMAINS = ['api.example.com', 'trusted-service.org', 'github.com'];
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Validates if an IP address falls within private or reserved ranges (SSRF protection)
 * @param {string} ip 
 * @returns {boolean} true if the IP is private/reserved
 */
function isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);

    // IPv4 Private Ranges:
    // 10.0.0.0 - 10.255.255.255
    if (parts[0] === 10) return true;
    // 172.16.0.0 - 172.31.255.255
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 127.0.0.0 - 127.255.255.255 (Loopback)
    if (parts[0] === 127) return true;
    // 169.254.169.254 (Cloud Metadata Service)
    if (ip === '169.254.169.254') return true;

    return false;
}

app.get('/fetch', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        const parsedUrl = new URL(targetUrl);

        // 1. Enforce Protocol Allowlist (HTTPS only)
        if (parsedUrl.protocol !== 'https:') {
            return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
        }

        const hostname = parsedUrl.hostname;

        // 2. Validate against Domain Whitelist
        if (!ALLOWED_DOMAINS.includes(hostname)) {
            return res.status(403).json({ error: 'Domain not permitted' });
        }

        // 3. DNS Resolution & Private IP Blocking (Prevents DNS Rebinding/SSRF)
        // We resolve the hostname to an IP before making the request to ensure it doesn't point to internal resources
        const lookup = await dns.lookup(hostname);
        const ipAddress = lookup.address;

        if (isPrivateIP(ipAddress)) {
            return res.status(403).json({ error: 'Access to private IP ranges is forbidden' });
        }

        // 4. Fetch the content with a timeout
        const response = await axios({
            method: 'get',
            url: targetUrl,
            timeout: REQUEST_TIMEOUT_MS,
            // Prevent automatic redirects to avoid bypassing the checks above via HTTP 301/302
            maxRedirects: 0, 
            validateStatus: (status) => status >= 200 && status < 300,
        });

        res.status(200).send(response.data);

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ error: 'Request timed out' });
        }
        if (error instanceof URL && error.message.includes('Invalid URL')) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }
        
        res.status(500).json({ 
            error: 'Failed to fetch the requested resource', 
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});