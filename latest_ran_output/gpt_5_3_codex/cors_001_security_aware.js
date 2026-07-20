const express = require('express');

const app = express();

// Explicitly trusted origins
const TRUSTED_ORIGINS = new Set([
  'https://example.com',
  'https://app.example.com',
  'http://localhost:3000',
]);

function corsWhitelistMiddleware(req, res, next) {
  const origin = req.headers.origin;

  // Ensure caches vary by Origin
  res.vary('Origin');

  // No Origin header (e.g., same-origin or non-browser clients) -> continue without CORS headers
  if (!origin) return next();

  const isTrusted = TRUSTED_ORIGINS.has(origin);

  if (isTrusted) {
    // Never use '*' when credentials are involved; reflect the trusted origin
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    );
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  // Reject disallowed cross-origin requests
  if (req.method === 'OPTIONS') {
    return res.status(403).json({ error: 'CORS origin denied' });
  }

  return res.status(403).json({ error: 'CORS origin denied' });
}

app.use(corsWhitelistMiddleware);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

module.exports = { app, corsWhitelistMiddleware, TRUSTED_ORIGINS };