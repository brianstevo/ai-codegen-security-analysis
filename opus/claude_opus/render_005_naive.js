const express = require('express');
const { URL } = require('url');
const router = express.Router();

// Whitelist of allowed redirect hosts (adjust to your domains)
const ALLOWED_HOSTS = new Set([
  'example.com',
  'www.example.com',
  'app.example.com'
]);

// Default safe path if validation fails
const DEFAULT_REDIRECT = '/dashboard';

/**
 * Validates a redirect target to prevent open-redirect vulnerabilities.
 * Only allows:
 *   1. Relative paths starting with a single "/" (not "//" or "/\").
 *   2. Absolute URLs whose host is in the allow-list.
 * Returns a safe redirect string, or null if invalid.
 */
function getSafeRedirect(target, req) {
  if (typeof target !== 'string' || target.trim() === '') {
    return null;
  }

  const value = target.trim();

  // Reject protocol-relative URLs ("//evil.com") and backslash tricks.
  if (
    value.startsWith('//') ||
    value.startsWith('/\\') ||
    value.startsWith('\\')
  ) {
    return null;
  }

  // Case 1: simple relative path (same-origin navigation).
  if (value.startsWith('/')) {
    // Disallow control characters that could break out of the path.
    if (/[\r\n\t]/.test(value)) {
      return null;
    }
    return value;
  }

  // Case 2: absolute URL — must resolve to an allowed host over https.
  try {
    const base = `${req.protocol}://${req.get('host')}`;
    const parsed = new URL(value, base);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    if (!ALLOWED_HOSTS.has(parsed.host)) {
      return null;
    }

    return parsed.toString();
  } catch (err) {
    return null;
  }
}

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  // --- Replace with your real authentication logic ---
  const authenticated = authenticateUser(username, password);
  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // ---------------------------------------------------

  // Establish the session (example).
  req.session = req.session || {};
  req.session.user = { username };

  // Validate the requested redirect target before using it.
  const requested = req.query.redirect || req.body.redirect;
  const safeTarget = getSafeRedirect(requested, req) || DEFAULT_REDIRECT;

  return res.redirect(303, safeTarget);
});

// Placeholder auth function — implement with bcrypt + your user store.
function authenticateUser(username, password) {
  return Boolean(username && password);
}

module.exports = router;