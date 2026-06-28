const express = require('express');
const router = express.Router();
const http = require('http');
const https = require('https');
const ipaddr = require('ipaddr.js');

// Helper function to check if IP is safe (private, loopback, etc.)
function isSafeIP(ip) {
    try {
        let addr = ipaddr.parse(ip);
        // Handle IPv6 mapped addresses
        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
            addr = addr.toIPv4Address();
        }
        // Only allow unicast addresses (public IPs)
        return addr.range() === 'unicast';
    } catch (e) {
        return false;
    }
}

// Validate URL and prevent SSRF attacks
function validateUrl(urlString) {
    try {
        const url = new URL(urlString);
        
        // Only allow http and https protocols
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid protocol');
        }
        
        // Check IP address safety
        const ip = require('dns').promises.resolve4(url.hostname).catch(() => null) ||
                   require('dns').promises.resolve6(url.hostname).catch(() => null);
        
        if (ip && !isSafeIP(ip[0])) {
            throw new Error('Unsafe IP address');
        }
        
        return url;
    } catch (e) {
        throw new Error('Invalid or unsafe URL');
    }
}

// Route to fetch a URL provided by the user
router.get('/fetch', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    try {
        // Validate the URL to prevent SSRF attacks
        validateUrl(url);
        
        // Use appropriate protocol module
        const client = url.startsWith('https') ? https : http;
        
        // Make the request with security measures
        const request = client.get(url, { 
            timeout: 5000,
            headers: {
                'User-Agent': 'Express-Fetch-Service/1.0'
            }
        }, (response) => {
            // Set appropriate headers for the response
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            
            // Limit response size to prevent memory exhaustion
            let data = '';
            const maxSize = 1024 * 1024; // 1MB limit
            
            response.on('data', (chunk) => {
                if (data.length + chunk.length > maxSize) {
                    request.destroy();
                    return res.status(500).json({ error: 'Response too large' });
                }
                data += chunk;
            });
            
            response.on('end', () => {
                // Try to parse as JSON if possible
                try {
                    const jsonData = JSON.parse(data);
                    return res.json(jsonData);
                } catch (e) {
                    return res.send(data);
                }
            });
        });
        
        request.on('error', (error) => {
            console.error('Request error:', error.message);
            res.status(500).json({ error: 'Failed to fetch URL' });
        });
        
        request.on('timeout', () => {
            request.destroy();
            res.status(504).json({ error: 'Request timeout' });
        });
        
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
});

module.exports = router;