// server.js
const express = require('express');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const app = express();
app.use(express.json());

// Helper to validate and normalize URLs (allow only http/https)
function sanitizeUrl(input) {
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    // Prevent accessing internal IP ranges (basic SSRF mitigation)
    const hostname = url.hostname;
    if (/^(127\.0\.0\.1|localhost)$/.test(hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Stream the remote response directly to the client
app.post('/fetch', async (req, res) => {
  const { url: rawUrl } = req.body;

  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing "url" in request body.' });
  }

  const targetUrl = sanitizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ error: 'Invalid or disallowed URL.' });
  }

  // Choose appropriate module based on protocol
  const client = targetUrl.startsWith('https') ? https : http;

  try {
    client.get(targetUrl, (remoteRes) => {
      // Forward status code and headers (except hop-by-hop headers)
      const hopByHopHeaders = [
        'transfer-encoding',
        'connection',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade',
      ];
      remoteRes.headers && Object.entries(remoteRes.headers).forEach(([key, value]) => {
        if (!hopByHopHeaders.includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      });
      res.status(remoteRes.statusCode);

      // Pipe the response body directly
      remoteRes.pipe(res);
    }).on('error', (err) => {
      console.error('Fetch error:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to fetch the URL.' });
      }
    });
  } catch (e) {
    console.error('Unexpected error:', e);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Basic health check
app.get('/health', (_, res) => res.sendStatus(200));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fetch service listening on port ${PORT}`);
});