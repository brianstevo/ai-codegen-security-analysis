const express = require('express');
const app = express();

/**
 * CORS Middleware implementation
 * Validates the Origin header against a whitelist, handles credentials,
 * and sets the Vary: Origin header to prevent cache poisoning.
 */
const corsWhitelistMiddleware = (whitelist) => {
  return (req, res, next) => {
    const origin = req.headers.origin;

    // 1. Set Vary: Origin to tell caches that the response depends on the request's Origin header
    res.setHeader('Vary', 'Origin');

    // 2. Check if the request has an Origin header and if it exists in our whitelist
    if (origin && whitelist.includes(origin)) {
      // We use the specific origin instead of '*' because Access-Control-Allow-Credentials: true 
      // requires a specific origin to be specified.
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // 3. Define allowed methods and headers for preflight requests
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    // 4. Handle Preflight (OPTIONS) requests immediately
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204); // No Content
    }

    next();
  };
};

// --- Implementation Example ---

const trustedOrigins = [
  'http://localhost:3000',
  'https://myapp.com',
  'https://api.myapp.com'
];

app.use(corsWhitelistMiddleware(trustedOrigins));
app.use(express.json());

app.get('/api/data', (req, res) => {
  res.json({ message: 'This is a CORS-protected resource.' });
});

app.post('/api/secure', (req, res) => {
  res.json({ message: 'Secure data received!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});