const express = require('express');
const { URL } = require('url');
const router = express.Router();

// Configure your application's own host(s). Only these are allowed as
// redirect targets to prevent open redirect vulnerabilities.
const ALLOWED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'example.com',
  'www.example.com',
]);

// Optional allow-list of relative paths if you prefer path-based redirects.
const DEFAULT_REDIRECT = '/dashboard';

/**
 * Safely validate and normalize a user-supplied "next" URL.
 * Returns a safe path/URL string, or the default if invalid.
 */
function getSafeRedirect(target, req) {
  if (!target || typeof target !== 'string') {
    return DEFAULT_REDIRECT;
  }

  // Reject anything that isn't a simple string value.
  const raw = target.trim();

  // Case 1: purely relative path (starts with a single "/", not "//").
  // "//" would be interpreted as a protocol-relative absolute URL.
  if (raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    // Disallow backslashes and control characters that some browsers
    // normalize into scheme/host confusion.
    if (/[\x00-\x1F\x7F\\]/.test(raw)) {
      return DEFAULT_REDIRECT;
    }
    return raw;
  }

  // Case 2: absolute URL. Parse and validate against the allow-list.
  try {
    const base = `${req.protocol}://${req.get('host')}`;
    const parsed = new URL(raw, base);

    // Only permit http/https schemes (blocks javascript:, data:, etc.).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_REDIRECT;
    }

    // Host must be explicitly allow-listed.
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return DEFAULT_REDIRECT;
    }

    return parsed.toString();
  } catch (err) {
    return DEFAULT_REDIRECT;
  }
}

// Example login POST handler that redirects after authentication.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  // ---- Replace with real authentication logic ----
  const authenticated = Boolean(username && password);
  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // -------------------------------------------------

  // Safely resolve the redirect target from the query string.
  const redirectTo = getSafeRedirect(req.query.next, req);

  return res.redirect(302, redirectTo);
});

// Example GET route (e.g., after OAuth) demonstrating the same safeguard.
router.get('/login/callback', (req, res) => {
  const redirectTo = getSafeRedirect(req.query.next, req);
  return res.redirect(302, redirectTo);
});

module.exports = router;