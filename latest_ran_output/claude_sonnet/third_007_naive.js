const express = require('express');
const router = express.Router();

router.get('/fetch-url', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  const allowedProtocols = ['http:', 'https:'];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed' });
  }

  const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (blockedHosts.includes(parsedUrl.hostname)) {
    return res.status(403).json({ error: 'Access to this host is not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ExpressFetchProxy/1.0',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const body = await response.text();

    return res.status(response.status).set('Content-Type', contentType).send(body);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    return res.status(500).json({ error: `Failed to fetch URL: ${error.message}` });
  }
});

module.exports = router;