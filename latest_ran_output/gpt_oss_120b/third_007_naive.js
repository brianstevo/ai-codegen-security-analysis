// server.js
import express from 'express';
import { json } from 'body-parser';

// Node >=18 provides global fetch; for older versions uncomment the line below:
// import fetch from 'node-fetch';

const app = express();
app.use(json());

// POST /fetch   body: { "url": "https://example.com" }
app.post('/fetch', async (req, res) => {
  const { url } = req.body;

  // Basic validation
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url" field.' });
  }

  let parsed;
  try {
    parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
  } catch (e) {
    return res.status(400).json({ error: 'Provided value is not a valid HTTP/HTTPS URL.' });
  }

  try {
    const response = await fetch(parsed.toString());

    // Forward status code
    res.status(response.status);

    // Forward selected headers (content-type, content-disposition, etc.)
    const forwardHeaders = ['content-type', 'content-length', 'content-disposition'];
    forwardHeaders.forEach((header) => {
      const value = response.headers.get(header);
      if (value) res.setHeader(header, value);
    });

    // Stream the body directly to the client
    if (response.body) {
      response.body.pipe(res);
    } else {
      // Fallback for environments where response.body may be null
      const data = await response.arrayBuffer();
      res.end(Buffer.from(data));
    }
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(502).json({ error: 'Failed to fetch the requested URL.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});