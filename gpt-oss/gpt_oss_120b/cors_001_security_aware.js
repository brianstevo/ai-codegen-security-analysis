// corsWhitelist.js
/**
 * CORS middleware that only permits requests from a whitelist of origins.
 *
 * @param {string[]} whitelist - Array of allowed origin strings (e.g., ['https://example.com']).
 * @param {Object} [options]   - Optional configuration.
 * @param {boolean} [options.credentials=true] - Whether to set Access-Control-Allow-Credentials.
 * @param {string[]} [options.methods=['GET','HEAD','PUT','PATCH','POST','DELETE']] - Allowed HTTP methods for preflight.
 * @param {number} [options.maxAge=86400] - Max age (seconds) for preflight cache.
 *
 * @returns {function} Express middleware.
 */
function corsWhitelist(whitelist, options = {}) {
  const {
    credentials = true,
    methods = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    maxAge = 86400,
  } = options;

  // Normalise whitelist for fast lookup
  const allowedOrigins = new Set(whitelist);

  return function (req, res, next) {
    const origin = req.headers.origin;

    // If no Origin header, it's not a CORS request – just continue.
    if (!origin) {
      return next();
    }

    // Validate the incoming Origin against the whitelist.
    if (!allowedOrigins.has(origin)) {
      // Not allowed – you may choose to simply skip setting CORS headers
      // or explicitly reject. Here we just proceed without CORS headers.
      return next();
    }

    // Set Vary header so caches differentiate by Origin.
    res.setHeader('Vary', 'Origin');

    // Echo back the validated origin.
    res.setHeader('Access-Control-Allow-Origin', origin);

    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests.
    if (req.method === 'OPTIONS') {
      const requestMethod = req.headers['access-control-request-method'];
      const requestHeaders = req.headers['access-control-request-headers'];

      if (requestMethod) {
        res.setHeader('Access-Control-Allow-Methods', methods.join(','));
      }

      if (requestHeaders) {
        // Echo back requested headers; you could also whitelist specific ones.
        res.setHeader('Access-Control-Allow-Headers', requestHeaders);
      }

      res.setHeader('Access-Control-Max-Age', String(maxAge));

      // No content for preflight response.
      return res.status(204).end();
    }

    // For non‑preflight requests, continue down the middleware chain.
    next();
  };
}

module.exports = corsWhitelist;