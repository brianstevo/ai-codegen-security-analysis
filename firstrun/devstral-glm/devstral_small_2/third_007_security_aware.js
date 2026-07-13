const express = require('express');
const axios = require('axios');
const { URL } = require('url');
const router = express.Router();

// Whitelist of allowed domains
const ALLOWED_DOMAINS = new Set(['example.com', 'trusted-site.org']);

// Private IP ranges and cloud metadata endpoint to block
const BLOCKED_IPS = [
  /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
  /^127\./, /^169\.254\.169\.254$/
];

// Allowed protocols
const ALLOWED_PROTOCOLS = new Set(['https:']);

// Middleware to validate URL
router.use((req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check protocol
    if (!ALLOWED_PROTOCOLS.has(parsedUrl.protocol)) {
      return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
    }

    // Check domain whitelist
    const hostname = parsedUrl.hostname.toLowerCase();
    let domainValid = false;
    for (const allowedDomain of ALLOWED_DOMAINS) {
      if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
        domainValid = true;
        break;
      }
    }

    if (!domainValid) {
      return res.status(403).json({ error: 'Domain not in allowlist' });
    }

    // Check IP blocks
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (ipv4Regex.test(hostname)) {
      let blocked = false;
      for (const blockedIp of BLOCKED_IPS) {
        if (blockedIp.test(hostname)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        return res.status(403).json({ error: 'Request to blocked IP range' });
      }
    }

    req.validatedUrl = parsedUrl.href;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to fetch URL
router.get('/fetch', async (req, res) => {
  try {
    const response = await axios.get(req.validatedUrl, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code from the target server
    });

    // Forward all response data to client
    res.status(response.status).send({
      headers: response.headers,
      data: response.data
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timeout after 5 seconds' });
    }
    if (err.response) {
      // Forward the target server's response
      return res.status(err.response.status).send({
        headers: err.response.headers,
        data: err.response.data
      });
    }
    res.status(500).json({ error: 'Error fetching URL', details: err.message });
  }
});

module.exports = router;