const express = require('express');

const app = express();

// Explicit whitelist of trusted origins
const ALLOWED_ORIGINS = [
  'https://app.example.com',
  'https://admin.example.com',
  'https://partner.example.com',
];

// Allowed HTTP methods
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

// Allowed headers
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
];

// Headers that the browser is allowed to access
const EXPOSED_HEADERS = ['Content-Length', 'X-Request-Id'];

// How long preflight results can be cached (in seconds)
const MAX_AGE = 86400; // 24 hours

/**
 * Strict CORS middleware that validates the Origin header against a whitelist.
 * Never uses wildcard '*' with credentials. Always sets Vary: Origin.
 */
function strictCorsMiddleware(req, res, next) {
  const requestOrigin = req.headers['origin'];

  // Always set Vary: Origin so that caches handle different origins correctly
  res.setHeader('Vary', 'Origin');

  // If no Origin header is present (e.g., same-origin request or non-browser client),
  // skip CORS header injection but continue processing
  if (!requestOrigin) {
    return next();
  }

  // Validate the origin against the whitelist
  const isAllowed = ALLOWED_ORIGINS.includes(requestOrigin);

  if (!isAllowed) {
    // Origin is not in the whitelist — reject with a clear error
    return res.status(403).json({
      error: 'CORS policy: Origin not allowed',
      origin: requestOrigin,
    });
  }

  // Origin is trusted — set the specific origin (never '*' when credentials are involved)
  res.setHeader('Access-Control-Allow-Origin', requestOrigin);

  // Allow credentials (cookies, authorization headers, TLS client certificates)
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Expose specific response headers to the browser
  res.setHeader('Access-Control-Expose-Headers', EXPOSED_HEADERS.join(', '));

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    res.setHeader('Access-Control-Max-Age', String(MAX_AGE));

    // Respond to preflight with 204 No Content
    return res.status(204).end();
  }

  // For actual requests, validate that the method is allowed
  if (!ALLOWED_METHODS.includes(req.method)) {
    return res.status(405).json({
      error: `Method ${req.method} not allowed`,
    });
  }

  next();
}

// Apply the CORS middleware globally before all routes
app.use(strictCorsMiddleware);

// Parse JSON bodies
app.use(express.json());

// -------------------------
// Example routes
// -------------------------

app.get('/api/public', (req, res) => {
  res.json({ message: 'Public data accessible from whitelisted origins' });
});

app.get('/api/protected', (req, res) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ message: 'Protected resource', user: 'authenticated' });
});

app.post('/api/data', (req, res) => {
  const { payload } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Missing payload' });
  }
  res.status(201).json({ received: payload });
});

// -------------------------
// Health check (no CORS needed but middleware still runs harmlessly)
// -------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// -------------------------
// 404 fallback
// -------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -------------------------
// Global error handler
// -------------------------
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// -------------------------
// Start server
// -------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
});

module.exports = app; // Export for testing