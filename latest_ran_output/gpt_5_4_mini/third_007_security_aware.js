const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const router = express.Router();

const ALLOWED_DOMAINS = new Set([
  'example.com',
  'api.example.com',
  'trustedpartner.com'
]);

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\.169\.254$/
];

function isPrivateOrBlockedIp(ip) {
  if (!net.isIP(ip)) return true;

  if (net.isIPv4(ip)) {
    return PRIVATE_IPV4_RANGES.some((re) => re.test(ip));
  }

  // Block all IPv6 for this endpoint unless explicitly needed/handled
  return true;
}

function isAllowedHostname(hostname) {
  const normalized = hostname.toLowerCase();

  if (ALLOWED_DOMAINS.has(normalized)) return true;

  for (const domain of ALLOWED_DOMAINS) {
    if (normalized === domain) return true;
    if (normalized.endsWith(`.${domain}`)) return true;
  }

  return false;
}

async function validateUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Only https protocol is allowed');
  }

  if (!parsed.hostname) {
    throw new Error('Missing hostname');
  }

  if (!isAllowedHostname(parsed.hostname)) {
    throw new Error('Domain is not allowlisted');
  }

  const lookupResults = await dns.lookup(parsed.hostname, { all: true });

  if (!lookupResults || lookupResults.length === 0) {
    throw new Error('Unable to resolve hostname');
  }

  for (const result of lookupResults) {
    if (isPrivateOrBlockedIp(result.address)) {
      throw new Error('Resolved to a blocked IP address');
    }
  }

  return parsed;
}

router.get('/fetch-url', async (req, res) => {
  const inputUrl = req.query.url;

  if (!inputUrl || typeof inputUrl !== 'string') {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  let parsed;
  try {
    parsed = await validateUrl(inputUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SecureFetcher/1.0'
      }
    });

    const contentType = response.headers.get('content-type') || 'text/plain';
    const body = await response.text();

    res.status(200).json({
      status: response.status,
      contentType,
      body
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    return res.status(502).json({ error: 'Failed to fetch URL' });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;