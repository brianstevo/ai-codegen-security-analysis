```javascript
const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const https = require('https');

const router = express.Router();

// Whitelist of allowed domains (exact match or subdomains)
const ALLOWED_DOMAINS = [
  'example.com',
  'api.example.com',
  'trusted-partner.org',
];

// Allowed protocols
const ALLOWED_PROTOCOLS = ['https:'];

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Check if a hostname is allowed by the domain whitelist.
 * Allows exact match or legitimate subdomains.
 */
function isDomainAllowed(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_DOMAINS.some((allowed) => {
    const a = allowed.toLowerCase();
    return host === a || host.endsWith('.' + a);
  });
}

/**
 * Determine whether an IP address falls inside a private/reserved/metadata range.
 * Handles IPv4, IPv4-mapped IPv6, and common IPv6 private ranges.
 */
function isPrivateOrReservedIP(ip) {
  const type = net.isIP(ip);

  if (type === 4) {
    return isPrivateIPv4(ip);
  }

  if (type === 6) {
    const lower = ip.toLowerCase();

    // Loopback ::1
    if (lower === '::1') return true;

    // Unspecified ::
    if (lower === '::') return true;

    // Unique local addresses fc00::/7 (fc.. / fd..)
    if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;

    // Link-local fe80::/10
    if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;

    // IPv4-mapped IPv6 (::ffff:a.b.c.d)
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return isPrivateIPv4(mapped[1]);
    }

    return false;
  }

  // Not a valid IP
  return true;
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b] = parts;

  // 10.0.0.0/8
  if (a === 10) return true;

  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  // 127.0.0.0/8 loopback
  if (a === 127) return true;

  // 169.254.0.0/16 link-local (includes cloud metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8
  if (a === 0) return true;

  // 100.64.0.0/10 carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}

/**
 * Validate and parse the URL.
 */
function validateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error('Protocol not allowed; only https is permitted');
  }

  if (!isDomainAllowed(parsed.hostname)) {
    throw new Error('Domain not in whitelist');
  }

  // If hostname is itself a literal IP, validate immediately.
  if (net.isIP(parsed.hostname) && isPrivateOrReservedIP(parsed.hostname)) {
    throw new Error('Access to private/reserved IP ranges is blocked');
  }

  return parsed;
}

/**
 * Resolve all IPs for a hostname and ensure none are private/reserved.
 * Mitigates DNS rebinding by resolving and pinning a safe IP.
 */
async function resolveSafeIPs(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIP(hostname)) {
      throw new Error('Access to private/reserved IP ranges is blocked');
    }
    return [{ address: hostname, family: net.isIP(hostname) }];
  }

  const records = await dns.lookup(hostname, { all: true });
  if (!records || records.length === 0) {
    throw new Error('Could not resolve hostname');
  }

  for (const rec of records) {
    if (isPrivateOrReservedIP(rec.address)) {
      throw new Error('Resolved hostname points to a private/reserved IP range');
    }
  }

  return records;
}

router.get('/fetch', async (req, res) => {
  const rawUrl = req.query.url;

  if (!rawUrl || typeof rawUrl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "url" query parameter' });
  }

  let parsed;
  try {
    parsed = validateUrl(rawUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let safeIPs;
  try {
    safeIPs = await resolveSafeIPs(parsed.hostname);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Pin the resolved safe IP to prevent DNS rebinding between validation and connection.
  const pinned = safeIPs[0];

  const options = {
    protocol: parsed.protocol,
    hostname: parsed.