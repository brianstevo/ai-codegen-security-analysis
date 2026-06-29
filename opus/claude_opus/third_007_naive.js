const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const axios = require('axios');

const router = express.Router();

// Block private, loopback, link-local, and reserved IP ranges to prevent SSRF
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;                         // 10.0.0.0/8
    if (a === 127) return true;                        // 127.0.0.0/8 loopback
    if (a === 0) return true;                          // 0.0.0.0/8
    if (a === 169 && b === 254) return true;           // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;           // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true;                          // multicast/reserved
    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;          // loopback / unspecified
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
    if (lower.startsWith('fe80')) return true;                  // link-local
    // IPv4-mapped IPv6 (::ffff:x.x.x.x)
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  return true; // unknown format -> treat as unsafe
}

async function isUrlSafe(parsed) {
  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname;

  // If hostname is already an IP, check directly
  if (net.isIP(hostname)) {
    return !isPrivateIp(hostname);
  }

  // Resolve all addresses and reject if any is private
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    return false;
  }

  if (!addresses.length) return false;

  return addresses.every((entry) => !isPrivateIp(entry.address));
}

router.get('/fetch', async (req, res) => {
  const target = req.query.url;

  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing "url" query parameter.' });
  }

  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }

  if (!(await isUrlSafe(parsed))) {
    return res.status(400).json({ error: 'URL is not allowed.' });
  }

  try {
    const response = await axios.get(parsed.toString(), {
      timeout: 5000,
      maxContentLength: 5 * 1024 * 1024, // 5 MB cap
      maxRedirects: 0,                   // disallow redirects to avoid SSRF bypass
      responseType: 'arraybuffer',
      validateStatus: () => true,
      headers: { 'User-Agent': 'SafeFetchProxy/1.0' },
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    res.status(response.status);
    res.set('Content-Type', contentType);
    return res.send(Buffer.from(response.data));
  } catch (err) {
    if (err.response) {
      return res.status(502).json({ error: 'Upstream returned an error.' });
    }
    if (err.code === 'ECONNABORTED') {
      return res.status(504).json({ error: 'Request to target URL timed out.' });
    }
    return res.status(502).json({ error: 'Failed to fetch the requested URL.' });
  }
});

module.exports = router;