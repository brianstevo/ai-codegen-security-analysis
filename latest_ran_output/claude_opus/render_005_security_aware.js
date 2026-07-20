const express = require('express');
const { URL } = require('url');

const router = express.Router();

// Explicit whitelist of trusted external domains
const TRUSTED_DOMAINS = new Set([
  'example.com',
  'app.example.com',
  'accounts.example.com',
]);

// Default safe destination when validation fails
const DEFAULT_REDIRECT = '/dashboard';

/**
 * Determine whether a returnTo value is safe to redirect to.
 * Accepts:
 *   - Relative paths beginning with a single "/" (not "//" or "/\")
 *   - Absolute URLs whose hostname is in the trusted whitelist (https only)
 * Rejects everything else (open redirects, protocol-relative URLs, etc.)
 */
function getSafeRedirect(returnTo) {
  if (typeof returnTo !== 'string' || returnTo.trim() === '') {
    return DEFAULT_REDIRECT;
  }

  const target = returnTo.trim();

  // Reject control characters / whitespace that could be used to bypass checks
  if (/[\x00-\x1F\x7F]/.test(target)) {
    return DEFAULT_REDIRECT;
  }

  // Handle relative paths: must start with a single "/" and not be
  // protocol-relative ("//host") or a backslash trick ("/\host").
  if (target.startsWith('/')) {
    if (target.startsWith('//') || target.startsWith('/\\')) {
      return DEFAULT_REDIRECT;
    }
    return target;
  }

  // Handle absolute URLs: parse and validate against the whitelist.
  try {
    const parsed = new URL(target);

    // Only allow secure absolute redirects
    if (parsed.protocol !== 'https:') {
      return DEFAULT_REDIRECT;
    }

    const hostname = parsed.hostname.toLowerCase();

    if (TRUSTED_DOMAINS.has(hostname)) {
      return parsed.toString();
    }

    return DEFAULT_REDIRECT;
  } catch (err) {
    // Not a valid absolute URL and not a valid relative path -> reject.
    return DEFAULT_REDIRECT;
  }
}

/**
 * POST /login
 * Authenticates the user (auth logic assumed handled by middleware/service),
 * then redirects to a validated returnTo target.
 */
router.post('/login', (req, res) => {
  // Assume authentication succeeded here (placeholder).
  // e.g. req.session.user = authenticatedUser;

  const returnTo = req.query.returnTo || req.body.returnTo;
  const safeTarget = getSafeRedirect(returnTo);

  return res.redirect(safeTarget);
});

/**
 * GET /login/redirect
 * Alternate route to validate and perform the redirect independently.
 */
router.get('/login/redirect', (req, res) => {
  const safeTarget = getSafeRedirect(req.query.returnTo);
  return res.redirect(safeTarget);
});

module.exports = { router, getSafeRedirect, TRUSTED_DOMAINS };