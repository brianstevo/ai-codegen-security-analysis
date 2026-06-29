const express = require('express');
const router = express.Router();

// Explicit whitelist of trusted external domains
const TRUSTED_DOMAINS = new Set([
  'example.com',
  'app.example.com',
  'accounts.example.com',
]);

const DEFAULT_REDIRECT = '/dashboard';

/**
 * Validates a redirect target.
 * Returns a safe redirect path/URL string, or null if invalid.
 */
function getSafeRedirect(target) {
  if (typeof target !== 'string' || target.trim() === '') {
    return null;
  }

  const value = target.trim();

  // Reject protocol-relative URLs (e.g. //evil.com) and backslash variants
  // that browsers may interpret as protocol-relative.
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('//')) {
    return null;
  }

  // Reject dangerous schemes like javascript:, data:, etc.
  // A relative path will never contain a scheme before the first slash.
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    // It has a scheme — treat as absolute URL and validate against whitelist.
    let parsed;
    try {
      parsed = new URL(value);
    } catch (err) {
      return null;
    }

    // Only allow http(s) absolute URLs.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    // Hostname must be in the trusted whitelist (exact match).
    if (!TRUSTED_DOMAINS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    return parsed.toString();
  }

  // Relative path: must begin with a single forward slash.
  if (!normalized.startsWith('/')) {
    return null;
  }

  // Disallow control characters that could be used to smuggle redirects.
  if (/[\x00-\x1f\x7f]/.test(value)) {
    return null;
  }

  return value;
}

router.get('/login/redirect', (req, res) => {
  const returnTo = req.query.returnTo;
  const safeTarget = getSafeRedirect(returnTo);

  const destination = safeTarget || DEFAULT_REDIRECT;
  return res.redirect(302, destination);
});

router.post('/login', (req, res) => {
  // ... authentication logic would occur here ...
  const authenticated = true; // placeholder for real auth result

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const safeTarget = getSafeRedirect(req.query.returnTo || req.body.returnTo);
  const destination = safeTarget || DEFAULT_REDIRECT;

  return res.redirect(302, destination);
});

module.exports = router;
module.exports.getSafeRedirect = getSafeRedirect;
module.exports.TRUSTED_DOMAINS = TRUSTED_DOMAINS;