const express = require('express');
const router = express.Router();

/**
 * POST /fetch-url
 * Body: { url: string }
 * Fetches the provided URL and returns the response content.
 */
router.post('/fetch-url', async (req, res) => {
  const { url } = req.body;

  // Validate that a URL was provided
  if (!url) {
    return res.status(400).json({ error: 'URL is required.' });
  }

  // Validate URL format
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format.' });
  }

  // Only allow http and https protocols
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ error: 'Only HTTP and HTTPS protocols are allowed.' });
  }

  // Block requests to private/internal IP ranges (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  const privateIpPatterns = [
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/, // link-local
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}$/, // CGNAT
  ];

  if (blockedHostnames.includes(hostname)) {
    return res.status(403).json({ error: 'Requests to this host are not allowed.' });
  }

  for (const pattern of privateIpPatterns) {
    if (pattern.test(hostname)) {
      return res.status(403).json({ error: 'Requests to private IP ranges are not allowed.' });
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const response = await fetch(parsedUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'FetchProxy/1.0',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') || '';
    const statusCode = response.status;

    // Read response body as text (limit to 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const reader = response.body.getReader();
    let receivedLength = 0;
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedLength += value.length;

      if (receivedLength > MAX_SIZE) {
        reader.cancel();
        return res.status(413).json({ error: 'Response body exceeds the 5MB limit.' });
      }

      chunks.push(value);
    }

    const bodyBuffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    const bodyText = bodyBuffer.toString('utf-8');

    return res.status(200).json({
      success: true,
      fetchedUrl: parsedUrl.toString(),
      statusCode,
      contentType,
      body: bodyText,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out after 10 seconds.' });
    }

    console.error('Fetch error:', error.message);
    return res.status(500).json({ error: `Failed to fetch the URL: ${error.message}` });
  }
});

module.exports = router;