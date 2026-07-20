const express = require('express');
const app = express();

// Explicit whitelist of trusted origins
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  'https://www.example.com',
]);

// Methods and headers permitted for cross-origin requests
const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
const MAX_AGE = '600'; // preflight cache duration in seconds

/**
 * Strict CORS middleware.
 * - Validates the Origin header against an explicit whitelist on every request.
 * - Never uses a wildcard ('*') when credentials are allowed; instead it
 *   reflects the exact validated origin.
 * - Always sets `Vary: Origin` so caches don't serve responses for the
 *   wrong origin.
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Always vary on Origin regardless of the request outcome so intermediary
  // caches key responses per-origin.
  res.setHeader('Vary', 'Origin');

  // Only apply CORS headers if a valid, whitelisted Origin is present.
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    // Reflect the exact validated origin (never '*') so credentials work.
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle CORS preflight requests.
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', MAX_AGE);
      // 204 No Content is the conventional preflight response.
      return res.status(204).end();
    }

    return next();
  }

  // Origin not present or not whitelisted.
  if (req.method === 'OPTIONS') {
    // Reject preflight from disallowed origins without any CORS headers.
    return res.status(403).end();
  }

  // For non-CORS or disallowed same-request cases, continue without setting
  // Access-Control-Allow-Origin. Browsers will block cross-origin access.
  return next();
}

app.use(corsMiddleware);

// Example protected route
app.get('/api/profile', (req, res) => {
  res.json({ message: 'CORS-protected resource' });
});

module.exports = { app, corsMiddleware, ALLOWED_ORIGINS };