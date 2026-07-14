// server.js
const express = require('express');
const bodyParser = require('body-parser');
const dns = require('dns').promises;
const net = require('net');
const https = require('https');
const { URL } = require('url');
const { AbortController } = require('abort-controller');

const app = express();
app.use(bodyParser.json());

// ---- Configuration ----
const ALLOWED_DOMAINS = new Set([
  'example.com',
  'api.example.org',
  // add more allowed hostnames here (lowercase, no ports)
]);

// Private IPv4 ranges and metadata endpoint
const BLOCKED_IPV4_RANGES = [
  { start: ipToInt('10.0.0.0'), end: ipToInt('10.255.255.255') },
  { start: ipToInt('172.16.0.0'), end: ipToInt('172.31.255.255') },
  { start: ipToInt('192.168.0.0'), end: ipToInt('192.168.255.255') },
  { start: ipToInt('127.0.0.0'), end: ipToInt('127.255.255.255') },
  { start: ipToInt('169.254.169.254'), end: ipToInt('169.254.169.254') }, // AWS metadata
];

// Blocked IPv6 ranges (loopback and link‑local)
const BLOCKED_IPV6_RANGES = [
  { start: ipv6ToBigInt('::1'), end: ipv6ToBigInt('::1') },
  { start: ipv6ToBigInt('fe80::'), end: ipv6ToBigInt('febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff') }, // fe80::/10
];

// ---- Helper Functions ----
function ipToInt(ip) {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}
function ipv6ToBigInt(addr) {
  const sections = addr.split(':');
  let full = [];
  for (let i = 0; i < sections.length; i++) {
    if (sections[i] === '') {
      // expand ::
      const missing = 8 - sections.length + 1;
      full.push(...Array(missing).fill('0'));
    } else {
      full.push(sections[i]);
    }
  }
  return BigInt('0x' + full.map(s => s.padStart(4, '0')).join(''));
}
function isIpBlocked(ip) {
  if (net.isIP(ip) === 4) {
    const intIp = ipToInt(ip);
    return BLOCKED_IPV4_RANGES.some(r => intIp >= r.start && intIp <= r.end);
  } else if (net.isIP(ip) === 6) {
    const bigIp = ipv6ToBigInt(ip);
    return BLOCKED_IPV6_RANGES.some(r => bigIp >= r.start && bigIp <= r.end);
  }
  return true; // unknown format -> block
}
async function resolveAndValidateHost(hostname) {
  // Ensure hostname is in the allowlist (case‑insensitive)
  if (!ALLOWED_DOMAINS.has(hostname.toLowerCase())) {
    throw new Error('Hostname not allowed');
  }

  const addresses = await dns.lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isIpBlocked(address)) {
      throw new Error(`Resolved IP ${address} is blocked`);
    }
  }
}

// ---- Route Implementation ----
app.post('/fetch', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Enforce HTTPS only
  if (parsed.protocol !== 'https:') {
    return res.status(400).json({ error: 'Only https protocol is allowed' });
  }

  try {
    await resolveAndValidateHost(parsed.hostname);
  } catch (e) {
    return res.status(403).json({ error: e.message });
  }

  // Perform the request with a 5‑second timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  https.get(
    url,
    { signal: controller.signal },
    (resp) => {
      clearTimeout(timeout);
      let data = [];
      resp.on('data', (chunk) => data.push(chunk));
      resp.on('end', () => {
        const body = Buffer.concat(data).toString('utf8');
        res.status(resp.statusCode).set(resp.headers).send(body);
      });
    }
  ).on('error', (err) => {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out' });
    }
    res.status(502).json({ error: err.message });
  });
});

// ---- Server Startup ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));