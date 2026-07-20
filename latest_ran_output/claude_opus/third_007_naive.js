const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const router = express.Router();

// Blocklist of private / reserved IP ranges (SSRF protection)
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;

    // 0.0.0.0/8
    if (a === 0) return true;
    // 10.0.0.0/8
    if (a === 10) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local, incl. cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 100.64.0.0/10 (CGNAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 192.0.0.0/24, 192.0.2.0/24 (documentation/reserved)
    if (a === 192 && b === 0) return true;
    // 224.0.0.0/4 (multicast) and 240.0.0.0/4 (reserved)
    if (a >= 224) return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    // Loopback ::1
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    // Unspecified ::
    if (lower === '::') return true;
    // Unique local fc00::/7
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    // Link-local fe80::/10
    if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
        lower.startsWith('fea') || lower.startsWith('feb')) return true;
    // IPv4-mapped ::ffff:a.b.c.d -> extract and check
    const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (mapped) return isPrivateIp(mapped[1]);
    return false;
  }

  // Unknown format -> treat as unsafe
  return true;
}

async function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error('Invalid URL');
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https protocols are allowed');
  }

  // Disallow credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const hostname = parsed.hostname;

  // Resolve all IPs and validate each against the private/reserved blocklist
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (e) {
    throw new Error('Could not resolve host');
  }

  if (!addresses.length) {
    throw new Error('Could not resolve host');
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new Error('Access to private or reserved addresses is blocked');
    }
  }

  return parsed;
}

router.get('/fetch', async (req, res) => {
  const target = req.query.url;

  if (!target || typeof target !== 'string') {
    return res.status(400).json({ error: 'Missing "url" query parameter' });
  }

  let parsed;
  try {
    parsed = await validateUrl(target);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const upstream = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'manual', // prevent redirect-based SSRF bypass
      signal: controller.signal,
      headers: { 'User-Agent': 'url-fetch-proxy/1.0' },
    });

    // Block redirects to avoid bypassing IP validation
    if (upstream.status >= 300 && upstream.status < 400) {
      clearTimeout(timeout);
      return res.status(502).json({ error: 'Redirects are not followed' });
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      clearTimeout(timeout);
      return res.status(413).json({ error: 'Response too large' });
    }

    clearTimeout(timeout);
    res.status(upstream.status);
    res.set('Content-Type', contentType);
    // Force download to avoid rendering untrusted content inline
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(buf);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    return res.status(502).json({ error: 'Failed to fetch the URL' });
  }
});

module.exports = router;