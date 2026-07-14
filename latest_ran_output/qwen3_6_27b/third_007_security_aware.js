const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const router = express.Router();

// Configuration
const ALLOWED_DOMAINS = ['example.com', 'api.example.com'];
const TIMEOUT_MS = 5000;

// Helper function to check if an IP is private or reserved
function isPrivateOrReservedIP(ip) {
    // Check for IPv4 private ranges and loopback
    const privateRanges = [
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^127\./,
        /^169\.254\./ // Cloud metadata endpoint
    ];

    return privateRanges.some(pattern => pattern.test(ip));
}

// Helper function to resolve hostname and validate IP
async function validateHostname(hostname) {
    const dns = require('dns').promises;
    
    try {
        // Resolve the hostname to get the actual IP address
        const addresses = await dns.resolve4(hostname);
        
        // Check all resolved IPs
        for (const ip of addresses) {
            if (isPrivateOrReservedIP(ip)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        // If DNS resolution fails, it's safer to block the request
        return false;
    }
}

router.get('/fetch', async (req, res) => {
    const { url: targetUrl } = req.query;

    if (!targetUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (error) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    // 1. Enforce allowlist of protocols (https only)
    if (parsedUrl.protocol !== 'https:') {
        return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
    }

    // 2. Validate URL against a whitelist of allowed domains
    const hostname = parsedUrl.hostname;
    if (!ALLOWED_DOMAINS.includes(hostname)) {
        return res.status(403).json({ error: 'Domain not in allowlist' });
    }

    // 3. Block requests to private IP ranges and cloud metadata endpoints
    const isSafe = await validateHostname(hostname);
    if (!isSafe) {
        return res.status(403).json({ error: 'Access to private or reserved IPs is blocked' });
    }

    // 4. Fetch the URL with a timeout of 5 seconds
    try {
        const response = await fetchWithTimeout(targetUrl, TIMEOUT_MS);
        
        // Read the response body
        let body = '';
        response.setEncoding('utf8');
        
        for await (const chunk of response) {
            body += chunk;
        }

        res.json({
            status: response.statusCode,
            headers: response.headers,
            body: body
        });
    } catch (error) {
        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({ error: 'Request timed out' });
        }
        return res.status(502).json({ error: 'Failed to fetch URL', details: error.message });
    }
});

// Helper function to make HTTP/HTTPS requests with timeout
function fetchWithTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const request = client.get(url, (response) => {
            // Clear the timeout on successful response
            clearTimeout(timeoutId);
            resolve(response);
        });

        request.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
            request.destroy();
            reject(new Error('Request timed out'));
        }, timeout);
    });
}

module.exports = router;