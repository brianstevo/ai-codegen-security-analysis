```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { URL } = require('url');

const router = express.Router();

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '1h';

// Whitelist of trusted domains for redirects
const TRUSTED_DOMAINS = new Set([
  'app.example.com',
  'dashboard.example.com',
  'admin.example.com',
]);

// Mock user store (replace with real database)
const users = [
  {
    id: 1,
    username: 'testuser',
    // bcrypt hash of 'password123'
    passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i',
    role: 'user',
  },
];

/**
 * Validates a redirect target to prevent open redirect attacks.
 * Allows:
 *   - Relative paths starting with /
 *   - Absolute URLs pointing to trusted domains
 * Rejects:
 *   - External absolute URLs not in the whitelist
 *   - Protocol-relative URLs (e.g., //evil.com)
 *   - JavaScript or data URIs
 *   - Paths with encoded characters that could bypass validation
 *
 * @param {string} target - The redirect target to validate
 * @returns {{ valid: boolean, sanitized: string|null, reason?: string }}
 */
function validateRedirectTarget(target) {
  if (!target || typeof target !== 'string') {
    return { valid: false, sanitized: null, reason: 'No redirect target provided' };
  }

  // Decode URI components to catch encoded bypass attempts
  let decoded;
  try {
    // Decode multiple times to catch double-encoding
    decoded = decodeURIComponent(target);
    // Check for double encoding
    const doubleDecoded = decodeURIComponent(decoded);
    if (doubleDecoded !== decoded) {
      return { valid: false, sanitized: null, reason: 'Double-encoded characters detected' };
    }
  } catch {
    return { valid: false, sanitized: null, reason: 'Invalid URI encoding' };
  }

  // Reject protocol-relative URLs (e.g., //evil.com/path)
  if (/^\/\//.test(decoded)) {
    return { valid: false, sanitized: null, reason: 'Protocol-relative URLs are not allowed' };
  }

  // Reject dangerous schemes
  const dangerousSchemes = /^(javascript|data|vbscript|file|ftp):/i;
  if (dangerousSchemes.test(decoded)) {
    return { valid: false, sanitized: null, reason: 'Dangerous URL scheme detected' };
  }

  // Check if it's an absolute URL
  if (/^https?:\/\//i.test(decoded)) {
    try {
      const parsedUrl = new URL(decoded);
      const hostname = parsedUrl.hostname.toLowerCase();

      // Remove port for comparison if present
      const hostnameWithoutPort = hostname.split(':')[0];

      if (TRUSTED_DOMAINS.has(hostnameWithoutPort)) {
        return { valid: true, sanitized: decoded };
      }

      return {
        valid: false,
        sanitized: null,
        reason: `Domain '${hostnameWithoutPort}' is not in the trusted domains list`,
      };
    } catch {
      return { valid: false, sanitized: null, reason: 'Malformed absolute URL' };
    }
  }

  // Validate relative paths
  if (/^\/[^/]/.test(decoded) || decoded === '/') {
    // Ensure no null bytes or other control characters
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(decoded)) {
      return { valid: false, sanitized: null, reason: 'Control characters detected in path' };
    }

    // Prevent path traversal
    if (decoded.includes('..')) {
      return { valid: false, sanitized: null, reason: 'Path traversal detected' };
    }

    return { valid: true, sanitized: decoded };
  }

  return {
    valid: false,
    sanitized: null,
    reason: 'Redirect target must be a relative path starting with / or a trusted absolute URL',
  };
}

/**
 * Find user by username (replace with actual DB query)
 * @param {string} username
 * @returns {object|null}
 */
async function findUserByUsername(username) {
  return users.find((u) => u.username === username) || null;
}

/**
 * POST /auth/login
 *
 * Body: { username, password }
 * Query: { returnTo } - Optional redirect target after successful login
 *
 * On success: Sets JWT cookie and redirects to validated returnTo or default path
 * On failure: Returns 401 with error message
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic input validation
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ error: 'Username is required' });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Sanitize username input
    const sanitizedUsername = username.trim().toLowerCase();

    // Look up user
    const user = await findUserByUsername(sanitizedUsername);

    if (!user) {
      // Use consistent timing to prevent username enumeration
      await bcrypt.compare(password, '$2b$12$invalidhashtopreventtimingattacks00000000000000000000');
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRY,
        issuer: 'example.com',
        audience: 'example.com',
      }
    );

    // Set JWT as httpOnly cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour in milliseconds
    });

    // Validate returnTo parameter
    const returnTo = req.query.returnTo;
    const { valid, sanitized, reason } = validateRedirectTarget(returnTo);

    if (returnTo && !valid) {
      // Log the rejected redirect attempt for security monitoring
      console.warn('[Security] Rejected redirect attempt:', {
        username: sanitizedUsername,
        returnTo,
        reason,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      // Redirect to default instead of failing the login
      return res.redirect('/dashboard');
    }

    const redirectTarget = valid && sanitized ? sanitized : '/dashboard';

    // Log successful login
    console.info('[Auth] Successful login:', {
      username: sanitizedUsername,
      redirectTo: redirectTarget,
      ip: req.ip,
    });

    return res.redirect(302, redirectTarget);
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return res.status(500).json({ error: 'An internal server error occurred'