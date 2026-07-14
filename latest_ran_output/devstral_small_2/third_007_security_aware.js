const express = require('express');
const axios = require('axios');
const router = express.Router();
const dns = require('dns').promises;
const net = require('net');

// Whitelist of allowed domains
const ALLOWED_DOMAINS = new Set([
  'example.com',
  'trusted-site.org',
  'api.service.io'
]);

// Private IP ranges and cloud metadata endpoint
const PRIVATE_IP_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' }
];
const CLOUD_METADATA_IP = '169.254.169.254';

// Helper function to check if IP is in private range
function isPrivateIp(ip) {
  for (const range of PRIVATE_IP_RANGES) {
    const start = net.isIP(range.start);
    const end = net.isIP(range.end);
    if (start && end && ip >= start && ip <= end) return true;
  }
  return false;
}

// Route to fetch URL
router.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;

    // Validate input
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Parse and validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Check protocol
    if (parsedUrl.protocol !== 'https:') {
      return res.status(403).json({ error: 'Only HTTPS protocol is allowed' });
    }

    // Check domain against whitelist
    const hostname = parsedUrl.hostname;
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

    // Resolve DNS to check for private IPs
    let ipAddresses;
    try {
      ipAddresses = await dns.resolve(hostname);
    } catch (err) {
      return res.status(400).json({ error: 'DNS resolution failed' });
    }

    // Check each IP address
    for (const ip of ipAddresses) {
      if (isPrivateIp(ip) || ip === CLOUD_METADATA_IP) {
        return res.status(403).json({ error: 'Request to private or cloud metadata IP blocked' });
      }
    }

    // Make the request with timeout
    const response = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'URL-Fetcher/1.0' }
    });

    res.json({
      status: response.status,
      headers: response.headers,
      data: response.data
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timeout after 5 seconds' });
    }
    console.error('Fetch error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;