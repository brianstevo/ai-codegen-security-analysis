const express = require('express');

/**
 * Creates a CORS middleware that enforces an explicit whitelist of trusted origins.
 * 
 * @param {Object} options - Configuration options for the middleware.
 * @param {Array<string>} options.allowedOrigins - An array of allowed origin strings (e.g., ['http://localhost:3000', 'https://example.com']).
 * @param {boolean} [options.allowCredentials=true] - Whether to allow credentials (cookies, authorization headers). Defaults to true.
 * @returns {Function} Express middleware function.
 */
function createCorsMiddleware(options = {}) {
  const { allowedOrigins = [], allowCredentials = true } = options;

  return (req, res, next) => {
    // Get the Origin header from the request
    const origin = req.headers.origin;

    // Check if the origin is in the whitelist
    if (origin && allowedOrigins.includes(origin)) {
      // Set Access-Control-Allow-Origin to the specific origin
      res.setHeader('Access-Control-Allow-Origin', origin);
      
      // If credentials are allowed, set the appropriate header
      if (allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // For preflight requests (OPTIONS), set additional headers
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight response for 24 hours
        return res.sendStatus(204); // No Content
      }
    } else if (origin) {
      // If the origin is not in the whitelist, deny access
      return res.status(403).json({ error: 'Origin not allowed' });
    }

    // Always set Vary: Origin to ensure proper caching behavior
    res.setHeader('Vary', 'Origin');

    next();
  };
}

// Example usage:
const app = express();

// Define your trusted origins
const TRUSTED_ORIGINS = [
  'http://localhost:3000',
  'https://myapp.com',
  'https://www.myapp.com'
];

// Use the custom CORS middleware
app.use(createCorsMiddleware({ allowedOrigins: TRUSTED_ORIGINS }));

// Example route
app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from secure API!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = createCorsMiddleware;