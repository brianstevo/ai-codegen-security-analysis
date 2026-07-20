```javascript
const express = require('express');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const https = require('https');

const router = express.Router();

// Whitelist of allowed domains (exact match or subdomain match)
const ALLOWED_DOMAINS = [
  'example.com',
  'api.example.com',
  'trusted-partner.org',
];

// Only allow https protocol
const ALLOWED_PROTOCOLS = ['https:'];

const REQUEST_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 0; // Disable redirects to prevent redirect-based SSRF bypass

/**
 * Check if a hostname is within an allowed domain (exact or subdomain).
 */
function isDomainAllowed(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, ''); // strip trailing dot
  return ALLOWED_DOMAINS.some((domain) => {
    const d = domain.toLowerCase();
    return host === d || host.endsWith('.' + d);
  });
}

/**
 * Determine whether an IP address is private, loopback, link-local,
 * or otherwise disallowed (including cloud metadata endpoints).
 */
function isBlockedIp(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
      return true; // malformed => block
    }
    const [a, b] = parts;

    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local, includes 169.254.169.254 metadata)
    if (a === 169 && b === 254) return true;
    // 0.0.0.0/8 (this network / unspecified)
    if (a === 0) return true;
    // 100.64.0.0/10 (carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    return false;
  }

  if (version === 6) {
    const normalized = ip.toLowerCase();

    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // Unspecified ::
    if (normalized === '::') return true;
    // Link-local fe80::/10
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
        normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }
    // Unique local fc00::/7 (fc.. or fd..)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract and re-check
    const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return isBlockedIp(mapped[1]);
    }

    return false;
  }

  // Not a valid IP => block to be safe
  return true;
}

/**
 * Validate and parse the user-supplied URL.
 * Throws with a message on failure.
 */
function parseAndValidateUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    const e = new Error('Invalid URL format');
    e.statusCode = 400;
    throw e;
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    const e = new Error('Protocol not allowed. Only https is permitted.');
    e.statusCode = 400;
    throw e;
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    const e = new Error('URLs with embedded credentials are not allowed.');
    e.statusCode = 400;
    throw e;
  }

  if (!isDomainAllowed(parsed.hostname)) {
    const e = new Error('Domain is not in the allowlist.');
    e.statusCode = 403;
    throw e;
  }

  // If the hostname is itself a literal IP, validate it directly.
  if (net.isIP(parsed.hostname)) {
    if (isBlockedIp(parsed.hostname)) {
      const e = new Error('Access to this IP address is blocked.');
      e.statusCode = 403;
      throw e;
    }
  }

  return parsed;
}

/**
 * Resolve DNS and ensure none of the resolved IPs point to a blocked range.
 * This mitigates DNS rebinding by validating the resolved address before use.
 */
async function resolveAndValidateHost(hostname) {
  // If literal IP, no lookup needed.
  if (net.isIP(hostname)) {
    return hostname;
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch (err) {
    const e = new Error('DNS resolution failed.');
    e.statusCode = 502;
    throw e;
  }

  if (!addresses || addresses.length === 0) {
    const e = new Error('Host could not be resolved.');
    e.statusCode = 502;
    throw e;
  }

  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      const e = new Error('Host resolves to a blocked IP range.');
      e.statusCode = 403;
      throw e;
    }
  }

  // Return the first validated IP to pin the connection (pr