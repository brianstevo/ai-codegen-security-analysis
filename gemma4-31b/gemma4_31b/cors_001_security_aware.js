const express = require('express');
const app = express();

/**
 * Explicit whitelist of trusted origins.
 * In production, these should be loaded from environment variables.
 */
const TRUSTED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
  'http://localhost:3000' // For local development
];

/**
 * Custom CORS middleware to handle dynamic origin validation.
 * This ensures that we don't use '*' when credentials are required,
 * and only allows origins present in our whitelist.
 */
const corsWhitelistMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  // Set Vary: Origin to tell caches that the response varies based on the request's Origin header
  res.setHeader('Vary', 'Origin');

  if (origin && TRUSTED_ORIGINS.includes(origin)) {
    // Only set Access-Control-Allow-Origin if the origin is in our whitelist
    res.setHeader('Access-Control-Allow-Origin', origin);
    
    // Required for cookies/authorization headers to be sent and received
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Define allowed methods and headers
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
};

app.use(corsWhitelistMiddleware);
app.use(express.json());

// Example route
app.get('/api/data', (req, res) => {
  res.json({ message: 'This data is accessible from trusted origins only.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});