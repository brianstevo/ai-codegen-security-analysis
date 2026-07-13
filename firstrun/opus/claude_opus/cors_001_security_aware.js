'use strict';

const express = require('express');

// Explicit whitelist of trusted origins.
// Add or remove entries here as needed.
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  'https://www.example.com',
]);

// Methods and headers you want to permit for cross-origin requests.
const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
const EXPOSED_HEADERS = 'Content-Length, X-Request-Id';
const MAX_AGE_SECONDS = 600; // Cache preflight result for 10 minutes.

/**
 * Strict CORS middleware.
 *
 * - Never emits a wildcard ('*') Origin when credentials are allowed.
 * - Validates the incoming Origin header against an explicit whitelist
 *   on every request.
 * - Always sets `Vary: Origin` so caches do not serve a response built
 *   for one origin to a different origin.
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Always vary on Origin so cached responses are not leaked across origins.
  res.append('Vary', 'Origin');

  // Only echo back the Origin if it is explicitly whitelisted.
  // We never use '*' because we allow credentials.
  const isAllowed = typeof origin === 'string' && ALLOWED_ORIGINS.has(origin);

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS);
  }

  // Handle CORS preflight requests.
  if (req.method === 'OPTIONS') {
    if (!isAllowed) {
      // Reject preflight from non-whitelisted origins.
      return res.status(403).end();
    }

    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    res.setHeader('Access-Control-Max-Age', String(MAX_AGE_SECONDS));

    // Vary on the preflight-specific request headers too.
    res.append('Vary', 'Access-Control-Request-Method');
    res.append('Vary', 'Access-Control-Request-Headers');

    // No body needed for a successful preflight.
    return res.status(204).end();
  }

  // For actual (non-preflight) requests from disallowed origins,
  // simply omit the CORS headers so the browser blocks the response.
  return next();
}

// Example usage.
const app = express();

app.use(corsMiddleware);
app.use(express.json());

app.get('/api/profile', (req, res) => {
  res.json({ ok: true, user: 'demo' });
});

app.post('/api/profile', (req, res) => {
  res.json({ ok: true, received: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { app, corsMiddleware, ALLOWED_ORIGINS };