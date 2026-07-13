```javascript
const express = require('express');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');

const router = express.Router();

// Configuration
const ALLOWED_DOMAINS = [
  'api.example.com',
  'data.example.org',
  'public.example.net',
];

const ALLOWED_PROTOCOLS = ['https:'];

const REQUEST_TIMEOUT_MS = 5000;

const MAX_REDIRECTS = 0; // Disable redirects to prevent redirect-based SSRF

// Private and reserved IP ranges (CIDR-like checks)
const BLOCKED_IP_PATTERNS = [
  // Loopback
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // Private Class A
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  // Private Class B (172.16.0.0 - 172.31.255.255)
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/,
  // Private Class C
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  // Link-local / Cloud metadata (AWS, GCP, Azure)
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
  // APIPA
  /^0\.0\.0\.0$/,
  // Broadcast
  /^255\.255\.255\.255$/,
  // Multicast
  /^22[4-9]\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^23\d\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
];

// Also block by specific IP strings for cloud metadata
const BLOCKED_SPECIFIC_IPS = new Set([
  '169.254.169.254', // AWS/GCP/Azure metadata
  '100.100.100.200', // Alibaba Cloud metadata
  '192.0.2.1',      // TEST-NET
]);

/**
 * Check if an IP address is in a blocked range
 */
function isBlockedIP(ip) {
  if (!ip) return true;

  // Block IPv6 addresses except loopback check (::1)
  if (net.isIPv6(ip)) {
    // Allow only if you explicitly want IPv6 support; block all for safety
    return true;
  }

  if (!net.isIPv4(ip)) {
    return true; // Not a valid IP, block it
  }

  if (BLOCKED_SPECIFIC_IPS.has(ip)) {
    return true;
  }

  return BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

/**
 * Validate and parse the target URL
 */
function validateURL(rawURL) {
  let parsed;

  try {
    parsed = new URL(rawURL);
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  // Enforce allowed protocols
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return {
      valid: false,
      error: `Protocol "${parsed.protocol}" is not allowed. Only HTTPS is permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Reject if hostname is a raw IP address
  if (net.isIP(hostname)) {
    if (isBlockedIP(hostname)) {
      return { valid: false, error: 'Direct IP access is not permitted.' };
    }
    // Even if it's a public IP, reject it to enforce domain-based allowlist
    return {
      valid: false,
      error: 'Direct IP addresses are not allowed; use a whitelisted domain.',
    };
  }

  // Validate against allowed domains (exact match or subdomain match)
  const isAllowedDomain = ALLOWED_DOMAINS.some((allowed) => {
    return hostname === allowed || hostname.endsWith(`.${allowed}`);
  });

  if (!isAllowedDomain) {
    return {
      valid: false,
      error: `Domain "${hostname}" is not in the allowed domains list.`,
    };
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with credentials are not permitted.' };
  }

  return { valid: true, parsed };
}

/**
 * Resolve the hostname to IPs and verify none are in blocked ranges
 */
async function resolveAndCheckHostname(hostname) {
  let addresses;

  try {
    // Resolve all A records
    const result = await dns.resolve4(hostname);
    addresses = result;
  } catch (err) {
    throw new Error(`DNS resolution failed for "${hostname}": ${err.message}`);
  }

  if (!addresses || addresses.length === 0) {
    throw new Error(`No IP addresses found for "${hostname}".`);
  }

  for (const ip of addresses) {
    if (isBlockedIP(ip)) {
      throw new Error(
        `Resolved IP "${ip}" for hostname "${hostname}" is in a blocked range.`
      );
    }
  }

  return addresses;
}

/**
 * Perform the actual HTTPS request with timeout
 */
function performRequest(parsedURL) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedURL.hostname,
      port: parsedURL.port || 443,
      path: parsedURL.pathname + parsedURL.search,
      method: 'GET',
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        'User-Agent': 'SecureFetcher/1.0',
        Accept: 'application/json, text/plain, */*',
      },
      // Enforce TLS security
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      // Disable following redirects at the Node.js level
      maxRedirects: MAX_REDIRECTS,
    };

    const req = https.request(options, (res) => {
      // Block redirect responses to prevent SSRF via redirect
      if (res.statusCode >= 300 && res.statusCode < 400) {
        req.destroy();
        return reject(
          new Error(`Redirects are not permitted (status ${res.statusCode}).`)
        );
      }

      // Limit response size to prevent DoS (10 MB)
      const MAX_RESPONSE_SIZE = 10 * 1024 * 1024;
      let totalSize = 0;
      const chunks = [];

      res.on('data', (chunk) => {
        totalSize += chunk.length;
        if (totalSize > MAX_RESPONSE_SIZE) {
          req.destroy();
          return reject(new Error('Response size exceeds the 10 MB limit.'));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            'content-type': res.headers['content-type'],
            'content-length': res.headers['content-length'],
          },
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });

      res.on('error', reject);
    });

    // Handle socket timeout
    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms.`));
    });

    req.on('error', reject);

    req.end();
  });
}

/**
 * POST /fetch
 * Body: { "url": "https://api.example.com/data" }
 */
router.post('/fetch', async (req, res) => {
  const { url: rawURL } = req.body;

  if (!rawURL || typeof rawURL !== 'string') {
    return res.status(400).json({ error: 'A "url" string is required in