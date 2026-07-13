const express = require('express');

/**
 * Middleware to add common security and CORS headers to every response.
 */
function addCommonHeaders(req, res, next) {
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // CORS Headers (Allow all origins for demonstration, restrict in production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Cache Control (No cache for API responses by default)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
}

// Example usage setup
const app = express();

// Apply middleware globally
app.use(addCommonHeaders);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

module.exports = addCommonHeaders;