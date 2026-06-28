// server.js
const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');

const app = express();
app.use(express.json());

// ----- Configuration -----
const ALLOWED_DOMAINS = [
  'example.com',
  'api.example.org'
]; // whitelist of domains (exact or sub‑domains allowed)

const REQUEST_TIMEOUT_MS = 5000; // 5 seconds

// ----- Helper Functions -----
function isAllowedDomain(hostname) {
  return ALLOWED_DOMAINS.some(allowed => {
    // allow exact match or sub‑domain (e.g., sub.example.com)
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });
}

function ipInRange(ip, rangeStart, rangeEnd) {
  const toNum = a => a.split('.').reduce((p, c) => p * 256 + Number(c), 0);
  const ipNum = toNum(ip);
  return ipNum >= toNum(rangeStart) && ipNum <= toNum(rangeEnd);
}

function isBlockedIP(ip) {
  // IPv4 only checks
  if (!net.isIPv4(ip)) return false;

  // Private ranges
  if (ipInRange(ip, '10.0.0.0', '10.255.255.255')) return true;
  if (ipInRange(ip, '172.16.0.0', '172.31.255.255')) return true;
  if (ipInRange(ip, '192.168.0.0', '192.168.255.255')) return true;
  // Loopback
  if (ipInRange(ip, '127.0.0.0', '127.255.255.255')) return true;
  // Cloud metadata endpoint
  if (ip === '169.254.169.254') return true;

  return false;
}

async function resolveAndValidateHost(hostname) {
  const addresses = await dns.lookup(hostname, { all: true });
  for (const addr of addresses) {
    if (isBlockedIP(addr.address)) {
      throw new Error('Resolved IP is blocked');
    }
  }
}

// ----- Route -----
app.get('/fetch', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only https protocol is allowed' });
  }

  // Domain whitelist check
  if (!isAllowedDomain(parsed.hostname)) {
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  try {
    // Resolve DNS and block private / metadata IPs
    await resolveAndValidateHost(parsed.hostname);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  // Perform the request with timeout, no redirects
  try {
    const response = await axios.get(targetUrl, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      validateStatus: null // forward any status code
    });

    // Forward content-type and other relevant headers (excluding hop‑by‑hop)
    const safeHeaders = {};
    if (response.headers['content-type']) safeHeaders['Content-Type'] = response.headers['content-type'];
    if (response.headers['content-disposition']) safeHeaders['Content-Disposition'] = response.headers['content-disposition'];

    res.set(safeHeaders);
    res.status(response.status).send(Buffer.from(response.data));
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    return res.status(502).json({ error: 'Failed to fetch the URL', details: err.message });
  }
});

// ----- Start Server -----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`URL fetcher listening on port ${PORT}`);
});