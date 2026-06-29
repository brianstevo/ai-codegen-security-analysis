const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const router = express.Router();

const ALLOWED_DOMAINS = new Set([
  'example.com',
  'api.example.com',
  'www.example.com',
]);

const ALLOWED_PROTOCOLS = new Set(['https:']);
const REQUEST_TIMEOUT_MS = 5000;

function isPrivateIPv4(ip) {
  if (!net.isIP(ip)) return false;
  if (net.isIP(ip) !== 4) return false;

  const parts = ip.split('.').map(Number);
  const [a, b] = parts;

  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function isAllowedHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  if (ALLOWED_DOMAINS.has(normalized)) return true;

  for (const domain of ALLOWED_DOMAINS) {
    if (normalized.endsWith(`.${domain}`)) return true;
  }

  return false;
}

async function validateTargetUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('Only https protocol is allowed');
  }

  if (!parsed.hostname) {
    throw new Error('Missing hostname');
  }

  if (!isAllowedHostname(parsed.hostname)) {
    throw new Error('Domain not allowed');
  }

  const lookupResults = await dns.lookup(parsed.hostname, { all: true, verbatim: true });
  if (!lookupResults.length) {
    throw new Error('Unable to resolve host');
  }

  for (const result of lookupResults) {
    if (isPrivateIPv4(result.address)) {
      throw new Error('Resolved to a blocked IP range');
    }
  }

  return parsed;
}

router.get('/fetch-url', async (req, res) => {
  const target = req.query.url;

  if (typeof target !== 'string' || !target.trim()) {
    return res.status(400).json({ error: 'url query parameter is required' });
  }

  let parsed;
  try {
    parsed = await validateTargetUrl(target.trim());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        'User-Agent': 'SafeFetcher/1.0',
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      contentType,
      body,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    return res.status(502).json({ error: 'Failed to fetch URL' });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;