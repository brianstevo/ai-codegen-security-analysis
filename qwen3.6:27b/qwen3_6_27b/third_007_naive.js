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
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  if (!isValidUrl(targetUrl)) {
    return res.status(400).json({ error: 'Invalid URL format. Only http and https are allowed.' });
  }

  const client = targetUrl.startsWith('https') ? https : http;

  client.get(targetUrl, (response) => {
    let data = '';

    // Check for redirect or non-success status codes if desired, 
    // but typically we might want to return the raw response body regardless of status.
    
    response.on('data', (chunk) => {
      data += chunk;
    });

    response.on('end', () => {
      res.status(response.statusCode).json({
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