const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const app = express();
app.use(express.json());

const ALLOWED_DOMAINS = new Set([
  'example.com',
  'api.example.com',
  'jsonplaceholder.typicode.com',
]);

function isAllowedDomain(hostname) {
  const h = hostname.toLowerCase();
  for (const domain of ALLOWED_DOMAINS) {
    if (h === domain || h.endsWith(`.${domain}`)) return true;
  }
  return false;
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => ((acc << 8) + Number(oct)) >>> 0, 0);
}

function inCidr(ip, base, prefix) {
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

function isBlockedIPv4(ip) {
  // Private/local + metadata endpoint
  return (
    inCidr(ip, '10.0.0.0', 8) ||
    inCidr(ip, '172.16.0.0', 12) ||
    inCidr(ip, '192.168.0.0', 16) ||
    inCidr(ip, '127.0.0.0', 8) ||
    ip === '169.254.169.254'
  );
}

function isBlockedIPv6(ip) {
  const normalized = ip.toLowerCase();
  return (
    normalized === '::1' || // loopback
    normalized.startsWith('fc') || normalized.startsWith('fd') || // unique local fc00::/7
    normalized.startsWith('fe80:') || // link-local
    normalized === '::ffff:169.254.169.254'
  );
}

async function resolveAndValidateHost(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) throw new Error('Host did not resolve');

  for (const rec of records) {
    const ip = rec.address;
    const family = rec.family;

    if (family === 4) {
      if (isBlockedIPv4(ip)) {
        throw new Error(`Blocked IP resolved: ${ip}`);
      }
    } else if (family === 6) {
      if (isBlockedIPv6(ip)) {
        throw new Error(`Blocked IPv6 resolved: ${ip}`);
      }
    } else {
      throw new Error('Unknown IP family');
    }
  }
}

app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Protocol allowlist: HTTPS only
    if (parsed.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only https protocol is allowed' });
    }

    // Disallow credentials in URL to reduce abuse surface
    if (parsed.username || parsed.password) {
      return res.status(400).json({ error: 'Credentials in URL are not allowed' });
    }

    const hostname = parsed.hostname;
    if (!isAllowedDomain(hostname)) {
      return res.status(403).json({ error: 'Domain is not in whitelist' });
    }

    // Resolve host and block private/local/metadata IPs
    await resolveAndValidateHost(hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let upstreamResp;
    try {
      upstreamResp = await fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'error', // avoid bypass via redirects
        signal: controller.signal,
        headers: {
          'User-Agent': 'safe-fetch-service/1.0',
          'Accept': '*/*',
        },
      });
    } finally {
      clearTimeout(timeout);
    }

    const contentType = upstreamResp.headers.get('content-type') || 'text/plain; charset=utf-8';
    const bodyText = await upstreamResp.text();

    return res.status(upstreamResp.status).set('content-type', contentType).send(bodyText);
  } catch (err) {
    if (err && err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream request timed out after 5 seconds' });
    }
    return res.status(400).json({ error: err.message || 'Request failed' });
  }
});

// Optional startup for standalone usage
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;