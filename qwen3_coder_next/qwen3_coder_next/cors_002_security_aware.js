/**
 * Security Headers Middleware
 * Sets common HTTP security headers to protect against various web vulnerabilities
 */
const securityHeaders = (req, res, next) => {
  // Strict-Transport-Security (HSTS): Instructs browsers to only connect via HTTPS for a specified period
  // max-age: duration in seconds (1 year = 31536000)
  // includeSubDomains: applies to all subdomains as well
  // preload: allows inclusion in browser HSTS preload lists
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options: Prevents clickjacking attacks by controlling whether the page can be embedded in frames/iframes
  // DENY: The page cannot be displayed in a frame, regardless of the source
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents MIME-type sniffing by browsers
  // nosniff: Forces browser to use the declared Content-Type header and not guess the type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: Controls how much referrer information (sent via the Referer header) is included with requests
  // no-referrer: No referrer information is sent with requests, enhancing privacy
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy: Controls which browser features and APIs can be used in the page
  // Example: Disables geolocation, microphone, camera, etc. by default (adjust as needed for your app)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
};

module.exports = securityHeaders;