```javascript
const express = require('express');
const crypto = require('crypto');

/**
 * Middleware to add common security and informational HTTP headers to every response.
 */
function commonHeaders(options = {}) {
  const {
    poweredBy = false,
    customPoweredBy = null,
    cacheControl = 'no-store, no-cache, must-revalidate, proxy-revalidate',
    contentSecurityPolicy = "default-src 'self'",
    referrerPolicy = 'strict-origin-when-cross-origin',
    frameOptions = 'DENY',
    xssProtection = '1; mode=block',
    contentTypeOptions = 'nosniff',
    strictTransportSecurity = 'max-age=31536000; includeSubDomains',
    permissionsPolicy = 'geolocation=(), microphone=(), camera=()',
    corsOrigin = null,
    corsMethods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    corsHeaders = 'Content-Type, Authorization, X-Requested-With',
    corsCredentials = false,
    addRequestId = true,
    addTimestamp = true,
    addNonce = false,
  } = options;

  return function (req, res, next) {
    // ─── Request ID ──────────────────────────────────────────────────────────
    if (addRequestId) {
      const requestId = req.headers['x-request-id'] || crypto.randomUUID();
      req.requestId = requestId;
      res.setHeader('X-Request-Id', requestId);
    }

    // ─── Timestamp ───────────────────────────────────────────────────────────
    if (addTimestamp) {
      res.setHeader('X-Response-Time-Start', Date.now().toString());
    }

    // ─── Nonce ───────────────────────────────────────────────────────────────
    if (addNonce) {
      const nonce = crypto.randomBytes(16).toString('base64');
      req.nonce = nonce;
      res.setHeader('X-Nonce', nonce);
    }

    // ─── Remove / Replace X-Powered-By ───────────────────────────────────────
    if (!poweredBy) {
      res.removeHeader('X-Powered-By');
    } else if (customPoweredBy) {
      res.setHeader('X-Powered-By', customPoweredBy);
    }

    // ─── Cache Control ───────────────────────────────────────────────────────
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // ─── Content Security Policy ─────────────────────────────────────────────
    if (contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', contentSecurityPolicy);
    }

    // ─── Referrer Policy ─────────────────────────────────────────────────────
    if (referrerPolicy) {
      res.setHeader('Referrer-Policy', referrerPolicy);
    }

    // ─── Clickjacking Protection ─────────────────────────────────────────────
    if (frameOptions) {
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // ─── XSS Protection ──────────────────────────────────────────────────────
    if (xssProtection) {
      res.setHeader('X-XSS-Protection', xssProtection);
    }

    // ─── MIME Sniffing Prevention ─────────────────────────────────────────────
    if (contentTypeOptions) {
      res.setHeader('X-Content-Type-Options', contentTypeOptions);
    }

    // ─── HSTS ────────────────────────────────────────────────────────────────
    if (strictTransportSecurity) {
      res.setHeader('Strict-Transport-Security', strictTransportSecurity);
    }

    // ─── Permissions Policy ───────────────────────────────────────────────────
    if (permissionsPolicy) {
      res.setHeader('Permissions-Policy', permissionsPolicy);
    }

    // ─── CORS ────────────────────────────────────────────────────────────────
    if (corsOrigin) {
      const origin = req.headers.origin;

      if (Array.isArray(corsOrigin)) {
        if (corsOrigin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
        }
      } else if (corsOrigin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Vary', 'Origin');
      }

      res.setHeader('Access-Control-Allow-Methods', corsMethods);
      res.setHeader('Access-Control-Allow-Headers', corsHeaders);

      if (corsCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.setHeader('Access-Control-Max-Age', '86400');

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    }

    // ─── Response Time ────────────────────────────────────────────────────────
    if (addTimestamp) {
      const startTime = process.hrtime();

      res.on('finish', () => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
        // Note: setting headers after finish is for logging only;
        // actual header already sent. Log it instead.
        if (process.env.NODE_ENV !== 'test') {
          console.log(
            `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} - ${durationMs}ms ` +
            `[ReqId: ${req.requestId || 'N/A'}]`
          );
        }
      });
    }

    next();
  };
}

// ─── Demo App ────────────────────────────────────────────────────────────────

const app = express();

app.use(express.json());

// Apply common headers middleware with custom options
app.use(
  commonHeaders({
    poweredBy: false,
    cacheControl: 'no-store, no-cache, must-revalidate, proxy-revalidate',
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:",
    referrerPolicy: 'strict-origin-when-cross-origin',
    frameOptions: 'SAMEORIGIN',
    xssProtection: '1; mode=block',
    contentTypeOptions: 'nosniff',
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    permissionsPolicy: 'geolocation=(), microphone=(), camera=()',
    corsOrigin: ['http://localhost:3000', 'https://yourdomain.com'],
    corsMethods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    corsHeaders: 'Content-Type, Authorization, X-Requested-With',
    corsCredentials: true,
    addRequestId: true,
    addTimestamp: true,
    addNonce: true,
  })
);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: 'Hello, World!',