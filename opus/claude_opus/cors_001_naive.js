const express = require('express');

const app = express();

/**
 * CORS middleware
 *
 * Enables Cross-Origin Resource Sharing so that other websites can call this API.
 *
 * SECURITY NOTE:
 * Using a wildcard origin ("*") allows ANY website to call your API. This is fine
 * for fully public, unauthenticated APIs, but it is dangerous if your API relies on
 * cookies/credentials. The spec forbids combining "*" with credentials, so this
 * implementation uses an allow-list of trusted origins and only reflects an origin
 * back when it is explicitly trusted. Configure ALLOWED_ORIGINS as needed.
 */

// Configure your trusted origins here (comma-separated env var or defaults).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'https://example.com']);

// Set to true only if you must support cookies/Authorization with credentials.
const ALLOW_CREDENTIALS = String(process.env.CORS_ALLOW_CREDENTIALS || 'false') === 'true';

const ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With';
const MAX_AGE_SECONDS = 600; // Cache preflight result for 10 minutes.

function corsMiddleware(req, res, next) {
  const requestOrigin = req.headers.origin;

  // Vary on Origin so caches don't serve the wrong CORS headers to different origins.
  res.header('Vary', 'Origin');

  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    // Reflect only explicitly trusted origins.
    res.header('Access-Control-Allow-Origin', requestOrigin);

    if (ALLOW_CREDENTIALS) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }

  res.header('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.header('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.header('Access-Control-Max-Age', String(MAX_AGE_SECONDS));

  // Short-circuit preflight (OPTIONS) requests.
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
}

// Apply globally before your routes.
app.use(corsMiddleware);

// Example route.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { app, corsMiddleware };