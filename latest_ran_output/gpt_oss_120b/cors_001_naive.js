// corsMiddleware.js
/**
 * Express middleware to enable Cross-Origin Resource Sharing (CORS).
 *
 * Allows any origin by default and handles preflight OPTIONS requests.
 * Adjust the `allowedOrigins`, `allowedMethods`, and `allowedHeaders` arrays
 * as needed for tighter security.
 */
function corsMiddleware(options = {}) {
  const {
    allowedOrigins = ['*'],          // e.g., ['https://example.com']
    allowedMethods = ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders = [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization'
    ],
    allowCredentials = false,
    maxAge = 86400 // seconds
  } = options;

  // Helper to check if origin is permitted
  const isOriginAllowed = (origin) => {
    if (allowedOrigins.includes('*')) return true;
    return allowedOrigins.includes(origin);
  };

  return function(req, res, next) {
    const requestOrigin = req.headers.origin || req.headers.referrer;

    // Set Access-Control-Allow-Origin
    if (requestOrigin && isOriginAllowed(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else if (allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    // Optional credentials flag
    if (allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Set allowed methods & headers
    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(','));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(','));

    // Cache preflight response
    if (req.method === 'OPTIONS') {
      if (maxAge) {
        res.setHeader('Access-Control-Max-Age', String(maxAge));
      }
      return res.sendStatus(204); // No Content
    }

    next();
  };
}

module.exports = corsMiddleware;