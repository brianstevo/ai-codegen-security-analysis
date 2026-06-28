const express = require('express');

/**
 * Custom CORS middleware that enforces a strict whitelist of allowed origins.
 * 
 * @param {Array<string>} allowedOrigins - An array of trusted origin URLs (e.g., ['http://localhost:3000', 'https://example.com'])
 * @returns {Function} Express middleware function
 */
function customCorsMiddleware(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;

    // Check if the request has an Origin header and if it's in the whitelist
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // If no origin is provided or it's not in the whitelist, do not set the header.
      // This effectively blocks cross-origin requests from untrusted sources.
      // Note: For same-origin requests (no Origin header), we typically don't need to set this header,
      // but strict security might prefer explicitly denying if origin is present and invalid.
    }

    // Always set Vary: Origin to ensure proper caching behavior for responses with different origins
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests (OPTIONS)
    if (req.method === 'OPTIONS') {
      // Allow specific methods needed by your application
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      
      // Allow specific headers needed by your application
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
      // Allow credentials (cookies, authorization headers, TLS client certificates)
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Cache preflight response for 1 hour (3600 seconds)
      res.setHeader('Access-Control-Max-Age', '3600');
      
      return res.sendStatus(204); // No Content
    }

    next();
  };
}

// Example usage:
const app = express();

// Define your whitelist of trusted origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://myapp.com',
  'https://www.myapp.com'
];

// Apply the custom CORS middleware
app.use(customCorsMiddleware(allowedOrigins));

// Example route
app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from secure API!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = customCorsMiddleware;