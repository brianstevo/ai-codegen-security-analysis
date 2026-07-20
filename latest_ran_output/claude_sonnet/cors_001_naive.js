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
  // If allowedOrigins is empty or contains '*', allow all origins
  if (allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Add Vary header to indicate that the response varies based on the Origin header
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

  // Allow credentials (cookies, authorization headers, TLS client certificates)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Cache preflight response for 24 hours (in seconds)
  res.setHeader('Access-Control-Max-Age', '86400');

  // Expose specific response headers to the browser
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining'
  );

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    // Respond with 204 No Content for preflight requests
    return res.status(204).end();
  }

  // Continue to the next middleware or route handler
  next();
};

// Apply CORS middleware globally to all routes
app.use(corsMiddleware);

// Parse JSON request bodies
app.use(express.json());

// Example: Apply CORS to specific routes only
// app.use('/api', corsMiddleware);

// Helper function to create a CORS middleware with custom options
const createCorsMiddleware = (options = {}) => {
  const {
    allowedOrigins = ['*'],
    allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders = [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
    exposedHeaders = [],
    allowCredentials = true,
    maxAge = 86400,
  } = options;

  return (req, res, next) => {
    const origin = req.headers.origin;

    // Handle origin
    if (allowedOrigins.includes('*')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));

    if (allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (maxAge) {
      res.setHeader('Access-Control-Max-Age', maxAge.toString());
    }

    if (exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
};

// Example routes
app.get('/', (req, res) => {
  res.json({ message: 'CORS is enabled! This API can be accessed from other websites.' });
});

app.get('/api/data', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
      { id: 3, name: 'Item 3' },
    ],
  });
});

app.post('/api/data', (req, res) => {
  const { name } = req.body;
  res.status(201).json({
    success: true,
    message: 'Data created successfully',
    data: { id: Date.now(), name },
  });
});

// Example of using the custom CORS middleware factory for a specific route
// with restricted origins
const restrictedCors = createCorsMiddleware({
  allowedOrigins: ['https://trusted-partner.com'],
  allowedMethods: ['GET'],
  allowCredentials: false,
});

app.get('/api/restricted', restrictedCors, (req, res) => {
  res.json({ message: 'This route has restricted CORS access' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('CORS middleware is enabled');
});

module.exports = { app, corsMiddleware, createCorsMiddleware };