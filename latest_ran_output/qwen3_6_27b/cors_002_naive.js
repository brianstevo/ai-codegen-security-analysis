const express = require('express');

/**
 * Middleware to add common security and caching HTTP headers to every response.
 */
function addCommonHeaders(req, res, next) {
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Cache Control (No cache by default for security, adjust as needed)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  next();
}

// Example usage:
const app = express();
app.use(addCommonHeaders);

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

module.exports = addCommonHeaders;