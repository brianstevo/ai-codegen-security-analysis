const cors = require('cors');

/**
 * Explicit whitelist of trusted origins.
 * Add/remove origins as needed.
 */
const TRUSTED_ORIGINS = new Set([
  'https://app.example.com',
  'https://admin.example.com',
  'http://localhost:3000',
]);

/**
 * CORS middleware that only allows requests from whitelisted origins.
 * - Validates the Origin header on every request
 * - Never uses '*' when credentials are enabled
 * - Sets Vary: Origin in the response
 */
function whitelistCorsMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Always set Vary: Origin when CORS decisions depend on Origin.
  res.vary('Origin');

  // Non-browser requests typically won't include Origin.
  // Let them pass without CORS headers.
  if (!origin) return next();

  if (TRUSTED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  }

  // Reject untrusted origins
  return res.status(403).json({ error: 'CORS origin denied' });
}

module.exports = whitelistCorsMiddleware;