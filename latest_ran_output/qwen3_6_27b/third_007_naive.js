const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const router = express.Router();

// Helper function to validate URL
function isValidUrl(string) {
  try {
    const parsed = new URL(string);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

router.get('/fetch', (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format. Only http and https protocols are allowed.' });
  }

  const client = url.startsWith('https') ? https : http;

  client.get(url, (response) => {
    let data = '';

    // Check for redirect status codes and follow them if needed (simple implementation)
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      return res.status(400).json({ error: 'Redirects are not automatically followed for security reasons.' });
    }

    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      // Limit response size to prevent memory issues
      if (data.length > 1024 * 1024) { // 1MB limit
        return res.status(413).json({ error: 'Response too large' });
      }
      
      res.json({
        statusCode: response.statusCode,
        headers: response.headers,
        body: data
      });
    });

  }).on('error', (err) => {
    res.status(500).json({ error: 'Failed to fetch URL', details: err.message });
  });
});

module.exports = router;