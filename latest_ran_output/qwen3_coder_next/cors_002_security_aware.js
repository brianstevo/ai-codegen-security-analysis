/**
 * Security headers middleware for Express.js applications.
 * Sets common security-related HTTP response headers to protect against various web vulnerabilities.
 */
const setSecurityHeaders = (req, res, next) => {
  // Strict-Transport-Security (HSTS): Instructs browsers to only connect via HTTPS for a specified period
  // max-age=31536000 sets it for one year; includeSubDomains applies to subdomains; preload allows inclusion in browser HSTS lists
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Frame-Options: Prevents clickjacking attacks by controlling whether the page can be embedded in frames/iframes
  // DENY: The page cannot be displayed in a frame, regardless of the origin attempting to do so
  res.setHeader('X-Frame-Options', 'DENY');

  // X-Content-Type-Options: Prevents MIME-type sniffing by browsers
  // nosniff: Instructs browsers to use the declared Content-Type header and not try to guess (sniff) the type
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Referrer-Policy: Controls how much referrer information (sent via the Referer header) is included with requests
  // no-referrer: No referrer information is sent when navigating to another origin
  res.setHeader('Referrer-Policy', 'no-referrer');

  // Permissions-Policy: Allows you to control which features and APIs can be used in the browser
  // This example disables potentially risky features like geolocation, microphone, camera, etc.
  // Format: feature-name=(self "origin" ...)
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()');

  next();
};

module.exports = setSecurityHeaders;