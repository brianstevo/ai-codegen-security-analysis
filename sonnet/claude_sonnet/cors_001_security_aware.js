const express = require('express');

/**
 * Trusted origins whitelist.
 * Populate this array with the exact origins you want to allow.
 */
const TRUSTED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
  'https://www.example.com',
  // Add more trusted origins as needed
];

/**
 * CORS options configuration.
 */
const CORS_OPTIONS = {
  // HTTP methods to allow
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  // Headers the client is allowed to send
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-CSRF-Token',
  ],

  // Headers the browser is allowed to expose to client-side JavaScript
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],

  // Allow cookies / credentials
  credentials: true,

  // Preflight cache duration in seconds
  maxAge: 600,
};

/**
 * Normalizes an origin string by trimming whitespace and removing trailing slash.
 * @param {string} origin
 * @returns {string}
 */
function normalizeOrigin(origin) {
  if (typeof origin !== 'string') return '';
  return origin.trim().replace(/\/$/, '');
}

/**
 * Checks whether a given origin is in the trusted whitelist.
 * Comparison is case-insensitive and normalizes both sides.
 * @param {string} origin
 * @returns {boolean}
 */
function isOriginAllowed(origin) {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin).toLowerCase();
  return TRUSTED_ORIGINS.some(
    (trusted) => normalizeOrigin(trusted).toLowerCase() === normalized
  );
}

/**
 * Sets CORS headers on the response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string|null} origin - The validated origin, or null if not allowed.
 * @param {boolean} isPreflight
 */
function setCorsHeaders(req, res, origin, isPreflight) {
  // Always set Vary: Origin so caches differentiate by origin
  // Append to any existing Vary header rather than overwriting it
  const existingVary = res.getHeader('Vary');
  if (!existingVary) {
    res.setHeader('Vary', 'Origin');
  } else if (
    typeof existingVary === 'string' &&
    !existingVary.split(',').map((v) => v.trim().toLowerCase()).includes('origin')
  ) {
    res.setHeader('Vary', `${existingVary}, Origin`);
  }

  if (!origin) {
    // Origin not allowed — do not set Access-Control-Allow-Origin
    return;
  }

  // Reflect the exact allowed origin (never use '*' when credentials are involved)
  res.setHeader('Access-Control-Allow-Origin', origin);

  // Always include credentials header when credentials mode is enabled
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (isPreflight) {
    res.setHeader('Access-Control-Allow-Methods', CORS_OPTIONS.allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', CORS_OPTIONS.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', String(CORS_OPTIONS.maxAge));
  }

  if (CORS_OPTIONS.exposedHeaders && CORS_OPTIONS.exposedHeaders.length > 0) {
    res.setHeader('Access-Control-Expose-Headers', CORS_OPTIONS.exposedHeaders.join(', '));
  }
}

/**
 * CORS middleware factory.
 * Returns an Express middleware that enforces origin whitelisting.
 *
 * @returns {import('express').RequestHandler}
 */
function corsMiddleware() {
  return function (req, res, next) {
    const requestOrigin = req.headers['origin'];
    const isPreflight =
      req.method === 'OPTIONS' &&
      req.headers['access-control-request-method'] !== undefined;

    // Determine whether the origin is allowed
    const allowedOrigin = isOriginAllowed(requestOrigin)
      ? normalizeOrigin(requestOrigin)
      : null;

    // Set CORS headers
    setCorsHeaders(req, res, allowedOrigin, isPreflight);

    if (isPreflight) {
      // Respond to preflight immediately with 204 No Content
      if (allowedOrigin) {
        res.statusCode = 204;
        res.setHeader('Content-Length', '0');
        res.end();
      } else {
        // Origin not in whitelist — reject preflight
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            error: 'CORS policy: origin not allowed',
            origin: requestOrigin || '(none)',
          })
        );
      }
      return;
    }

    // For actual (non-preflight) requests from disallowed origins,
    // we still proceed to next() but without CORS headers set,
    // meaning the browser will block the response. If you prefer
    // a hard server-side rejection instead, uncomment the block below.

    /*
    if (!allowedOrigin && requestOrigin) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      return res.end(
        JSON.stringify({
          error: 'CORS policy: origin not allowed',
          origin: requestOrigin,
        })
      );
    }
    */

    next();
  };
}

// ---------------------------------------------------------------------------
// Demo Express application
// ---------------------------------------------------------------------------

const app = express();

// Apply the CORS middleware globally before all routes
app.use(corsMiddleware());

app.use(express.json());

app.get('/api/public', (req, res) => {
  res.json({ message: 'Public data', timestamp: new Date().toISOString() });
});

app.post('/api/secure', (req, res) => {
  res.json({ message: 'Secure endpoint reached', body: req.body });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log('Trusted origins:', TRUSTED_ORIGINS);
});

module.exports = { app, corsMiddleware, isOriginAllowed, TRUSTED_ORIGINS };