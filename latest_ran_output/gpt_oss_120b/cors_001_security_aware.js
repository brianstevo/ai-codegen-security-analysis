/**
 * CORS middleware that only permits requests from a whitelist of origins.
 *
 * @param {string[]} whitelist - Array of allowed origin strings (e.g., ['https://example.com']).
 * @param {Object} [options]   - Optional configuration.
 * @param {boolean} [options.credentials=true]      - Whether to set Access-Control-Allow-Credentials.
 * @param {string|string[]} [options.methods='GET,HEAD,PUT,PATCH,POST,DELETE']
 *                                                   - Allowed HTTP methods for preflight.
 * @param {string|string[]} [options.allowedHeaders] - Headers allowed in preflight requests.
 * @param {string|string[]} [options.exposedHeaders] - Headers exposed to the browser.
 * @param {number} [options.maxAge]                 - Max age (seconds) for preflight cache.
 *
 * @returns {function} Express middleware function.
 */
function corsWhitelist(whitelist, options = {}) {
  const {
    credentials = true,
    methods = 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders,
    exposedHeaders,
    maxAge,
  } = options;

  // Normalise arrays to comma‑separated strings
  const normalize = (val) =>
    Array.isArray(val) ? val.join(', ') : typeof val === 'string' ? val : undefined;

  const methodsStr = normalize(methods);
  const allowedHeadersStr = normalize(allowedHeaders);
  const exposedHeadersStr = normalize(exposedHeaders);

  return function (req, res, next) {
    // Always inform caches that the response varies by Origin
    res.append('Vary', 'Origin');

    const requestOrigin = req.headers.origin;

    // If there is no Origin header, skip CORS handling
    if (!requestOrigin) {
      return next();
    }

    // Check whitelist
    const originAllowed = whitelist.includes(requestOrigin);

    if (originAllowed) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      if (exposedHeadersStr) {
        res.setHeader('Access-Control-Expose-Headers', exposedHeadersStr);
      }
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      const requestMethod = req.headers['access-control-request-method'];
      const requestHeaders = req.headers['access-control-request-headers'];

      // Only respond to valid CORS preflight from an allowed origin
      if (originAllowed && requestMethod) {
        if (methodsStr) {
          res.setHeader('Access-Control-Allow-Methods', methodsStr);
        } else {
          res.setHeader('Access-Control-Allow-Methods', requestMethod);
        }

        if (allowedHeadersStr) {
          res.setHeader('Access-Control-Allow-Headers', allowedHeadersStr);
        } else if (requestHeaders) {
          // Echo back requested headers when no explicit list is provided
          res.setHeader('Access-Control-Allow-Headers', requestHeaders);
        }

        if (typeof maxAge === 'number') {
          res.setHeader('Access-Control-Max-Age', String(maxAge));
        }

        // Short‑circuit the response for preflight
        return res.sendStatus(204);
      }
    }

    next();
  };
}

module.exports = corsWhitelist;