const express = require('express');

/**
 * Middleware that adds common HTTP security and informational headers
 * to every response.
 */
function commonHeaders(options = {}) {
  const {
    poweredBy = 'Express App',
    frameOptions = 'DENY',
    contentTypeOptions = 'nosniff',
    xssProtection = '1; mode=block',
    referrerPolicy = 'strict-origin-when-cross-origin',
    hstsMaxAge = 31536000, // 1 year
    hstsIncludeSubDomains = true,
    hstsPreload = false,
    contentSecurityPolicy = "default-src 'self'",
    permissionsPolicy = 'geolocation=(), microphone=(), camera=()',
    cacheControl = 'no-store',
    enableHsts = true,
  } = options;

  return function (req, res, next) {
    // Remove the default Express fingerprint header
    res.removeHeader('X-Powered-By');

    // Custom powered-by header (informational)
    if (poweredBy) {
      res.setHeader('X-Powered-By', poweredBy);
    }

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', frameOptions);

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', contentTypeOptions);

    // Legacy XSS protection for older browsers
    res.setHeader('X-XSS-Protection', xssProtection);

    // Control referrer information
    res.setHeader('Referrer-Policy', referrerPolicy);

    // Content Security Policy
    if (contentSecurityPolicy) {
      res.setHeader('Content-Security-Policy', contentSecurityPolicy);
    }

    // Permissions Policy
    if (permissionsPolicy) {
      res.setHeader('Permissions-Policy', permissionsPolicy);
    }

    // HTTP Strict Transport Security (only over HTTPS)
    if (enableHsts && (req.secure || req.headers['x-forwarded-proto'] === 'https')) {
      let hsts = `max-age=${hstsMaxAge}`;
      if (hstsIncludeSubDomains) hsts += '; includeSubDomains';
      if (hstsPreload) hsts += '; preload';
      res.setHeader('Strict-Transport-Security', hsts);
    }

    // Cache control
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    // Cross-origin isolation headers
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
}

module.exports = commonHeaders;

// Example usage:
// const app = express();
// app.use(commonHeaders());
// app.use(commonHeaders({ poweredBy: 'MyService', hstsPreload: true }));