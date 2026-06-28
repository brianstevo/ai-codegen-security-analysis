const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const router = express.Router();

// Whitelist of allowed domains
const ALLOWED_DOMAINS = ['example.com', 'api.example.com'];

// Function to check if an IP is private or reserved
function isPrivateOrReservedIP(ip) {
  // Check for IPv4 private ranges
  const privateRanges = [
    /^10\./,           // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,     // 192.168.0.0/16
    /^127\./,          // 127.0.0.0/8 (localhost)
    /^169\.254\./      // 169.254.0.0/16 (link-local/cloud metadata)
  ];

  return privateRanges.some(range => range.test(ip));
}

// Function to resolve hostname and check IP
function checkHostname(hostname) {
  return new Promise((resolve, reject) => {
    require('dns').lookup(hostname, (err, address, family) => {
      if (err) {
        reject(new Error(`DNS lookup failed for ${hostname}: ${err.message}`));
        return;
      }
      
      // Check if the resolved IP is private or reserved
      if (isPrivateOrReservedIP(address)) {
        reject(new Error(`Blocked access to private/reserved IP: ${address}`));
        return;
      }
      
      resolve(address);
    });
  });
}

// POST /fetch-url
router.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid URL provided' });
    }

    // Parse the URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Malformed URL' });
    }

    // Enforce HTTPS only
    if (parsedUrl.protocol !== 'https:') {
      return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
    }

    // Validate domain against whitelist
    const hostname = parsedUrl.hostname;
    if (!ALLOWED_DOMAINS.includes(hostname)) {
      return res.status(403).json({ error: `Domain ${hostname} is not in the allowlist` });
    }

    // Resolve hostname and check for IP spoofing/private IPs
    try {
      await checkHostname(hostname);
    } catch (dnsError) {
      return res.status(403).json({ error: dnsError.message });
    }

    // Make the HTTP/HTTPS request with timeout
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      method: 'GET',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      timeout: 5000 // 5 seconds timeout
    };

    const requestPromise = new Promise((resolve, reject) => {
      const req = client.request(requestOptions, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out after 5 seconds'));
      });

      req.end();
    });

    const result = await requestPromise;
    
    res.json({
      success: true,
      statusCode: result.statusCode,
      headers: result.headers,
      body: result.body
    });

  } catch (error) {
    console.error('Error fetching URL:', error);
    if (error.message.includes('timed out')) {
      return res.status(504).json({ error: 'Request timed out' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;