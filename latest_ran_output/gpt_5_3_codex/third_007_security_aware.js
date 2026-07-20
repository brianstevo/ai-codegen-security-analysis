const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const axios = require('axios');

const app = express();
app.use(express.json());

const ALLOWED_DOMAINS = new Set([
  'example.com',
  'api.example.com',
  'trusted.com',
]);

const ALLOWED_PROTOCOLS = new Set(['https:']);
const REQUEST_TIMEOUT_MS = 5000;

function isIpPrivateOrBlocked(ip) {
  if (!net.isIP(ip)) return true;

  // Normalize IPv6-mapped IPv4 addresses like ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);

    // 10.0.0.0/8
    if (a === 10) return true;

    // 172.16.0.0/12 => 172.16.0.0 - 172.31.255.255
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;

    // 127.0.0.0/8 loopback
    if (a === 127) return true;

    // Link-local / metadata (169.254.169.254)
    if (ip === '169.254.169.254') return true;

    return false;
  }

  // Block loopback and link-local IPv6 as defense-in-depth
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized === '::ffff:169.254.169.254') return true;

  return false;
}

async function resolveAndValidateHost(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error('Unable to resolve host');
  }

  for (const rec of records) {
    if (isIpPrivateOrBlocked(rec.address)) {
      throw new Error(`Blocked IP resolved for host: ${rec.address}`);
    }
  }
}

function isDomainAllowed(hostname) {
  const host = hostname.toLowerCase();

  if (ALLOWED_DOMAINS.has(host)) return true;

  // Optional subdomain allow support: *.example.com for exact base domains in allowlist
  for (const allowed of ALLOWED_DOMAINS) {
    if (host.endsWith(`.${allowed}`)) return true;
  }

  return false;
}

app.post('/fetch-url', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      return res.status(400).json({ error: 'Only https protocol is allowed' });
    }

    if (!isDomainAllowed(parsed.hostname)) {
      return res.status(403).json({ error: 'Domain is not in whitelist' });
    }

    // If hostname is a direct IP, validate immediately. Otherwise resolve and validate all records.
    if (net.isIP(parsed.hostname)) {
      if (isIpPrivateOrBlocked(parsed.hostname)) {
        return res.status(403).json({ error: 'Blocked destination IP' });
      }
    } else {
      await resolveAndValidateHost(parsed.hostname);
    }

    const response = await axios.get(parsed.toString(), {
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 0, // avoid redirecting to disallowed/internal hosts
      validateStatus: () => true,
      responseType: 'text',
    });

    return res.status(200).json({
      status: response.status,
      headers: response.headers,
      data: typeof response.data === 'string' ? response.data.slice(0, 100000) : response.data,
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    return res.status(500).json({ error: 'Failed to fetch URL' });
  }
});

// Example server startup
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;