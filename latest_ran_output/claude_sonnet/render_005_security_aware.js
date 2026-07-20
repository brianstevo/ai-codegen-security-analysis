```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { URL } = require('url');

const router = express.Router();

// --- Configuration ---
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRY = '1h';

// Explicit whitelist of trusted external domains (must include protocol)
const TRUSTED_DOMAINS = new Set([
  'https://app.example.com',
  'https://dashboard.example.com',
  'https://partner.trusted-domain.com',
]);

// Mock user store — replace with your database logic
const MOCK_USERS = [
  {
    id: 1,
    username: 'alice',
    // bcrypt hash of "password123"
    passwordHash: '$2b$12$KIx6IYbCVv4U4Zs1q1e8a.Q1Q4Q4Q4Q4Q4Q4Q4Q4Q4Q4Q4Q4Q4Q4',
  },
];

// --- Helpers ---

/**
 * Determines whether a redirect target is safe.
 *
 * Accepted targets:
 *   1. Relative paths that start with "/" but NOT "//" (protocol-relative URLs).
 *   2. Absolute URLs whose origin is listed in TRUSTED_DOMAINS.
 *
 * Rejected targets:
 *   - Protocol-relative URLs  ("//evil.com/…")
 *   - Absolute URLs to untrusted origins
 *   - Anything that is not a string or is empty
 *
 * @param {string} target
 * @returns {{ safe: boolean, reason?: string }}
 */
function validateRedirectTarget(target) {
  if (typeof target !== 'string' || target.trim() === '') {
    return { safe: false, reason: 'Empty or non-string target.' };
  }

  const trimmed = target.trim();

  // Reject protocol-relative URLs (e.g. "//evil.com")
  if (trimmed.startsWith('//')) {
    return { safe: false, reason: 'Protocol-relative URLs are not allowed.' };
  }

  // Accept relative paths (must start with "/" but not "//")
  if (trimmed.startsWith('/')) {
    // Extra guard: ensure there are no embedded newlines (header injection)
    if (/[\r\n]/.test(trimmed)) {
      return { safe: false, reason: 'Newline characters detected in redirect path.' };
    }
    return { safe: true };
  }

  // For everything else, attempt to parse as an absolute URL
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { safe: false, reason: 'Invalid URL format.' };
  }

  // Only allow http/https schemes
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: `Disallowed URL scheme: ${parsed.protocol}` };
  }

  // Check against the trusted-domain whitelist (compare origin, which includes protocol + host + port)
  const origin = parsed.origin; // e.g. "https://app.example.com"
  if (TRUSTED_DOMAINS.has(origin)) {
    return { safe: true };
  }

  return {
    safe: false,
    reason: `External domain "${parsed.hostname}" is not in the trusted-domain whitelist.`,
  };
}

/**
 * Resolves the final redirect URL.
 * Falls back to "/" if the provided returnTo is absent or unsafe.
 *
 * @param {string|undefined} returnTo
 * @returns {string}
 */
function resolveRedirect(returnTo) {
  if (!returnTo) return '/';

  const { safe } = validateRedirectTarget(returnTo);
  return safe ? returnTo : '/';
}

// --- Middleware ---

/**
 * Authenticate an incoming JWT (Bearer token or cookie).
 * Used to protect demonstration of the already-logged-in guard.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token =
    (authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7)) ||
    req.cookies?.token;

  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
}

// --- Routes ---

/**
 * POST /auth/login
 *
 * Body: { username, password }
 * Query: ?returnTo=<safe-redirect-target>
 *
 * On success: sets a JWT cookie and redirects to the validated returnTo
 *             (or "/" as a fallback).
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // --- returnTo validation happens BEFORE authentication to give early feedback,
    //     but the redirect itself only happens after successful auth. ---
    const rawReturnTo = req.query.returnTo;
    let redirectTarget = '/';

    if (rawReturnTo) {
      const { safe, reason } = validateRedirectTarget(rawReturnTo);
      if (!safe) {
        // Log and silently fall back — do NOT surface internal reasons to the client
        // to avoid giving attackers useful feedback.
        console.warn(`[login] Rejected unsafe returnTo="${rawReturnTo}": ${reason}`);
        redirectTarget = '/';
      } else {
        redirectTarget = rawReturnTo;
      }
    }

    // --- Look up user ---
    const user = MOCK_USERS.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    );

    // Use a constant-time comparison even for missing users to prevent user enumeration
    const DUMMY_HASH = '$2b$12$invalidhashpadding000000000000000000000000000000000000';
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // --- Issue JWT ---
    const payload = { sub: user.id, username: user.username };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Send token as an HttpOnly cookie (more secure than returning it in the body)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    // --- Redirect ---
    return res.redirect(302, redirectTarget);
  } catch (err) {
    console.error('[login] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * GET /auth/logout
 *
 * Clears the auth cookie and redirects to the login page.
 */
router.get('/auth/logout', (req, res) => {
  res.clearCookie('token');
  return res.redirect('/auth/login');
});

/**
 * GET /auth/validate-redirect  (utility / debugging endpoint)
 *
 * Query: ?returnTo=<target>
 *
 * Returns JSON describing whether the given target is safe.
 * You may want to remove or protect this in production.
 */
router.get('/auth/validate-redirect', (req, res) => {
  const { returnTo } = req.query;
  const result = validateRedirectTarget(returnTo);
  return res.json({