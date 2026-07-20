```javascript
const express = require('express');
const crypto = require('crypto');

/**
 * Middleware that adds common security and informational HTTP headers to every response.
 */
function commonHeadersMiddleware(options = {}) {
  const {
    contentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    allowedOrigins = [],
    cacheControl = 'no-store',
    serverName = false,
    enableHSTS = true,
    hstsMaxAge = 31536000,
    enableCSP = true,
    enableCORS = false,
    corsOrigin = '*',
    corsMethods = 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    corsHeaders = 'Content-Type, Authorization, X-Requested-With',
    enableExpectCT = true,
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  } = options;

  return function (req, res, next) {
    // Generate a unique request ID for traceability
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    // ─── Security Headers ─────────────────────────────────────────────────────

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Control referrer information
    res.setHeader('Referrer-Policy', referrerPolicy);

    // Permissions / Feature Policy
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // HTTP Strict Transport Security (HSTS)
    if (enableHSTS) {
      res.setHeader(
        'Strict-Transport-Security',
        `max-age=${hstsMaxAge}; includeSubDomains; preload`
      );
    }

    // Content Security Policy (CSP)
    if (enableCSP) {
      res.setHeader('Content-Security-Policy', contentSecurityPolicy);
    }

    // Expect-CT (Certificate Transparency)
    if (enableExpectCT) {
      res.setHeader('Expect-CT', `max-age=${hstsMaxAge}, enforce`);
    }

    // DNS prefetch control
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    // Disable IE compatibility mode
    res.setHeader('X-UA-Compatible', 'IE=edge');

    // ─── CORS Headers ─────────────────────────────────────────────────────────

    if (enableCORS) {
      const origin = req.headers.origin;

      if (allowedOrigins.length > 0) {
        if (origin && allowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Vary', 'Origin');
        }
      } else {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
      }

      res.setHeader('Access-Control-Allow-Methods', corsMethods);
      res.setHeader('Access-Control-Allow-Headers', corsHeaders);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours preflight cache

      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        res.setHeader('Content-Length', '0');
        return res.status(204).end();
      }
    }

    // ─── Cache Headers ────────────────────────────────────────────────────────

    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // ─── Informational Headers ────────────────────────────────────────────────

    // Request ID for tracing / debugging
    res.setHeader('X-Request-Id', requestId);

    // Timestamp of the response
    res.setHeader('X-Response-Time-Start', Date.now().toString());

    // API Version (customize as needed)
    res.setHeader('X-API-Version', process.env.API_VERSION || '1.0.0');

    // Remove or mask the server header to avoid exposing technology stack
    if (serverName) {
      res.setHeader('Server', serverName);
    } else {
      res.removeHeader('Server');
      res.removeHeader('X-Powered-By');
    }

    // ─── Intercept response finish to compute elapsed time ────────────────────

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startTime) / 1e6;
      // Note: headers cannot be set after finish, but we log for observability
      if (process.env.NODE_ENV !== 'test') {
        console.log(
          JSON.stringify({
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            elapsedMs: elapsedMs.toFixed(3),
            userAgent: req.headers['user-agent'] || 'unknown',
            ip: req.ip,
          })
        );
      }
    });

    next();
  };
}

// ─── Demo Express Application ─────────────────────────────────────────────────

const app = express();

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply the common headers middleware globally
app.use(
  commonHeadersMiddleware({
    enableCORS: true,
    allowedOrigins: [], // Empty = allow all origins when enableCORS is true
    corsOrigin: '*',
    cacheControl: 'no-store, no-cache, must-revalidate',
    enableHSTS: true,
    hstsMaxAge: 31536000,
    enableCSP: true,
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';",
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy:
      'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    serverName: false, // Set to a string like 'MyApp' to customize, false to remove
  })
);

// ─── Example Routes ───────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    message: 'Hello! Common HTTP headers have been applied to this response.',
    requestId: req.requestId,
    headers: {
      'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
      'X-Frame-Options': res.getHeader('X-Frame-Options'),
      'X-XSS-Protection': res.getHeader('X-XSS-Protection'),
      'Referrer-Policy': res.getHeader('Referrer-Policy'),
      'Strict-Transport-Security': res.getHeader('Strict-Transport-Security'),
      'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
      'Cache-Control': res.getHeader('Cache-Control'),
      'X-Request-Id': res.getHeader('X-Request-Id'),
      'X-API-Version': res.getHeader('X-