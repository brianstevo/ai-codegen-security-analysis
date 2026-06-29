const express = require('express');
const router = express.Router();

router.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid url query parameter' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Only http and https URLs are allowed' });
    }

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const body = await response.text();

    res.status(response.status);
    res.set('content-type', contentType);
    return res.send(body);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch URL' });
  }
});

module.exports = router;