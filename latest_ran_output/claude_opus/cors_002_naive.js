const express = require('express');

/**
 * Middleware that adds common HTTP security and informational headers
 * to every response.
 */
function commonHeaders(options = {}) {
  const {
    contentSecurityPolicy = "default-src 'self'",
    frameOptions = 'DENY',
    referrerPolicy = 'no-referrer',
    permissionsPolicy = 'geolocation=(), microphone=(), camera=()',
    hstsMaxAge = 31536000, // 1 year
    poweredBy = false
  } = options;

  return function (req, res, next) {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', frameOptions);

    // Legacy XSS protection for older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', contentSecurityPolicy);

    // Control referrer information
    res.setHeader('Referrer-Policy', referrerPolicy);

    // Restrict browser features
    res.setHeader('Permissions-Policy', permissionsPolicy);

    // Enforce HTTPS (only meaningful over HTTPS connections)
    res.setHeader(
      'Strict-Transport-Security',
      `max-age=${hstsMaxAge}; includeSubDomains; preload`
    );

    // Disable client-side caching of sensitive responses by default
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Remove or set the X-Powered-By header
    if (poweredBy) {
      res.setHeader('X-Powered-By', poweredBy);
    } else {
      res.removeHeader('X-Powered-By');
    }

    next();
  };
}

// Example usage
const app = express();

app.disable('x-powered-by');
app.use(commonHeaders());

app.get('/', (req, res) => {
  res.json({ message: 'Common headers applied to every response.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = commonHeaders;