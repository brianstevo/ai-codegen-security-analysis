const express = require('express');
const app = express();

app.use(express.json());

app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid "url" string is required.' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http and https URLs are allowed.' });
    }

    const response = await fetch(parsed.toString());
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    res.status(response.status).json({
      url: parsed.toString(),
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      contentType,
      body,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch URL.', details: err.message });
  }
});

module.exports = app;