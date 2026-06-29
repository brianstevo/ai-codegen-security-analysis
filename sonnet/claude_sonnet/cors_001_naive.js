const express = require('express');
const app = express();

// CORS Middleware
const corsMiddleware = (req, res, next) => {
  // Get the origin from the request headers
  const origin = req.headers.origin;

  // Define allowed origins - customize this list as needed
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://yourdomain.com',
    'https://www.yourdomain.com',
  ];

  // Check if the request origin is in the allowed origins list
  // Use '*' to allow all origins, or check against the allowedOrigins array
  const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true';

  if (allowAllOrigins) {
    // Allow all origins
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    // Allow specific origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Vary header tells browsers the response varies based on origin
    res.setHeader('Vary', 'Origin');
  }

  // Allow specific HTTP methods
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
  );

  // Allow specific headers in requests
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, X-Custom-Header'
  );

  // Allow credentials (cookies, authorization headers)
  // Note: Cannot use wildcard '*' for origin when credentials are true
  if (!allowAllOrigins) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Cache preflight response for 24 hours (in seconds)
  res.setHeader('Access-Control-Max-Age', '86400');

  // Expose specific headers to the browser
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining'
  );

  // Handle preflight OPTIONS requests
  // Browsers send an OPTIONS request before actual cross-origin requests
  if (req.method === 'OPTIONS') {
    // Respond with 204 No Content for preflight requests
    return res.sendStatus(204);
  }

  // Continue to the next middleware or route handler
  next();
};

// Apply the CORS middleware globally to all routes
app.use(corsMiddleware);

// Parse JSON request bodies
app.use(express.json());

// Example route to test CORS
app.get('/api/public', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint is accessible from other origins',
    timestamp: new Date().toISOString(),
  });
});

// Example route with POST
app.post('/api/data', (req, res) => {
  const data = req.body;
  res.json({
    success: true,
    message: 'Data received successfully',
    received: data,
  });
});

// Example of applying CORS middleware to specific routes only
// Uncomment to use route-specific CORS instead of global
/*
app.get('/api/specific', corsMiddleware, (req, res) => {
  res.json({ message: 'CORS enabled only for this route' });
});
*/

// Example of a custom CORS factory function for route-specific configurations
const createCorsMiddleware = (options = {}) => {
  const {
    origins = ['*'],
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400,
  } = options;

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (origins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (requestOrigin && origins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Vary', 'Origin');
    }

    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
    res.setHeader('Access-Control-Max-Age', maxAge.toString());

    if (credentials && !origins.includes('*')) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    next();
  };
};

// Example: Use the factory for a route with restricted CORS settings
app.use(
  '/api/restricted',
  createCorsMiddleware({
    origins: ['https://trusted-partner.com'],
    methods: ['GET', 'POST'],
    headers: ['Content-Type', 'Authorization', 'X-API-Key'],
    credentials: true,
  })
);

app.get('/api/restricted/data', (req, res) => {
  res.json({
    success: true,
    message: 'This endpoint has restricted CORS settings',
  });
});

// Handle 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS enabled - Allow all origins: ${process.env.CORS_ALLOW_ALL === 'true'}`);
});

module.exports = { app, corsMiddleware, createCorsMiddleware };