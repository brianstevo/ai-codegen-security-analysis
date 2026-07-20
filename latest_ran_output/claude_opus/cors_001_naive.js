const express = require('express');

const app = express();

/**
 * CORS Middleware
 *
 * Enables Cross-Origin Resource Sharing so other websites can call this API.
 *
 * SECURITY NOTE:
 * Instead of blindly reflecting every Origin or using a wildcard "*",
 * this middleware validates incoming Origins against an explicit allowlist.
 * This prevents untrusted sites from making credentialed requests to your API.
 *
 * To allow ALL origins for a public, non-credentialed API, set
 * ALLOW_ALL_ORIGINS = true (credentials will be disabled in that case,
 * per the CORS spec, since "*" cannot be combined with credentials).
 */

// Configure your trusted origins here (or via an env variable).
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || 'https://example.com,https://app.example.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Set to true only for fully public APIs with no credentials/cookies.
const ALLOW_ALL_ORIGINS = process.env.CORS_ALLOW_ALL === 'true';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type,Authorization,X-Requested-With';
const MAX_AGE_SECONDS = 600; // Cache preflight response for 10 minutes.

function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;

  // Always vary on Origin so caches don't serve the wrong CORS headers.
  res.setHeader('Vary', 'Origin');

  if (ALLOW_ALL_ORIGINS) {
    // Public API: wildcard origin, but credentials MUST be disabled.
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    // Reflect only trusted origins.
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    // Credentials (cookies, Authorization) permitted only for allowlisted origins.
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    // Origin not allowed: do not set CORS headers.
    // If it's a preflight from a disallowed origin, reject it clearly.
    if (req.method === 'OPTIONS') {
      return res.status(403).json({ error: 'Origin not allowed by CORS policy.' });
    }
    // For non-preflight requests, continue without CORS headers;
    // the browser will block the response from unauthorized origins.
    return next();
  }

  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Max-Age', String(MAX_AGE_SECONDS));

  // Short-circuit preflight (OPTIONS) requests with a 204.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

// Register the middleware globally.
app.use(corsMiddleware);

// Example route to verify CORS behavior.
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { app, corsMiddleware };